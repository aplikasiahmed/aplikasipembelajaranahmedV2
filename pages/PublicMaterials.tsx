import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  BookOpen, 
  Search, 
  Filter, 
  ChevronRight, 
  X, 
  Link as LinkIcon, 
  BookOpenCheck, 
  CalendarDays,
  GraduationCap,
  ArrowLeft,
  Bookmark,
  Share2,
  CheckCircle,
  Clock,
  Sparkles,
  BookMarked,
  RotateCcw
} from 'lucide-react';
import { db } from '../services/supabaseMock';
import { Material, GradeLevel } from '../types';
import Swal from 'sweetalert2';

interface TP {
  id: string;
  code: string;
  name: string;
  description: string;
  subject: string;
  grade: string;
  semester: string;
}

const CATEGORIES = ['Aqidah', 'Fiqih', 'Sejarah', 'Akhlak', 'Al-Quran'] as const;

const PublicMaterials: React.FC = () => {
  const location = useLocation();

  // --- STATES ---
  const [materials, setMaterials] = useState<Material[]>([]);
  const [tps, setTps] = useState<TP[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Active student context (if logged in/remembered from other features)
  const [studentGrade, setStudentGrade] = useState<string>('7');

  // Filter & Search
  const [activeGradeTab, setActiveGradeTab] = useState<string>('Semua');
  const [activeSemesterFilter, setActiveSemesterFilter] = useState<string>('Semua');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Reader Modal State
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);

  // List of material IDs that are completed
  const [completedReadIds, setCompletedReadIds] = useState<string[]>([]);
  // Reader Font Size (px)
  const [readerFontSize, setReaderFontSize] = useState<number>(16);

  // Read materials tracking for notification system
  const [readMaterialIds, setReadMaterialIds] = useState<string[]>([]);

  // Load completed and read lists from local storage on mount
  useEffect(() => {
    const listStr = localStorage.getItem('pai_completed_read_materials');
    if (listStr) {
      try {
        setCompletedReadIds(JSON.parse(listStr));
      } catch (e) {
        console.warn(e);
      }
    }

    const readStr = localStorage.getItem('pai_read_materials');
    if (readStr) {
      try {
        setReadMaterialIds(JSON.parse(readStr));
      } catch (e) {
        console.warn(e);
      }
    }
  }, []);

  const handleSelectMaterial = (mat: Material) => {
    setSelectedMaterial(mat);
    
    try {
      const readList = JSON.parse(localStorage.getItem('pai_read_materials') || '[]');
      if (!readList.includes(mat.id)) {
        readList.push(mat.id);
        localStorage.setItem('pai_read_materials', JSON.stringify(readList));
        setReadMaterialIds(readList);
        // Dispatch custom event to notify other components (like Home.tsx or BottomNav.tsx)
        window.dispatchEvent(new Event('pai_notifications_updated'));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkAsCompleted = (id: string) => {
    let updated = [...completedReadIds];
    if (!updated.includes(id)) {
      updated.push(id);
      setCompletedReadIds(updated);
      localStorage.setItem('pai_completed_read_materials', JSON.stringify(updated));
      
      Swal.fire({
        title: 'Alhamdulillah! 🎉',
        text: 'Kamu telah menyelesaikan membaca materi ini. Semoga menjadi ilmu yang bermanfaat dan berkah!',
        icon: 'success',
        confirmButtonText: 'Aamiin Yaa Rabbal \'Alamiin',
        confirmButtonColor: '#047857',
        heightAuto: false
      });
    }
  };

  // --- LOAD DATA ---
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const matList = await db.getMaterials();
        setMaterials(matList);

        const tpList = db.getLocalTable<TP>('tujuan_pembelajaran');
        setTps(tpList);

        // Check if grade state is passed from another page
        if (location.state && (location.state as any).grade) {
          const passGrade = String((location.state as any).grade);
          setActiveGradeTab(passGrade);
        } else {
          // Detect student grade if available from active student profile or exams session
          const lastStudentStr = localStorage.getItem('pai_last_active_student');
          if (lastStudentStr) {
            try {
              const stud = JSON.parse(lastStudentStr);
              if (stud.kelas) {
                const char = stud.kelas.trim().charAt(0);
                if (['7', '8', '9'].includes(char)) {
                  setStudentGrade(char);
                  setActiveGradeTab(char); // Auto filter to student's own grade
                }
              }
            } catch (e) {
              console.warn(e);
            }
          }
        }
      } catch (err) {
        console.error('Gagal memuat materi:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [location.state]);

  // Extract unique semesters from materials created by teacher
  const availableSemesters = Array.from(
    new Set(materials.map(m => m.semester).filter((s): s is string => !!s))
  ).sort((a, b) => a.localeCompare(b));

  // --- FILTERED DISPLAY ---
  const displayMaterials = materials.filter(m => {
    const matchSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        (m.description && m.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchGrade = activeGradeTab === 'Semua' || m.grade === activeGradeTab;
    const matchSemester = activeSemesterFilter === 'Semua' || String(m.semester) === activeSemesterFilter;
    return matchSearch && matchGrade && matchSemester;
  });

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Immersive Welcome Header */}
      <div className="bg-gradient-to-br from-emerald-800 to-emerald-950 p-6 md:p-8 rounded-[2rem] text-white relative overflow-hidden shadow-lg shadow-emerald-100">
        <div className="absolute top-0 right-0 p-8 opacity-[0.05] pointer-events-none">
          <BookOpen size={180} />
        </div>
        <div className="relative z-10 max-w-2xl space-y-2">
          <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-700/50 text-emerald-200 px-3 py-1 rounded-full border border-emerald-600/30 inline-block">
            Pusat Pembelajaran Digital PAI
          </span>
          <h1 className="text-xl md:text-3xl font-black tracking-tight leading-tight uppercase">
            Materi Pembelajaran Pendidikan Agama Islam
          </h1>
          <p className="text-emerald-100/85 text-[11px] md:text-xs font-medium leading-relaxed">
            Memperdalam Materi Pendididkan Agama Islam dengan interaktif yang sesuai dengan Tujuan Pembelajaran Kurikulum
          </p>
        </div>
      </div>

      {loading ? (
        <div className="bg-white p-12 rounded-[2rem] border border-slate-100 shadow-sm text-center space-y-3">
          <div className="w-10 h-10 border-4 border-slate-100 border-t-emerald-600 rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-slate-500 font-medium">Memuat katalog materi PAI...</p>
        </div>
      ) : materials.length === 0 ? (
        <div className="bg-white p-12 md:p-16 rounded-[2rem] border border-slate-100 shadow-sm text-center space-y-4">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin"></div>
            <BookOpen className="absolute inset-0 m-auto text-emerald-600 animate-pulse" size={24} />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-black text-slate-800 uppercase tracking-wide">Materi dalam pengembangan</h3>
            <p className="text-xs sm:text-sm font-semibold text-slate-400 max-w-md mx-auto">
              Materi pembelajaran Pendidikan Agama Islam sedang dipersiapkan oleh guru. Silakan periksa kembali nanti.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Filter & Search Bar */}
          <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {/* Search */}
              <div className="md:col-span-2 relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari modul materi, contoh: Hari Akhir, Zakat, Adab..."
                  className="w-full pl-10 pr-4 py-3 text-xs font-medium rounded-xl border border-slate-200 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-50 bg-slate-50/50"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Semester Filter */}
              <div>
                <select
                  className="w-full px-3 py-3 text-xs font-bold rounded-xl border border-slate-200 outline-none focus:border-emerald-600 bg-white"
                  value={activeSemesterFilter}
                  onChange={(e) => setActiveSemesterFilter(e.target.value)}
                >
                  <option value="Semua">Semua Semester</option>
                  {availableSemesters.map(sem => (
                    <option key={sem} value={sem}>
                      {sem === '1' 
                        ? 'Semester 1 (Ganjil)' 
                        : sem === '2' 
                        ? 'Semester 2 (Genap)' 
                        : sem.toLowerCase() === 'ganjil' 
                        ? 'Semester Ganjil' 
                        : sem.toLowerCase() === 'genap' 
                        ? 'Semester Genap' 
                        : `Semester ${sem}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Grade Tabs - Scrollable on Mobile for professional layout */}
            <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-50">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Pilih Jenjang Kelas:</span>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 scrollbar-none -mx-2 px-2">
                <button
                  onClick={() => setActiveGradeTab('Semua')}
                  className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 ${
                    activeGradeTab === 'Semua'
                      ? 'bg-emerald-700 text-white shadow-md shadow-emerald-50'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Semua Kelas
                </button>
                {['7', '8', '9'].map(gr => (
                  <button
                    key={gr}
                    onClick={() => setActiveGradeTab(gr)}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 ${
                      activeGradeTab === gr
                        ? 'bg-emerald-700 text-white shadow-md shadow-emerald-50'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <GraduationCap size={14} />
                    Kelas {gr === '7' ? 'VII' : gr === '8' ? 'VIII' : 'IX'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Materials Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayMaterials.length === 0 ? (
              <div className="col-span-full bg-white p-12 rounded-[2rem] border border-slate-100 shadow-sm text-center space-y-2">
                <BookOpen size={48} className="text-slate-300 mx-auto" />
                <h3 className="text-sm font-black text-slate-700">Materi Tidak Ditemukan</h3>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Silakan ganti kata kunci atau pilih tab filter kelas yang lain.
                </p>
              </div>
            ) : (
              displayMaterials.map((mat) => {
                const matchedTp = tps.find(t => String(t.id) === String(mat.tp_id));
                const isCompleted = completedReadIds.includes(mat.id);

                return (
                  <div 
                    key={mat.id} 
                    className={`bg-white rounded-[2rem] border shadow-sm overflow-hidden flex flex-col justify-between group hover:shadow-md transition-all duration-300 cursor-pointer relative ${
                      isCompleted ? 'border-emerald-200 bg-emerald-50/5' : 'border-slate-100'
                    }`}
                    onClick={() => handleSelectMaterial(mat)}
                  >
                    <div>
                      {/* Image Thumbnail */}
                      <div className="h-44 bg-slate-50 relative overflow-hidden">
                        {mat.thumbnail ? (
                          <img 
                            referrerPolicy="no-referrer" 
                            src={mat.thumbnail} 
                            alt={mat.title} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 gap-1 bg-slate-50">
                            <BookOpen size={36} />
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Pelajaran PAI</span>
                          </div>
                        )}

                        {/* Top Left Category Badge */}
                        <span className="absolute left-4 top-4 bg-emerald-700 text-white font-black text-[9px] px-2.5 py-1 rounded-full uppercase tracking-wider shadow-md">
                          {mat.category}
                        </span>

                        {/* Top Right Semester Badge */}
                        <span className="absolute right-4 top-4 bg-white/95 text-slate-800 font-extrabold text-[9px] px-2.5 py-1 rounded-full shadow-md">
                          Semester {mat.semester || '1'}
                        </span>

                        {/* Gamified Completed Badge */}
                        {isCompleted && (
                          <div className="absolute inset-0 bg-emerald-950/40 backdrop-blur-[1px] flex items-center justify-center transition-opacity">
                            <span className="bg-emerald-600 text-white font-black text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-lg scale-100 animate-pulse">
                              <CheckCircle size={14} />
                              Selesai Dibaca
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Info Body */}
                      <div className="p-5 space-y-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="bg-emerald-50 text-emerald-800 font-extrabold text-[9px] px-2 py-0.5 rounded-lg border border-emerald-100">
                            Kelas {mat.grade === '7' ? 'VII' : mat.grade === '8' ? 'VIII' : 'IX'}
                          </span>
                          <span className="bg-indigo-50 text-indigo-800 font-extrabold text-[9px] px-2 py-0.5 rounded-lg border border-indigo-100">
                            {mat.kelas || 'Semua Kelas'}
                          </span>
                          {!readMaterialIds.includes(mat.id) && (
                            <span className="bg-red-500 text-white font-black text-[9px] px-2 py-0.5 rounded-lg flex items-center gap-0.5 animate-pulse shadow-[0_2px_8px_rgba(239,68,68,0.3)]">
                              BARU
                            </span>
                          )}
                          {isCompleted && (
                            <span className="bg-amber-50 text-amber-800 font-black text-[9px] px-2 py-0.5 rounded-lg border border-amber-100 flex items-center gap-0.5 animate-pulse">
                              <Sparkles size={8} />
                              Materi Dikuasai
                            </span>
                          )}
                        </div>

                        <div>
                          <h3 className="font-black text-slate-800 text-sm md:text-base leading-snug line-clamp-1 group-hover:text-emerald-700 transition-colors">
                            {mat.title}
                          </h3>
                          <p className="text-[11px] text-slate-400 font-medium line-clamp-2 mt-1 leading-relaxed">
                            {mat.description || 'Pelajari materi lengkap ini untuk memperdalam pemahaman kompetensi PAI.'}
                          </p>
                        </div>

                        {/* TP details */}
                        {matchedTp && (
                          <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                            <span className="text-[8px] text-slate-400 font-bold block uppercase tracking-wide">Tujuan Pembelajaran:</span>
                            <p className="text-[10px] font-bold text-slate-700 line-clamp-1 mt-0.5">
                              [{matchedTp.code}] {matchedTp.name}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between rounded-b-[2rem]">
                      <span className="text-[9px] text-slate-400 font-bold font-mono">
                        {mat.created_at ? new Date(mat.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) : 'Terbaru'}
                      </span>
                      <button className="flex items-center gap-1 text-emerald-700 text-xs font-black uppercase tracking-wider group-hover:translate-x-1 transition-transform">
                        Pelajari
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* --- PREMIUM COMPREHENSIVE READER MODAL (FULL SCREEN MOBILE) --- */}
      {selectedMaterial && (() => {
        const wordCount = selectedMaterial.text_content?.split(/\s+/).length || 0;
        const readTime = Math.max(1, Math.ceil(wordCount / 150)); // ~150 words per min for students
        const isCompleted = completedReadIds.includes(selectedMaterial.id);

        return (
          <div className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4 md:p-6 overflow-y-auto animate-fadeIn">
            <div className="bg-white w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-4xl sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-slate-100 animate-slideUp">
              
              {/* Modal Header Bar */}
              <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <span className="bg-emerald-700 text-white font-extrabold text-[9px] px-2.5 py-1 rounded-full uppercase tracking-wider">
                    {selectedMaterial.category}
                  </span>
                  <span className="hidden xs:inline-block text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Kelas {selectedMaterial.grade} &bull; Semester {selectedMaterial.semester || '1'}
                  </span>
                </div>

                {/* Font Size Adjuster Tools for Reader Eye Health */}
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setReaderFontSize(prev => Math.max(12, prev - 2))}
                    className="w-7 h-7 flex items-center justify-center text-xs font-bold text-slate-600 bg-white hover:bg-slate-50 rounded-lg transition-colors border border-slate-200 animate-scale"
                    title="Perkecil Tulisan"
                  >
                    A-
                  </button>
                  <span className="text-[10px] font-black font-mono text-slate-500 w-6 text-center">
                    {readerFontSize}
                  </span>
                  <button
                    onClick={() => setReaderFontSize(prev => Math.min(24, prev + 2))}
                    className="w-7 h-7 flex items-center justify-center text-xs font-bold text-slate-600 bg-white hover:bg-slate-50 rounded-lg transition-colors border border-slate-200 animate-scale"
                    title="Perbesar Tulisan"
                  >
                    A+
                  </button>
                  <button
                    onClick={() => setReaderFontSize(16)}
                    className="w-7 h-7 flex items-center justify-center text-xs text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Reset Ukuran"
                  >
                    <RotateCcw size={12} />
                  </button>
                </div>

                <button 
                  onClick={() => setSelectedMaterial(null)}
                  className="p-1.5 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-full transition-all"
                  title="Tutup Membaca"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Scrollable Reader Content */}
              <div className="flex-1 p-5 sm:p-8 overflow-y-auto space-y-6 bg-slate-50/20">
                
                {/* Banner & Title */}
                <div className="space-y-4">
                  {/* Estimasi Bacaan */}
                  <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock size={13} className="text-emerald-600 animate-pulse" />
                      Estimasi: ~{readTime} Menit Membaca
                    </span>
                    {isCompleted && (
                      <span className="flex items-center gap-1 text-emerald-600 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
                        <CheckCircle size={12} />
                        Selesai Kamu Pelajari
                      </span>
                    )}
                  </div>

                  <h1 className="text-xl sm:text-3xl font-black text-slate-800 tracking-tight leading-tight">
                    {selectedMaterial.title}
                  </h1>
                  
                  {/* Deskripsi ringkas */}
                  <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed italic bg-emerald-50/40 p-4 rounded-2xl border-l-4 border-emerald-600">
                    {selectedMaterial.description}
                  </p>
                </div>

                {/* Grid: Image and TP Information */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Image Illustration */}
                  <div className="md:col-span-2 h-48 sm:h-64 rounded-2xl overflow-hidden border border-slate-100 shadow-sm relative shrink-0">
                    {selectedMaterial.thumbnail ? (
                      <img 
                        referrerPolicy="no-referrer" 
                        src={selectedMaterial.thumbnail} 
                        alt={selectedMaterial.title} 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center text-slate-300 gap-2">
                        <BookOpen size={48} />
                        <span className="text-[10px] font-black uppercase text-slate-400">Dokumentasi Pembelajaran</span>
                      </div>
                    )}
                  </div>

                  {/* TP & Metadata Panel */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Target Kompetensi (TP)</h4>
                      
                      {selectedMaterial.tp_id ? (
                        (() => {
                          const tp = tps.find(t => String(t.id) === String(selectedMaterial.tp_id));
                          return tp ? (
                            <div className="space-y-2">
                              <span className="bg-emerald-100 text-emerald-800 font-extrabold text-[10px] px-2 py-0.5 rounded-lg block w-max">
                                {tp.code}
                              </span>
                              <p className="text-xs font-black text-slate-800">{tp.name}</p>
                              <p className="text-[10px] text-slate-400 font-medium leading-normal">{tp.description}</p>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 italic">Target TP terhubung tidak ditemukan.</p>
                          );
                        })()
                      ) : (
                        <p className="text-xs text-slate-400 italic">Materi ini bersifat pengayaan umum (tidak spesifik ke TP mandiri).</p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-200/50 space-y-1.5">
                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
                        <span>Target Kelas:</span>
                        <span className="text-indigo-600">{selectedMaterial.kelas || 'Semua Kelas'}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
                        <span>Semester:</span>
                        <span className="text-emerald-700">Semester {selectedMaterial.semester || '1'}</span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Teks Pembahasan Lengkap */}
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <BookOpenCheck size={16} className="text-emerald-600" />
                    Pembahasan Lengkap Materi
                  </h3>
                  
                  {selectedMaterial.text_content ? (
                    <div 
                      style={{ fontSize: `${readerFontSize}px` }}
                      className="text-slate-800 font-medium leading-relaxed bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 font-sans shadow-sm whitespace-pre-wrap break-words prose max-w-none prose-emerald prose-headings:font-black prose-p:my-2"
                      dangerouslySetInnerHTML={{ __html: selectedMaterial.text_content }}
                    />
                  ) : (
                    <p className="text-xs text-slate-400 italic">Teks materi utama tidak tersedia.</p>
                  )}
                </div>

                {/* External source button if exists */}
                {selectedMaterial.content_url && (
                  <div className="pt-4 flex justify-center">
                    <a
                      href={selectedMaterial.content_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-indigo-150 transition-all active:scale-95"
                    >
                      <LinkIcon size={14} />
                      Buka Dokumen / Sumber Belajar Eksternal
                    </a>
                  </div>
                )}

              </div>

              {/* Modal Footer Controls */}
              <div className="px-5 pt-4 pb-7 sm:pb-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                <span className="text-[10px] text-slate-400 font-bold italic text-center sm:text-left">
                  {isCompleted 
                    ? '✓ Materi ini sudah kamu tandai selesai dibaca.' 
                    : '*Klik tombol "Tandai Selesai" untuk mengoleksi lencana selesai membaca!'}
                </span>
                
                <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                  {!isCompleted ? (
                    <button
                      onClick={() => handleMarkAsCompleted(selectedMaterial.id)}
                      className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all active:scale-95"
                    >
                      <Sparkles size={14} />
                      Tandai Selesai Dibaca
                    </button>
                  ) : (
                    <span className="w-full sm:w-auto bg-emerald-100 text-emerald-800 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border border-emerald-200 flex items-center justify-center gap-1.5 animate-pulse">
                      <CheckCircle size={14} />
                      Selesai Dibaca
                    </span>
                  )}
                  
                  <button
                    onClick={() => setSelectedMaterial(null)}
                    className="w-full sm:w-auto px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all active:scale-95 text-center flex items-center justify-center"
                  >
                    Tutup
                  </button>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
};

export default PublicMaterials;
