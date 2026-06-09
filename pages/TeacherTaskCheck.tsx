import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, ExternalLink, Image as ImageIcon, Link as LinkIcon, Trash2, Loader2, Calendar, FileText, ArrowLeft, CheckCircle2, Clock, ShieldAlert } from 'lucide-react';
import { db } from '../services/supabaseMock';
import { TaskSubmission, GradeLevel } from '../types';
import Swal from 'sweetalert2';

const TeacherTaskCheck: React.FC = () => {
  const navigate = useNavigate();
  
  // --- STATE TABS & DATA ---
  const [activeTab, setActiveTab] = useState<'tasks' | 'exams'>('tasks');
  const [loading, setLoading] = useState(true);
  
  const [tasks, setTasks] = useState<TaskSubmission[]>([]);
  const [examResults, setExamResults] = useState<any[]>([]);
  
  // --- STATE FILTER ---
  const [filterGrade, setFilterGrade] = useState<GradeLevel | 'all'>('all');
  const [filterClass, setFilterClass] = useState<string>('all');
  const [filterSemester, setFilterSemester] = useState<string>('all'); // Sekarang untuk KEDUA Tab
  
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);

  // Load Data saat Tab atau Filter berubah
  useEffect(() => {
    loadClasses();
    if (activeTab === 'tasks') {
      loadTasks();
    } else {
      loadExamResults();
    }
  }, [activeTab, filterGrade, filterSemester]); // Trigger saat filter berubah

  const loadClasses = async () => {
    // Reset kelas ke 'all' saat jenjang berubah (kecuali initial load)
    if (filterClass !== 'all' && !filterClass.startsWith(filterGrade === 'all' ? '' : filterGrade)) {
         setFilterClass('all');
    }
    
    if (filterGrade === 'all') {
      setAvailableClasses([]);
    } else {
      const classes = await db.getAvailableKelas(filterGrade);
      setAvailableClasses(classes);
    }
  };

  const loadTasks = async () => {
    setLoading(true);
    const data = await db.getTaskSubmissions(filterGrade === 'all' ? undefined : filterGrade);
    setTasks(data);
    setLoading(false);
  };

  const loadExamResults = async () => {
      setLoading(true);
      const gradeParam = filterGrade === 'all' ? undefined : filterGrade;
      const semParam = filterSemester === 'all' ? undefined : filterSemester;
      
      const data = await db.getExamResults(gradeParam, semParam);
      setExamResults(data);
      setLoading(false);
  };

  // --- HELPER FUNCTION: Hitung Durasi Pengerjaan Riil ---
  const calculateRealDuration = (start?: string, end?: string) => {
    if (!start || !end) return '-';
    
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    
    // Hitung selisih dalam menit
    const diffMs = endTime - startTime;
    const diffMins = Math.floor(diffMs / 60000); // 60000 ms = 1 menit
    
    // Jika kurang dari 1 menit, tampilkan detik (opsional) atau bulatkan ke 1 menit
    if (diffMins < 1) return '< 1 Menit';
    
    return `${diffMins} Menit`;
  };

  // --- ACTIONS: TASKS ---
  const viewContent = async (task: TaskSubmission) => {
    if (task.submission_type === 'link') {
      window.open(task.content, '_blank');
    } else {
      const dateStr = new Date(task.created_at).toLocaleDateString('id-ID', {
          day: 'numeric', month: 'long', year: 'numeric'
      });

      const result = await Swal.fire({
        title: `Tugas: ${task.task_name}`,
        text: `Dari: ${task.student_name} (${task.kelas}) • Tanggal: ${dateStr}`,
        imageUrl: task.content,
        imageAlt: 'Tugas Siswa',
        showCancelButton: true,
        confirmButtonText: 'INPUT NILAI',
        cancelButtonText: 'TUTUP',
        confirmButtonColor: '#059669',
        cancelButtonColor: '#dc2626',
        reverseButtons: true,
        customClass: { popup: 'rounded-3xl' }
      });

      if (result.isConfirmed) {
         navigate('/guru/nilai', {
             state: {
                 prefill: {
                     student_name: task.student_name,
                     kelas: task.kelas,
                     task_name: task.task_name,
                     date: task.created_at
                 }
             }
         });
      }
    }
  };

  // --- ACTIONS: DELETE TASK (NEW FEATURE) ---
  const handleDeleteTask = async (task: TaskSubmission) => {
      // 1. Konfirmasi Awal
      const confirm = await Swal.fire({
          title: 'Hapus Tugas?',
          text: `Anda akan menghapus tugas "${task.task_name}" milik ${task.student_name}.`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#dc2626',
          confirmButtonText: 'Ya, Hapus',
          cancelButtonText: 'Batal',
          heightAuto: false
      });

      if (!confirm.isConfirmed) return;

      // 2. Layer Keamanan Ganda (Token)
      const { value: token } = await Swal.fire({
          title: 'Verifikasi Keamanan',
          text: 'Masukkan Token ID Server PAI',
          input: 'password',
          inputPlaceholder: 'Token Keamanan',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#dc2626',
          heightAuto: false
      });

      if (token === "PAI_ADMIN_GURU") {
          Swal.fire({ title: 'Menghapus...', didOpen: () => Swal.showLoading(), heightAuto: false });
          try {
              await db.deleteTaskSubmission(task.id);
              await loadTasks(); // Reload data
              Swal.fire({icon: 'success', title: 'Terhapus', timer: 1000, showConfirmButton: false, heightAuto: false});
          } catch (e) {
              Swal.fire({icon: 'error', title: 'Gagal', text: 'Gagal menghapus data.', heightAuto: false});
          }
      } else if (token !== undefined) {
          Swal.fire({ icon: 'error', title: 'Token Salah', text: 'Penghapusan dibatalkan.', heightAuto: false });
      }
  };

  // --- ACTIONS: EXAMS ---
  const handleDeleteResult = async (id: string, name: string) => {
      // 1. Konfirmasi Awal
      const confirm = await Swal.fire({
          title: 'Hapus Hasil Ujian?',
          text: `Menghapus data hasil ujian milik ${name}. Siswa dapat mengerjakan ulang setelah dihapus.`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#dc2626',
          confirmButtonText: 'Ya, Hapus',
          cancelButtonText: 'Batal',
          heightAuto: false
      });

      if (!confirm.isConfirmed) return;

      // 2. Layer Keamanan Ganda (Token)
      const { value: token } = await Swal.fire({
          title: 'Verifikasi Keamanan',
          text: 'Masukkan Token ID Server PAI',
          input: 'password',
          inputPlaceholder: 'Token Keamanan',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#dc2626',
          heightAuto: false
      });

      if (token === "PAI_ADMIN_GURU") {
          await db.deleteExamResult(id);
          loadExamResults();
          Swal.fire({icon: 'success', title: 'Terhapus', timer: 1000, showConfirmButton: false, heightAuto: false});
      } else if (token !== undefined) {
          Swal.fire({ icon: 'error', title: 'Token Salah', text: 'Penghapusan dibatalkan.', heightAuto: false });
      }
  };

  // Filter Lokal untuk Kelas & Semester (Tugas Upload)
  const getFilteredData = () => {
    let data: any[] = activeTab === 'tasks' ? tasks : examResults;

    // 1. Filter Kelas
    if (filterClass !== 'all') {
        if (activeTab === 'tasks') {
            data = data.filter((t: TaskSubmission) => t.kelas === filterClass);
        } else {
            data = data.filter((r: any) => r.student_class === filterClass);
        }
    }

    // 2. Filter Semester untuk TUGAS UPLOAD (Client Side Logic berdasarkan Tanggal)
    if (activeTab === 'tasks' && filterSemester !== 'all') {
        data = data.filter((t: TaskSubmission) => {
            const date = new Date(t.created_at);
            const month = date.getMonth() + 1; // 1-12
            
            if (filterSemester === '1') {
                return month >= 7 && month <= 12; // Juli - Desember
            } else {
                return month >= 1 && month <= 6;  // Januari - Juni
            }
        });
    }

    // 3. LOGIKA SORTING DINAMIS (SESUAI PERMINTAAN)
    
    if (filterClass === 'all') {
        // JIKA FILTER = SEMUA JENJANG / SEMUA KELAS
        // Urutkan berdasarkan WAKTU (Terakhir Kirim / Selesai) -> Terbaru di Atas
        data.sort((a, b) => {
            const dateA = activeTab === 'tasks' 
                ? new Date(a.created_at).getTime() 
                : new Date(a.submitted_at).getTime();
            
            const dateB = activeTab === 'tasks' 
                ? new Date(b.created_at).getTime() 
                : new Date(b.submitted_at).getTime();

            return dateB - dateA; // Descending (Newest first)
        });
    } else {
        // JIKA FILTER = KELAS TERTENTU (Spesifik)
        // Urutkan berdasarkan ABJAD NAMA (A-Z)
        data.sort((a, b) => {
            const nameA = (a.student_name || '').toLowerCase();
            const nameB = (b.student_name || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });
    }

    return data;
  };

  const filteredData = getFilteredData();

  return (
    <div className="space-y-3 md:space-y-6 animate-fadeIn pb-20">
      {/* Mobile Back Button */}
      <button 
        onClick={() => navigate('/guru')}
        className="md:hidden flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase tracking-tight mb-1"
      >
        <ArrowLeft size={14} /> Kembali ke Dashboard
      </button>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg md:text-2xl font-black text-slate-800 tracking-tight leading-tight">Monitoring Siswa</h1>
          <p className="text-slate-400 text-[10px] md:text-sm font-medium">Cek pengumpulan tugas harian dan hasil tugas online.</p>
        </div>
        
        {/* TABS SWITCHER */}
        <div className="bg-slate-100 p-1 rounded-xl flex">
            <button 
                onClick={() => setActiveTab('tasks')}
                className={`flex-1 px-4 py-2 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${activeTab === 'tasks' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
                <FileText size={14} /> Tugas Upload
            </button>
            <button 
                onClick={() => setActiveTab('exams')}
                className={`flex-1 px-4 py-2 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${activeTab === 'exams' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
                <CheckCircle2 size={14} /> Tugas Online
            </button>
        </div>
      </div>
      
      {/* FILTER AREA */}
      <div className="flex flex-col md:flex-row gap-2 overflow-x-auto pb-2 md:pb-0">
          {/* 1. Filter Jenjang */}
          <div className="flex gap-1.5 shrink-0">
            {(['all', '7', '8', '9'] as const).map((g) => (
              <button
                key={g}
                onClick={() => setFilterGrade(g)}
                className={`px-3 py-1.5 rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold transition-all whitespace-nowrap border ${
                  filterGrade === g 
                  ? (activeTab === 'tasks' ? 'bg-purple-600 text-white border-purple-600' : 'bg-emerald-600 text-white border-emerald-600') 
                  : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                {g === 'all' ? 'Semua Jenjang' : `Kelas ${g}`}
              </button>
            ))}
          </div>

          {/* 2. Filter Nama Kelas */}
          {filterGrade !== 'all' && (
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="px-3 py-1.5 rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold border border-slate-200 bg-white text-slate-700 outline-none focus:border-emerald-500 transition-all shrink-0"
            >
              <option value="all">Semua Kelas {filterGrade}</option>
              {availableClasses.map((cls) => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          )}

          {/* 3. Filter Semester (SEKARANG MUNCUL UNTUK KEDUA TAB) */}
          <select
            value={filterSemester}
            onChange={(e) => setFilterSemester(e.target.value)}
            className="px-3 py-1.5 rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold border border-slate-200 bg-white text-slate-700 outline-none focus:border-emerald-500 transition-all shrink-0"
          >
            <option value="all">Semua Semester</option>
            <option value="1">Semester 1 (Ganjil)</option>
            <option value="2">Semester 2 (Genap)</option>
          </select>
      </div>

      <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-100 overflow-hidden shadow-sm min-h-[300px]">
        {loading ? (
          <div className="p-10 md:p-20 flex flex-col items-center justify-center space-y-3">
            <Loader2 className={`animate-spin ${activeTab === 'tasks' ? 'text-purple-600' : 'text-emerald-600'}`} size={24} />
            <p className="text-slate-400 text-[9px] md:text-xs font-bold uppercase tracking-widest">Memuat Data...</p>
          </div>
        ) : filteredData.length > 0 ? (
          /* REVISI SCROLLBAR & MAX-HEIGHT UNTUK KEDUA TABEL (KIRA-KIRA 10 BARIS = 550px) */
          <div className="max-h-[550px] overflow-y-auto scrollbar-thin relative">
            {activeTab === 'tasks' ? (
                /* ================= TABEL TUGAS UPLOAD ================= */
                <table className="w-full text-left">
                  <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-100 shadow-sm">
                    <tr>
                      <th className="px-4 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-12">NO</th>
                      <th className="px-4 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Siswa</th>
                      <th className="px-4 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest hidden md:table-cell">Judul</th>
                      <th className="px-4 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipe</th>
                      <th className="px-4 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredData.map((task: TaskSubmission, index: number) => (
                      <tr key={task.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 text-center align-middle font-bold text-slate-500 text-[10px] md:text-xs">
                            {index + 1}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800 text-[11px] md:text-sm leading-tight">{task.student_name}</span>
                            <span className="text-[8px] md:text-[10px] text-slate-400 uppercase font-black tracking-tighter">Kelas {task.kelas}</span>
                            {/* Mobile Task Name */}
                            <span className="md:hidden text-[9px] text-slate-500 mt-1 truncate max-w-[120px]">{task.task_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-sm font-medium text-slate-600 truncate max-w-[150px] inline-block">{task.task_name}</span>
                        </td>
                        <td className="px-4 py-3">
                          {task.submission_type === 'link' ? (
                            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-blue-50 text-blue-600 text-[8px] md:text-[10px] font-black border border-blue-100">
                              <LinkIcon size={10} /> Link
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-purple-50 text-purple-600 text-[8px] md:text-[10px] font-black border border-purple-100">
                              <ImageIcon size={10} /> Foto
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center align-middle">
                          {/* REVISI AKSI: TAMBAH TOMBOL HAPUS */}
                          <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => viewContent(task)}
                                className="bg-slate-900 text-white px-2.5 py-2 md:px-4 md:py-2 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-bold hover:bg-purple-600 transition-all active:scale-95 flex items-center gap-1.5"
                              >
                                {task.submission_type === 'link' ? <ExternalLink size={10} /> : <Search size={10} />}
                                <span className="hidden md:inline">Lihat Konten</span>
                                <span className="md:hidden">Cek</span>
                              </button>
                              
                              <button
                                onClick={() => handleDeleteTask(task)}
                                className="bg-red-50 text-red-500 p-2 md:p-2.5 rounded-lg md:rounded-xl hover:bg-red-600 hover:text-white transition-all active:scale-95 border border-red-100"
                                title="Hapus Tugas"
                              >
                                <Trash2 size={14} className="md:w-3.5 md:h-3.5" />
                              </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            ) : (
                /* ================= TABEL HASIL UJIAN ================= */
                <table className="w-full text-left">
                  <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-100 shadow-sm">
                    <tr>
                      <th className="px-4 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-12">NO</th>
                      <th className="px-4 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Siswa</th>
                      <th className="px-4 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest hidden md:table-cell">Nama Tugas</th>
                      <th className="px-4 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Nilai</th>
                      <th className="px-4 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Waktu</th>
                      <th className="px-4 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Hapus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredData.map((res: any, index: number) => (
                      <tr key={res.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 text-center align-middle font-bold text-slate-500 text-[10px] md:text-xs">
                            {index + 1}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800 text-[11px] md:text-sm leading-tight">{res.student_name}</span>
                            <span className="text-[8px] md:text-[10px] text-slate-400 uppercase font-black tracking-tighter">Kelas {res.student_class}</span>
                            
                            {/* REVISI: INFO TAMBAHAN KHUSUS MOBILE (DI BAWAH KELAS) */}
                            <div className="block md:hidden mt-1.5 pt-1.5 border-t border-slate-100">
                               <span className="text-[10px] font-bold text-slate-700 block leading-tight">{res.ujian?.title || '-'}</span>
                               <span className="text-[9px] font-bold text-emerald-600 uppercase">{res.ujian?.category} • Sem {res.semester}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-sm font-medium text-slate-600">{res.ujian?.title || '-'}</span>
                          <span className="block text-[10px] text-slate-400 uppercase font-bold">{res.ujian?.category} • Sem {res.semester}</span>
                        </td>
                        <td className="px-4 py-3 text-center align-top md:align-middle">
                           <span className={`inline-block w-8 py-1 rounded-lg font-black text-[10px] md:text-xs ${res.score >= 75 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                              {res.score}
                           </span>
                        </td>
                        <td className="px-4 py-3 align-top md:align-middle">
                           <div className="flex flex-col text-[10px] md:text-xs text-slate-500">
                              <span className="font-bold">{new Date(res.submitted_at).toLocaleDateString('id-ID')}</span>
                              <span className="flex items-center gap-1 text-[9px]"><Clock size={10}/> {new Date(res.submitted_at).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})} WIB</span>
                              {/* REVISI: MENAMPILKAN LAMA PENGERJAAN RIIL */}
                              <span className="text-[9px] text-emerald-600 font-bold mt-1 block">
                                  Pengerjaan: {calculateRealDuration(res.started_at, res.submitted_at)}
                              </span>
                              
                              {/* BARU: MENAMPILKAN INDIKATOR PELANGGARAN JIKA ADA */}
                              {res.violation_count > 0 && (
                                  <span className="text-[9px] text-red-600 font-bold mt-1 bg-red-50 px-1.5 py-0.5 rounded-md border border-red-100 w-fit flex items-center gap-1">
                                     <ShieldAlert size={10} />
                                     Pelanggaran: {res.violation_count}x
                                  </span>
                              )}
                           </div>
                        </td>
                        <td className="px-4 py-3 text-center align-top md:align-middle">
                          <button
                            onClick={() => handleDeleteResult(res.id, res.student_name)}
                            className="bg-red-50 text-red-500 p-2 rounded-lg hover:bg-red-600 hover:text-white transition-all active:scale-95"
                            title="Hapus Hasil (Siswa bisa ujian ulang)"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            )}
          </div>
        ) : (
          <div className="p-10 md:p-20 text-center space-y-3">
            <div className="w-12 h-12 md:w-16 md:h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200">
              {activeTab === 'tasks' ? <FileText className="w-6 h-6 md:w-8 md:h-8" /> : <CheckCircle2 className="w-6 h-6 md:w-8 md:h-8" />}
            </div>
            <div>
              <p className="text-slate-800 font-bold text-xs md:text-sm">Belum ada data</p>
              <p className="text-slate-400 text-[10px] md:text-xs">
                {filterClass !== 'all' ? `Tidak ada data dari kelas ${filterClass}.` : (activeTab === 'tasks' ? 'Tugas yang dikumpulkan siswa akan muncul di sini.' : 'Hasil ujian siswa akan muncul di sini.')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherTaskCheck;