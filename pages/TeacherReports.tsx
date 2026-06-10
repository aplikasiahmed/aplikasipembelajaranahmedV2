import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Download, 
  FileText, 
  Trash2, 
  ArrowLeft, 
  Database, 
  FileDown, 
  ShieldAlert, 
  Upload,
  Info,
  FileUp,
  AlertTriangle,
  Files,
  Filter,
  RefreshCw
} from 'lucide-react';
import { db } from '../services/supabaseMock';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';

// Import Utils
import { generateExcel, generateBatchExcel } from '../utils/excelGenerator';
import { generatePDFReport, generateBatchPDFReport } from '../utils/pdfGenerator';
import { formatBulan } from '../utils/format';

const TeacherReports: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [availKelas, setAvailKelas] = useState<string[]>([]);
  
  // States Konfigurasi NILAI
  const [kelasNilai, setKelasNilai] = useState('');
  const [semNilai, setSemNilai] = useState('');
  const [tipeNilai, setTipeNilai] = useState(''); // Filter Jenis Tugas

  // States Konfigurasi ABSENSI
  const [kelasAbsen, setKelasAbsen] = useState('');
  const [semAbsen, setSemAbsen] = useState('');
  const [monthAbsen, setMonthAbsen] = useState(''); // Dari Bulan
  const [monthAbsenEnd, setMonthAbsenEnd] = useState(''); // Sampai Bulan
  const [yearAbsen, setYearAbsen] = useState(new Date().getFullYear().toString());

  const [appsScriptUrl, setAppsScriptUrl] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchAllKelas();
    db.getAppsScriptUrl().then(url => setAppsScriptUrl(url));
  }, []);

  const handleSyncFromSheets = async () => {
    Swal.fire({
      title: 'Konfirmasi Tarik Data',
      text: 'Yakin anda ingin menambahkan/sinkronisasi data siswa dari Google Sheets?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ya, Tarik Data',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#059669',
      cancelButtonColor: '#64748b',
      heightAuto: false
    }).then(async (result) => {
      if (!result.isConfirmed) return;

      setSyncing(true);
      Swal.fire({
        title: 'Menarik data...',
        text: 'Sedang mengimpor data terbaru dari Google Sheets...',
        didOpen: () => Swal.showLoading(),
        allowOutsideClick: false,
        heightAuto: false
      });
      try {
        await db.syncFromGoogleSheets();
        Swal.close();
        setTimeout(() => {
          Swal.fire({
            icon: 'success',
            title: 'Berhasil Tarik Data!',
            text: 'Data siswa dan tabel pendukung telah berhasil ditarik dari spreadsheet.',
            timer: 2000,
            showConfirmButton: false,
            heightAuto: false
          });
        }, 150);
        fetchAllKelas();
      } catch (e: any) {
        console.error(e);
        Swal.close();
        setTimeout(() => {
          Swal.fire({
            icon: 'error',
            title: 'Gagal Tarik Data',
            text: 'Terjadi kesalahan saat menghubungi Google Sheets. Silakan periksa koneksi atau URL Apps Script Anda.',
            confirmButtonColor: '#dc2626',
            heightAuto: false
          });
        }, 150);
      } finally {
        setSyncing(false);
      }
    });
  };

  // Auto-set Semester Absensi berdasarkan Bulan Awal
  useEffect(() => {
    if (!monthAbsen) {
      setSemAbsen('');
      return;
    }
    const m = parseInt(monthAbsen);
    if (m >= 7 && m <= 12) {
      setSemAbsen('1');
    } else {
      setSemAbsen('2');
    }
  }, [monthAbsen]);

  const fetchAllKelas = async () => {
    try {
        const unique = await db.getAvailableKelas();
        setAvailKelas(unique);
    } catch (e) {
        console.error("Gagal mengambil data kelas", e);
    }
  };

  // --- HELPER: TRANSFORM DATA NILAI KE PIVOT (KOLOM DINAMIS & LOGIKA HIDE) ---
  const transformGradesToPivot = (data: any[]) => {
      // 0. Sort data secara Kronologis (Terlama ke Terbaru) agar H-1, TO-1 adalah yang pertama
      data.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      // 1. Grouping by Student
      const studentsMap = new Map<string, any>();
      
      // Flags global untuk mendeteksi ketersediaan data dalam 1 kelas
      let maxHarianCount = 0;
      let maxTOCount = 0; // NEW: Hitung jumlah maksimal TO
      let existUTS = false;
      let existUAS = false;
      let existPraktik = false;

      data.forEach(item => {
          const sid = item.student_id;
          if (!studentsMap.has(sid)) {
              studentsMap.set(sid, {
                  nis: item.data_siswa?.nis || '-',
                  nama: item.data_siswa?.namalengkap || 'Siswa',
                  harian: [],
                  uts: null,
                  uas: null,
                  praktik: null,
                  to: [] // NEW: Ubah TO menjadi array untuk menampung banyak nilai
              });
          }

          const s = studentsMap.get(sid);
          const type = item.subject_type ? item.subject_type.toLowerCase().trim() : '';

          if (type === 'harian' || type === 'uh') {
              s.harian.push(item.score);
              if (s.harian.length > maxHarianCount) maxHarianCount = s.harian.length;
          } else if (type === 'uts' || type === 'pts') {
              s.uts = item.score;
              existUTS = true;
          } else if (type === 'uas' || type === 'pas') {
              s.uas = item.score;
              existUAS = true;
          } else if (type === 'pts') {
              s.praktik = item.score;
              existPraktik = true;
          } else if (type === 'tugas online' || type === 'ujian online') {
              // REVISI: Masukkan ke array TO
              s.to.push(item.score);
              if (s.to.length > maxTOCount) maxTOCount = s.to.length;
          }
      });

      // 2. Build Final Array
      const result = Array.from(studentsMap.values()).map((s, idx) => {
          // Hitung Rata-rata
          let totalScore = 0;
          let count = 0;
          
          s.harian.forEach((h: number) => { totalScore += h; count++; });
          
          // Hitung Rata-rata dari Array TO juga
          s.to.forEach((t: number) => { totalScore += t; count++; });
          
          if (s.praktik !== null) { totalScore += s.praktik; count++; }
          if (s.uts !== null) { totalScore += s.uts; count++; }
          if (s.uas !== null) { totalScore += s.uas; count++; }

          const average = count > 0 ? (totalScore / count).toFixed(1) : '0';

          // Base Object
          const row: any = {
              'NO': idx + 1,
              'NIS': s.nis,
              'NAMA SISWA': s.nama
          };

          // Dynamic Harian Columns 'H-1'
          for (let i = 0; i < maxHarianCount; i++) {
              row[`H-${i + 1}`] = s.harian[i] !== undefined ? s.harian[i] : '';
          }

          // REVISI: Dynamic TO Columns (TO-1, TO-2, dst)
          if (maxTOCount === 1) {
              // Jika cuma ada 1 TO di seluruh kelas, namakan 'TO' saja agar simpel (opsional, bisa juga TO-1)
              row['TO'] = s.to[0] !== undefined ? s.to[0] : '';
          } else if (maxTOCount > 1) {
              // Jika lebih dari 1, buat TO-1, TO-2, dst
              for (let i = 0; i < maxTOCount; i++) {
                  row[`TO-${i + 1}`] = s.to[i] !== undefined ? s.to[i] : '';
              }
          }

          // Column Lain
          if (existPraktik) row['PRAKTIK'] = s.praktik !== null ? s.praktik : '';
          if (existUTS) row['PTS'] = s.uts !== null ? s.uts : '';
          if (existUAS) row['PAS'] = s.uas !== null ? s.uas : '';
          
          // REVISI FINAL: Ganti 'RATA-RATA' menjadi 'RATA2'
          row['RATA2'] = average;

          return row;
      });

      // 3. SORTING ABJAD (A-Z)
      return result.sort((a: any, b: any) => a['NAMA SISWA'].localeCompare(b['NAMA SISWA']));
  };

  // --- SINGLE EXPORT (PER KELAS) ---
  const handleExport = async (type: 'pdf' | 'excel', category: 'nilai' | 'absensi') => {
    if (category === 'nilai') {
        if (!kelasNilai || !semNilai) {
            Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Pilih Kelas dan Semester!', heightAuto: false });
            return;
        }
    } else {
        if (!kelasAbsen || !monthAbsen || !semAbsen) {
            Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Pilih Kelas, Bulan, dan Semester!', heightAuto: false });
            return;
        }
    }

    const targetKelas = category === 'nilai' ? kelasNilai : kelasAbsen;
    const targetSem = category === 'nilai' ? semNilai : semAbsen;
    
    Swal.fire({ title: 'Memproses...', didOpen: () => Swal.showLoading(), heightAuto: false, allowOutsideClick: false });

    try {
      if (category === 'nilai') {
        // Ambil Raw Data
        let rawData = await db.getGradesByKelas(targetKelas, targetSem);
        
        // Filter by Tipe Nilai (Jika user memilih filter, walau defaultnya Semua)
        if (tipeNilai) {
            rawData = rawData.filter(item => item.subject_type === tipeNilai);
        }

        if (!rawData || rawData.length === 0) {
          Swal.close();
          setTimeout(() => {
            Swal.fire({
              icon: 'info',
              title: 'Kosong',
              text: `Data nilai Semester ${targetSem} belum tersedia.`,
              heightAuto: false
            });
          }, 150);
          return;
        }

        // TRANSFORM DATA MENJADI PIVOT (KOLOM DINAMIS)
        const pivotedData = transformGradesToPivot(rawData);
        // RE-NUMBERING 'NO' AFTER SORTING
        pivotedData.forEach((row: any, index: number) => { row['NO'] = index + 1; });

        const titleLabel = 'LAPORAN NILAI SISWA';

        if (type === 'excel') {
          generateExcel(
            pivotedData, 
            `Laporan_Nilai_${targetKelas}`, 
            targetKelas, 
            {
              title: titleLabel,
              kelas: targetKelas,
              semester: targetSem === '1' ? '1 (Ganjil)' : '2 (Genap)',
              type: 'nilai' // Menandakan ini laporan nilai untuk memunculkan keterangan H, TO, dll
            }
          );
          Swal.close();
        } else {
          generatePDFReport('nilai', pivotedData, { 
              kelas: targetKelas, 
              semester: targetSem === '1' ? '1 (Ganjil)' : '2 (Genap)' 
          });
          Swal.close();
        }
      } else {
        // ABSENSI SINGLE (LOGIKA LAMA TETAP DIPERTAHANKAN)
        const students = await db.getStudentsByKelas(targetKelas);
        const attendance = await db.getAttendanceByKelas(targetKelas, targetSem, monthAbsen, yearAbsen);

        if (!attendance || attendance.length === 0) {
          Swal.close();
          setTimeout(() => {
            Swal.fire({
              icon: 'info',
              title: 'Kosong',
              text: 'Data absensi bulan ini belum tersedia.',
              heightAuto: false
            });
          }, 150);
          return;
        }

        // Sorting Siswa A-Z untuk Absensi
        students.sort((a, b) => a.namalengkap.localeCompare(b.namalengkap));

        const aggregated = students.map((s, idx) => {
          const sRecs = attendance.filter(a => a.student_id === s.id);
          return {
            'NO': idx + 1,
            'NIS': s.nis,
            'NAMA SISWA': s.namalengkap,
            'H': sRecs.filter(r => r.status?.toLowerCase() === 'hadir').length,
            'S': sRecs.filter(r => r.status?.toLowerCase() === 'sakit').length,
            'I': sRecs.filter(r => r.status?.toLowerCase() === 'izin').length,
            'A': sRecs.filter(r => r.status?.toLowerCase() === 'alfa').length
          };
        });

        if (type === 'excel') {
          generateExcel(
            aggregated, 
            `Rekap_Absen_${targetKelas}_${monthAbsen}`, 
            targetKelas, 
            {
              title: 'REKAPITULASI ABSENSI SISWA',
              kelas: targetKelas,
              semester: targetSem === '1' ? '1 (Ganjil)' : '2 (Genap)',
              bulan: formatBulan(monthAbsen),
              tahun: yearAbsen
            }
          );
          Swal.close();
        } else {
          generatePDFReport('absensi', aggregated, { 
            kelas: targetKelas, 
            semester: targetSem === '1' ? '1 (Ganjil)' : '2 (Genap)',
            bulan: formatBulan(monthAbsen),
            tahun: yearAbsen
          });
          Swal.close();
        }
      }
    } catch (err) {
      console.error(err);
      Swal.close();
      setTimeout(() => {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Gagal memproses laporan.',
          heightAuto: false
        });
      }, 150);
    }
  };

  // --- BATCH EXPORT (SEMUA KELAS) ---
  const handleExportAll = async (type: 'pdf' | 'excel', category: 'nilai' | 'absensi') => {
    // Validasi
    if (category === 'nilai' && !semNilai) {
        Swal.fire({ icon: 'warning', title: 'Pilih Semester', text: 'Pilih semester terlebih dahulu!', heightAuto: false });
        return;
    }
    if (category === 'absensi') {
        if (!monthAbsen) {
             Swal.fire({ icon: 'warning', title: 'Pilih Bulan', text: 'Pilih bulan awal terlebih dahulu!', heightAuto: false });
             return;
        }
        if (!semAbsen) {
             Swal.fire({ icon: 'warning', title: 'Pilih Semester', text: 'Pilih semester terlebih dahulu!', heightAuto: false });
             return;
        }
    }

    const targetSem = category === 'nilai' ? semNilai : semAbsen;
    const targetSemLabel = targetSem === '1' ? '1 (Ganjil)' : '2 (Genap)';

    Swal.fire({
        title: `Download Semua Data (${availKelas.length} Kelas)`,
        text: 'Proses ini mungkin memakan waktu...',
        didOpen: () => Swal.showLoading(),
        heightAuto: false,
        allowOutsideClick: false
    });

    try {
        const batchData: any[] = [];

        // Loop semua kelas
        for (const kelas of availKelas) {
            if (category === 'nilai') {
                let rawData = await db.getGradesByKelas(kelas, targetSem);
                
                if (tipeNilai) {
                    rawData = rawData.filter(item => item.subject_type === tipeNilai);
                }

                if (rawData && rawData.length > 0) {
                    // TRANSFORM PIVOT UNTUK BATCH JUGA (Sorting sudah include)
                    const pivotedData = transformGradesToPivot(rawData);
                    // Re-numbering
                    pivotedData.forEach((row: any, index: number) => { row['NO'] = index + 1; });
                    
                    batchData.push({
                        data: pivotedData,
                        sheetName: kelas,
                        meta: {
                            title: 'LAPORAN NILAI SISWA',
                            kelas: kelas,
                            semester: targetSemLabel,
                            type: 'nilai'
                        }
                    });
                }
            } else {
                // Absensi Batch
                const students = await db.getStudentsByKelas(kelas);
                students.sort((a, b) => a.namalengkap.localeCompare(b.namalengkap)); // Sort Siswa Batch

                let attendance = await db.getAttendanceByKelas(kelas, targetSem, undefined, yearAbsen);
                
                if (monthAbsen) {
                    const startM = parseInt(monthAbsen);
                    const endM = monthAbsenEnd ? parseInt(monthAbsenEnd) : startM;
                    attendance = attendance.filter(a => {
                        const recDate = new Date(a.date);
                        const recMonth = recDate.getMonth() + 1;
                        return recMonth >= startM && recMonth <= endM;
                    });
                }

                if (attendance && attendance.length > 0) {
                    const aggregated = students.map((s, idx) => {
                        const sRecs = attendance.filter(a => a.student_id === s.id);
                        return {
                            'NO': idx + 1,
                            'NIS': s.nis,
                            'NAMA SISWA': s.namalengkap,
                            'H': sRecs.filter(r => r.status?.toLowerCase() === 'hadir').length,
                            'S': sRecs.filter(r => r.status?.toLowerCase() === 'sakit').length,
                            'I': sRecs.filter(r => r.status?.toLowerCase() === 'izin').length,
                            'A': sRecs.filter(r => r.status?.toLowerCase() === 'alfa').length
                        };
                    });

                    let bulanLabel = formatBulan(monthAbsen);
                    if (monthAbsenEnd && monthAbsen !== monthAbsenEnd) {
                        bulanLabel += ` s/d ${formatBulan(monthAbsenEnd)}`;
                    }

                    batchData.push({
                        data: aggregated,
                        sheetName: kelas,
                        meta: {
                            title: 'REKAPITULASI ABSENSI SISWA',
                            kelas: kelas,
                            semester: targetSemLabel,
                            bulan: bulanLabel,
                            tahun: yearAbsen
                        }
                    });
                }
            }
        }

        if (batchData.length === 0) {
            Swal.close();
            setTimeout(() => {
                Swal.fire({
                    icon: 'info',
                    title: 'Data Tidak Ditemukan',
                    text: 'Tidak ada data di periode yang dipilih untuk semua kelas.',
                    heightAuto: false
                });
            }, 150);
            return;
        }

        if (type === 'excel') {
            const labelFile = category === 'nilai' 
                ? `Laporan_Nilai_SEMUA_KELAS_Sem${targetSem}` 
                : `Rekap_Absen_SEMUA_KELAS_${monthAbsen}-${monthAbsenEnd || monthAbsen}`;
            generateBatchExcel(batchData, labelFile);
            Swal.close();
        } else {
            generateBatchPDFReport(category, batchData);
            Swal.close();
        }

    } catch (error) {
        console.error("Batch Export Error", error);
        Swal.close();
        setTimeout(() => {
            Swal.fire({
                icon: 'error',
                title: 'Gagal',
                text: 'Terjadi kesalahan saat memproses data masal.',
                confirmButtonColor: '#dc2626',
                heightAuto: false
            });
        }, 150);
    }
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Swal.fire({
      title: 'Konfirmasi Impor',
      text: 'Yakin anda ingin menambahkan data siswa dari file Excel ini?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ya, Impor',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#3b82f6',
      cancelButtonColor: '#64748b',
      heightAuto: false
    }).then((result) => {
      if (!result.isConfirmed) {
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws) as any[];

          if (data.length === 0) throw new Error("File kosong.");

          Swal.fire({
            title: 'Mengimpor...',
            text: 'Sedang mendaftarkan data siswa baru...',
            didOpen: () => {
              Swal.showLoading();
            },
            allowOutsideClick: false,
            heightAuto: false
          });

          const students = data.map((row, idx) => {
            const rowId = row.ID || row.id || row.Id;
            return {
              id: rowId ? String(rowId).trim() : undefined,
              nis: String(row.NIS || row.nis),
              namalengkap: String(row.NAMA || row.nama || row['NAMA SISWA']),
              jeniskelamin: String(row.JK || row.jk),
              kelas: String(row.KELAS || row.kelas)
            };
          });

          await db.upsertStudents(students);
          
          Swal.close();
          setTimeout(() => {
            Swal.fire({
              icon: 'success',
              title: 'Berhasil',
              text: `${students.length} data siswa diperbarui.`,
              confirmButtonColor: '#059669',
              heightAuto: false
            });
          }, 150);
          fetchAllKelas();
        } catch (err) {
          Swal.close();
          setTimeout(() => {
            Swal.fire({
              icon: 'error',
              title: 'Gagal',
              text: 'Format file tidak sesuai template.',
              confirmButtonColor: '#dc2626',
              heightAuto: false
            });
          }, 150);
        }
      };
      reader.readAsBinaryString(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    });
  };

  const downloadTemplate = () => {
    const template = [
      { NO: 1, NIS: '12345', 'NAMA SISWA': 'Nama Siswa Contoh', JK: 'L', KELAS: '7.1' }
    ];
    generateExcel(template, 'Template_Import_Siswa', 'SISWA');
  };

  const secureReset = async (type: 'absensi' | 'nilai' | 'tugas' | 'siswa' | 'semua') => {
    const labels = { absensi: 'Absensi', nilai: 'Nilai', tugas: 'Tugas', siswa: 'Data Siswa', semua: 'SEMUA DATABASE' };
    const confirm = await Swal.fire({
      title: 'Hapus Data?',
      text: `Apakah Bapak yakin ingin menghapus ${labels[type]}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      heightAuto: false
    });

    if (!confirm.isConfirmed) return;

    const { value: token } = await Swal.fire({ 
      title: 'Verifikasi Keamanan', 
      text: 'Masukkan Kode Token ID Server:',
      input: 'password', 
      inputPlaceholder: 'Kode Token',
      icon: 'warning', 
      showCancelButton: true, 
      confirmButtonColor: '#dc2626',
      heightAuto: false 
    });

    if (token === "PAI_ADMIN_GURU") {
      Swal.fire({ title: 'Menghapus...', didOpen: () => Swal.showLoading(), heightAuto: false });
      try {
        if (type === 'absensi') await db.resetAttendance();
        else if (type === 'nilai') await db.resetGrades();
        else if (type === 'tugas') await db.resetTasks();
        else if (type === 'siswa') await db.resetStudents();
        else await db.resetAllData();
        
        Swal.close();
        setTimeout(() => {
          Swal.fire({
            icon: 'success',
            title: 'Berhasil',
            text: 'Data telah dibersihkan.',
            confirmButtonColor: '#059669',
            heightAuto: false
          });
        }, 150);
        fetchAllKelas();
      } catch (err) {
        Swal.close();
        setTimeout(() => {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Gagal terhubung server.',
            confirmButtonColor: '#dc2626',
            heightAuto: false
          });
        }, 150);
      }
    } else if (token !== undefined) {
      Swal.fire({
        icon: 'error',
        title: 'Ditolak',
        text: 'Token Keamanan Salah!',
        confirmButtonColor: '#dc2626',
        heightAuto: false
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-3 md:space-y-6 animate-fadeIn pb-24 px-1 no-print">
      {/* Header Responsif */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white/50 backdrop-blur-sm p-3 md:p-0 rounded-2xl md:bg-transparent">
        <div className="flex-1">
          <button onClick={() => navigate('/guru')} className="flex items-center gap-1.5 text-slate-800 text-[10px] font-black uppercase py-2 hover:translate-x-[-4px] transition-transform">
            <ArrowLeft size={14} /> Dashboard Utama
          </button>
          <h1 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-slate-800 leading-tight">Laporan & Database</h1>
          <p className="text-slate-500 text-[10px] md:text-sm font-medium leading-tight md:leading-normal max-w-lg">
            Panel Pengelolaan Laporan dan Database PAI.
          </p>
        </div>
        <div className="bg-red-600 text-white p-2.5 rounded-xl md:rounded-2xl shadow-lg flex items-center gap-3 self-start md:self-center">
          <Database size={20} className="opacity-50" />
          <div className="text-[9px] font-bold uppercase tracking-widest">Admin System</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
        
        {/* =======================
            KARTU 1: LAPORAN NILAI
           ======================= */}
        <div className="bg-white p-4 md:p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-50 pb-3">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><FileText size={18}/></div>
            <div>
              <h2 className="text-[11px] md:text-sm font-black uppercase tracking-widest text-slate-800">Laporan Nilai</h2>
              <p className="text-[9px] text-slate-400 font-medium">Download rekap nilai siswa.</p>
            </div>
          </div>

          {/* FILTER UTAMA (Global untuk Nilai) */}
          <div className="grid grid-cols-2 gap-2 bg-slate-50/50 p-2 rounded-xl border border-slate-100">
             <div className="space-y-0.5 col-span-2">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Semester</label>
                <select 
                  className="w-full p-2 text-[10px] md:text-xs border border-slate-200 rounded-xl font-normal outline-none bg-white text-slate-900"
                  value={semNilai} 
                  onChange={(e) => setSemNilai(e.target.value)}
                >
                  <option value="">-- Pilih --</option>
                  <option value="1">1 (Ganjil)</option>
                  <option value="2">2 (Genap)</option>
                </select>
             </div>
             {/* Filter Tipe Nilai dihapus agar otomatis menampilkan semua kolom */}
          </div>

          {/* SUB-KARTU 1: DOWNLOAD PER KELAS */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
                <Filter size={12} className="text-emerald-600" />
                <h3 className="text-[9px] font-black uppercase text-slate-600">Download Per Kelas</h3>
            </div>
            <div className="space-y-2">
                <select 
                    className="w-full p-2 text-[10px] md:text-xs border border-slate-200 rounded-xl font-normal outline-none bg-white text-slate-900"
                    value={kelasNilai} 
                    onChange={(e) => setKelasNilai(e.target.value)}
                >
                    <option value="">-- Pilih Kelas --</option>
                    {availKelas.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => handleExport('excel', 'nilai')} className="p-2.5 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"><FileDown size={14}/> Excel</button>
                    <button onClick={() => handleExport('pdf', 'nilai')} className="p-2.5 bg-red-600 text-white rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"><FileText size={14}/> PDF</button>
                </div>
            </div>
          </div>

          {/* SUB-KARTU 2: DOWNLOAD SEMUA KELAS */}
          <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100">
            <div className="flex items-center gap-2 mb-2">
                <Files size={12} className="text-emerald-700" />
                <h3 className="text-[9px] font-black uppercase text-emerald-800">Download Semua Kelas</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <button onClick={() => handleExportAll('excel', 'nilai')} className="p-2.5 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"><FileDown size={14}/> Excel All</button>
                <button onClick={() => handleExportAll('pdf', 'nilai')} className="p-2.5 bg-red-600 text-white rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"><FileText size={14}/> PDF All</button>
            </div>
            <p className="text-[8px] text-emerald-600 mt-2 italic leading-tight">
                *Menggabungkan data seluruh kelas dalam satu file (Batch).
            </p>
          </div>
        </div>

        {/* =======================
            KARTU 2: REKAP ABSENSI
           ======================= */}
        <div className="bg-white p-4 md:p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-50 pb-3">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl"><Download size={18}/></div>
            <div>
               <h2 className="text-[11px] md:text-sm font-black uppercase tracking-widest text-slate-800">Rekap Absensi</h2>
               <p className="text-[9px] text-slate-400 font-medium">Download data kehadiran siswa.</p>
            </div>
          </div>
          
          {/* FILTER UTAMA (Global untuk Absensi) */}
          <div className="bg-slate-50/50 p-2 rounded-xl border border-slate-100 space-y-2">
             <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                   <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Semester</label>
                   <select 
                     className="w-full p-2 text-[10px] md:text-xs border border-slate-200 rounded-xl font-normal outline-none bg-white text-slate-900"
                     value={semAbsen} 
                     onChange={(e) => setSemAbsen(e.target.value)}
                   >
                     <option value="">-- Pilih --</option>
                     <option value="1">1 (Ganjil)</option>
                     <option value="2">2 (Genap)</option>
                   </select>
                </div>
                <div className="space-y-0.5">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Dari Bulan</label>
                    <select 
                        className="w-full p-2 text-[10px] md:text-xs border border-slate-200 rounded-xl font-normal outline-none bg-white text-slate-900"
                        value={monthAbsen} 
                        onChange={(e) => setMonthAbsen(e.target.value)}
                    >
                        <option value="">-- Awal --</option>
                        {['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => <option key={m} value={m}>{formatBulan(m)}</option>)}
                    </select>
                </div>
             </div>
             <div className="space-y-0.5">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Sampai Bulan (Opsional)</label>
                <select 
                    className="w-full p-2 text-[10px] md:text-xs border border-slate-200 rounded-xl font-normal outline-none bg-white text-slate-900"
                    value={monthAbsenEnd} 
                    onChange={(e) => setMonthAbsenEnd(e.target.value)}
                >
                    <option value="">-- Sama dengan Awal --</option>
                    {['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => <option key={m} value={m}>{formatBulan(m)}</option>)}
                </select>
             </div>
          </div>

          {/* SUB-KARTU 1: DOWNLOAD PER KELAS */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
             <div className="flex items-center gap-2 mb-2">
                <Filter size={12} className="text-amber-600" />
                <h3 className="text-[9px] font-black uppercase text-slate-600">Download Per Kelas</h3>
             </div>
             <div className="space-y-2">
                <select 
                    className="w-full p-2 text-[10px] md:text-xs border border-slate-200 rounded-xl font-normal outline-none bg-white text-slate-900"
                    value={kelasAbsen} 
                    onChange={(e) => setKelasAbsen(e.target.value)}
                >
                    <option value="">-- Pilih Kelas --</option>
                    {availKelas.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => handleExport('excel', 'absensi')} className="p-2.5 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"><FileDown size={14}/> Excel</button>
                    <button onClick={() => handleExport('pdf', 'absensi')} className="p-2.5 bg-red-600 text-white rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"><FileText size={14}/> PDF</button>
                </div>
             </div>
          </div>

          {/* SUB-KARTU 2: DOWNLOAD SEMUA KELAS */}
          <div className="bg-amber-50 p-3 rounded-2xl border border-amber-100">
             <div className="flex items-center gap-2 mb-2">
                <Files size={12} className="text-amber-700" />
                <h3 className="text-[9px] font-black uppercase text-amber-800">Download Semua Kelas</h3>
             </div>
             <div className="grid grid-cols-2 gap-2">
                <button onClick={() => handleExportAll('excel', 'absensi')} className="p-2.5 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"><FileDown size={14}/> Excel All</button>
                <button onClick={() => handleExportAll('pdf', 'absensi')} className="p-2.5 bg-red-600 text-white rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"><FileText size={14}/> PDF All</button>
             </div>
             <p className="text-[8px] text-amber-700 mt-2 italic leading-tight">
                *Rekap kehadiran seluruh kelas sesuai rentang bulan.
             </p>
          </div>
        </div>

        {/* IMPORT SISWA */}
        <div className="bg-white p-4 md:p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><FileUp size={18}/></div>
            <h2 className="text-[11px] md:text-sm font-black uppercase tracking-widest text-slate-800">Kelola & Import Siswa</h2>
          </div>

          {/* PETUNJUK GOOGLE SHEETS */}
          <div className="p-4 bg-emerald-50/70 border border-emerald-100 rounded-2xl space-y-2">
            <h3 className="text-[10px] font-black text-emerald-850 uppercase tracking-wider flex items-center gap-1">
              💡 Cara Memasukkan 500 Siswa Via Google Sheets
            </h3>
            <ol className="list-decimal list-inside text-[9px] md:text-xs text-slate-600 space-y-1 leading-normal">
              <li>Buka file Google Spreadsheet Anda, aktifkan tab <strong>"data_siswa"</strong>.</li>
              <li>Tulis / Paste data 500+ siswa Anda secara sekaligus ke kolom yang tersedia:
                <div className="mt-1 flex flex-wrap gap-1 font-mono text-[8px] md:text-[10px] text-emerald-800 bg-white/80 p-1 md:p-2 rounded-lg border border-emerald-100">
                  <span>id</span> | <span>nis</span> | <span>namalengkap</span> | <span>kelas</span> | <span>jeniskelamin</span>
                </div>
                <span className="text-[8px] text-slate-400 block mt-0.5">*Catatan: Isi <code className="bg-slate-100 px-0.5 py-0.2 rounded text-[7px]">jeniskelamin</code> dengan <strong className="text-slate-600">L</strong> (Laki-laki) atau <strong className="text-slate-600">P</strong> (Perempuan)</span>
              </li>
              <li>Setelah data terisi lengkap di spreadsheet, klik tombol <strong>"Tarik Data dari Google Sheets"</strong> di bawah ini untuk memuatnya secara instan ke web portal!</li>
            </ol>
          </div>

          <div className="space-y-2.5">
            {appsScriptUrl ? (
              <button 
                onClick={handleSyncFromSheets} 
                disabled={syncing}
                className="w-full p-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95 hover:bg-emerald-500 transition-all"
              >
                <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                {syncing ? 'Sedang Mensinkronkan...' : 'Tarik Data dari Google Sheets'}
              </button>
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-[9px] text-amber-700 leading-tight">
                Hubungkan Web App URL Google Apps Script Anda di menu Kelola Admin terlebih dahulu untuk mengaktifkan fitur penarikan data langsung dari Google Sheets.
              </div>
            )}

            <div className="relative flex items-center my-2">
              <div className="flex-grow border-t border-slate-100"></div>
              <span className="flex-shrink mx-3 text-[8px] font-black text-slate-300 uppercase tracking-widest">Atau via Offline Excel</span>
              <div className="flex-grow border-t border-slate-100"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <button onClick={downloadTemplate} className="w-full p-2.5 bg-slate-100 text-slate-800 rounded-2xl text-[9px] font-black uppercase flex items-center justify-center gap-2 hover:bg-slate-200 transition-all"><Download size={14}/> Template Excel</button>
              <div className="relative">
                <input type="file" ref={fileInputRef} onChange={handleImportExcel} accept=".xlsx, .xls" className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} className="w-full p-2.5 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-1.5 shadow-md hover:bg-blue-500 active:scale-95 transition-all"><Upload size={14}/> Upload Excel</button>
              </div>
            </div>
          </div>
        </div>

        {/* RESET DATA */}
        <div className="bg-white p-4 md:p-6 rounded-[2rem] border border-red-100 border-dashed shadow-sm space-y-3 md:space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-50 text-red-600 rounded-xl"><ShieldAlert size={18}/></div>
            <h2 className="text-[11px] md:text-sm font-black uppercase tracking-widest text-red-600">Reset Database</h2>
          </div>
          <div className="flex items-start gap-2 px-3 py-2 bg-red-50/50 rounded-xl border border-red-100">
            <AlertTriangle size={14} className="text-red-600 mt-0.5 shrink-0" />
            <p className="text-[8px] font-bold text-red-700 uppercase italic">Membutuhkan Token Keamanan PAI.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => secureReset('siswa')} className="p-2.5 bg-slate-800 text-white rounded-xl text-[8px] font-black uppercase active:scale-95 transition-all">Reset Siswa</button>
            <button onClick={() => secureReset('absensi')} className="p-2.5 bg-slate-800 text-white rounded-xl text-[8px] font-black uppercase active:scale-95 transition-all">Reset Absensi</button>
            <button onClick={() => secureReset('nilai')} className="p-2.5 bg-slate-800 text-white rounded-xl text-[8px] font-black uppercase active:scale-95 transition-all">Reset Nilai</button>
            <button onClick={() => secureReset('tugas')} className="p-2.5 bg-slate-800 text-white rounded-xl text-[8px] font-black uppercase active:scale-95 transition-all">Reset Tugas</button>
            <button onClick={() => secureReset('semua')} className="p-3.5 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase col-span-2 shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">
              <Trash2 size={16}/> Hapus Seluruh Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherReports;