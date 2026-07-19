import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, BookOpen, Plus, Trash2, Edit2, Check, Settings, Save, Award, Scroll, 
  Users, CheckCircle2, ChevronRight, AlertTriangle, ListFilter, HelpCircle, FileDown, Eye, ShieldAlert
} from 'lucide-react';
import { db } from '../services/supabaseMock';
import { Student } from '../types';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';

// --- INTERFACES ---
interface TP {
  id: string;
  code: string; // TP 1, TP 2 ...
  name: string;
  description: string;
  subject: string;
  grade: string; // 7, 8, 9
  semester: string; // 1, 2
}

interface TPAssessment {
  id: string;
  tpId: string;
  name: string; // Tugas 1, Tugas 2 ...
  type: string;
}

interface StudentTPScore {
  studentId: string;
  assessmentId: string;
  score: number; // 0 - 100
}

interface CourseOverallScore {
  studentId: string;
  kelas: string;
  semester: string;
  sts: number | ''; // 0 - 100
  sas: number | ''; // 0 - 100
  sikap: 'Sangat Baik' | 'Baik' | 'Cukup' | 'Perlu Bimbingan' | '';
  kehadiran: {
    sakit: number;
    izin: number;
    alpha: number;
  };
  katrol: number | ''; // Nilai Katrol
}

interface GradeWeights {
  harian: number; // Nilai Tugas TP (default 35%)
  sts: number; // Sumatif Tengah Semester (default 20%)
  sas: number; // Sumatif Akhir Semester (default 20%)
  kehadiran: number; // Kehadiran (default 10%)
  sikap: number; // Nilai Sikap (default 15%)
}

const ASSESSMENT_TYPES = ['Hafalan', 'Penulisan', 'Praktik', 'Proyek', 'Observasi'] as const;

