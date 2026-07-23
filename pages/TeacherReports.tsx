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
  RefreshCw,
  Target,
  TrendingUp,
  Award
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

  const kkmValue = Number(localStorage.getItem('pai_kkm') || '71');
  const getKkmIntervals = (kkm: number) => {
    const range = 100 - kkm;
    const step = range / 3;
    return {
      cMin: kkm,
      bMin: Math.ceil(kkm + step),
      aMin: Math.ceil(kkm + 2 * step)
    };
  };
  const { cMin, bMin, aMin } = getKkmIntervals(kkmValue);
  
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

  // --- STATES FOR MONTHLY SUMMARY ---
  const [sumKelas, setSumKelas] = useState('');
  const [sumSemester, setSumSemester] = useState('');
  const [sumMonth, setSumMonth] = useState('');
  const [sumYear, setSumYear] = useState(new Date().getFullYear().toString());
  const [sumData, setSumData] = useState<any | null>(null);
  const [generatingSum, setGeneratingSum] = useState(false);

  const handleGenerateMonthlySummary = async () => {
    if (!sumKelas || !sumMonth || !sumSemester) {
      Swal.fire({
        icon: 'warning',
        title: 'Perhatian',
        text: 'Pilih Kelas, Semester, dan Bulan terlebih dahulu!',
        heightAuto: false
      });
      return;
    }

    setGeneratingSum(true);
    Swal.fire({
      title: 'Memproses...',
      text: 'Sedang menyusun ringkasan bulanan (absensi, nilai, dan jurnal)...',
      didOpen: () => Swal.showLoading(),
      allowOutsideClick: false,
      heightAuto: false
    });

    try {
      // 1. Fetch students in selected class
      const students = await db.getStudentsByKelas(sumKelas);
      if (!students || students.length === 0) {
        Swal.close();
        Swal.fire({
          icon: 'info',
          title: 'Kosong',
          text: `Tidak ditemukan data siswa untuk Kelas ${sumKelas}.`,
          heightAuto: false
        });
        setGeneratingSum(false);
        return;
      }

      // Sort students A-Z
      const sortedStudents = [...students].sort((a, b) => a.namalengkap.localeCompare(b.namalengkap));

      // 2. Fetch attendance records
      let attendanceList = await db.getAttendanceByKelas(sumKelas, sumSemester, undefined, sumYear);
      if (sumMonth) {
        const mTarget = parseInt(sumMonth);
        attendanceList = attendanceList.filter(a => {
          const d = new Date(a.date);
          return (d.getMonth() + 1) === mTarget;
        });
      }

      // 3. Fetch calculated grades
      const pivotedData = await getDynamicGradeReportData(sumKelas, sumSemester);
      const gradesMap: Record<string, any> = {};
      if (pivotedData && pivotedData.length > 0) {
        pivotedData.forEach(row => {
          const nis = row['NIS'];
          gradesMap[nis] = row['NILAI AKHIR'];
        });
      }

      // 4. Fetch teacher journals
      const allJournals = await db.getJurnalHarian();
      const classJournals = allJournals.filter(j => {
        if (j.kelas !== sumKelas) return false;
        const d = new Date(j.tanggal);
        return (d.getMonth() + 1) === parseInt(sumMonth) && d.getFullYear() === parseInt(sumYear);
      }).sort((a, b) => a.tanggal.localeCompare(b.tanggal));

      // 5. Aggregate student records
      const compiledStudents = sortedStudents.map((s, idx) => {
        const sAttendance = attendanceList.filter(a => a.student_id === s.id);
        const hadir = sAttendance.filter(r => r.status?.toLowerCase() === 'hadir').length;
        const sakit = sAttendance.filter(r => r.status?.toLowerCase() === 'sakit').length;
        const izin = sAttendance.filter(r => r.status?.toLowerCase() === 'izin').length;
        const alfa = sAttendance.filter(r => r.status?.toLowerCase() === 'alfa').length;
        const totalHari = hadir + sakit + izin + alfa;
        const persentaseKehadiran = totalHari > 0 ? Math.round((hadir / totalHari) * 100) : 100;

        return {
          no: idx + 1,
          nis: s.nis,
          nama: s.namalengkap,
          hadir,
          sakit,
          izin,
          alfa,
          persentaseKehadiran,
          nilaiAkhir: gradesMap[s.nis] !== undefined ? gradesMap[s.nis] : '-'
        };
      });

      // 6. Calculate statistics
      const totalSiswa = compiledStudents.length;
      const validScores = compiledStudents.map(s => Number(s.nilaiAkhir)).filter(val => !isNaN(val));
      const rataRataNilai = validScores.length > 0 
        ? parseFloat((validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1))
        : 0;
      
      const totalJamMengajar = classJournals.reduce((sum, j) => sum + Number(j.jam_mengajar || 0), 0);
      const rataRataHadir = compiledStudents.length > 0
        ? Math.round(compiledStudents.reduce((sum, s) => sum + s.persentaseKehadiran, 0) / compiledStudents.length)
        : 100;

      setSumData({
        kelas: sumKelas,
        semester: sumSemester === '1' ? '1 (Ganjil)' : '2 (Genap)',
        bulan: formatBulan(sumMonth),
        tahun: sumYear,
        students: compiledStudents,
        journals: classJournals,
        stats: {
          totalSiswa,
          rataRataNilai,
          totalJamMengajar,
          rataRataHadir
        }
      });

      Swal.close();
      setTimeout(() => {
        Swal.fire({
          icon: 'success',
          title: 'Berhasil',
          text: `Data ringkasan untuk Kelas ${sumKelas} bulan ${formatBulan(sumMonth)} berhasil disusun!`,
          timer: 1500,
          showConfirmButton: false,
          heightAuto: false
        });
      }, 150);

    } catch (e) {
      console.error("Gagal menyusun ringkasan bulanan:", e);
      Swal.close();
      setTimeout(() => {
        Swal.fire({
          icon: 'error',
          title: 'Gagal',
          text: 'Terjadi kesalahan sistem saat menyusun ringkasan bulanan.',
          heightAuto: false
        });
      }, 150);
    } finally {
      setGeneratingSum(false);
    }
  };

  // KKM Analysis State variables
  const [kkmKelas, setKkmKelas] = useState('');
  const [kkmSemester, setKkmSemester] = useState('');
  const [kkmTargetValue, setKkmTargetValue] = useState(() => {
    return Number(localStorage.getItem('pai_kkm') || '75');
  });
  const [kkmResults, setKkmResults] = useState<any[]>([]);
  const [loadingKkm, setLoadingKkm] = useState(false);

  const calculateKkmAnalysis = async () => {
    if (!kkmKelas || !kkmSemester) {
      setKkmResults([]);
      return;
    }
    setLoadingKkm(true);
    try {
      // 1. Fetch students
      const students = await db.getStudentsByKelas(kkmKelas);
      if (!students || students.length === 0) {
        setKkmResults([]);
        setLoadingKkm(false);
        return;
      }

      // 2. Fetch TPs and scores
      const tpsList = db.getLocalTable<any>('tujuan_pembelajaran');
      const assessmentsList = db.getLocalTable<any>('asesmen_tp');

      const savedTpScores = localStorage.getItem('pai_grades_tp_scores');
      const tpScores: Record<string, number> = savedTpScores ? JSON.parse(savedTpScores) : {};

      // Parse grade Level from class name
      const match = kkmKelas.match(/\d+/);
      const gradeLevel = match ? match[0] : '7';

      const activeTps = tpsList
        .filter((t: any) => String(t.grade) === String(gradeLevel) && String(t.semester) === String(kkmSemester))
        .sort((a: any, b: any) => {
          const codeA = String(a.code || '').toLowerCase();
          const codeB = String(b.code || '').toLowerCase();
          return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
        });

      if (activeTps.length === 0) {
        setKkmResults([]);
        setLoadingKkm(false);
        return;
      }

      // 3. Evaluate each TP
      const results = activeTps.map((tp: any) => {
        let reachedCount = 0;
        let evaluatedCount = 0;
        const studentScores: number[] = [];

        students.forEach((s: any) => {
          const studentId = s.id;
          const relatedAsms = assessmentsList.filter((a: any) => a.tpId === tp.id);
          if (relatedAsms.length > 0) {
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

            if (count > 0) {
              const score = parseFloat((sum / count).toFixed(1));
              studentScores.push(score);
              evaluatedCount++;
              if (score >= kkmTargetValue) {
                reachedCount++;
              }
            }
          }
        });

        const percentage = evaluatedCount > 0 ? Math.round((reachedCount / evaluatedCount) * 100) : 0;
        const avgScore = studentScores.length > 0 ? parseFloat((studentScores.reduce((a, b) => a + b, 0) / studentScores.length).toFixed(1)) : 0;

        return {
          id: tp.id,
          code: tp.code || `TP ${tp.id}`,
          name: tp.name || tp.description,
          totalStudents: students.length,
          evaluatedCount,
          reachedCount,
          percentage,
          avgScore
        };
      });

      setKkmResults(results);
    } catch (err) {
      console.error('Error calculating KKM analysis:', err);
    } finally {
      setLoadingKkm(false);
    }
  };

  useEffect(() => {
    calculateKkmAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kkmKelas, kkmSemester, kkmTargetValue]);

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

  // Auto-set Semester Ringkasan Bulanan berdasarkan Bulan
  useEffect(() => {
    if (!sumMonth) {
      setSumSemester('');
      return;
    }
    const m = parseInt(sumMonth);
    if (m >= 7 && m <= 12) {
      setSumSemester('1');
    } else {
      setSumSemester('2');
    }
  }, [sumMonth]);

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
      if (score >= aMin) pred = 'A';
      else if (score >= bMin) pred = 'B';
      else if (score >= cMin) pred = 'C';

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
      if (maxEval.score >= kkmValue) {
        desc += `Sangat memahami ${maxEval.tp.name || maxEval.tp.description}`;
      } else {
        desc += `Cukup memahami ${maxEval.tp.name || maxEval.tp.description}`;
      }

      if (minEval && minEval.tp.id !== maxEval.tp.id && minEval.score < bMin) {
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
    <>
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

      {/* ==============================================
          KARTU BARU: RINGKASAN BULANAN OTOMATIS (PDF)
          ============================================== */}
      <div className="bg-white p-4 md:p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-5">
        <div className="flex items-center gap-3 border-b border-slate-50 pb-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
            <FileText size={18} />
          </div>
          <div>
            <h2 className="text-[11px] md:text-sm font-black uppercase tracking-widest text-slate-800">Ringkasan Bulanan Otomatis (PDF)</h2>
            <p className="text-[9px] text-slate-400 font-medium">Gabungkan rekap absensi harian, nilai akhir, dan jurnal mengajar guru dalam satu laporan PDF resmi.</p>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
          <div className="space-y-1">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Pilih Kelas</label>
            <select 
              className="w-full p-2 text-[10px] md:text-xs border border-slate-200 rounded-xl font-normal outline-none bg-white text-slate-900"
              value={sumKelas} 
              onChange={(e) => setSumKelas(e.target.value)}
            >
              <option value="">-- Pilih Kelas --</option>
              {availKelas.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Pilih Bulan</label>
            <select 
              className="w-full p-2 text-[10px] md:text-xs border border-slate-200 rounded-xl font-normal outline-none bg-white text-slate-900"
              value={sumMonth} 
              onChange={(e) => setSumMonth(e.target.value)}
            >
              <option value="">-- Pilih Bulan --</option>
              {['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => (
                <option key={m} value={m}>{formatBulan(m)}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Semester</label>
            <select 
              className="w-full p-2 text-[10px] md:text-xs border border-slate-200 rounded-xl font-normal outline-none bg-white text-slate-900"
              value={sumSemester} 
              onChange={(e) => setSumSemester(e.target.value)}
            >
              <option value="">-- Pilih Semester --</option>
              <option value="1">1 (Ganjil)</option>
              <option value="2">2 (Genap)</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button 
            onClick={handleGenerateMonthlySummary}
            disabled={generatingSum}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generatingSum ? (
              <><RefreshCw size={14} className="animate-spin" /> Menyusun...</>
            ) : (
              <><RefreshCw size={14} /> Susun Ringkasan</>
            )}
          </button>
        </div>

        {/* INTERACTIVE PREVIEW PANEL */}
        {sumData && (
          <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/30 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/60 pb-3">
              <div>
                <span className="bg-blue-100 text-blue-800 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md">PREVIEW LAPORAN</span>
                <h3 className="text-xs md:text-sm font-black text-slate-800 uppercase mt-1">Ringkasan {sumData.bulan} {sumData.tahun} - Kelas {sumData.kelas}</h3>
              </div>
              <button 
                onClick={() => window.print()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
              >
                <Download size={12} /> Unduh / Cetak Laporan PDF
              </button>
            </div>

            {/* QUICK STATS */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Total Siswa</p>
                <p className="text-sm font-black text-slate-800">{sumData.stats.totalSiswa} Siswa</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Rata Nilai Akhir</p>
                <p className="text-sm font-black text-slate-800">{sumData.stats.rataRataNilai}</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Rata Kehadiran</p>
                <p className="text-sm font-black text-slate-800">{sumData.stats.rataRataHadir}%</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Durasi Mengajar</p>
                <p className="text-sm font-black text-slate-800">{sumData.stats.totalJamMengajar} Jam</p>
              </div>
            </div>

            {/* TABEL PREVIEW SISWA & JURNAL */}
            <div className="space-y-3">
              <div>
                <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">Riwayat Jurnal Bulan Ini ({sumData.journals.length} Catatan)</h4>
                <div className="max-h-[160px] overflow-y-auto border border-slate-100 rounded-xl bg-white text-[10px]">
                  {sumData.journals.length === 0 ? (
                    <p className="p-4 text-center text-slate-400 italic font-medium">Belum ada catatan jurnal guru.</p>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold">
                          <th className="p-2 w-20">Tanggal</th>
                          <th className="p-2 w-16">Jam</th>
                          <th className="p-2">Deskripsi Aktivitas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-slate-700">
                        {sumData.journals.map((j: any, i: number) => (
                          <tr key={i}>
                            <td className="p-2 whitespace-nowrap">{j.tanggal}</td>
                            <td className="p-2 font-bold">{j.jam_mengajar} Jam</td>
                            <td className="p-2 text-slate-600 line-clamp-2 leading-relaxed">{j.deskripsi}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">Daftar Kehadiran & Nilai Siswa</h4>
                <div className="max-h-[220px] overflow-y-auto border border-slate-100 rounded-xl bg-white text-[10px]">
                  <table className="w-full text-center border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold">
                        <th className="p-2 text-left w-10">No</th>
                        <th className="p-2 text-left">Nama</th>
                        <th className="p-2 w-10">H</th>
                        <th className="p-2 w-10">S</th>
                        <th className="p-2 w-10">I</th>
                        <th className="p-2 w-10">A</th>
                        <th className="p-2 w-14">% Abs</th>
                        <th className="p-2 w-16">Nilai Akhir</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-slate-700">
                      {sumData.students.map((s: any) => (
                        <tr key={s.no}>
                          <td className="p-2 text-left">{s.no}</td>
                          <td className="p-2 text-left font-semibold uppercase truncate max-w-[120px]">{s.nama}</td>
                          <td className="p-2 text-emerald-600">{s.hadir}</td>
                          <td className="p-2 text-amber-600">{s.sakit}</td>
                          <td className="p-2 text-blue-600">{s.izin}</td>
                          <td className="p-2 text-red-600">{s.alfa}</td>
                          <td className="p-2 font-bold">{s.persentaseKehadiran}%</td>
                          <td className="p-2 font-black text-slate-800">{s.nilaiAkhir}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ==============================================
          KARTU 3: ANALISIS KKM PER TUJUAN PEMBELAJARAN
          ============================================== */}
      <div className="bg-white p-4 md:p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-50 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><TrendingUp size={18}/></div>
            <div>
              <h2 className="text-[11px] md:text-sm font-black uppercase tracking-widest text-slate-800">Analisis Ketercapaian KKM Per TP</h2>
              <p className="text-[9px] text-slate-400 font-medium">Mengukur persentase siswa mencapai target KKM pada setiap Tujuan Pembelajaran.</p>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-emerald-50 text-emerald-800 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider self-start sm:self-center">
            <Target size={12} className="text-emerald-600 animate-pulse" /> Target KKM: {kkmTargetValue}
          </div>
        </div>

        {/* KKM SELECTION CONTROLS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
          <div className="space-y-1">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Pilih Kelas</label>
            <select 
              className="w-full p-2.5 text-[10px] md:text-xs border border-slate-200 rounded-xl font-normal outline-none bg-white text-slate-900"
              value={kkmKelas} 
              onChange={(e) => setKkmKelas(e.target.value)}
            >
              <option value="">-- Pilih Kelas --</option>
              {availKelas.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Pilih Semester</label>
            <select 
              className="w-full p-2.5 text-[10px] md:text-xs border border-slate-200 rounded-xl font-normal outline-none bg-white text-slate-900"
              value={kkmSemester} 
              onChange={(e) => setKkmSemester(e.target.value)}
            >
              <option value="">-- Pilih Semester --</option>
              <option value="1">1 (Ganjil)</option>
              <option value="2">2 (Genap)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Sesuaikan Batas KKM</label>
            <div className="flex items-center gap-2">
              <input 
                type="range" 
                min="50" 
                max="100" 
                value={kkmTargetValue} 
                onChange={(e) => setKkmTargetValue(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
              <input 
                type="number" 
                min="50" 
                max="100" 
                value={kkmTargetValue} 
                onChange={(e) => setKkmTargetValue(Math.min(100, Math.max(50, Number(e.target.value))))}
                className="w-12 p-1.5 text-center text-[10px] md:text-xs border border-slate-200 rounded-lg font-bold bg-white text-slate-900"
              />
            </div>
          </div>
        </div>

        {/* KKM ANALYSIS LIST RESULTS */}
        {loadingKkm ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
            <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-[10px] font-black uppercase tracking-wider">Menghitung Ketercapaian...</span>
          </div>
        ) : kkmKelas && kkmSemester ? (
          kkmResults.length === 0 ? (
            <div className="py-10 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 space-y-1">
              <div className="text-slate-300 flex justify-center"><Target size={36} /></div>
              <p className="text-xs text-slate-500 font-bold">Tidak ada data Tujuan Pembelajaran atau nilai aktif.</p>
              <p className="text-[10px] text-slate-400">Pastikan Tujuan Pembelajaran telah diatur untuk Kelas & Semester ini.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {kkmResults.map((tp) => {
                  const isHigh = tp.percentage >= 75;
                  const isLow = tp.percentage < 50;
                  const colorClass = isHigh 
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-100' 
                    : isLow 
                      ? 'text-rose-700 bg-rose-50 border-rose-100' 
                      : 'text-amber-700 bg-amber-50 border-amber-100';
                  
                  const barColor = isHigh 
                    ? 'bg-emerald-600' 
                    : isLow 
                      ? 'bg-rose-500' 
                      : 'bg-amber-500';

                  return (
                    <div key={tp.id} className="p-4 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all bg-white space-y-3 shadow-sm flex flex-col justify-between">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="bg-slate-100 text-slate-700 font-black text-[9px] px-2.5 py-0.5 rounded-lg border border-slate-200 uppercase tracking-wider">
                            {tp.code}
                          </span>
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border ${colorClass} flex items-center gap-1`}>
                            <Award size={10} /> {tp.percentage}% Tuntas
                          </span>
                        </div>
                        <p className="text-slate-800 text-[11px] font-bold leading-normal line-clamp-2" title={tp.name}>
                          {tp.name}
                        </p>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-slate-50">
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[9px] font-bold text-slate-400">
                            <span>Rata-Rata Kelas: <strong className="text-slate-700 font-black">{tp.avgScore}</strong></span>
                            <span>{tp.reachedCount} dari {tp.evaluatedCount} Siswa</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                              style={{ width: `${tp.percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-3.5 bg-emerald-50 text-emerald-800 border border-emerald-100/50 rounded-2xl flex items-start gap-2.5 text-[10px] md:text-xs font-bold leading-normal">
                <Info size={16} className="shrink-0 text-emerald-600 mt-0.5" />
                <p>
                  Siswa dinyatakan tuntas pada Tujuan Pembelajaran (TP) apabila nilai rata-rata asesmen formatif & sumatif harian mereka mencapai atau melampaui batas KKM (<strong className="text-emerald-950 font-black">{kkmTargetValue}</strong>). 
                  Gunakan slider/input di atas untuk menganalisis ketercapaian siswa secara fleksibel sesuai target kelulusan dinamis.
                </p>
              </div>
            </div>
          )
        ) : (
          <div className="py-12 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200 space-y-1">
            <div className="text-slate-400 flex justify-center animate-pulse"><Target size={36} /></div>
            <p className="text-xs text-slate-500 font-bold">Pilih kelas dan semester terlebih dahulu</p>
            <p className="text-[10px] text-slate-400">Untuk memulai analisis ketersediaan ketercapaian ketuntasan minimal (KKM).</p>
          </div>
        )}
      </div>
    </div>

    {/* PRINT ONLY STYLE & CONTAINER */}
    <style dangerouslySetInnerHTML={{__html: `
      @media print {
        .no-print { display: none !important; }
        .print-only { display: block !important; }
        body { background: white !important; color: black !important; padding: 0 !important; margin: 0 !important; font-size: 10pt !important; }
        @page { size: A4 portrait; margin: 1.5cm; }
        .page-break { page-break-before: always; }
      }
    `}} />

    {sumData && (
      <div className="hidden print:block print-only bg-white text-black p-4 font-sans max-w-4xl mx-auto space-y-6">
        {/* Header Dokumen Resmi */}
        <div className="border-b-4 border-double border-slate-900 pb-4 text-center space-y-1">
          <h1 className="text-xl font-extrabold uppercase tracking-tight">LAPORAN RINGKASAN BULANAN PEMBELAJARAN</h1>
          <h2 className="text-sm font-black uppercase tracking-wide text-slate-700">PENDIDIKAN AGAMA ISLAM DAN BUDI PEKERTI (PAI)</h2>
          <p className="text-[10px] text-slate-500 font-bold tracking-wider">KEMENTERIAN AGAMA REPUBLIK INDONESIA</p>
          <div className="mt-3 text-xs font-semibold text-slate-600 flex justify-center gap-6 border-t border-slate-100 pt-2">
            <span>Kelas: <strong className="text-slate-900">{sumData.kelas}</strong></span>
            <span>Bulan: <strong className="text-slate-900">{sumData.bulan} {sumData.tahun}</strong></span>
            <span>Semester: <strong className="text-slate-900">{sumData.semester}</strong></span>
          </div>
        </div>

        {/* Ringkasan Indikator Kinerja Utama */}
        <div className="grid grid-cols-4 gap-3 text-center">
          <div className="border border-slate-300 p-2 rounded-xl">
            <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Total Siswa</div>
            <div className="text-base font-black text-slate-800">{sumData.stats.totalSiswa}</div>
          </div>
          <div className="border border-slate-300 p-2 rounded-xl">
            <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Rata-Rata Nilai</div>
            <div className="text-base font-black text-slate-800">{sumData.stats.rataRataNilai}</div>
          </div>
          <div className="border border-slate-300 p-2 rounded-xl">
            <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Rata-Rata Hadir</div>
            <div className="text-base font-black text-slate-800">{sumData.stats.rataRataHadir}%</div>
          </div>
          <div className="border border-slate-300 p-2 rounded-xl">
            <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Jam Mengajar</div>
            <div className="text-base font-black text-slate-800">{sumData.stats.totalJamMengajar} Jam</div>
          </div>
        </div>

        {/* Jurnal Harian Pengajaran Guru */}
        <div className="space-y-2">
          <h3 className="text-[10px] font-black uppercase border-b-2 border-slate-800 pb-1 text-slate-800 tracking-wider">I. JURNAL HARIAN MENGAJAR GURU (BULANAN)</h3>
          {sumData.journals.length === 0 ? (
            <p className="text-[10px] text-slate-500 italic">Tidak ada catatan jurnal pengajaran guru untuk periode bulan ini.</p>
          ) : (
            <div className="border border-slate-300 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse text-[9px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-300 font-bold text-slate-700">
                    <th className="p-2 w-28 border-r border-slate-200">Tanggal</th>
                    <th className="p-2 w-20 border-r border-slate-200 text-center">Jam Mengajar</th>
                    <th className="p-2">Uraian / Deskripsi Kegiatan Pembelajaran & Capaian Kelas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sumData.journals.map((j: any, i: number) => (
                    <tr key={i}>
                      <td className="p-2 border-r border-slate-200 font-medium">
                        {new Date(j.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-center font-bold">{j.jam_mengajar} Jam</td>
                      <td className="p-2 text-slate-700 leading-relaxed whitespace-pre-wrap">{j.deskripsi}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Rekap Kehadiran dan Nilai Akhir Siswa */}
        <div className="space-y-2 page-break">
          <h3 className="text-[10px] font-black uppercase border-b-2 border-slate-800 pb-1 text-slate-800 tracking-wider">II. REKAPITULASI PERSENTASE KEHADIRAN & NILAI AKHIR SISWA</h3>
          <div className="border border-slate-300 rounded-xl overflow-hidden">
            <table className="w-full text-center border-collapse text-[9px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-300 font-bold text-slate-700">
                  <th className="p-2 text-left w-10 border-r border-slate-200">No</th>
                  <th className="p-2 text-left border-r border-slate-200">Nama Lengkap Siswa</th>
                  <th className="p-2 w-14 border-r border-slate-200">Hadir</th>
                  <th className="p-2 w-14 border-r border-slate-200">Sakit</th>
                  <th className="p-2 w-14 border-r border-slate-200">Izin</th>
                  <th className="p-2 w-14 border-r border-slate-200">Alfa</th>
                  <th className="p-2 w-20 border-r border-slate-200">% Hadir</th>
                  <th className="p-2 w-24">Nilai Akhir (Sem)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sumData.students.map((s: any) => (
                  <tr key={s.no} className="text-slate-800">
                    <td className="p-2 border-r border-slate-200 text-left">{s.no}</td>
                    <td className="p-2 border-r border-slate-200 text-left font-bold uppercase truncate max-w-[200px]">{s.nama}</td>
                    <td className="p-2 border-r border-slate-200">{s.hadir}</td>
                    <td className="p-2 border-r border-slate-200">{s.sakit}</td>
                    <td className="p-2 border-r border-slate-200">{s.izin}</td>
                    <td className="p-2 border-r border-slate-200">{s.alfa}</td>
                    <td className="p-2 border-r border-slate-200 font-bold">{s.persentaseKehadiran}%</td>
                    <td className="p-2 font-extrabold text-slate-900">{s.nilaiAkhir}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tanda Tangan */}
        <div className="pt-8 flex justify-between text-[10px]">
          <div></div>
          <div className="text-center w-64 space-y-16">
            <p>Mengetahui,<br />Guru Mata Pelajaran PAI & Budi Pekerti</p>
            <div>
              <p className="font-bold underline uppercase">___________________________</p>
              <p className="text-slate-500 font-medium">NIP. -</p>
            </div>
          </div>
        </div>
      </div>
    )}
  </>
  );
};

export default TeacherReports;