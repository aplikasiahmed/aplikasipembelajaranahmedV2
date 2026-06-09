import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileEdit, Plus, Trash2, Edit, PlayCircle, PauseCircle, Loader2, ArrowLeft, X, Save, BookOpen, Clock, Layers, Pencil, CalendarClock, Shuffle } from 'lucide-react';
import { db } from '../services/supabaseMock';
import { Exam, GradeLevel } from '../types';
import Swal from 'sweetalert2';

const TeacherExams: React.FC = () => {
  const navigate = useNavigate();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  // --- STATE UNTUK FORM (INLINE) ---
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    grade: '',     // Default kosong untuk "Pilih Kelas"
    category: '',  // Default kosong untuk "Pilih Tugas"
    duration: '60',
    semester: '',   // Default kosong untuk "Pilih Semester"
    deadline: ''    // New: Batas Waktu
  });

  // Load Exams
  useEffect(() => {
    fetchExams();
  }, []);

  const fetchExams = async () => {
    setLoading(true);
    const data = await db.getExams();
    setExams(data);
    setLoading(false);
  };

  // Toggle Form
  const toggleForm = () => {
    if (!showForm) {
      // Reset form saat dibuka
      setFormData({
        title: '',
        grade: '',
        category: '',
        duration: '60',
        semester: '',
        deadline: ''
      });
      setEditingId(null);
    }
    setShowForm(!showForm);
  };

  const handleEditClick = (exam: Exam) => {
    if (exam.status === 'active') {
       Swal.fire({ icon: 'warning', title: 'Soal Aktif', text: 'Nonaktifkan soal terlebih dahulu untuk mengedit.', heightAuto: false });
       return;
    }
    
    // Format deadline untuk input datetime-local (YYYY-MM-DDTHH:mm)
    let formattedDeadline = '';
    if (exam.deadline) {
        try {
            const d = new Date(exam.deadline);
            // Mengatasi konversi zona waktu agar sesuai tampilan lokal
            const localIso = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
            formattedDeadline = localIso;
        } catch (e) {
            console.error("Date parse error", e);
        }
    }

    setFormData({
        title: exam.title,
        grade: exam.grade,
        category: exam.category,
        duration: String(exam.duration),
        semester: exam.semester,
        deadline: formattedDeadline
    });
    setEditingId(exam.id);
    setShowForm(true);
    // Scroll ke atas agar form terlihat
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validasi Wajib Pilih Dropdown
    if (!formData.title.trim()) {
      Swal.fire({ icon: 'warning', title: 'Judul Kosong', text: 'Judul tugas wajib diisi.', heightAuto: false });
      return;
    }
    if (!formData.category) {
      Swal.fire({ icon: 'warning', title: 'Kategori Kosong', text: 'Silakan Pilih Tugas (Kategori) terlebih dahulu.', heightAuto: false });
      return;
    }
    if (!formData.grade) {
      Swal.fire({ icon: 'warning', title: 'Kelas Kosong', text: 'Silakan Pilih Kelas terlebih dahulu.', heightAuto: false });
      return;
    }
    if (!formData.semester) {
      Swal.fire({ icon: 'warning', title: 'Semester Kosong', text: 'Silakan Pilih Semester terlebih dahulu.', heightAuto: false });
      return;
    }
    if (!formData.duration) {
      Swal.fire({ icon: 'warning', title: 'Durasi Kosong', text: 'Durasi tugas wajib diisi.', heightAuto: false });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: formData.title,
        grade: formData.grade as GradeLevel,
        category: formData.category as any,
        semester: formData.semester,
        duration: parseInt(formData.duration) || 60,
        deadline: formData.deadline ? new Date(formData.deadline).toISOString() : undefined
      };

      if (editingId) {
          // UPDATE
          await db.updateExam(editingId, payload);
          Swal.fire({ icon: 'success', title: 'Diperbarui', text: 'Data tugas berhasil diupdate.', timer: 1000, showConfirmButton: false, heightAuto: false });
      } else {
          // CREATE
          await db.createExam({
            ...payload,
            status: 'draft'
          });
          Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Soal baru telah dibuat.', timer: 1000, showConfirmButton: false, heightAuto: false });
      }
      
      setShowForm(false);
      setEditingId(null);
      fetchExams();
    } catch (err: any) {
      console.error(err);
      const errMsg = err.message || 'Terjadi kesalahan sistem.';
      Swal.fire({ icon: 'error', title: 'Gagal', text: errMsg, heightAuto: false });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleStatus = async (exam: Exam) => {
    const newStatus = exam.status === 'active' ? 'draft' : 'active';
    const actionText = newStatus === 'active' ? 'Mengaktifkan' : 'Menonaktifkan';
    
    const result = await Swal.fire({
      title: `${actionText} Soal?`,
      text: newStatus === 'active' ? 'Siswa dapat melihat dan mengerjakan soal ini.' : 'Soal akan disembunyikan dari siswa.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: newStatus === 'active' ? '#059669' : '#d97706',
      confirmButtonText: 'Ya, Lakukan',
      heightAuto: false
    });

    if (result.isConfirmed) {
      await db.updateExamStatus(exam.id, newStatus);
      fetchExams();
    }
  };

  const toggleRandom = async (exam: Exam) => {
    const newRandom = !exam.is_random;
    
    try {
        await db.updateExam(exam.id, { is_random: newRandom });
        
        // Show toast notification
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2000,
            timerProgressBar: true,
            didOpen: (toast) => {
                toast.addEventListener('mouseenter', Swal.stopTimer)
                toast.addEventListener('mouseleave', Swal.resumeTimer)
            }
        });
        
        Toast.fire({
            icon: 'success',
            title: newRandom ? 'Soal Diacak' : 'Soal Tidak Diacak'
        });

        fetchExams();
    } catch (error) {
        console.error("Failed to toggle random:", error);
        Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal mengubah status acak soal.', heightAuto: false });
    }
  };

  const handleDelete = async (exam: Exam) => {
    // 1. Validasi Status Aktif
    if (exam.status === 'active') {
       Swal.fire({
          icon: 'error',
          title: 'Akses Ditolak',
          text: 'Tugas sedang AKTIF. Silakan nonaktifkan (draft) terlebih dahulu untuk menghapus.',
          heightAuto: false
       });
       return;
    }

    // 2. Konfirmasi Awal
    const result = await Swal.fire({
      title: 'Hapus Tugas?',
      text: 'Anda akan menghapus data tugas ini.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Ya, Hapus',
      heightAuto: false
    });

    if (!result.isConfirmed) return;

    // 3. Validasi Keamanan Token
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
        Swal.fire({ title: 'Memproses....', didOpen: () => Swal.showLoading(), heightAuto: false });
        
        // 4. CEK APAKAH ADA HASIL UJIAN
        const hasResults = await db.hasExamResults(exam.id);

        if (hasResults) {
            // JIKA ADA HASIL: HAPUS SOAL SAJA, JANGAN HAPUS UJIAN
            await db.deleteAllQuestionsByExamId(exam.id);
            // Opsional: Set status closed atau ubah judul untuk menandakan archived
            await db.updateExamStatus(exam.id, 'closed');
            
            Swal.fire({
                icon: 'success',
                title: 'Diarsipkan',
                text: 'Tugas memiliki data hasil siswa. Hanya soal yang dihapus untuk menjaga arsip nilai.',
                heightAuto: false
            });
        } else {
            // JIKA TIDAK ADA HASIL: HAPUS SEMUA (CLEAN DELETE)
            await db.deleteExam(exam.id);
            Swal.fire({ icon: 'success', title: 'Terhapus', text: 'Data tugas berhasil dihapus permanen.', timer: 1500, showConfirmButton: false, heightAuto: false });
        }
        
        fetchExams();

    } else if (token !== undefined) {
        Swal.fire({ icon: 'error', title: 'Token Salah', text: 'Penghapusan dibatalkan.', heightAuto: false });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 animate-fadeIn pb-20 px-1 md:px-0">
      <button onClick={() => navigate('/guru')} className="md:hidden flex items-center gap-1.5 text-slate-800 text-[10px] font-black uppercase tracking-tight py-2 mb-1">
        <ArrowLeft size={14} /> Kembali ke Dashboard
      </button>

      {/* HEADER CARD */}
      <div className="flex flex-col bg-emerald-600 md:flex-row md:items-center justify-between gap-4 shadow-emerald-200 p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-sm z-10 relative">
        <div>
          <h1 className="text-lg md:text-2xl font-black text-white uppercase tracking-tight">Bank Soal</h1>
          <p className="text-white text-[10px] md:text-sm font-medium">Buat dan kelola soal untuk siswa.</p>
        </div>
        <button 
          onClick={toggleForm}
          className={`px-5 py-3 rounded-xl shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider ${showForm ? 'text-white bg-red-600 hover:bg-red-800 shadow-red-900' : 'bg-emerald-800 text-white shadow-emerald-900 hover:bg-emerald-700'}`}
        >
          {showForm ? <><X size={16} /> Batal</> : <><Plus size={16} /> Buat Soal Baru</>}
        </button>
      </div>

      {/* FORM CARD (INLINE) */}
      {showForm && (
        <div className="bg-white w-full rounded-[2.5rem] p-6 md:p-8 shadow-xl border border-blue-100 relative overflow-hidden animate-slideUp">
             <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                <BookOpen size={120} className="text-blue-900"/>
             </div>
             
             <div className="flex items-center gap-3 mb-6 relative z-10">
                  <div className="bg-blue-100 text-blue-700 p-2.5 rounded-xl">
                     <FileEdit size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">{editingId ? 'Edit Data Tugas' : 'Form Tugas Baru'}</h2>
                    <p className="text-[10px] text-slate-400 font-medium leading-none">Lengkapi detail Tugas Online di bawah ini</p>
                  </div>
             </div>

             <form onSubmit={handleFormSubmit} className="space-y-4 relative z-10">
               {/* 1. Judul Ujian */}
               <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Judul Tugas Online</label>
                  <input 
                    type="text" 
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    placeholder="Contoh: Penilaian Harian Bab 1"
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-normal text-slate-800 outline-none focus:bg-white focus:border-emerald-500 transition-all placeholder:font-normal"
                  />
               </div>

               {/* 2. Grid (Kategori & Kelas) */}
               <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kategori</label>
                    <div className="relative">
                       <Layers size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                       <select 
                          name="category"
                          value={formData.category}
                          onChange={handleInputChange}
                          className={`w-full pl-9 pr-3 py-3 rounded-xl border text-xs font-normal outline-none focus:bg-white focus:border-emerald-500 transition-all appearance-none ${formData.category ? 'bg-slate-50 text-slate-800 border-slate-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}
                       >
                          <option value="" disabled>-- Pilih Tugas --</option>
                          <option value="Tugas Online">Tugas Online</option>
                          <option value="Ujian Online">Ujian Online</option>
                          <option value="Harian">Harian</option>
                          <option value="UTS">UTS</option>
                          <option value="UAS">UAS</option>
                          <option value="Praktik">Praktik</option>
                       </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kelas</label>
                    <select 
                        name="grade"
                        value={formData.grade}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-3 rounded-xl border text-xs font-normal outline-none focus:bg-white focus:border-emerald-500 transition-all ${formData.grade ? 'bg-slate-50 text-slate-800 border-slate-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}
                    >
                        <option value="" disabled>-- Pilih Kelas --</option>
                        <option value="7">Kelas 7</option>
                        <option value="8">Kelas 8</option>
                        <option value="9">Kelas 9</option>
                    </select>
                  </div>
               </div>

               {/* 3. Grid (Durasi & Semester) */}
               <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Durasi (Menit)</label>
                     <div className="relative">
                        <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                           type="number"
                           name="duration"
                           value={formData.duration}
                           onChange={handleInputChange}
                           className="w-full pl-9 pr-3 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-normal text-slate-800 outline-none focus:bg-white focus:border-emerald-500 transition-all"
                        />
                     </div>
                  </div>
                  <div className="space-y-1">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Semester</label>
                     <select 
                        name="semester"
                        value={formData.semester}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-3 rounded-xl border text-xs font-normal outline-none focus:bg-white focus:border-emerald-500 transition-all ${formData.semester ? 'bg-slate-50 text-slate-800 border-slate-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}
                     >
                        <option value="" disabled>-- Pilih Semester --</option>
                        <option value="1">Ganjil (1)</option>
                        <option value="2">Genap (2)</option>
                     </select>
                  </div>
               </div>

               {/* NEW: Input Batas Pengerjaan (Deadline) */}
               <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Batas Waktu (Opsional)</label>
                  <div className="relative">
                     <CalendarClock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                     <input 
                        type="datetime-local" 
                        name="deadline"
                        value={formData.deadline}
                        onChange={handleInputChange}
                        className="w-full pl-9 pr-3 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-normal text-slate-800 outline-none focus:bg-white focus:border-emerald-500 transition-all cursor-pointer"
                     />
                  </div>
                  <p className="text-[9px] text-slate-400 italic ml-1">*Jika diisi, soal otomatis non-aktif setelah tanggal ini.</p>
               </div>

               <div className="pt-2">
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl text-xs font-black uppercase tracking-[0.2em] shadow-lg shadow-blue-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <><Loader2 size={16} className="animate-spin"/> Proses...</> : <><Save size={16} /> {editingId ? 'Update Data' : 'Simpan Soal'}</>}
                  </button>
               </div>
            </form>
        </div>
      )}

      {/* EXAM LIST */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-10 text-center"><Loader2 size={32} className="animate-spin text-emerald-600 mx-auto" /></div>
        ) : exams.length === 0 ? (
          <div className="p-10 text-center bg-white rounded-2xl border border-dashed border-slate-200">
            <p className="text-slate-400 font-bold text-sm">Belum ada soal dibuat.</p>
          </div>
        ) : (
          exams.map((exam) => (
            <div key={exam.id} className="bg-white p-4 md:p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-emerald-100 transition-colors">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                   <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${exam.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {exam.status === 'active' ? 'AKTIF' : 'DRAFT'}
                   </span>
                   <span className="text-[9px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                      KELAS {exam.grade}
                   </span>
                   <span className="text-[9px] font-bold text-purple-500 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100 uppercase">
                      {exam.category || 'Harian'}
                   </span>
                   <span className="text-[9px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                      {exam.duration} MENIT
                   </span>
                   <span className="text-[9px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                      SEM {exam.semester}
                   </span>
                </div>
                <h3 className="text-sm md:text-base font-black text-slate-800 leading-tight">{exam.title}</h3>
                {/* Tampilkan Deadline di List jika ada */}
                {exam.deadline && (
                    <p className="text-[9px] text-red-500 font-bold uppercase flex items-center gap-1">
                        <Clock size={10} /> Batas Soal: {new Date(exam.deadline).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'})}
                    </p>
                )}
                {!exam.deadline && <p className="text-[10px] text-slate-400 font-medium">Semester {exam.semester}</p>}
              </div>

              {/* REVISI URUTAN TOMBOL: ACAK -> STATUS -> KELOLA -> EDIT -> HAPUS */}
              <div className="flex items-center gap-2">
                 <button 
                   onClick={() => toggleRandom(exam)}
                   className={`p-2.5 rounded-xl border transition-all ${exam.is_random ? 'bg-purple-50 text-purple-600 border-purple-100 hover:bg-purple-100' : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100'}`}
                   title={exam.is_random ? "Soal Diacak" : "Soal Tidak Diacak"}
                 >
                   <Shuffle size={18} />
                 </button>

                 <button 
                   onClick={() => toggleStatus(exam)}
                   className={`p-2.5 rounded-xl border transition-all ${exam.status === 'active' ? 'bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100'}`}
                   title={exam.status === 'active' ? "Non-aktifkan" : "Aktifkan"}
                 >
                   {exam.status === 'active' ? <PauseCircle size={18} /> : <PlayCircle size={18} />}
                 </button>

                 <button 
                   onClick={() => {
                       if(exam.status === 'active') {
                           Swal.fire({ icon: 'warning', title: 'Akses Dibatasi', text: 'Nonaktifkan soal terlebih dahulu untuk mengedit soal.', heightAuto: false });
                       } else {
                           navigate(`/guru/ujian/edit/${exam.id}`)
                       }
                   }}
                   className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm active:scale-95 transition-all ${exam.status === 'active' ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-red-600 text-white hover:bg-red-900'}`}
                 >
                   <Edit size={14} /> Kelola Soal
                 </button>

                 {/* Tombol Edit Ujian (Metadata) */}
                 <button 
                    onClick={() => handleEditClick(exam)}
                    className={`p-2.5 rounded-xl border transition-all active:scale-95 ${exam.status === 'active' ? 'bg-slate-100 text-slate-300 border-transparent cursor-not-allowed' : 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100'}`}
                    title="Edit Data Soal"
                 >
                    <Pencil size={18} />
                 </button>

                 <button 
                   onClick={() => handleDelete(exam)}
                   className={`p-2.5 rounded-xl border transition-all active:scale-95 ${exam.status === 'active' ? 'bg-slate-100 text-slate-300 border-transparent cursor-not-allowed' : 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100'}`}
                 >
                   <Trash2 size={18} />
                 </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TeacherExams;