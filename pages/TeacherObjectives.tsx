import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  BookOpen, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  Settings, 
  Save, 
  Award, 
  Scroll, 
  ChevronRight, 
  AlertTriangle, 
  PlusCircle,
  FolderPlus,
  BookOpenCheck,
  AwardIcon,
  Layers,
  HelpCircle,
  RotateCcw
} from 'lucide-react';
import Swal from 'sweetalert2';
import { db } from '../services/supabaseMock';

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

const ASSESSMENT_TYPES = ['Hafalan', 'Penulisan', 'Praktik', 'Proyek', 'Observasi'] as const;

const TeacherObjectives: React.FC = () => {
  const navigate = useNavigate();

  // --- APP STATE ---
  const [activeTab, setActiveTab] = useState<'tp' | 'penilaian'>('tp');
  const [selectedGrade, setSelectedGrade] = useState<string>('7');
  const [selectedSemester, setSelectedSemester] = useState<string>('1');

  // Database States
  const [tps, setTps] = useState<TP[]>([]);
  const [assessments, setAssessments] = useState<TPAssessment[]>([]);
  const [selectedTpId, setSelectedTpId] = useState<string>('');

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
  const [asmForm, setAsmForm] = useState<{ name: string; type: string }>({
    name: 'Tugas 1',
    type: 'Penulisan',
  });

  // --- INITIALIZE DATA FROM LOCALSTORAGE ---
  useEffect(() => {
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
  }, []);

  // Sync state to local storage helpers
  const saveTpsToStorage = (updatedTps: TP[]) => {
    db.setLocalTable('tujuan_pembelajaran', updatedTps);
    setTps(updatedTps);
  };

  const saveAssessmentsToStorage = (updatedAsms: TPAssessment[]) => {
    db.setLocalTable('asesmen_tp', updatedAsms);
    setAssessments(updatedAsms);
  };

  // Switch initial selection when tab state changes
  useEffect(() => {
    const currentClassTps = tps
      .filter(t => t.grade === selectedGrade && t.semester === selectedSemester)
      .sort((a, b) => {
        const codeA = String(a.code || '').toLowerCase();
        const codeB = String(b.code || '').toLowerCase();
        return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
      });
    if (currentClassTps.length > 0) {
      // Set to first match if empty or no longer in current grade list
      if (!selectedTpId || !currentClassTps.find(t => t.id === selectedTpId)) {
        setSelectedTpId(currentClassTps[0].id);
      }
    } else {
      setSelectedTpId('');
    }
  }, [tps, selectedGrade, selectedSemester, selectedTpId]);

  // Sync tpForm with selectedGrade and selectedSemester
  useEffect(() => {
    setTpForm(prev => ({
      ...prev,
      grade: selectedGrade,
      semester: selectedSemester,
      code: `TP ${tps.filter(t => t.grade === selectedGrade && t.semester === selectedSemester).length + 1}`
    }));
  }, [selectedGrade, selectedSemester, tps]);

  const currentClassTps = tps
    .filter(t => t.grade === selectedGrade && t.semester === selectedSemester)
    .sort((a, b) => {
      const codeA = String(a.code || '').toLowerCase();
      const codeB = String(b.code || '').toLowerCase();
      return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
    });

  // --- ACTIONS ---
  const handleSaveTp = () => {
    if (!tpForm.code.trim() || !tpForm.name.trim() || !tpForm.description.trim()) {
      Swal.fire({ 
        icon: 'warning', 
        title: 'Data Kurang lengkap', 
        text: 'Mohon isi semua field Tujuan Pembelajaran (Kode, Nama, Deskripsi)', 
        heightAuto: false,
        confirmButtonColor: '#047857' 
      });
      return;
    }

    if (editingTpId) {
      const updated = tps.map(t => t.id === editingTpId ? { ...t, ...tpForm } : t);
      saveTpsToStorage(updated);
      setEditingTpId(null);
      Swal.fire({ 
        icon: 'success', 
        title: 'TP Berhasil Diedit', 
        timer: 1500, 
        showConfirmButton: false, 
        heightAuto: false 
      });
    } else {
      const newTp: TP = {
        id: 'tp_' + Math.random().toString(36).substr(2, 9),
        ...tpForm
      };
      saveTpsToStorage([...tps, newTp]);
      Swal.fire({ 
        icon: 'success', 
        title: 'TP Berhasil Ditambahkan', 
        timer: 1500, 
        showConfirmButton: false, 
        heightAuto: false 
      });
    }

    // Reset Form (keep subject/grade/semester fields aligned)
    setTpForm(prev => ({
      ...prev,
      code: `TP ${tps.filter(t => t.grade === selectedGrade && t.semester === selectedSemester).length + (editingTpId ? 1 : 2)}`,
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
      text: 'Semua instrumen penilaian siswa yang dikoneksikan dengan TP ini juga akan dihapus permanen!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
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

    // Clean TP Scores from localStorage as well
    const savedTpScores = localStorage.getItem('pai_grades_tp_scores');
    if (savedTpScores) {
      try {
        const updatedScores = JSON.parse(savedTpScores);
        Object.keys(updatedScores).forEach(key => {
          const parts = key.split('_');
          if (parts.length > 1 && relatedAsmIds.includes(parts[1])) {
            delete updatedScores[key];
          }
        });
        localStorage.setItem('pai_grades_tp_scores', JSON.stringify(updatedScores));
      } catch (e) {
        console.error(e);
      }
    }

    Swal.fire({ 
      icon: 'success', 
      title: 'TP Dihapus', 
      timer: 1500, 
      showConfirmButton: false, 
      heightAuto: false 
    });
  };

  const handleAddAssessment = () => {
    if (!selectedTpId) {
      Swal.fire({ 
        icon: 'warning', 
        title: 'Pilih TP Terlebih Dahulu', 
        text: 'Buat atau pilih salah satu Tujuan Pembelajaran (TP) terlebih dahulu!', 
        heightAuto: false,
        confirmButtonColor: '#047857' 
      });
      return;
    }
    if (!asmForm.name.trim()) {
      Swal.fire({ 
        icon: 'warning', 
        title: 'Isi Nama Penilaian', 
        text: 'Nama penilaian wajib diisi (Contoh: Tugas 1)', 
        heightAuto: false,
        confirmButtonColor: '#047857' 
      });
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

    Swal.fire({ 
      icon: 'success', 
      title: 'Penilaian TP Berhasil Ditambahkan', 
      timer: 1500, 
      showConfirmButton: false, 
      heightAuto: false 
    });
  };

  const handleDeleteAssessment = async (id: string) => {
    const confirm = await Swal.fire({
      title: 'Hapus Tugas Penilaian?',
      text: 'Nilai peserta didik untuk instrumen ini juga akan terhapus!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      heightAuto: false
    });

    if (!confirm.isConfirmed) return;

    const updatedAsms = assessments.filter(a => a.id !== id);
    saveAssessmentsToStorage(updatedAsms);

    // Clean scores
    const savedTpScores = localStorage.getItem('pai_grades_tp_scores');
    if (savedTpScores) {
      try {
        const updatedScores = JSON.parse(savedTpScores);
        Object.keys(updatedScores).forEach(key => {
          const parts = key.split('_');
          if (parts.length > 1 && parts[1] === id) {
            delete updatedScores[key];
          }
        });
        localStorage.setItem('pai_grades_tp_scores', JSON.stringify(updatedScores));
      } catch (e) {
        console.error(e);
      }
    }

    Swal.fire({ 
      icon: 'success', 
      title: 'Tugas Penilaian Dihapus', 
      timer: 1500, 
      showConfirmButton: false, 
      heightAuto: false 
    });
  };

  const handleResetAllTps = async () => {
    const confirm1 = await Swal.fire({
      title: 'Reset Seluruh Data TP dan Asesmen?',
      text: 'Tindakan ini akan menghapus semua Tujuan Pembelajaran (TP), instrumen kompetensi, dan seluruh nilai harian guru yang tersimpan secara permanen!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Lanjutkan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      heightAuto: false
    });

    if (!confirm1.isConfirmed) return;

    const confirm2 = await Swal.fire({
      title: 'Konfirmasi Keamanan',
      text: 'Semua nilai pada semester ganjil & genap di seluruh tingkatan kelas akan dihapus bersih! Silakan ketik kata kunci "RESET" di bawah ini untuk melanjutkan:',
      input: 'text',
      inputPlaceholder: 'Ketik RESET disini...',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Hapus Bersih Permanen',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
      heightAuto: false,
      preConfirm: (value) => {
        if (value !== 'RESET') {
          Swal.showValidationMessage('Kata kunci konfirmasi salah!');
        }
        return value;
      }
    });

    if (!confirm2.isConfirmed) return;

    // Clear lists
    saveTpsToStorage([]);
    saveAssessmentsToStorage([]);

    // Clear scoring records from local storage
    localStorage.removeItem('pai_grades_tp_scores');

    Swal.fire({
      icon: 'success',
      title: 'Sistem Data Berhasil Direset',
      text: 'Seluruh kurikulum TP, instrumen tugas harian, dan database rekap nilai telah dikosongkan.',
      heightAuto: false,
      confirmButtonColor: '#047857'
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fadeIn pb-24 px-2 md:px-0 font-sans" id="learning-objectives-container">
      {/* HEADER BAR */}
      <div className="flex items-center justify-between pb-1">
        <button 
          onClick={() => navigate('/guru')} 
          className="group flex items-center gap-2 text-slate-705 hover:text-emerald-700 transition-all text-xs font-black uppercase tracking-wider mb-2"
          id="btn-back-to-dashboard-utama"
        >
          <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
          <span>DASHBOARD UTAMA</span>
        </button>

        <button 
          onClick={handleResetAllTps}
          className="group flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/50 transition-all font-black text-[10px] md:text-xs uppercase tracking-wider mb-2 shadow-sm"
          id="btn-reset-semua-tp"
        >
          <RotateCcw size={13} className="transition-transform group-hover:-rotate-180 duration-500" />
          <span>Atur Ulang / Reset TP</span>
        </button>
      </div>

      {/* JUMBOTRON HEADER */}
      <div className="bg-gradient-to-r from-teal-800 to-emerald-700 text-white p-6 md:p-8 rounded-[1.8rem] md:rounded-[2.5rem] shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none transform translate-x-4">
          <BookOpenCheck size={185} />
        </div>
        <div className="relative z-10 space-y-2">
          <span className="bg-emerald-600 border border-emerald-500 text-emerald-50 text-[10px] md:text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full">
            Kurikulum PAI &amp; Budi Pekerti
          </span>
          <h1 className="text-xl md:text-3xl font-black uppercase tracking-tight">
            Tujuan Pembelajaran (TP)
          </h1>

        </div>
      </div>

      {/* GRADE & SEMESTER SHAPER */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers size={18} className="text-emerald-600" />
          <span className="text-xs font-black uppercase tracking-widest text-slate-700">Filter Wilayah TP</span>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="flex-1 md:flex-none">
            <select 
              value={selectedGrade}
              onChange={(e) => {
                setSelectedGrade(e.target.value);
                setEditingTpId(null);
              }}
              className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold outline-none focus:bg-white text-slate-700"
            >
              <option value="7">Kelas 7 (Fase D)</option>
              <option value="8">Kelas 8 (Fase D)</option>
              <option value="9">Kelas 9 (Fase D)</option>
            </select>
          </div>
          <div className="flex-1 md:flex-none">
            <select 
              value={selectedSemester}
              onChange={(e) => {
                setSelectedSemester(e.target.value);
                setEditingTpId(null);
              }}
              className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold outline-none focus:bg-white text-slate-700"
            >
              <option value="1">Semester Ganjil (1)</option>
              <option value="2">Semester Genap (2)</option>
            </select>
          </div>
        </div>
      </div>

      {/* TAB SELECTOR */}
      <div className="flex bg-slate-100 p-1 rounded-2xl max-w-md">
        <button 
          onClick={() => setActiveTab('tp')}
          className={`flex-1 py-3 text-center text-xs font-black uppercase tracking-wider rounded-xl transition ${activeTab === 'tp' ? 'bg-white text-emerald-850 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
        >
          1. Data TP ({currentClassTps.length})
        </button>
        <button 
          onClick={() => setActiveTab('penilaian')}
          className={`flex-1 py-3 text-center text-xs font-black uppercase tracking-wider rounded-xl transition ${activeTab === 'penilaian' ? 'bg-white text-emerald-855 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
        >
          2. Penilaian per TP
        </button>
      </div>

      {/* ==========================================
          TAB 1: KELOLA DATA TP
          ========================================== */}
      {activeTab === 'tp' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Left panel: Save form */}
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-50 pb-2">
              <FolderPlus size={18} className="text-emerald-700" />
              <h2 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                {editingTpId ? 'Edit Parameter TP' : 'Tambah TP Baru'}
              </h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1 mb-1">Kode TP</label>
                <input 
                  type="text" 
                  value={tpForm.code}
                  onChange={(e) => setTpForm({ ...tpForm, code: e.target.value })}
                  placeholder="Contoh: TP 1, TP 2"
                  className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold outline-none focus:bg-white focus:border-emerald-500 text-slate-800"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1 mb-1">Nama Ringkas TP</label>
                <input 
                  type="text" 
                  value={tpForm.name}
                  onChange={(e) => setTpForm({ ...tpForm, name: e.target.value })}
                  placeholder="Contoh: Memahami Al-Qur'an & Tajwid"
                  className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold outline-none focus:bg-white focus:border-emerald-500 text-slate-800"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1 mb-1">Deskripsi Kompetensi Lengkap</label>
                <textarea 
                  value={tpForm.description}
                  onChange={(e) => setTpForm({ ...tpForm, description: e.target.value })}
                  placeholder="Tulis capaian atau kompetensi pembelajaran secara detail..."
                  rows={4}
                  className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-normal outline-none focus:bg-white focus:border-emerald-500 text-slate-700"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  onClick={handleSaveTp}
                  className="flex-1 py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs uppercase tracking-wider shadow-sm active:scale-95 transition flex items-center justify-center gap-1.5"
                >
                  <Save size={14} />
                  <span>{editingTpId ? 'Simpan Perubahan' : 'Buat TP'}</span>
                </button>
                {editingTpId && (
                  <button 
                    onClick={() => {
                      setEditingTpId(null);
                      setTpForm({
                        code: `TP ${tps.filter(t => t.grade === selectedGrade && t.semester === selectedSemester).length + 1}`,
                        name: '',
                        description: '',
                        subject: 'Pendidikan Agama Islam & Budi Pekerti',
                        grade: selectedGrade,
                        semester: selectedSemester,
                      });
                    }}
                    className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider transition"
                  >
                    Batal
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right panel: TP List */}
          <div className="lg:col-span-2 bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-55 pb-2">
              <div>
                <h2 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                  Daftar TP Kelas {selectedGrade} - Semester {selectedSemester}
                </h2>
                <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                  Berlaku terintegrasi untuk seluruh rombongan belajar (A, B, C, dst)
                </span>
              </div>
              <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black px-2.5 py-1 rounded-full border border-emerald-100">
                {currentClassTps.length} TP Terdaftar
              </span>
            </div>

            {currentClassTps.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 min-h-[300px]">
                <BookOpen size={45} className="text-slate-300 mb-2" />
                <p className="text-slate-700 font-bold text-xs uppercase tracking-wide">Belum Ada TP Terdaftar</p>
                <p className="text-slate-400 text-[11px] max-w-xs mt-1">Silakan definisikan parameter Tujuan Pembelajaran baru menggunakan form di kiri.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
                {currentClassTps.map((tp) => (
                  <div key={tp.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100/75 hover:border-emerald-150 hover:bg-emerald-50/10 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="bg-emerald-600 text-white text-[9px] font-black px-2.5 py-0.5 rounded-full tracking-wider">
                          {tp.code}
                        </span>
                        <h3 className="font-bold text-slate-800 text-xs md:text-sm">
                          {tp.name}
                        </h3>
                      </div>
                      <p className="text-slate-500 text-[11px] md:text-xs leading-relaxed">
                        {tp.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 self-end md:self-center shrink-0">
                      <button 
                        onClick={() => handleEditTpInitiate(tp)}
                        className="p-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-100/50 transition"
                        title="Edit Kompetensi"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button 
                        onClick={() => handleDeleteTp(tp.id)}
                        className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-650 border border-red-100/50 transition"
                        title="Hapus TP"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==========================================
          TAB 2: PENILAIAN PER TP
          ========================================== */}
      {activeTab === 'penilaian' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Create Assignment Form */}
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-55 pb-2">
              <PlusCircle size={18} className="text-emerald-700" />
              <h2 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                Desain Evaluasi Baru
              </h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1 mb-1">Hubungkan Pada TP</label>
                {currentClassTps.length === 0 ? (
                  <div className="bg-red-50 text-red-700 text-[10px] font-bold p-3 rounded-xl border border-red-100">
                    <p className="font-black mb-1">Peringatan!</p>
                    Anda wajib membuat minimal 1 Tujuan Pembelajaran (TP) pada Tab 1 sebelum mendesain instrumen penilaian tugas.
                  </div>
                ) : (
                  <select 
                    value={selectedTpId}
                    onChange={(e) => setSelectedTpId(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold outline-none focus:bg-white text-slate-700"
                  >
                    {currentClassTps.map(t => (
                      <option key={t.id} value={t.id}>{t.code}: {t.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1 mb-1">Nama Tugas / Penilaian</label>
                <input 
                  type="text" 
                  value={asmForm.name}
                  onChange={(e) => setAsmForm({ ...asmForm, name: e.target.value })}
                  placeholder="Contoh: Tugas Mandiri, Ulangan Harian"
                  className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold outline-none focus:bg-white focus:border-emerald-500 text-slate-800"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1 mb-1">Metode / Jenis Penilaian</label>
                <select 
                  value={asmForm.type}
                  onChange={(e) => setAsmForm({ ...asmForm, type: e.target.value })}
                  className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold outline-none focus:bg-white text-slate-700"
                >
                  {ASSESSMENT_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <button 
                onClick={handleAddAssessment}
                disabled={currentClassTps.length === 0}
                className="w-full py-3.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs uppercase tracking-widest shadow-sm active:scale-95 transition mt-3 flex items-center justify-center gap-2 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
              >
                <Plus size={15} />
                <span>Buat Instrumen Tugas</span>
              </button>
            </div>
          </div>

          {/* List of custom assignments grouped by TP */}
          <div className="lg:col-span-2 bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-55 pb-2">
              <div>
                <h2 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                  Peta Evaluasi per TP Kelas {selectedGrade} Smt {selectedSemester}
                </h2>
                <p className="text-[10px] text-slate-400 font-medium">Setiap TP dapat memiliki beberapa instrumen tugas harian secara mandiri.</p>
              </div>
            </div>

            {currentClassTps.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 rounded-2xl min-h-[300px]">
                <BookOpen size={45} className="text-slate-300" />
                <p className="text-slate-700 font-bold text-xs uppercase tracking-wider mt-2">Daftar TP Masih Kosong</p>
                <p className="text-slate-400 text-[11px] mt-1">Harap daftarkan tujuan pembelajaran Anda terlebih dahulu.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[550px] overflow-y-auto pr-1">
                {currentClassTps.map((tp) => {
                  const tpRelatedAsms = assessments.filter(a => a.tpId === tp.id);

                  return (
                    <div key={tp.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100/70 space-y-3">
                      <div className="flex justify-between items-center border-b border-slate-200/50 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="bg-emerald-700 text-white font-black text-[9px] px-2 py-0.5 rounded-md tracking-wider">
                            {tp.code}
                          </span>
                          <span className="font-bold text-xs text-slate-850 truncate max-w-sm md:max-w-md">
                            {tp.name}
                          </span>
                        </div>
                        <span className="bg-emerald-100 text-emerald-800 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                          {tpRelatedAsms.length} Asesmen
                        </span>
                      </div>

                      {tpRelatedAsms.length === 0 ? (
                        <p className="text-slate-400 text-[10px] italic py-2 pl-1">Belum ada rancangan instrumen penilaian tugas khusus untuk TP ini.</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {tpRelatedAsms.map(asm => (
                            <div key={asm.id} className="bg-white p-3 rounded-xl border border-slate-100 flex items-center justify-between hover:border-emerald-100 transition shadow-sm">
                              <div className="text-xs">
                                <p className="font-black text-slate-755">{asm.name}</p>
                                <span className="text-[7.5px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100/50 block mt-1 w-max">
                                  {asm.type}
                                </span>
                              </div>
                              <button 
                                onClick={() => handleDeleteAssessment(asm.id)}
                                className="text-slate-400 hover:text-red-600 p-2 rounded-xl hover:bg-red-50 border border-transparent hover:border-red-100/30 transition"
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

    </div>
  );
};

export default TeacherObjectives;
