
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, CheckCircle2, AlertCircle, ImageIcon, X, Loader2, Pencil } from 'lucide-react';
import { db } from '../services/supabaseMock';
import { Exam, Question } from '../types';
import Swal from 'sweetalert2';

const TeacherExamEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  
  // State untuk Mode Edit
  const [editingQId, setEditingQId] = useState<string | null>(null);

  // Form State
  const [qText, setQText] = useState('');
  const [qImage, setQImage] = useState('');
  const [isProcessingImg, setIsProcessingImg] = useState(false);

  const [optA, setOptA] = useState('');
  const [optB, setOptB] = useState('');
  const [optC, setOptC] = useState('');
  const [optD, setOptD] = useState('');
  const [correctKey, setCorrectKey] = useState('0'); 

  useEffect(() => {
    if (id) {
      loadData(id);
    }
  }, [id]);

  const loadData = async (examId: string) => {
    const e = await db.getExamById(examId);
    if (!e) {
      navigate('/guru/ujian');
      return;
    }
    setExam(e);
    const q = await db.getQuestionsByExamId(examId);
    setQuestions(q);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsProcessingImg(true);
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 600; 
          let width = img.width;
          let height = img.height;

          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6); 
          setQImage(dataUrl);
          setIsProcessingImg(false);
        };
      };
    }
  };

  const handleEditClick = (q: Question) => {
    if (exam?.status === 'active') {
        Swal.fire({ icon: 'warning', title: 'Ujian Aktif', text: 'Nonaktifkan ujian terlebih dahulu untuk mengedit.', heightAuto: false });
        return;
    }
    setEditingQId(q.id);
    setQText(q.text);
    setQImage(q.image_url || '');
    if (q.options && q.options.length === 4) {
        setOptA(q.options[0]);
        setOptB(q.options[1]);
        setOptC(q.options[2]);
        setOptD(q.options[3]);
    }
    setCorrectKey(q.correct_answer);
    // Scroll ke form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingQId(null);
    setQText('');
    setQImage('');
    setOptA(''); setOptB(''); setOptC(''); setOptD('');
    setCorrectKey('0');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exam) return;

    if (exam.status === 'active') {
       Swal.fire({ icon: 'warning', title: 'Ujian Aktif', text: 'Nonaktifkan ujian terlebih dahulu.', heightAuto: false });
       return;
    }

    if (!qText || !optA || !optB || !optC || !optD) {
      Swal.fire({ icon: 'warning', title: 'Lengkapi Soal', text: 'Pertanyaan dan semua opsi jawaban wajib diisi.', heightAuto: false });
      return;
    }

    const payload = {
        type: 'pg' as any,
        text: qText,
        image_url: qImage,
        options: [optA, optB, optC, optD],
        correct_answer: correctKey
    };

    try {
      if (editingQId) {
          // UPDATE
          await db.updateQuestion(editingQId, payload);
          Swal.fire({ icon: 'success', title: 'Diperbarui', text: 'Data soal berhasil diupdate.', timer: 1000, showConfirmButton: false, heightAuto: false });
      } else {
          // CREATE
          await db.addQuestion({
            exam_id: exam.id,
            ...payload
          });
          Swal.fire({ icon: 'success', title: 'Tersimpan', text: 'Soal berhasil ditambahkan.', timer: 1000, showConfirmButton: false, heightAuto: false });
      }

      cancelEdit(); // Reset form
      loadData(exam.id); // Reload

    } catch (err) {
      Swal.fire('Error', 'Gagal menyimpan soal.', 'error');
    }
  };

  const handleDeleteQ = async (qid: string) => {
    if (!exam) return;

    if (exam.status === 'active') {
       Swal.fire({ icon: 'warning', title: 'Ujian Aktif', text: 'Nonaktifkan ujian terlebih dahulu untuk menghapus soal.', heightAuto: false });
       return;
    }

    const res = await Swal.fire({ 
        title: 'Hapus Soal?', 
        text: 'Soal ini akan dihapus permanen.',
        icon: 'warning', 
        showCancelButton: true, 
        confirmButtonColor: '#dc2626', 
        heightAuto: false 
    });

    if (!res.isConfirmed) return;

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
        await db.deleteQuestion(qid);
        loadData(exam.id);
        Swal.fire({ icon: 'success', title: 'Terhapus', timer: 1000, showConfirmButton: false, heightAuto: false });
        if (editingQId === qid) cancelEdit();
    } else if (token !== undefined) {
        Swal.fire({ icon: 'error', title: 'Token Salah', text: 'Penghapusan dibatalkan.', heightAuto: false });
    }
  };

  if (!exam) return <div className="p-10 text-center">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-4 animate-fadeIn pb-24 px-1 md:px-0">
      <button onClick={() => navigate('/guru/ujian')} className="flex items-center gap-1.5 text-slate-800 text-[10px] font-black uppercase tracking-tight py-2 mb-1">
        <ArrowLeft size={14} /> Kembali ke Bank Soal
      </button>

      <div className="bg-emerald-700 text-white p-5 rounded-2xl shadow-lg">
        <div className="flex justify-between items-start">
            <div>
                <p className="text-emerald-200 text-[9px] font-bold uppercase tracking-widest mb-1">EDITOR SOAL</p>
                <h1 className="text-lg md:text-xl font-black uppercase tracking-tight leading-tight">{exam.title}</h1>
                <p className="text-emerald-100 text-[10px] mt-1">Kelas {exam.grade} • Semester {exam.semester} • {questions.length} Soal</p>
            </div>
            {exam.status === 'active' && (
                <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-lg border border-white/30">
                    <p className="text-[9px] font-black uppercase text-white flex items-center gap-1"><CheckCircle2 size={12}/> SEDANG AKTIF</p>
                </div>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* KOLOM KIRI: FORM TAMBAH/EDIT SOAL */}
        <div className="md:col-span-1">
            <div className={`bg-white p-4 rounded-2xl border border-slate-100 shadow-sm sticky top-20 ${exam.status === 'active' ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                        {editingQId ? <><Pencil size={16} className="text-blue-600"/> Edit Soal</> : <><Plus size={16} className="text-emerald-600"/> Tambah Soal</>}
                    </h2>
                    {editingQId && (
                        <button onClick={cancelEdit} className="text-[10px] font-bold text-red-500 hover:text-red-700 bg-red-50 px-2 py-1 rounded-lg">Batal Edit</button>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Pertanyaan</label>
                        <textarea 
                            className="w-full p-3 bg-white rounded-xl border border-slate-200 text-xs font-medium focus:border-emerald-500 outline-none min-h-[80px]"
                            placeholder="Tulis pertanyaan disini..."
                            value={qText}
                            onChange={(e) => setQText(e.target.value)}
                        />
                    </div>
                    
                    {/* INPUT GAMBAR */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Gambar Soal (Opsional)</label>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        ref={fileInputRef} 
                        onChange={handleImageSelect} 
                      />
                      
                      {qImage ? (
                        <div className="relative rounded-xl overflow-hidden border border-slate-200 group">
                          <img src={qImage} alt="Preview" className="w-full h-32 object-cover" />
                          <button 
                            type="button" 
                            onClick={() => { setQImage(''); if(fileInputRef.current) fileInputRef.current.value = ''; }}
                            className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full shadow-md hover:bg-red-600"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <button 
                          type="button"
                          disabled={isProcessingImg}
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center gap-2 text-slate-400 hover:border-emerald-400 hover:text-emerald-600 transition-all bg-slate-50"
                        >
                          {isProcessingImg ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
                          <span className="text-[10px] font-bold uppercase">{isProcessingImg ? 'Memproses...' : 'Upload Gambar'}</span>
                        </button>
                      )}
                    </div>

                    <div className="border-t border-slate-100 pt-2 space-y-2">
                      {['A','B','C','D'].map((opt, idx) => (
                          <div key={opt}>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="w-5 h-5 rounded-full bg-white text-emerald-500 text-[10px] font-black flex items-center justify-center border border-slate-200">{opt}</span>
                                {/* REVISI WARNA INPUT MENJADI BG-WHITE */}
                                <input 
                                    type="text"
                                    className="flex-1 p-2 rounded-lg border border-slate-200 text-xs font-medium focus:border-emerald-500 outline-none bg-white text-slate-800"
                                    placeholder={`Jawaban ${opt}`}
                                    value={idx === 0 ? optA : idx === 1 ? optB : idx === 2 ? optC : optD}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if(idx===0) setOptA(val);
                                        else if(idx===1) setOptB(val);
                                        else if(idx===2) setOptC(val);
                                        else setOptD(val);
                                    }}
                                />
                              </div>
                          </div>
                      ))}
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Kunci Jawaban</label>
                        <select 
                            className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-white outline-none focus:border-emerald-500 text-slate-800"
                            value={correctKey}
                            onChange={(e) => setCorrectKey(e.target.value)}
                        >
                            <option value="0">Jawaban A</option>
                            <option value="1">Jawaban B</option>
                            <option value="2">Jawaban C</option>
                            <option value="3">Jawaban D</option>
                        </select>
                    </div>

                    <button type="submit" disabled={isProcessingImg} className={`w-full text-white py-3 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 mt-2 ${editingQId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                        <Save size={14} /> {editingQId ? 'Update Soal' : 'Simpan Soal'}
                    </button>
                </form>
                {exam.status === 'active' && <p className="text-[10px] text-red-500 font-bold text-center mt-2 italic">*Nonaktifkan ujian untuk mengedit</p>}
            </div>
        </div>

        {/* KOLOM KANAN: LIST SOAL */}
        <div className="md:col-span-2 space-y-3">
            {questions.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                    <AlertCircle className="mx-auto text-slate-200 mb-2" size={32} />
                    <p className="text-slate-400 font-bold text-xs">Belum ada soal. Silakan tambah soal di panel kiri.</p>
                </div>
            ) : (
                questions.map((q, idx) => (
                    <div key={q.id} className={`bg-white p-4 rounded-2xl border shadow-sm transition-all group ${editingQId === q.id ? 'border-blue-500 ring-2 ring-blue-500/10' : 'border-slate-100 hover:border-emerald-100'}`}>
                        <div className="flex justify-between items-start gap-3">
                            <div className="flex gap-3 w-full">
                                <span className={`flex-shrink-0 w-6 h-6 rounded-full font-normal text-[8px] flex items-center justify-center border ${editingQId === q.id ? 'bg-blue-100 text-blue-600 border-blue-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                    {idx + 1}
                                </span>
                                <div className="space-y-3 w-full">
                                    {/* Render Gambar Jika Ada */}
                                    {q.image_url && (
                                      <div className="rounded-lg overflow-hidden border border-slate-100 max-w-[200px]">
                                        <img src={q.image_url} alt="Soal" className="w-full h-auto object-cover" />
                                      </div>
                                    )}
                                    <p className="text-[12px] font-normal text-slate-800 leading-relaxed">{q.text}</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {q.options?.map((opt, oIdx) => (
                                            <div key={oIdx} className={`text-xs px-3 py-2 rounded-lg border flex items-center gap-2 ${String(oIdx) === q.correct_answer ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-bold' : 'bg-slate-50 border-transparent text-slate-500'}`}>
                                                <span className="opacity-50 text-[10px] font-black w-4">{['A','B','C','D'][oIdx]}.</span> 
                                                {opt}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex flex-col gap-1">
                                <button 
                                    onClick={() => handleEditClick(q)} 
                                    className={`p-1.5 rounded-lg shrink-0 ${exam.status === 'active' ? 'text-slate-200 cursor-not-allowed' : 'text-blue-400 hover:text-blue-600 hover:bg-blue-50'}`}
                                    title={exam.status === 'active' ? "Nonaktifkan ujian untuk mengedit" : "Edit Soal"}
                                >
                                    <Pencil size={16} />
                                </button>
                                {/* REVISI WARNA ICON HAPUS JADI MERAH */}
                                <button 
                                    onClick={() => handleDeleteQ(q.id)} 
                                    className={`p-1.5 rounded-lg shrink-0 ${exam.status === 'active' ? 'text-slate-200 cursor-not-allowed' : 'text-red-500 hover:text-red-700 hover:bg-red-50'}`}
                                    title={exam.status === 'active' ? "Nonaktifkan ujian untuk menghapus" : "Hapus Soal"}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
      </div>
    </div>
  );
};

export default TeacherExamEditor;
