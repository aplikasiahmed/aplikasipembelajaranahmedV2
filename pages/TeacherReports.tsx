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
import { verifySecurityToken } from '../utils/security';
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

  // --- HELPER: GET DYNAMIC GRADE REPORT DATA (CONFORMING TO LEARNING OBJECTIVES) ---
  const getDynamicGradeReportData = async (targetKelas: string, targetSem: string): Promise<any[]> => {
    // 1. Fetch students in the classroom
    const students = await db.getStudentsByKelas(targetKelas);
    if (!students || students.length === 0) return [];

    // 2. Load TP and Assessments
    const tpsList = db.getLocalTable<any>('tujuan_pembelajaran');
    const assessmentsList = db.getLocalTable<any>('asesmen_tp');

    const savedTpScores = localStorage.getItem('pai_grades_tp_scores');
    const tpScores: Record<string, number> = savedTpScores ? JSON.parse(savedTpScores) : {};

    const savedOveralls = localStorage.getItem('pai_grades_overalls');
    const overalls: Record<string, any> = savedOveralls ? JSON.parse(savedOveralls) : {};

    const savedWeights = localStorage.getItem('pai_grade_weights');
    const weights = savedWeights ? JSON.parse(savedWeights) : { harian: 35, sts: 20, sas: 20, kehadiran: 10, sikap: 15 };

    // Get grade level from target class, e.g. "7"
    const match = targetKelas.match(/\d+/);
    const gradeLevel = match ? match[0] : '7';

    // Find active TPs
    const activeTps = tpsList
      .filter((t: any) => String(t.grade) === String(gradeLevel) && String(t.semester) === String(targetSem))
      .sort((a: any, b: any) => {
        const codeA = String(a.code || '').toLowerCase();
        const codeB = String(b.code || '').toLowerCase();
        return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
      });

    // Helper functions for scoring
    const calculateStudentTpScore = (studentId: string, tpId: string): number | null => {
      const relatedAsms = assessmentsList.filter((a: any) => a.tpId === tpId);
      if (relatedAsms.length === 0) return null;

      let sum = 0;
      let count = 0;
      relatedAsms.forEach((asm: any) => {
        const scoreKey = `${studentId}_${asm.id}`;
        const scoreVal = tpScores[scoreKey];
        if (scoreVal !== undefined && scoreVal !== null && scoreVal !== '') {
          sum += Number(scoreVal);
          count++;
        }
      });
      return count > 0 ? parseFloat((sum / count).toFixed(1)) : null;
    };

    const calculateStudentNilaiHarian = (studentId: string): number | null => {
      if (activeTps.length === 0) return null;
      let sum = 0;
      let count = 0;
      activeTps.forEach((tp: any) => {
        const tpScore = calculateStudentTpScore(studentId, tp.id);
        if (tpScore !== null) {
          sum += tpScore;
          count++;
        }
      });
      return count > 0 ? parseFloat((sum / count).toFixed(1)) : null;
    };

    const getAttendanceScore = (sakit: number = 0, izin: number = 0, alpha: number = 0): number => {
      const deduction = (sakit * 1) + (izin * 2) + (alpha * 5);
      return Math.max(0, 100 - deduction);
    };

    const getAttitudeScore = (sikapStr: string, nhScore: number | null): number => {
      if (sikapStr === 'Sangat Baik') return 95;
      if (sikapStr === 'Baik') return 85;
      if (sikapStr === 'Cukup') return 75;
      if (sikapStr === 'Perlu Bimbingan') return 60;
      return nhScore !== null ? Math.round(nhScore) : 85;
    };

    const calculateStudentNilaiAkhir = (studentId: string) => {
      const harian = calculateStudentNilaiHarian(studentId);
      const overallKey = `${studentId}_${targetSem}`;
      const overallRecord = overalls[overallKey];
      
      const sts = overallRecord && overallRecord.sts !== '' ? Number(overallRecord.sts) : 0;
      const sas = overallRecord && overallRecord.sas !== '' ? Number(overallRecord.sas) : 0;

      const sakit = overallRecord?.kehadiran?.sakit || 0;
      const izin = overallRecord?.kehadiran?.izin || 0;
      const alpha = overallRecord?.kehadiran?.alpha || 0;
      const kehadiranScore = getAttendanceScore(sakit, izin, alpha);

      const sikapStr = overallRecord?.sikap || '';
      const sikapScore = getAttitudeScore(sikapStr, harian);

      if (harian === null) {
        return { 
          harian: null, 
          sts, 
          sas, 
          kehadiranScore,
          sikapScore,
          finalScore: null 
        };
      }

      const wHarian = (weights.harian ?? 35) / 100;
      const wSts = (weights.sts ?? 20) / 100;
      const wSas = (weights.sas ?? 20) / 100;
      const wKehadiran = (weights.kehadiran ?? 10) / 100;
      const wSikap = (weights.sikap ?? 15) / 100;

      const result = 
        (harian * wHarian) + 
        (sts * wSts) + 
        (sas * wSas) + 
        (kehadiranScore * wKehadiran) + 
        (sikapScore * wSikap);

      const katrol = overallRecord && overallRecord.katrol !== '' && overallRecord.katrol !== undefined ? Number(overallRecord.katrol) : 0;
      const finalCalculated = Math.round(result) + katrol;
      const finalScore = Math.min(100, Math.max(0, finalCalculated));

      return {
        harian,
        sts,
        sas,
        kehadiranScore,
        sikapScore,
        finalScore
      };
    };

    const getAttitudeTextFromScore = (score: number | null): string => {
      if (score === null) return '-';
      if (score >= 91) return 'Sangat Baik';
      if (score >= 81) return 'Baik';
      if (score >= 71) return 'Cukup';
      return 'Perlu Bimbingan';
    };

    const getPredicateAndDesc = (score: number | null, studentId: string): { pred: string; desc: string } => {
      if (score === null) return { pred: '-', desc: '-' };
      let pred = 'D';
      if (score >= 91) pred = 'A';
      else if (score >= 81) pred = 'B';
      else if (score >= 71) pred = 'C';

      const fallbackDesc: Record<string, string> = {
        'A': 'Menunjukkan penguasaan materi yang sangat baik pada seluruh tujuan pembelajaran.',
        'B': 'Menunjukkan penguasaan materi yang baik pada sebagian besar tujuan pembelajaran.',
        'C': 'Menunjukkan penguasaan materi yang cukup dan perlu peningkatan pada beberapa tujuan pembelajaran.',
        'D': 'Memerlukan pendampingan dan penguatan meningkatkan kompetensi tujuan pembelajaran.'
      };

      if (!studentId || activeTps.length === 0) {
        return { pred, desc: fallbackDesc[pred] };
      }

      const tpEvaluations = activeTps
        .map(tp => {
          const val = calculateStudentTpScore(studentId, tp.id);
          return { tp, score: val };
        })
        .filter((item): item is { tp: any, score: number } => item.score !== null);

      if (tpEvaluations.length === 0) {
        return { pred, desc: fallbackDesc[pred] };
      }

      tpEvaluations.sort((a, b) => b.score - a.score);
      const maxEval = tpEvaluations[0];
      const minEval = tpEvaluations[tpEvaluations.length - 1];

      let desc = '';
      if (maxEval.score >= 75) {
        desc += `Sangat memahami ${maxEval.tp.name || maxEval.tp.description}`;
      } else {
        desc += `Cukup memahami ${maxEval.tp.name || maxEval.tp.description}`;
      }

      if (minEval && minEval.tp.id !== maxEval.tp.id && minEval.score < 80) {
        desc += `, namun masih perlu bimbingan/peningkatan dalam hal ${minEval.tp.name || minEval.tp.description}.`;
      } else {
        desc += `, serta konsisten menunjukkan penguasaan yang baik pada seluruh indikator lainnya.`;
      }

      return { pred, desc };
    };

    const rows = students.map((s, idx) => {
      const studentId = s.id!;
      const calculs = calculateStudentNilaiAkhir(studentId);
      const predObj = getPredicateAndDesc(calculs.finalScore, studentId);
      const overallKey = `${studentId}_${targetSem}`;
      const over = overalls[overallKey];

      const rowValue: any = {
        'NO': idx + 1,
        'NIS': s.nis || '-',
        'NAMA SISWA': s.namalengkap || '-'
      };

      // Add each active TP score dynamically
      activeTps.forEach((tp: any) => {
        const score = calculateStudentTpScore(studentId, tp.id);
        rowValue[tp.code || `TP ${tp.id}`] = score !== null ? score : '-';
      });

      rowValue['RATA HARIAN'] = calculs.harian !== null ? calculs.harian : '-';
      rowValue['STS'] = over && over.sts !== '' ? over.sts : '-';
      rowValue['SAS'] = over && over.sas !== '' ? over.sas : '-';
      rowValue['NILAI AKHIR'] = calculs.finalScore !== null ? calculs.finalScore : '-';
      rowValue['PREDIKAT'] = predObj.pred;
      rowValue['DESKRIPSI PENGUASAAN MATERI'] = predObj.desc;
      rowValue['SIKAP'] = over && over.sikap ? over.sikap : getAttitudeTextFromScore(calculs.sikapScore);
      rowValue['S'] = over && over.kehadiran?.sakit ? over.kehadiran.sakit : 0;
      rowValue['I'] = over && over.kehadiran?.izin ? over.kehadiran.izin : 0;
      rowValue['A'] = over && over.kehadiran?.alpha ? over.kehadiran.alpha : 0;

      return rowValue;
    });

    // Sort students A-Z by name
    const sorted = rows.sort((a, b) => a['NAMA SISWA'].localeCompare(b['NAMA SISWA']));
    sorted.forEach((row, index) => {
      row['NO'] = index + 1;
    });

    return sorted;
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
        const pivotedData = await getDynamicGradeReportData(targetKelas, targetSem);

        if (!pivotedData || pivotedData.length === 0) {
          Swal.close();
          setTimeout(() => {
            Swal.fire({
              icon: 'info',
              title: 'Kosong',
              text: `Data nilai Kelas ${targetKelas} Semester ${targetSem} belum tersedia.`,
              heightAuto: false
            });
          }, 150);
          return;
        }

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
              type: 'nilai' // Menandakan ini laporan nilai untuk memunculkan keterangan
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
                const pivotedData = await getDynamicGradeReportData(kelas, targetSem);
                
                if (pivotedData && pivotedData.length > 0) {
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

  const secureReset = async (type: 'absensi' | 'nilai' | 'tugas' | 'siswa' | 'materi' | 'ujian' | 'bank_soal' | 'hasil_ujian' | 'semua') => {
    const labels = { 
      absensi: 'Absensi', 
      nilai: 'Nilai', 
      tugas: 'Tugas', 
      siswa: 'Data Siswa', 
      materi: 'Materi Belajar',
      ujian: 'Ujian',
      bank_soal: 'Bank Soal',
      hasil_ujian: 'Hasil Ujian',
      semua: 'SEMUA DATABASE' 
    };
    const confirm = await Swal.fire({
      title: 'Hapus Data?',
      text: `Apakah Bapak yakin ingin menghapus ${labels[type]}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      heightAuto: false
    });

    if (!confirm.isConfirmed) return;

    const token = await verifySecurityToken('Masukkan Kode Token ID Server:');

    if (token === "PAI_ADMIN_GURU") {
      Swal.fire({ title: 'Menghapus...', didOpen: () => Swal.showLoading(), heightAuto: false });
      try {
        if (type === 'absensi') await db.resetAttendance();
        else if (type === 'nilai') await db.resetGrades();
        else if (type === 'tugas') await db.resetTasks();
        else if (type === 'siswa') await db.resetStudents();
        else if (type === 'materi') await db.resetMaterials();
        else if (type === 'ujian') await db.resetExams();
        else if (type === 'bank_soal') await db.resetQuestions();
        else if (type === 'hasil_ujian') await db.resetExamResults();
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
          <button 
            onClick={() => navigate('/guru')} 
            className="group flex items-center gap-2 text-slate-700 hover:text-emerald-700 transition-all text-xs font-black uppercase tracking-wider mb-2"
            id="btn-back-to-dashboard-utama"
          >
            <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
            <span>DASHBOARD UTAMA</span>
          </button>
          <h1 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-slate-800 leading-tight">Laporan Nilai</h1>
          <p className="text-slate-500 text-[10px] md:text-sm font-medium leading-tight md:leading-normal max-w-lg">
            Panel Pengelolaan Laporan Nilai PAI.
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
     </div>
    </div>
  );
};

export default TeacherReports;