const TeacherManageGrades: React.FC = () => {
  const navigate = useNavigate();

  // --- APP STATE ---
  const [activeTab, setActiveTab] = useState<'input' | 'rekap'>('input');
  const [selectedGrade, setSelectedGrade] = useState<string>('7');
  const [selectedKelas, setSelectedKelas] = useState<string>('');
  const [selectedSemester, setSelectedSemester] = useState<string>('1');
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  // Database States
  const [tps, setTps] = useState<TP[]>([]);
  const [assessments, setAssessments] = useState<TPAssessment[]>([]);
  const [tpScores, setTpScores] = useState<Record<string, number>>({}); // key: studentId_assessmentId -> score
  const [overalls, setOveralls] = useState<Record<string, CourseOverallScore>>({}); // key: studentId -> overall record
  const [weights, setWeights] = useState<GradeWeights>({ 
    harian: 35, 
    sts: 20, 
    sas: 20, 
    kehadiran: 10, 
    sikap: 15 
  });

  // UI/Editing States for TP Tab
  const [editingTpId, setEditingTpId] = useState<string | null>(null);
  const [tpForm, setTpForm] = useState<Omit<TP, 'id'>>({
    code: 'TP 1',
    name: '',
    description: '',
    subject: 'Pendidikan Agama Islam & Budi Pekerti',
    grade: '7',
    semester: '1',
  });

  // UI/Editing States for Assessments Tab
  const [selectedTpId, setSelectedTpId] = useState<string>('');
  const [asmForm, setAsmForm] = useState<{ name: string; type: string }>({
    name: 'Tugas 1',
    type: 'Penulisan',
  });

  // Search Filter for Rekap
  const [searchQuery, setSearchQuery] = useState('');
  const [syncingKelola, setSyncingKelola] = useState(false);

  // --- INITIALIZE DATA & TRIGGERS ---
  useEffect(() => {
    const hashParts = window.location.hash.split('?');
    const params = new URLSearchParams(hashParts[1] || window.location.search);
    const gradeParam = params.get('grade');
    const semesterParam = params.get('semester');
    const kelasParam = params.get('kelas');

    if (gradeParam) {
      setSelectedGrade(gradeParam);
    }
    if (semesterParam) {
      setSelectedSemester(semesterParam);
    }
    if (kelasParam) {
      setSelectedKelas(kelasParam);
    }
  }, []);

  useEffect(() => {
    // 1. Fetch available classes
    db.getAvailableKelas(selectedGrade as any).then((classes) => {
      setAvailableClasses(classes);
      if (classes.length > 0) {
        setSelectedKelas(classes[0]);
      } else {
        setSelectedKelas('');
      }
    });
  }, [selectedGrade]);

  // Read list of students based on chosen class
  useEffect(() => {
    if (selectedKelas) {
      db.getStudentsByKelas(selectedKelas).then((data) => {
        setStudents(data);
      });
    } else {
      setStudents([]);
    }
  }, [selectedKelas]);

  // Synchronize database grades and attendance by default
  useEffect(() => {
    if (!selectedKelas || !selectedSemester || students.length === 0) return;

    const syncDatabaseData = async () => {
      try {
        // 1. Fetch attendance records
        const attRecords = await db.getAttendanceByKelas(selectedKelas, selectedSemester);
        
        // Compute attendance counts per student
        const attendanceCounts: Record<string, { sakit: number; izin: number; alpha: number }> = {};
        students.forEach(s => {
          attendanceCounts[s.id!] = { sakit: 0, izin: 0, alpha: 0 };
        });

        attRecords.forEach(att => {
          const sId = att.student_id;
          if (attendanceCounts[sId]) {
            if (att.status === 'sakit') attendanceCounts[sId].sakit++;
            else if (att.status === 'izin') attendanceCounts[sId].izin++;
            else if (att.status === 'alfa' || att.status === 'alpha') attendanceCounts[sId].alpha++;
          }
        });

        // 2. Fetch grades records
        const gradeRecords = await db.getGradesByKelas(selectedKelas, selectedSemester);
        
        const integratedTpScores: Record<string, number> = {};
        const integratedSts: Record<string, number | ''> = {};
        const integratedSas: Record<string, number | ''> = {};

        gradeRecords.forEach(g => {
          const sId = g.student_id;
          const typeLower = String(g.subject_type).toLowerCase().trim();
          if (typeLower === 'uts' || typeLower === 'pts') {
            integratedSts[sId] = g.score;
          } else if (typeLower === 'uas' || typeLower === 'pas') {
            integratedSas[sId] = g.score;
          } else {
            if (g.description) {
              const scoreKey = `${sId}_${g.description}`;
              integratedTpScores[scoreKey] = g.score;
            }
          }
        });

        // 3. Fetch nilai_rapot records for custom Sikap & Katrol values
        const kelolaNilaiRecords = await db.getKelolaNilai();
        const dbSikap: Record<string, string> = {};
        const dbKatrol: Record<string, number | ''> = {};
        
        kelolaNilaiRecords.forEach(rec => {
          const key = `${rec.student_id}_${rec.semester}`;
          if (rec.sikap !== undefined) dbSikap[key] = rec.sikap;
          if (rec.katrol !== undefined) dbKatrol[key] = rec.katrol === '' ? '' : Number(rec.katrol);
        });

        // Merge with overalls state
        setOveralls(prevOveralls => {
          const updatedOveralls = { ...prevOveralls };
          students.forEach(s => {
            const sId = s.id!;
            const key = `${sId}_${selectedSemester}`;
            const current = updatedOveralls[key] || {
              studentId: sId,
              kelas: selectedKelas,
              semester: selectedSemester,
              sts: '',
              sas: '',
              sikap: '',
              kehadiran: { sakit: 0, izin: 0, alpha: 0 },
              katrol: ''
            };

            updatedOveralls[key] = {
              ...current,
              sts: integratedSts[sId] !== undefined ? integratedSts[sId] : current.sts,
              sas: integratedSas[sId] !== undefined ? integratedSas[sId] : current.sas,
              kehadiran: attendanceCounts[sId] || current.kehadiran,
              sikap: dbSikap[key] !== undefined ? dbSikap[key] : (current.sikap || ''),
              katrol: dbKatrol[key] !== undefined ? dbKatrol[key] : (current.katrol || '')
            };
          });
          
          localStorage.setItem('pai_grades_overalls', JSON.stringify(updatedOveralls));
          return updatedOveralls;
        });

        // Merge with tpScores state
        setTpScores(prevTpScores => {
          const mergedTpScores = { ...prevTpScores, ...integratedTpScores };

          // Fallback matching by name/id: if an assessment has no score but a grade record fits by title
          students.forEach(s => {
            const studentId = s.id!;
            currentClassAssessments.forEach(asm => {
              const scoreKey = `${studentId}_${asm.id}`;
              if (mergedTpScores[scoreKey] === undefined || mergedTpScores[scoreKey] === '') {
                const matchVal = gradeRecords.find(g => 
                  g.student_id === studentId && 
                  g.description && 
                  (String(g.description).toLowerCase().trim() === String(asm.id).toLowerCase().trim() ||
                   String(g.description).toLowerCase().trim() === String(asm.name).toLowerCase().trim() ||
                   String(g.description).toLowerCase().trim() === String(asm.name).replace(/\([^\)]+\)/g, '').toLowerCase().trim())
                );
                if (matchVal) {
                  mergedTpScores[scoreKey] = matchVal.score;
                }
              }
            });
          });

          localStorage.setItem('pai_grades_tp_scores', JSON.stringify(mergedTpScores));
          return mergedTpScores;
        });

      } catch (err) {
        console.error("Gagal menyinkronkan data absensi dan nilai dari database:", err);
      }
    };

    syncDatabaseData();
  }, [selectedKelas, selectedSemester, students]);

  // Load Grade Weights, TP, Assessments, Scores, Overalls from LocalStorage
  useEffect(() => {
    // Load Weights
    const savedWeights = localStorage.getItem('pai_grade_weights');
    if (savedWeights) {
      try { 
        const parsed = JSON.parse(savedWeights);
        setWeights({
          harian: parsed.harian !== undefined ? parsed.harian : 35,
          sts: parsed.sts !== undefined ? parsed.sts : 20,
          sas: parsed.sas !== undefined ? parsed.sas : 20,
          kehadiran: parsed.kehadiran !== undefined ? parsed.kehadiran : 10,
          sikap: parsed.sikap !== undefined ? parsed.sikap : 15,
        });
      } catch (e) { console.error(e); }
    }

    // Load TP list
    const hasTpsStorage = localStorage.getItem('pai_grades_tps') !== null;
    const savedTps = db.getLocalTable<TP>('tujuan_pembelajaran');
    if (hasTpsStorage) {
      setTps(savedTps);
    } else {
      // Seed default TPs if empty and never saved before
      const defaultTps: TP[] = [
        { id: 'tp-1', code: 'TP 1', name: 'Al-Qur\'an dan Hadis', description: 'Memahami hukum bacaan Al-Qur\'an dan Hadis tentang toleransi', subject: 'Pendidikan Agama Islam (PAI)', grade: '7', semester: '1' },
        { id: 'tp-2', code: 'TP 2', name: 'Meneladani Asmaul Husna', description: 'Mengamalkan perilaku terpuji yang mencerminkan Asmaul Husna', subject: 'Pendidikan Agama Islam (PAI)', grade: '7', semester: '1' },
        { id: 'tp-3', code: 'TP 3', name: 'Indahnya Berempati', description: 'Memahami makna empati dan menghormati orang tua serta guru', subject: 'Pendidikan Agama Islam (PAI)', grade: '7', semester: '1' },
        { id: 'tp-4', code: 'TP 4', name: 'Sejarah Nabi Muhammad', description: 'Memahami lembaran sejarah perjuangan dakwah Rasulullah SAW', subject: 'Pendidikan Agama Islam (PAI)', grade: '7', semester: '1' },
        { id: 'tp-5', code: 'TP 5', name: 'Bersuci dan Shalat Berjamaah', description: 'Mempraktikkan cara bersuci dari hadas dan shalat berjamaah', subject: 'Pendidikan Agama Islam (PAI)', grade: '7', semester: '1' },
      ];
      db.setLocalTable('tujuan_pembelajaran', defaultTps);
      setTps(defaultTps);
    }

    // Load Assessments list
    const hasAsmsStorage = localStorage.getItem('pai_grades_assessments') !== null;
    const savedAsms = db.getLocalTable<TPAssessment>('asesmen_tp');
    if (hasAsmsStorage) {
      setAssessments(savedAsms);
    } else {
      // Seed default Assessments for default TPs if empty and never saved before
      const defaultAsms: TPAssessment[] = [
        { id: 'asm-1', tpId: 'tp-1', name: 'Tugas 1 (Hukum Bacaan)', type: 'Penulisan' },
        { id: 'asm-2', tpId: 'tp-1', name: 'Tugas 2 (Hafalan Surat)', type: 'Hafalan' },
        { id: 'asm-3', tpId: 'tp-1', name: 'Tugas 3 (Kaidah Tajwid)', type: 'Observasi' },
        { id: 'asm-4', tpId: 'tp-2', name: 'Tugas 1 (Arti Asmaul Husna)', type: 'Penulisan' },
        { id: 'asm-5', tpId: 'tp-2', name: 'Tugas 2 (Penerapan Kehidupan)', type: 'Observasi' },
        { id: 'asm-6', tpId: 'tp-3', name: 'Tugas 1 (Kisah Empati)', type: 'Penulisan' },
        { id: 'asm-7', tpId: 'tp-3', name: 'Tugas 2 (Praktik Hormat)', type: 'Praktik' },
        { id: 'asm-8', tpId: 'tp-4', name: 'Tugas 1 (Uraian Dakwah Makkah)', type: 'Penulisan' },
        { id: 'asm-9', tpId: 'tp-4', name: 'Tugas 2 (Proyek Silsilah)', type: 'Proyek' },
        { id: 'asm-10', tpId: 'tp-5', name: 'Tugas 1 (Wudhu & Tayamum)', type: 'Praktik' },
        { id: 'asm-11', tpId: 'tp-5', name: 'Tugas 2 (Bacaan Shalat)', type: 'Hafalan' },
      ];
      db.setLocalTable('asesmen_tp', defaultAsms);
      setAssessments(defaultAsms);
    }

    // Load TP Scores
    const savedTpScores = localStorage.getItem('pai_grades_tp_scores');
    if (savedTpScores) {
      try { setTpScores(JSON.parse(savedTpScores)); } catch (e) { console.error(e); }
    }

    // Load Overall records
    const savedOveralls = localStorage.getItem('pai_grades_overalls');
    if (savedOveralls) {
      try { setOveralls(JSON.parse(savedOveralls)); } catch (e) { console.error(e); }
    }
  }, []);

  // Sync state to local storage helper
  const saveTpsToStorage = (updatedTps: TP[]) => {
    db.setLocalTable('tujuan_pembelajaran', updatedTps);
    setTps(updatedTps);
  };

  const saveAssessmentsToStorage = (updatedAsms: TPAssessment[]) => {
    db.setLocalTable('asesmen_tp', updatedAsms);
    setAssessments(updatedAsms);
  };

  const saveTpScoresToStorage = (updatedScores: Record<string, number>) => {
    localStorage.setItem('pai_grades_tp_scores', JSON.stringify(updatedScores));
    setTpScores(updatedScores);
  };

  const saveOverallsToStorage = (updatedOveralls: Record<string, CourseOverallScore>) => {
    localStorage.setItem('pai_grades_overalls', JSON.stringify(updatedOveralls));
    setOveralls(updatedOveralls);
  };

  // Switch initial selection when tab state changes
  useEffect(() => {
    const currentClassTps = tps.filter(t => String(t.grade) === String(selectedGrade) && String(t.semester) === String(selectedSemester));
    if (currentClassTps.length > 0 && !selectedTpId) {
      setSelectedTpId(currentClassTps[0].id);
    }
  }, [tps, selectedGrade, selectedSemester, selectedTpId]);

  // Sync tpForm with selectedGrade and selectedSemester
  useEffect(() => {
    setTpForm(prev => ({
      ...prev,
      grade: selectedGrade,
      semester: selectedSemester,
      code: `TP ${tps.filter(t => String(t.grade) === String(selectedGrade) && String(t.semester) === String(selectedSemester)).length + 1}`
    }));
  }, [selectedGrade, selectedSemester, tps]);

  // --- BUSINESS LOGIC AND ACTIONS ---

  // 1. Core TP Manage
  const handleGenerateDefaultTps = () => {
    const gradeLevel = selectedGrade;
    const smt = selectedSemester;

    // Define standard TPs for each combination
    const tpsPreset: Omit<TP, 'id'>[] = [];
    const asmsPreset: { tpIndex: number; name: string; type: string }[] = [];

    if (gradeLevel === '7') {
      if (smt === '1') {
        tpsPreset.push(
          { code: 'TP 1', name: 'Al-Qur\'an dan Hadis', description: 'Memahami hukum bacaan Al-Qur\'an dan Hadis tentang toleransi', subject: 'Pendidikan Agama Islam (PAI)', grade: '7', semester: '1' },
          { code: 'TP 2', name: 'Meneladani Asmaul Husna', description: 'Mengamalkan perilaku terpuji yang mencerminkan Asmaul Husna', subject: 'Pendidikan Agama Islam (PAI)', grade: '7', semester: '1' },
          { code: 'TP 3', name: 'Indahnya Berempati', description: 'Memahami makna empati dan menghormati orang tua serta guru', subject: 'Pendidikan Agama Islam (PAI)', grade: '7', semester: '1' },
          { code: 'TP 4', name: 'Sejarah Nabi Muhammad', description: 'Memahami lembaran sejarah perjuangan dakwah Rasulullah SAW', subject: 'Pendidikan Agama Islam (PAI)', grade: '7', semester: '1' },
          { code: 'TP 5', name: 'Bersuci dan Shalat Berjamaah', description: 'Mempraktikkan cara bersuci dari hadas dan shalat berjamaah', subject: 'Pendidikan Agama Islam (PAI)', grade: '7', semester: '1' }
        );
        asmsPreset.push(
          { tpIndex: 0, name: 'Tugas 1 (Hukum Bacaan)', type: 'Penulisan' },
          { tpIndex: 0, name: 'Tugas 2 (Hafalan Surat)', type: 'Hafalan' },
          { tpIndex: 1, name: 'Tugas 1 (Arti Asmaul Husna)', type: 'Penulisan' },
          { tpIndex: 1, name: 'Tugas 2 (Penerapan Sifat)', type: 'Observasi' },
          { tpIndex: 2, name: 'Tugas 1 (Kisah Empati)', type: 'Penulisan' },
          { tpIndex: 2, name: 'Tugas 2 (Sikap Hormat)', type: 'Praktik' },
          { tpIndex: 3, name: 'Tugas 1 (Uraian Dakwah)', type: 'Penulisan' },
          { tpIndex: 3, name: 'Tugas 2 (Proyek Silsilah)', type: 'Proyek' },
          { tpIndex: 4, name: 'Tugas 1 (Praktik Wudhu)', type: 'Praktik' },
          { tpIndex: 4, name: 'Tugas 2 (Bacaan Shalat)', type: 'Hafalan' }
        );
      } else {
        tpsPreset.push(
          { code: 'TP 6', name: 'Membaca QS. Al-Anbiya', description: 'Membaca dengan tartil QS. Al-Anbiya dan Al-A\'raf tentang kelestarian alam', subject: 'Pendidikan Agama Islam (PAI)', grade: '7', semester: '2' },
          { code: 'TP 7', name: 'Iman Kepada Malaikat', description: 'Mengenal nama-nama malaikat Allah SWT dan meyakini tugas-tugasnya', subject: 'Pendidikan Agama Islam (PAI)', grade: '7', semester: '2' },
          { code: 'TP 8', name: 'Mawas Diri & Introspeksi', description: 'Menghindari sifat tercela seperti ghibah, hasad, tamak dan dengki', subject: 'Pendidikan Agama Islam (PAI)', grade: '7', semester: '2' },
          { code: 'TP 9', name: 'Masyarakat Madinah', description: 'Sejarah perjuangan dakwah Nabi periode Madinah dalam keragaman', subject: 'Pendidikan Agama Islam (PAI)', grade: '7', semester: '2' },
          { code: 'TP 10', name: 'Makanan Halal & Thayyib', description: 'Mengkonsumsi makanan dan minuman yang halal dan bergizi tinggi', subject: 'Pendidikan Agama Islam (PAI)', grade: '7', semester: '2' }
        );
        asmsPreset.push(
          { tpIndex: 0, name: 'Tugas 1 (Bacaan Tartil)', type: 'Hafalan' },
          { tpIndex: 0, name: 'Tugas 2 (Kandungan QS)', type: 'Penulisan' },
          { tpIndex: 1, name: 'Tugas 1 (Tabel Sifat)', type: 'Penulisan' },
          { tpIndex: 1, name: 'Tugas 2 (Sikap Kejujuran)', type: 'Observasi' },
          { tpIndex: 2, name: 'Tugas 1 (Analisis Ghibah)', type: 'Penulisan' },
          { tpIndex: 3, name: 'Tugas 1 (Piagam Madinah)', type: 'Proyek' },
          { tpIndex: 4, name: 'Tugas 1 (Kriteria Halalan)', type: 'Penulisan' }
        );
      }
    } else if (gradeLevel === '8') {
      if (smt === '1') {
        tpsPreset.push(
          { code: 'TP 1', name: 'Kelestarian Lingkungan', description: 'Mengkaji QS. Ar-Rum tentang tanggung jawab memelihara alam semesta', subject: 'Pendidikan Agama Islam (PAI)', grade: '8', semester: '1' },
          { code: 'TP 2', name: 'Iman Kepada Kitab Allah', description: 'Meyakini kitab-kitab Allah SWT dan menjadikannya pedoman hidup', subject: 'Pendidikan Agama Islam (PAI)', grade: '8', semester: '1' },
          { code: 'TP 3', name: 'Menjauhi Khamr & Judi', description: 'Menghindari minuman keras, judi, dan pertengkaran demi ketenangan', subject: 'Pendidikan Agama Islam (PAI)', grade: '8', semester: '1' },
          { code: 'TP 4', name: 'Sejarah Daulah Abbasiyah', description: 'Meneladani kemajuan ilmu pengetahuan pada masa Daulah Abbasiyah', subject: 'Pendidikan Agama Islam (PAI)', grade: '8', semester: '1' },
          { code: 'TP 5', name: 'Ibadah Puasa Wajib & Sunnah', description: 'Memahami ketentuan, syarat sah, batal, dan hikmah ibadah puasa', subject: 'Pendidikan Agama Islam (PAI)', grade: '8', semester: '1' }
        );
        asmsPreset.push(
          { tpIndex: 0, name: 'Tugas 1 (Hafalan QS Ar-Rum)', type: 'Hafalan' },
          { tpIndex: 0, name: 'Tugas 2 (Analisis Al-Quran)', type: 'Penulisan' },
          { tpIndex: 1, name: 'Tugas 1 (Sejarah Kitab)', type: 'Penulisan' },
          { tpIndex: 2, name: 'Tugas 1 (Bahaya Khamr)', type: 'Observasi' },
          { tpIndex: 3, name: 'Tugas 1 (Tokoh Abbasiyah)', type: 'Penulisan' },
          { tpIndex: 4, name: 'Tugas 1 (Kaidah Puasa)', type: 'Penulisan' }
        );
      } else {
        tpsPreset.push(
          { code: 'TP 6', name: 'Kebaikan Sosial & Toleransi', description: 'Memahami QS. Al-Kafirun dan QS. Yunus tentang kedamaian berbangsa', subject: 'Pendidikan Agama Islam (PAI)', grade: '8', semester: '2' },
          { code: 'TP 7', name: 'Iman Kepada Rasul', description: 'Meneladani sifat mulia Shidiq, Tabligh, Amanah, Fathanah para rasul', subject: 'Pendidikan Agama Islam (PAI)', grade: '8', semester: '2' },
          { code: 'TP 8', name: 'Sikap Jujur & Adil', description: 'Membiasakan berperilaku jujur dan adil di lingkungan rumah dan sekolah', subject: 'Pendidikan Agama Islam (PAI)', grade: '8', semester: '2' },
          { code: 'TP 9', name: 'Islam di Nusantara', description: 'Mempelajari jalur masuknya Islam dan kearifan lokal di Indonesia', subject: 'Pendidikan Agama Islam (PAI)', grade: '8', semester: '2' },
          { code: 'TP 10', name: 'Haji & Umrah', description: 'Ketentuan manasik haji serta umrah sesuai syariat Islam', subject: 'Pendidikan Agama Islam (PAI)', grade: '8', semester: '2' }
        );
        asmsPreset.push(
          { tpIndex: 0, name: 'Tugas 1 (Toleransi)', type: 'Penulisan' },
          { tpIndex: 1, name: 'Tugas 1 (Kisah Rasul Ulul Azmi)', type: 'Penulisan' },
          { tpIndex: 2, name: 'Tugas 1 (Studi Kasus Adil)', type: 'Observasi' },
          { tpIndex: 3, name: 'Tugas 1 (Peta Dakwah Nusantara)', type: 'Proyek' },
          { tpIndex: 4, name: 'Tugas 1 (Praktik Manasik)', type: 'Praktik' }
        );
      }
    } else if (gradeLevel === '9') {
      if (smt === '1') {
        tpsPreset.push(
          { code: 'TP 1', name: 'Iman Kepada Hari Akhir', description: 'Memahami fenomena kiamat sughra dan kubra serta hikmah hari akhir', subject: 'Pendidikan Agama Islam (PAI)', grade: '9', semester: '1' },
          { code: 'TP 2', name: 'Optimis & Tawakal', description: 'Memahami QS. Az-Zumar tentang harapan dan usaha pantang menyerah', subject: 'Pendidikan Agama Islam (PAI)', grade: '9', semester: '1' },
          { code: 'TP 3', name: 'Menghargai Keberagaman', description: 'Menerapkan cinta tanah air dan persaudaraan sesama anak bangsa', subject: 'Pendidikan Agama Islam (PAI)', grade: '9', semester: '1' },
          { code: 'TP 4', name: 'Qadha dan Qadar', description: 'Meyakini takdir Allah SWT dengan tetap giat bekerja dan belajar', subject: 'Pendidikan Agama Islam (PAI)', grade: '9', semester: '1' },
          { code: 'TP 5', name: 'Zakat Fitrah & Mal', description: 'Mempraktikkan pembagian zakat guna membantu mustahik ekonomi lemah', subject: 'Pendidikan Agama Islam (PAI)', grade: '9', semester: '1' }
        );
        asmsPreset.push(
          { tpIndex: 0, name: 'Tugas 1 (Tahapan Hari Kiamat)', type: 'Penulisan' },
          { tpIndex: 1, name: 'Tugas 1 (Hafalan Surat)', type: 'Hafalan' },
          { tpIndex: 2, name: 'Tugas 1 (Sikap Moderat)', type: 'Observasi' },
          { tpIndex: 3, name: 'Tugas 1 (Hikmah Takdir)', type: 'Penulisan' },
          { tpIndex: 4, name: 'Tugas 1 (Perhitungan Zakat)', type: 'Penulisan' }
        );
      } else {
        tpsPreset.push(
          { code: 'TP 6', name: 'Etika Media Sosial', description: 'Adab menyaring berita (Tabayyun) dan kesantunan dalam menyebarkan info', subject: 'Pendidikan Agama Islam (PAI)', grade: '9', semester: '2' },
          { code: 'TP 7', name: 'Sejarah Daulah Usmaniyah', description: 'Mempelajari peradaban Islam luar biasa pada masa Daulah Usmaniyah', subject: 'Pendidikan Agama Islam (PAI)', grade: '9', semester: '2' },
          { code: 'TP 8', name: 'Syariat Aqiqah & Qurban', description: 'Ketentuan dan hikmah ibadah penyembelihan aqiqah dan hewan qurban', subject: 'Pendidikan Agama Islam (PAI)', grade: '9', semester: '2' },
          { code: 'TP 9', name: 'Pernikahan dalam Islam', description: 'Ketentuan nikah, rukun, syarat dan tujuan mulia ibadah keluarga', subject: 'Pendidikan Agama Islam (PAI)', grade: '9', semester: '2' },
          { code: 'TP 10', name: 'Dakwah Wali Songo', description: 'Meneladani strategi dakwah kultural Wali Songo di Nusantara', subject: 'Pendidikan Agama Islam (PAI)', grade: '9', semester: '2' }
        );
        asmsPreset.push(
          { tpIndex: 0, name: 'Tugas 1 (Analisis Hoax)', type: 'Penulisan' },
          { tpIndex: 1, name: 'Tugas 1 (Uraian Sejarah Usmaniyah)', type: 'Penulisan' },
          { tpIndex: 2, name: 'Tugas 1 (Syarat Qurban)', type: 'Penulisan' },
          { tpIndex: 3, name: 'Tugas 1 (Uraian Nikah)', type: 'Penulisan' },
          { tpIndex: 4, name: 'Tugas 1 (Tokoh Walisongo)', type: 'Hafalan' }
        );
      }
    }

    // Now insert them!
    const newTps: TP[] = [];
    const newAsms: TPAssessment[] = [];

    // Filter existing ones to avoid duplicating existing code
    const currentClassTpsInternal = tps.filter(t => String(t.grade) === String(gradeLevel) && String(t.semester) === String(smt));
    const existingCodes = currentClassTpsInternal.map(t => t.code);
    
    tpsPreset.forEach((preset, idx) => {
      if (existingCodes.includes(preset.code)) return; // skip if already exists

      const tpId = 'tp_auto_' + Math.random().toString(36).substr(2, 9);
      const builtTp: TP = {
        id: tpId,
        ...preset
      };
      newTps.push(builtTp);

      // Map corresponding assessments
      asmsPreset.filter(a => a.tpIndex === idx).forEach(aPreset => {
        const asmId = 'asm_auto_' + Math.random().toString(36).substr(2, 9);
        newAsms.push({
          id: asmId,
          tpId: tpId,
          name: aPreset.name,
          type: aPreset.type
        });
      });
    });

    if (newTps.length === 0) {
      Swal.fire({
        icon: 'info',
        title: 'TP Sudah Ada',
        text: `Tujuan Pembelajaran Kurikulum Merdeka untuk Kelas ${gradeLevel} Semester ${smt} sudah terdaftar semuanya!`,
        heightAuto: false
      });
      return;
    }

    const updatedTps = [...tps, ...newTps];
    const updatedAsms = [...assessments, ...newAsms];

    saveTpsToStorage(updatedTps);
    saveAssessmentsToStorage(updatedAsms);

    Swal.fire({
      icon: 'success',
      title: 'Bobot Nilai Berhasil Dibuat!',
      text: `${newTps.length} TP baru dan ${newAsms.length} Penilaian standar berhasil dibuat otomatis untuk Tingkat Kelas ${gradeLevel}.`,
      heightAuto: false
    });
  };

  // 1. Core TP Manage
  const handleSaveTp = () => {
    if (!tpForm.code.trim() || !tpForm.name.trim() || !tpForm.description.trim()) {
      Swal.fire({ icon: 'warning', title: 'Data Kurang', text: 'Mohon isi semua field TP (Kode, Nama, Deskripsi)', heightAuto: false });
      return;
    }

    if (editingTpId) {
      const updated = tps.map(t => t.id === editingTpId ? { ...t, ...tpForm } : t);
      saveTpsToStorage(updated);
      setEditingTpId(null);
      Swal.fire({ icon: 'success', title: 'TP Berhasil Diedit', timer: 1500, showConfirmButton: false, heightAuto: false });
    } else {
      const newTp: TP = {
        id: 'tp_' + Math.random().toString(36).substr(2, 9),
        ...tpForm
      };
      saveTpsToStorage([...tps, newTp]);
      Swal.fire({ icon: 'success', title: 'TP Berhasil Ditambahkan', timer: 1500, showConfirmButton: false, heightAuto: false });
    }

    // Reset Form (keep subject/grade/semester fields aligned)
    setTpForm(prev => ({
      ...prev,
      code: `TP ${tps.length + (editingTpId ? 1 : 2)}`,
      name: '',
      description: '',
    }));
  };

  const handleEditTpInitiate = (tp: TP) => {
    setEditingTpId(tp.id);
    setTpForm({
      code: tp.code,
      name: tp.name,
      description: tp.description,
      subject: tp.subject,
      grade: tp.grade,
      semester: tp.semester,
    });
  };

  const handleDeleteTp = async (id: string) => {
    const confirm = await Swal.fire({
      title: 'Hapus TP?',
      text: 'Semua penilaian dan nilai yang terikat dengan TP ini juga akan dihapus permanen!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      heightAuto: false
    });

    if (!confirm.isConfirmed) return;

    // Remove TP
    const updatedTps = tps.filter(t => t.id !== id);
    saveTpsToStorage(updatedTps);

    // Filter out related Assessments
    const relatedAsms = assessments.filter(a => a.tpId === id);
    const relatedAsmIds = relatedAsms.map(a => a.id);
    const updatedAsms = assessments.filter(a => a.tpId !== id);
    saveAssessmentsToStorage(updatedAsms);

    // Clean TP Scores
    const updatedScores = { ...tpScores };
    Object.keys(updatedScores).forEach(key => {
      const parts = key.split('_');
      if (parts.length > 1 && relatedAsmIds.includes(parts[1])) {
        delete updatedScores[key];
      }
    });
    saveTpScoresToStorage(updatedScores);

    Swal.fire({ icon: 'success', title: 'TP Dihapus', timer: 1500, showConfirmButton: false, heightAuto: false });
  };

  // 2. Assessmemts per TP Actions
  const handleAddAssessment = () => {
    if (!selectedTpId) {
      Swal.fire({ icon: 'warning', title: 'Pilih TP', text: 'Buat atau pilih salah satu TP terlebih dahulu!', heightAuto: false });
      return;
    }
    if (!asmForm.name.trim()) {
      Swal.fire({ icon: 'warning', title: 'Isi Nama Tugas', text: 'Nama penilaian wajib diisi (Contoh: Tugas 1)', heightAuto: false });
      return;
    }

    const newAsm: TPAssessment = {
      id: 'asm_' + Math.random().toString(36).substr(2, 9),
      tpId: selectedTpId,
      name: asmForm.name.trim(),
      type: asmForm.type,
    };

    const updated = [...assessments, newAsm];
    saveAssessmentsToStorage(updated);

    // Auto increment default name for utility
    const nextNum = parseInt(asmForm.name.replace(/^\D+/g, '')) || 0;
    setAsmForm(prev => ({
      ...prev,
      name: `Tugas ${nextNum ? nextNum + 1 : assessments.filter(a => a.tpId === selectedTpId).length + 2}`
    }));

    Swal.fire({ icon: 'success', title: 'Penilaian Berhasil Ditambahkan', timer: 1500, showConfirmButton: false, heightAuto: false });
  };

  const handleDeleteAssessment = async (id: string) => {
    const confirm = await Swal.fire({
      title: 'Hapus Penilaian?',
      text: 'Nilai siswa untuk tugas ini juga akan terhapus!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      heightAuto: false
    });

    if (!confirm.isConfirmed) return;

    const updatedAsms = assessments.filter(a => a.id !== id);
    saveAssessmentsToStorage(updatedAsms);

    // Clean scores
    const updatedScores = { ...tpScores };
    Object.keys(updatedScores).forEach(key => {
      const parts = key.split('_');
      if (parts.length > 1 && parts[1] === id) {
        delete updatedScores[key];
      }
    });
    saveTpScoresToStorage(updatedScores);

    Swal.fire({ icon: 'success', title: 'Penilaian Dihapus', timer: 1500, showConfirmButton: false, heightAuto: false });
  };


  // --- HELPER MATH CALCULATOR FUNCTIONS & DERIVED STATES ---

  // Filter current active TPs according to grade and semester (sorted starting from TP 1)
  const currentClassTps = tps
    .filter(t => String(t.grade) === String(selectedGrade) && String(t.semester) === String(selectedSemester))
    .sort((a, b) => {
      const codeA = String(a.code || '').toLowerCase();
      const codeB = String(b.code || '').toLowerCase();
      return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
    });
  
  // Get all Assessments tied to current class TPs (sorted by matching TP order starting from TP 1)
  const currentClassTpsIds = currentClassTps.map(t => t.id);
  const currentClassAssessments = assessments
    .filter(a => currentClassTpsIds.includes(a.tpId))
    .sort((a, b) => {
      const idxA = currentClassTpsIds.indexOf(a.tpId);
      const idxB = currentClassTpsIds.indexOf(b.tpId);
      return idxA - idxB;
    });

  // Calculates a specific student's aggregate score for individual TPs
  const calculateStudentTpScore = (studentId: string, tpId: string): number | null => {
    const relatedAsms = assessments.filter(a => a.tpId === tpId);
    if (relatedAsms.length === 0) return null;

    let sum = 0;
    let count = 0;
    relatedAsms.forEach(asm => {
      const scoreKey = `${studentId}_${asm.id}`;
      const scoreVal = tpScores[scoreKey];
      if (scoreVal !== undefined && scoreVal !== null && scoreVal !== '') {
        sum += Number(scoreVal);
        count++;
      }
    });

    return count > 0 ? parseFloat((sum / count).toFixed(1)) : null;
  };

  // Calculates a specific student's grand average Daily Grade (Nilai Harian = avg of all defined TPs)
  const calculateStudentNilaiHarian = (studentId: string): number | null => {
    if (currentClassTps.length === 0) return null;

    let sum = 0;
    let count = 0;

    currentClassTps.forEach(tp => {
      const tpScore = calculateStudentTpScore(studentId, tp.id);
      if (tpScore !== null) {
        sum += tpScore;
        count++;
      }
    });

    return count > 0 ? parseFloat((sum / count).toFixed(1)) : null;
  };

  // Attendance and Attitude scoring helper
  const getAttendanceScore = (sakit: number = 0, izin: number = 0, alpha: number = 0): number => {
    const deduction = (sakit * 1) + (izin * 2) + (alpha * 5);
    return Math.max(0, 100 - deduction);
  };

  const getAttitudeScore = (sikapStr: string, nhScore: number | null): number => {
    if (sikapStr === 'Sangat Baik') return 95;
    if (sikapStr === 'Baik') return 85;
    if (sikapStr === 'Cukup') return 75;
    if (sikapStr === 'Perlu Bimbingan') return 60;
    
    // Auto fallback: use NH score if defined, otherwise 85 (Baik)
    return nhScore !== null ? Math.round(nhScore) : 85;
  };

  // Calculate student final semester grade with 5 weighted values
  const calculateStudentNilaiAkhir = (studentId: string): { 
    harian: number | null, 
    sts: number, 
    sas: number, 
    kehadiranScore: number,
    sikapScore: number,
    finalScore: number | null 
  } => {
    const harian = calculateStudentNilaiHarian(studentId);
    const overallKey = `${studentId}_${selectedSemester}`;
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

  // Predicate mapper: A, B, C, D with highly dynamic descriptions based on student's highest & lowest TP scores
  const getPredicateAndDesc = (score: number | null, studentId?: string): { pred: string; desc: string } => {
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

    if (!studentId || currentClassTps.length === 0) {
      return { pred, desc: fallbackDesc[pred] };
    }

    // Hitung nilai masing-masing TP untuk siswa ini
    const tpEvaluations = currentClassTps
      .map(tp => {
        const val = calculateStudentTpScore(studentId, tp.id);
        return { tp, score: val };
      })
      .filter((item): item is { tp: typeof currentClassTps[number], score: number } => item.score !== null);

    if (tpEvaluations.length === 0) {
      return { pred, desc: fallbackDesc[pred] };
    }

    // Urutkan untuk mencari TP tertinggi dan terendah
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

  // Handle live score editing inside the spreadsheet
  const handleScoreChange = (studentId: string, assessmentId: string, value: string) => {
    const num = value === '' ? '' : parseInt(value);
    
    // Bounds check
    if (num !== '') {
      if (isNaN(num) || num < 0 || num > 100) return;
    }

    const key = `${studentId}_${assessmentId}`;
    const newScores = { ...tpScores };
    if (num === '') {
      delete newScores[key];
    } else {
      newScores[key] = num;
    }

    // Save as state and local storage instantly!
    setTpScores(newScores);
    localStorage.setItem('pai_grades_tp_scores', JSON.stringify(newScores));
  };

  // Handle live overall fields change (STS, SAS, Sikap, Attendance, Katrol)
  const handleOverallChange = (studentId: string, field: 'sts' | 'sas' | 'sikap' | 'sakit' | 'izin' | 'alpha' | 'katrol', value: any) => {
    const key = `${studentId}_${selectedSemester}`;
    const currentOverall = overalls[key] || {
      studentId,
      kelas: selectedKelas,
      semester: selectedSemester,
      sts: '',
      sas: '',
      sikap: '',
      kehadiran: { sakit: 0, izin: 0, alpha: 0 },
      katrol: ''
    };

    let updated = { ...currentOverall };

    if (field === 'sts' || field === 'sas') {
      const num = value === '' ? '' : parseInt(value);
      if (num !== '') {
        if (isNaN(num) || num < 0 || num > 100) return;
      }
      updated[field] = num;
    } else if (field === 'katrol') {
      const num = value === '' ? '' : parseInt(value);
      if (num !== '' && isNaN(num)) return;
      updated.katrol = num;
    } else if (field === 'sikap') {
      updated.sikap = value;
    } else {
      // Attendance fields
      const num = value === '' ? 0 : parseInt(value);
      if (isNaN(num) || num < 0) return;
      
      updated.kehadiran = {
        ...updated.kehadiran,
        [field]: num
      };
    }

    const newOveralls = { ...overalls, [key]: updated };
    setOveralls(newOveralls);
    localStorage.setItem('pai_grades_overalls', JSON.stringify(newOveralls));
  };

  // Helper score range mapping for Attitude
  const getAttitudeTextFromScore = (score: number | null): string => {
    if (score === null) return '-';
    if (score >= 91) return 'Sangat Baik';
    if (score >= 81) return 'Baik';
    if (score >= 71) return 'Cukup';
    return 'Perlu Bimbingan';
  };

  // --- BULK ACTION FOR SPREADSHEET INDIVIDUALS ---
  const handleClearCurrentData = async () => {
    const confirm = await Swal.fire({
      title: 'Bersihkan Semua Nilai?',
      text: `Menghapus semua rekam input nilai TP, STS, SAS, sikap, dan kehadiran untuk Kelas ${selectedKelas} Semester ${selectedSemester}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      heightAuto: false
    });

    if (!confirm.isConfirmed) return;

    // Remove scores of current students
    const studentIds = students.map(s => s.id!).filter(Boolean);
    const updatedScores = { ...tpScores };
    
    Object.keys(updatedScores).forEach(key => {
      const studentId = key.split('_')[0];
      if (studentIds.includes(studentId)) {
        delete updatedScores[key];
      }
    });

    const updatedOveralls = { ...overalls };
    studentIds.forEach(id => {
      delete updatedOveralls[`${id}_${selectedSemester}`];
    });

    saveTpScoresToStorage(updatedScores);
    saveOverallsToStorage(updatedOveralls);

    Swal.fire({ icon: 'success', title: 'Data Direset', timer: 1500, showConfirmButton: false, heightAuto: false });
  };

  const handleSaveAndSyncKelolaNilai = async () => {
    if (students.length === 0) return;
    setSyncingKelola(true);
    
    Swal.fire({
      title: 'Menyimpan & Menyinkronkan...',
      text: 'Merekap nilai akhir dan mengirim data ke Google Sheets...',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
      heightAuto: false
    });

    try {
      // 1. Calculate each student's final score and prepare clean records
      const recordsToSave = students.map(student => {
        const studentId = student.id!;
        const calculs = calculateStudentNilaiAkhir(studentId);
        
        const overallKey = `${studentId}_${selectedSemester}`;
        const over = overalls[overallKey] || {
          studentId,
          kelas: selectedKelas,
          semester: selectedSemester,
          sts: '',
          sas: '',
          sikap: '',
          kehadiran: { sakit: 0, izin: 0, alpha: 0 },
          katrol: ''
        };

        return {
          id: overallKey,
          student_id: studentId,
          nama_siswa: student.namalengkap || '-',
          nis: student.nis || '-',
          kelas: selectedKelas,
          semester: selectedSemester,
          sts: over.sts !== '' ? Number(over.sts) : '',
          sas: over.sas !== '' ? Number(over.sas) : '',
          sakit: over.kehadiran?.sakit || 0,
          izin: over.kehadiran?.izin || 0,
          alpha: over.kehadiran?.alpha || 0,
          sikap: over.sikap || '',
          katrol: over.katrol !== '' ? Number(over.katrol) : '',
          nilai_akhir: calculs.finalScore !== null ? calculs.finalScore : ''
        };
      });

      // 2. Save list for this class & semester (triggers background sync!)
      await db.saveKelolaNilai(recordsToSave);

      // 3. Sync Ledger scores directly to student "Nilai" table so they show up publically under /#/nilai
      for (const student of students) {
        const studentId = student.id!;
        const calculs = calculateStudentNilaiAkhir(studentId);
        const overallKey = `${studentId}_${selectedSemester}`;
        const over = overalls[overallKey] || {
          sts: '',
          sas: '',
          sikap: '',
          kehadiran: { sakit: 0, izin: 0, alpha: 0 }
        };

        const listToUpdate: Array<{ score: number; type: 'harian' | 'uts' | 'uas' | 'praktik'; desc: string }> = [];

        // Rata-Rata Harian
        if (calculs.harian !== null) {
          listToUpdate.push({
            score: Math.round(calculs.harian),
            type: 'harian',
            desc: 'Rata-Rata Nilai Harian (TP)'
          });
        }

        // STS
        if (over.sts !== '') {
          listToUpdate.push({
            score: Number(over.sts),
            type: 'uts',
            desc: 'Sumatif Tengah Semester (STS)'
          });
        }

        // SAS
        if (over.sas !== '') {
          listToUpdate.push({
            score: Number(over.sas),
            type: 'uas',
            desc: 'Sumatif Akhir Semester (SAS)'
          });
        }

        // Sikap
        const attitudeVal = over.sikap || getAttitudeTextFromScore(calculs.sikapScore);
        listToUpdate.push({
          score: calculs.sikapScore,
          type: 'praktik',
          desc: `Penilaian Sikap: ${attitudeVal}`
        });

        // Kehadiran
        listToUpdate.push({
          score: calculs.kehadiranScore,
          type: 'harian',
          desc: `Persentase Kehadiran (Sakit: ${over.kehadiran?.sakit || 0}, Izin: ${over.kehadiran?.izin || 0}, Alfa: ${over.kehadiran?.alpha || 0})`
        });

        // RATA-RATA TOTAL / LEDGER
        const hVal = calculs.harian ?? 0;
        const stsVal = over.sts !== '' ? Number(over.sts) : 0;
        const sasVal = over.sas !== '' ? Number(over.sas) : 0;
        const kehVal = calculs.kehadiranScore;
        const sikVal = calculs.sikapScore;
        const averageLedger = Math.round((hVal + stsVal + sasVal + kehVal + sikVal) / 5);

        listToUpdate.push({
          score: averageLedger,
          type: 'harian',
          desc: 'Rata-Rata Ledger (Harian, STS, SAS, Kehadiran, Sikap)'
        });

        // Nilai Akhir
        if (calculs.finalScore !== null) {
          listToUpdate.push({
            score: calculs.finalScore,
            type: 'uas',
            desc: 'Nilai Akhir Rapor (Nilai Rapot)'
          });
        }

        // Save each to standard db Grade table
        for (const item of listToUpdate) {
          await db.addGrade({
            student_id: studentId,
            subject_type: item.type,
            score: item.score,
            description: item.desc,
            kelas: selectedKelas,
            semester: selectedSemester,
            created_at: new Date().toISOString()
          });
        }
      }

      Swal.close();
      setTimeout(() => {
        Swal.fire({
          icon: 'success',
          title: 'Berhasil Disinkronkan!',
          text: `Data Nilai Rapot Kelas ${selectedKelas} Semester ${selectedSemester} berhasil disimpan dan disinkronkan ke Google Sheets!`,
          confirmButtonColor: '#059669',
          heightAuto: false
        });
      }, 150);
    } catch (error: any) {
      console.error(error);
      Swal.close();
      setTimeout(() => {
        Swal.fire({
          icon: 'error',
          title: 'Gagal Sinkronisasi',
          text: error.message || 'Terjadi kesalahan saat menyinkronkan data ke Google Sheets.',
          confirmButtonColor: '#dc2626',
          heightAuto: false
        });
      }, 150);
    } finally {
      setSyncingKelola(false);
    }
  };

  // Export Cumulative Spreadsheet Excel of all grades
  const handleExportExcelLedger = () => {
    if (students.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Data Siswa Kosong', text: 'Tidak ada data siswa untuk diexport', heightAuto: false });
      return;
    }

    // Build headers
    const headers = [
      'NO', 'NIS', 'NAMA LENGKAP', 'KELAS', 'SEMESTER'
    ];

    // Add TP score columns
    currentClassTps.forEach(tp => {
      headers.push(`NILAI ${tp.code}`);
    });

    headers.push('RATA-RATA HARIAN', 'SUMATIF TENGAH SMT (STS)', 'SUMATIF AKHIR SMT (SAS)', 'NILAI AKHIR', 'PREDIKAT', 'DESKRIPSI', 'NILAI SIKAP', 'SAKIT', 'IZIN', 'ALPHA');

    // Build row values
    const rows = students.map((s, idx) => {
      const calculs = calculateStudentNilaiAkhir(s.id!);
      const predObj = getPredicateAndDesc(calculs.finalScore, s.id!);
      const overallKey = `${s.id!}_${selectedSemester}`;
      const over = overalls[overallKey];

      const rowData: Record<string, any> = {
        'NO': idx + 1,
        'NIS': s.nis,
        'NAMA LENGKAP': s.namalengkap,
        'KELAS': s.kelas,
        'SEMESTER': selectedSemester === '1' ? '1 (Ganjil)' : '2 (Genap)'
      };

      // Add TP scores
      currentClassTps.forEach(tp => {
        const score = calculateStudentTpScore(s.id!, tp.id);
        rowData[`NILAI ${tp.code}`] = score !== null ? score : '-';
      });

      rowData['RATA-RATA HARIAN'] = calculs.harian !== null ? calculs.harian : '-';
      rowData['SUMATIF TENGAH SMT (STS)'] = over && over.sts !== '' ? over.sts : '-';
      rowData['SUMATIF AKHIR SMT (SAS)'] = over && over.sas !== '' ? over.sas : '-';
      rowData['NILAI AKHIR'] = calculs.finalScore !== null ? calculs.finalScore : '-';
      rowData['PREDIKAT'] = predObj.pred;
      rowData['DESKRIPSI'] = predObj.desc;
      rowData['NILAI SIKAP'] = over && over.sikap ? over.sikap : getAttitudeTextFromScore(calculs.sikapScore);
      rowData['SAKIT'] = over && over.kehadiran?.sakit ? over.kehadiran.sakit : 0;
      rowData['IZIN'] = over && over.kehadiran?.izin ? over.kehadiran.izin : 0;
      rowData['ALPHA'] = over && over.kehadiran?.alpha ? over.kehadiran.alpha : 0;

      return rowData;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `REKAP_NILAI_${selectedKelas}`);

    // Set layout parameters
    XLSX.writeFile(workbook, `Rekap_Nilai_PAI_${selectedKelas}_Smt${selectedSemester}.xlsx`);
    Swal.fire({ icon: 'success', title: 'Export Excel Berhasil', text: 'Data nilai telah diekspor', timer: 1500, showConfirmButton: false, heightAuto: false });
  };

  // Filter for search recap table
  const filteredStudents = students.filter(s => 
    s.namalengkap.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.nis.includes(searchQuery)
  );

  return (
    <div className="max-w-6xl mx-auto space-y-4 animate-fadeIn pb-24 px-2 md:px-0 font-sans">
      
      {/* HEADER BAR */}
      <div className="flex items-center justify-between pb-2">
        <button 
          onClick={() => navigate('/guru')} 
          className="group flex items-center gap-2 text-slate-700 hover:text-emerald-700 transition-all text-xs font-black uppercase tracking-wider mb-2"
          id="btn-back-to-dashboard-utama"
        >
          <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
          <span>DASHBOARD UTAMA</span>
        </button>
      </div>

      {/* COVER HEADER */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-700 text-white p-6 md:p-8 rounded-[1.8rem] md:rounded-[2.5rem] shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none transform translate-x-4">
          <Award size={180} />
        </div>
        <div className="relative z-10 space-y-2">
          <span className="bg-emerald-600 border border-emerald-500 text-emerald-50 text-[10px] md:text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full">
            Fitur Lanjutan Guru
          </span>
          <h1 className="text-xl md:text-3xl font-black uppercase tracking-tight">
            Nilai Rapot & Pencapaian TP PAI
          </h1>
          <p className="text-emerald-100/90 text-xs md:text-sm font-medium max-w-xl leading-relaxed">
            Sistem rekapitulasi penilaian digital per Tujuan Pembelajaran (TP). Hitung rata-rata, pembobotan Penilaian Harian, STS, SAS, pengubahan sikap dan kehadiran secara terintegrasi.
          </p>
        </div>
      </div>

      {/* ROUTE FILTER CONTROLLER */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mr-1">Rute Kelas:</span>
          
          {/* JENJANG */}
          <div className="flex rounded-xl bg-slate-100 p-0.5">
            {(['7', '8', '9'] as const).map(g => (
              <button 
                key={g} 
                className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${selectedGrade === g ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500'}`}
                onClick={() => setSelectedGrade(g)}
              >
                Kls {g}
              </button>
            ))}
          </div>

          {/* KELAS SELECTION */}
          <select 
            value={selectedKelas} 
            onChange={(e) => setSelectedKelas(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-black outline-none bg-slate-50 text-slate-800 focus:bg-white focus:border-emerald-500"
          >
            <option value="">-- Pilih Kelas --</option>
            {availableClasses.map(k => <option key={k} value={k}>{k}</option>)}
          </select>

          {/* SEMESTER */}
          <select 
            value={selectedSemester} 
            onChange={(e) => setSelectedSemester(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-black outline-none bg-slate-50 text-slate-800 focus:bg-white focus:border-emerald-500"
          >
            <option value="1">Semester 1 (Ganjil)</option>
            <option value="2">Semester 2 (Genap)</option>
          </select>
        </div>

        <div className="bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-xl text-[10px] md:text-sm font-bold flex items-center gap-1.5 border border-emerald-100">
          <Users size={14} className="text-emerald-600" />
          <span>Siswa Aktif: <strong>{students.length} Orang</strong></span>
        </div>
      </div>

      {/* VISUAL TABS CONTROL */}
      <div className="flex border-b border-slate-200 overflow-x-auto scrollbar-none gap-1 bg-slate-100 p-1 rounded-2xl">
        <button 
          onClick={() => setActiveTab('input')}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition whitespace-nowrap ${activeTab === 'input' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
        >
          <Edit2 size={14} /> 1. Input Nilai Siswa
        </button>
        <button 
          onClick={() => setActiveTab('rekap')}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition whitespace-nowrap ${activeTab === 'rekap' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
        >
          <Scroll size={14} /> 2. Rekap Laporan Akhir
        </button>
      </div>

      {/* ========================================================
          TAB 1: KELOLA DATA TP (TUJUAN PEMBELAJARAN)
          ======================================================== */}
      {false && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Form */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h2 className="text-sm font-black uppercase text-slate-800 flex items-center gap-1.5">
              <Plus size={16} className="text-emerald-700" />
              {editingTpId ? 'Edit Tujuan Pembelajaran' : 'Tambah Tujuan Pembelajaran'}
            </h2>
            
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block ml-1 mb-1">Kode TP</label>
                <input 
                  type="text" 
                  value={tpForm.code}
                  onChange={(e) => setTpForm({ ...tpForm, code: e.target.value })}
                  placeholder="Contoh: TP 1, TP 2"
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold outline-none focus:bg-white focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block ml-1 mb-1">Nama Ringkas TP</label>
                <input 
                  type="text" 
                  value={tpForm.name}
                  onChange={(e) => setTpForm({ ...tpForm, name: e.target.value })}
                  placeholder="Contoh: Memahami Al-Qur'an & Tajwid"
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium outline-none focus:bg-white focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block ml-1 mb-1">Deskripsi Lengkap TP</label>
                <textarea 
                  value={tpForm.description}
                  onChange={(e) => setTpForm({ ...tpForm, description: e.target.value })}
                  placeholder="Tulis kompetensi materi/pembahasan secara lengkap..."
                  rows={4}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-normal outline-none focus:bg-white focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block ml-1 mb-1">Jenjang Kelas</label>
                  <select 
                    value={tpForm.grade}
                    onChange={(e) => setTpForm({ ...tpForm, grade: e.target.value })}
                    className="w-full p-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold outline-none focus:bg-white"
                  >
                    <option value="7">Kelas 7</option>
                    <option value="8">Kelas 8</option>
                    <option value="9">Kelas 9</option>
                  </select>
                </div>

                <div>
                  <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block ml-1 mb-1">Semester</label>
                  <select 
                    value={tpForm.semester}
                    onChange={(e) => setTpForm({ ...tpForm, semester: e.target.value })}
                    className="w-full p-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold outline-none focus:bg-white"
                  >
                    <option value="1">Smt Ganjil (1)</option>
                    <option value="2">Smt Genap (2)</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button 
                  onClick={handleSaveTp}
                  className="flex-1 py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs uppercase shadow-md active:scale-95 transition"
                >
                  {editingTpId ? 'Simpan Edit' : 'Simpan TP Baru'}
                </button>
                {editingTpId && (
                  <button 
                    onClick={() => {
                      setEditingTpId(null);
                      setTpForm({
                        code: `TP ${tps.length + 1}`,
                        name: '',
                        description: '',
                        subject: 'Pendidikan Agama Islam',
                        grade: selectedGrade,
                        semester: selectedSemester,
                      });
                    }}
                    className="py-3 px-4 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs uppercase"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* List of TPs */}
          <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-black uppercase text-slate-800">
                  Daftar Tujuan Pembelajaran Kelas {selectedGrade} - Semester {selectedSemester}
                </h2>
                <span className="text-[10px] text-emerald-700 font-medium block mt-0.5">
                  ✓ Berlaku untuk seluruh rombel (Kelas {selectedGrade}-A, {selectedGrade}-B, dst)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {currentClassTps.length} TP Terdaftar
                </span>
              </div>
            </div>

            {currentClassTps.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 min-h-[250px]">
                <BookOpen size={40} className="text-slate-300 mb-2" />
                <p className="text-slate-700 font-bold text-sm">Belum Ada TP Terdaftar</p>
                <p className="text-slate-400 text-xs max-w-xs mt-1">Silakan tambahkan data TP baru dengan form di kiri.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {currentClassTps.map((tp) => (
                  <div key={tp.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-emerald-100 hover:bg-emerald-50/20 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                          {tp.code}
                        </span>
                        <h3 className="font-bold text-slate-800 text-xs md:text-sm">
                          {tp.name}
                        </h3>
                      </div>
                      <p className="text-slate-500 text-[11px] leading-relaxed">
                        {tp.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                      <button 
                        onClick={() => handleEditTpInitiate(tp)}
                        className="p-2 rounded-xl bg-blue-100 hover:bg-blue-200 text-blue-700 transition"
                        title="Edit TP"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={() => handleDeleteTp(tp.id)}
                        className="p-2 rounded-xl bg-red-100 hover:bg-red-200 text-red-600 transition"
                        title="Hapus TP"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 2: PENILAIAN PER TP (ASSESSMENTS PER TP LEVEL)
          ======================================================== */}
      {false && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          
          {/* Create Assignment Form */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h2 className="text-sm font-black uppercase text-slate-800 flex items-center gap-1.5">
              <Plus size={16} className="text-emerald-700" />
              Buat Tugas Baru pada TP
            </h2>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block ml-1 mb-1">Pilih TP Pembahasan</label>
                {currentClassTps.length === 0 ? (
                  <p className="text-red-500 text-[10px] font-black italic bg-red-50 p-2 rounded-xl">Wajib membuat TP (Tab 1) terlebih dahulu!</p>
                ) : (
                  <select 
                    value={selectedTpId}
                    onChange={(e) => setSelectedTpId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold outline-none focus:bg-white"
                  >
                    {currentClassTps.map(t => (
                      <option key={t.id} value={t.id}>{t.code}: {t.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block ml-1 mb-1">Nama Tugas / Penilaian</label>
                <input 
                  type="text" 
                  value={asmForm.name}
                  onChange={(e) => setAsmForm({ ...asmForm, name: e.target.value })}
                  placeholder="Contoh: Tugas 1, Tugas Mandiri"
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium outline-none focus:bg-white focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block ml-1 mb-1">Jenis Penilaian</label>
                <input 
                  type="text" 
                  value={asmForm.type}
                  onChange={(e) => setAsmForm({ ...asmForm, type: e.target.value })}
                  placeholder="Contoh: Penulisan, Hafalan, Praktik, dsb."
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium outline-none focus:bg-white focus:border-emerald-500"
                />
              </div>

              <button 
                onClick={handleAddAssessment}
                className="w-full py-3.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs uppercase shadow-md active:scale-95 transition mt-3"
              >
                Buat Tugas Baru
              </button>
            </div>
          </div>

          {/* List of custom assignments grouped by TP */}
          <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h2 className="text-sm font-black uppercase text-slate-800">
              Struktur Penilaian per TP Kelas {selectedGrade} Smt {selectedSemester}
            </h2>

            {currentClassTps.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 rounded-2xl min-h-[250px]">
                <BookOpen size={40} className="text-slate-300" />
                <p className="text-slate-700 font-bold mt-2">Buat tujuan pembelajaran dahulu</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                {currentClassTps.map((tp) => {
                  const tpRelatedAsms = assessments.filter(a => a.tpId === tp.id);

                  return (
                    <div key={tp.id} className="p-4 rounded-2xl bg-slate-50/80 border border-slate-100 space-y-3">
                      <div className="flex justify-between items-center border-b border-slate-200/50 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="bg-emerald-700 text-white font-black text-[10px] px-2 py-0.5 rounded-md">
                            {tp.code}
                          </span>
                          <span className="font-bold text-[11px] md:text-xs text-slate-800 truncate max-w-sm">
                            {tp.name}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400">
                          {tpRelatedAsms.length} Tugas
                        </span>
                      </div>

                      {tpRelatedAsms.length === 0 ? (
                        <p className="text-slate-400 text-[10px] italic py-2 pl-1">Belum ada penilaian spesifik untuk TP ini.</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {tpRelatedAsms.map(asm => (
                            <div key={asm.id} className="bg-white p-2.5 rounded-xl border border-slate-100 flex items-center justify-between hover:border-emerald-100 transition shadow-sm">
                              <div className="text-[11px]">
                                <p className="font-black text-slate-700">{asm.name}</p>
                                <span className="text-[8px] font-black uppercase text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                  {asm.type}
                                </span>
                              </div>
                              <button 
                                onClick={() => handleDeleteAssessment(asm.id)}
                                className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition"
                                title="Hapus Tugas"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 3: BULK GRID SPREADSHEET INPUT NILAI
          ======================================================== */}
      {activeTab === 'input' && (
        <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4 font-sans">
          
          {/* Instructions and Controls */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
            <div className="space-y-1">
              <h3 className="text-xs md:text-sm font-black text-emerald-900 uppercase">Interactive Ledger (Input Langsung)</h3>
              <p className="text-[10px] md:text-xs font-semibold text-emerald-700 max-w-2xl leading-relaxed">
                Tulis nilai <strong className="text-emerald-900">0 - 100</strong> pada sel tabel di bawah. Data otomatis disimpan di latar belakang dengan live calculation rata-rata, bobot semester, serta deskripsi kelulusan.
              </p>
            </div>
            
            <div className="flex flex-wrap gap-2 self-end md:self-center">
              <button 
                onClick={handleSaveAndSyncKelolaNilai}
                disabled={syncingKelola}
                className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider transition flex items-center gap-1.5 shadow-sm disabled:opacity-50 active:scale-95 duration-100"
              >
                <Save size={13} />
                {syncingKelola ? 'Menyinkronkan...' : 'Simpan & Sinkronkan Google Sheets'}
              </button>

              <button 
                onClick={handleClearCurrentData}
                className="py-1.5 px-3 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 text-[10px] font-bold uppercase tracking-wider transition active:scale-95 duration-100"
              >
                Reset Data Kelas
              </button>
            </div>
          </div>

          {/* SPREADSHEET WRAPPER AND CARIOUS COLS */}
          {students.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-50 rounded-2xl min-h-[300px]">
              <Users size={40} className="text-slate-300 mb-2" />
              <p className="text-slate-700 font-bold">Tidak ada data siswa</p>
              <p className="text-slate-400 text-xs mt-1">Ganti rute jenjang/pilih nomor kelas yang valid di atas.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-100 rounded-xl relative">
              <table className="w-full text-left border-collapse min-w-[1200px]">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200">
                    <th className="p-3 text-[10px] font-black uppercase text-slate-500 tracking-wider w-12 sticky left-0 bg-slate-100 z-10">No</th>
                    <th className="p-3 text-[10px] font-black uppercase text-slate-500 tracking-wider w-36 sticky left-12 bg-slate-100 z-10 border-r border-slate-200">Nama Siswa / NIS</th>
                    
                    {/* TP assessments columns */}
                    {currentClassAssessments.map(asm => {
                      const relatedTp = currentClassTps.find(t => t.id === asm.tpId);
                      return (
                        <th key={asm.id} className="p-2.5 text-[9px] font-black text-center text-slate-600 bg-amber-50/50 border-r border-slate-200 w-28 whitespace-normal tracking-tight leading-tight">
                          <span className="block text-[8px] text-amber-700 font-black">{relatedTp?.code || 'TP'}</span>
                          <span className="block truncate font-bold">{asm.name}</span>
                          <span className="block text-[7px] text-slate-400">({asm.type})</span>
                        </th>
                      );
                    })}

                    {/* Non TP columns */}
                    <th className="p-2.5 text-[9px] font-black text-center text-rose-800 bg-rose-50/30 w-24 border-r border-slate-200 uppercase tracking-wider">Nilai STS</th>
                    <th className="p-2.5 text-[9px] font-black text-center text-indigo-800 bg-indigo-50/30 w-24 border-r border-slate-200 uppercase tracking-wider">Nilai SAS</th>
                    
                    {/* Attidute selection */}
                    <th className="p-2.5 text-[9px] font-black text-center text-slate-500 w-28 border-r border-slate-200">Sikap</th>

                    {/* Attendance columns */}
                    <th className="p-2 text-[8px] font-black text-center text-slate-500 w-16 border-r border-slate-200">Sakit</th>
                    <th className="p-2 text-[8px] font-black text-center text-slate-500 w-16 border-r border-slate-200">Izin</th>
                    <th className="p-2 text-[8px] font-black text-center text-slate-500 w-16 border-r border-slate-200">Alpha</th>

                    {/* Katrol column */}
                    <th className="p-2.5 text-[9px] font-black text-center text-amber-800 bg-amber-50/20 w-24 border-r border-slate-200 uppercase tracking-wider">Katrol</th>

                    {/* Rata-Rata dari semua penilaian */}
                    <th className="p-3 text-[10px] font-black text-center text-blue-800 bg-blue-50 w-24 border-r border-slate-200 uppercase tracking-wider">Rata-Rata</th>

                    {/* Computations indicators (READ ONLY LIVE) */}
                    <th className="p-3 text-[10px] font-black text-center text-emerald-800 bg-emerald-50 w-24">Nilai Akhir</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 bg-white">
                  {students.map((student, sIdx) => {
                    const studentId = student.id!;
                    const calculs = calculateStudentNilaiAkhir(studentId);
                    
                    const overallKey = `${studentId}_${selectedSemester}`;
                    const over = overalls[overallKey] || {
                      sts: '',
                      sas: '',
                      sikap: '',
                      kehadiran: { sakit: 0, izin: 0, alpha: 0 }
                    };

                    return (
                      <tr key={studentId} className="hover:bg-slate-50/50 transition">
                        {/* No */}
                        <td className="p-3 text-[11px] font-bold text-slate-400 sticky left-0 bg-white group-hover:bg-slate-50 z-10">{sIdx + 1}</td>
                        
                        {/* Nama Siswa fixed */}
                        <td className="p-3 sticky left-12 bg-white z-10 border-r border-slate-200">
                          <p className="text-[11px] font-black text-slate-800 tracking-tight whitespace-nowrap overflow-hidden text-ellipsis max-w-xs">{student.namalengkap}</p>
                          <p className="text-[8px] font-mono font-medium text-slate-400">NIS: {student.nis}</p>
                        </td>

                        {/* TP scores input dynamic cells (READ-ONLY) */}
                        {currentClassAssessments.map(asm => {
                          const scoreKey = `${studentId}_${asm.id}`;
                          const rawVal = tpScores[scoreKey] !== undefined ? tpScores[scoreKey] : '';

                          return (
                            <td key={asm.id} className="p-2 text-center border-r border-slate-100 font-bold font-mono text-xs text-slate-600 bg-slate-50/20">
                              {rawVal !== '' ? rawVal : '-'}
                            </td>
                          );
                        })}

                        {/* STS input (READ-ONLY) */}
                        <td className="p-2 text-center border-r border-slate-100 bg-rose-50/10 font-bold font-mono text-xs text-rose-900">
                          {over.sts !== '' ? over.sts : '-'}
                        </td>

                        {/* SAS input (READ-ONLY) */}
                        <td className="p-2 text-center border-r border-slate-100 bg-indigo-50/10 font-bold font-mono text-xs text-indigo-900">
                          {over.sas !== '' ? over.sas : '-'}
                        </td>

                        {/* Attitude (EDITABLE) */}
                        <td className="p-1 border-r border-slate-100 text-center">
                          <select
                            value={over.sikap || ''}
                            onChange={(e) => handleOverallChange(studentId, 'sikap', e.target.value)}
                            className="w-full h-8 p-1 text-[9px] font-bold rounded-lg border border-slate-200 outline-none bg-white text-slate-700 focus:border-amber-500"
                          >
                            <option value="">Auto (Skor)</option>
                            <option value="Sangat Baik">Sangat Baik</option>
                            <option value="Baik">Baik</option>
                            <option value="Cukup">Cukup</option>
                            <option value="Perlu Bimbingan">Perlu Bimbingan</option>
                          </select>
                        </td>

                        {/* Sick attendance (READ-ONLY) */}
                        <td className="p-2 text-center border-r border-slate-100 font-bold font-mono text-xs text-slate-600 bg-slate-50/10">
                          {over.kehadiran?.sakit || 0}
                        </td>

                        {/* Permit attendance (READ-ONLY) */}
                        <td className="p-2 text-center border-r border-slate-100 font-bold font-mono text-xs text-slate-600 bg-slate-50/10">
                          {over.kehadiran?.izin || 0}
                        </td>

                        {/* Absent attendance (READ-ONLY) */}
                        <td className="p-2 text-center border-r border-slate-100 font-bold font-mono text-xs text-red-600 bg-slate-50/10 whitespace-nowrap">
                          {over.kehadiran?.alpha || 0}
                        </td>

                        {/* Katrol input (EDITABLE) */}
                        <td className="p-1 border-r border-slate-100 bg-amber-50/5">
                          <input 
                            type="text"
                            inputMode="numeric"
                            value={over.katrol || ''}
                            placeholder="0"
                            onChange={(e) => {
                              const val = e.target.value;
                              const num = val === '' ? '' : parseInt(val);
                              if (num !== '' && isNaN(num)) return;
                              handleOverallChange(studentId, 'katrol' as any, num);
                            }}
                            className="w-full h-8 text-center text-xs font-black text-amber-800 rounded-lg border border-amber-100 focus:border-amber-500 font-mono outline-none bg-white"
                          />
                        </td>

                        {/* Rata-Rata dari semua penilaian (TP average, STS, SAS, Kehadiran, Sikap) */}
                        <td className="p-2 text-center border-r border-slate-100 bg-blue-50/10 font-bold font-mono text-xs text-blue-900">
                          {(() => {
                            const h = calculs.harian ?? 0;
                            const sts = calculs.sts ?? 0;
                            const sas = calculs.sas ?? 0;
                            const keh = calculs.kehadiranScore ?? 0;
                            const sik = calculs.sikapScore ?? 0;
                            return parseFloat(((h + sts + sas + keh + sik) / 5).toFixed(1));
                          })()}
                        </td>

                        {/* Live computations metrics */}
                        <td className="p-3 bg-emerald-50 text-center border-l">
                          <span className={`text-sm font-black ${calculs.finalScore !== null && calculs.finalScore < 71 ? 'text-rose-600' : 'text-emerald-700'}`}>
                            {calculs.finalScore !== null ? calculs.finalScore : '-'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}



      {/* ========================================================
          TAB 5: REKAP DAN LAPORAN AKHIR
          ======================================================== */}
      {activeTab === 'rekap' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          
          {/* Filters, search, and exporters */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div className="space-y-0.5">
              <h2 className="text-sm font-black uppercase text-slate-800">
                Laporan Akhir Siswa (Leger) Kelas {selectedKelas}
              </h2>
              <span className="text-[10px] text-slate-400 font-bold block">
                Sistem mengkalkulasi bobot Rapor: Kehadiran ({weights.kehadiran ?? 10}%) | Sikap ({weights.sikap ?? 15}%) | Tugas/TP ({weights.harian}%) | STS ({weights.sts}%) | SAS ({weights.sas}%)
              </span>
            </div>

            <div className="flex flex-wrap gap-2 w-full md:w-auto items-center">
              <input 
                type="text" 
                placeholder="Cari siswa/NIS..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium outline-none bg-slate-50 text-slate-800 focus:bg-white max-w-xs flex-1 md:flex-initial"
              />

              <button 
                onClick={handleExportExcelLedger}
                className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-black uppercase flex items-center gap-1.5 shadow active:scale-95 transition"
              >
                <FileDown size={14} /> Export Leger Excel
              </button>
            </div>
          </div>

          {/* TABLE VISUAL DATA CUMULATIVE */}
          {filteredStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-50 rounded-2xl min-h-[300px]">
              <Users size={32} className="text-slate-300 mb-1" />
              <p className="text-slate-700 font-bold text-xs">Siswa tidak ditemukan/Data kosong</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-left border-collapse min-w-[1200px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-150 text-[9px] font-black text-slate-500 uppercase tracking-wider">
                    <th className="p-3 text-center w-10">No</th>
                    <th className="p-3 w-40">NIS & Nama Lengkap</th>
                    {/* TPs averages */}
                    {currentClassTps.map(tp => (
                      <th key={tp.id} className="p-2.5 text-center w-20 bg-amber-50/20">{tp.code}</th>
                    ))}
                    <th className="p-2.5 text-center w-24">Rata Harian</th>
                    <th className="p-2.5 text-center w-20">STS</th>
                    <th className="p-2.5 text-center w-20">SAS</th>
                    <th className="p-3 text-center w-24 bg-emerald-50 text-emerald-800 font-bold">NILAI AKHIR</th>
                    <th className="p-3 text-center w-14">Pred</th>
                    <th className="p-3 w-64 text-left leading-tight font-medium text-[8px] text-slate-400">Deskripsi Penguasaan Materi</th>
                    <th className="p-2.5 text-center w-24">Sikap</th>
                    <th className="p-2 text-center w-24 leading-none">Kehadiran<br/><span className="text-[7px] text-slate-400">(S / I / A)</span></th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 bg-white text-[10px] md:text-xs">
                  {filteredStudents.map((student, idx) => {
                    const studentId = student.id!;
                    const calculs = calculateStudentNilaiAkhir(studentId);
                    const predObj = getPredicateAndDesc(calculs.finalScore, studentId);

                    const overallKey = `${studentId}_${selectedSemester}`;
                    const over = overalls[overallKey];

                    const sts = over && over.sts !== '' ? over.sts : '-';
                    const sas = over && over.sas !== '' ? over.sas : '-';
                    const attitude = over && over.sikap ? over.sikap : getAttitudeTextFromScore(calculs.sikapScore);
                    
                    const sakit = over?.kehadiran?.sakit || 0;
                    const izin = over?.kehadiran?.izin || 0;
                    const alpha = over?.kehadiran?.alpha || 0;

                    return (
                      <tr key={studentId} className="hover:bg-slate-50/55 transition">
                        <td className="p-3 text-center font-bold text-slate-400">{idx + 1}</td>
                        <td className="p-3 bg-white">
                          <p className="font-black text-slate-800 tracking-tight">{student.namalengkap}</p>
                          <p className="text-[8px] font-mono text-slate-400">NIS: {student.nis}</p>
                        </td>

                        {/* Indiv TP score averages */}
                        {currentClassTps.map(tp => {
                          const score = calculateStudentTpScore(studentId, tp.id);
                          return (
                            <td key={tp.id} className="p-2.5 text-center font-bold text-slate-600 bg-amber-50/5">
                              {score !== null ? score : '-'}
                            </td>
                          );
                        })}

                        {/* Calculations columns status */}
                        <td className="p-2.5 text-center font-semibold text-slate-500">
                          {calculs.harian !== null ? calculs.harian : '-'}
                        </td>
                        <td className="p-2.5 text-center font-semibold text-rose-700">
                          {sts}
                        </td>
                        <td className="p-2.5 text-center font-semibold text-indigo-700">
                          {sas}
                        </td>

                        {/* FINAL SCORE */}
                        <td className="p-3 text-center font-black bg-emerald-50 text-emerald-800 text-sm">
                          {calculs.finalScore !== null ? calculs.finalScore : '-'}
                        </td>

                        {/* PREDICATE */}
                        <td className="p-3 text-center font-black">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                            predObj.pred === 'A' ? 'bg-emerald-100 text-emerald-800' :
                            predObj.pred === 'B' ? 'bg-blue-100 text-blue-800' :
                            predObj.pred === 'C' ? 'bg-amber-100 text-amber-800' :
                            'bg-rose-100 text-rose-800'
                          }`}>
                            {predObj.pred}
                          </span>
                        </td>

                        {/* DESCRIPTION */}
                        <td className="p-3 max-w-xs text-left leading-normal font-medium text-slate-500 text-[9px]">
                          {predObj.desc}
                        </td>

                        {/* ATTITUDE SIKAP */}
                        <td className="p-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                            attitude === 'Sangat Baik' ? 'bg-indigo-100 text-indigo-800' :
                            attitude === 'Baik' ? 'bg-emerald-100 text-emerald-800' :
                            attitude === 'Cukup' ? 'bg-amber-100 text-amber-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {attitude}
                          </span>
                        </td>

                        {/* ATTENDANCE CUMULA */}
                        <td className="p-2 text-center text-[10px] font-bold text-slate-700 whitespace-nowrap">
                          {sakit} Hari S / {izin} I / {alpha} A
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default TeacherManageGrades;
