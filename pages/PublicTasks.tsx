import React, { useState, useRef, useEffect } from 'react';
import { Camera, Link as LinkIcon, Send, Hash, Book, Youtube, Loader2, CheckCircle2, Info, UserCircle, ImageIcon, X, Plus } from 'lucide-react';
import Swal from 'sweetalert2';
import { db } from '../services/supabaseMock';

const PublicTasks: React.FC = () => {
  const [formData, setFormData] = useState({
    nisn: '',
    student_name: '',
    jeniskelamin: '',
    kelas: '',
    task_name: '',
    submission_type: 'photo' as 'link' | 'photo',
    content: ''
  });
  
  // State baru untuk menampung banyak foto
  const [photos, setPhotos] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);
  const [fetchingStudent, setFetchingStudent] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const searchStudent = async () => {
      if (formData.nisn.length < 4) {
        setFormData(prev => ({ ...prev, student_name: '', kelas: '', jeniskelamin: '' }));
        setIsVerified(false);
        return;
      }

      setFetchingStudent(true);
      try {
        const student = await db.getStudentByNIS(formData.nisn);
        if (student) {
          setFormData(prev => ({ 
            ...prev, 
            student_name: student.namalengkap, 
            kelas: student.kelas,
            jeniskelamin: student.jeniskelamin || '-'
          }));
          setIsVerified(true);
          Swal.fire({ 
            toast: true, 
            position: 'top-end', 
            icon: 'success', 
            title: 'Siswa Terverifikasi',
            text:'',
            showConfirmButton: false, 
            timer: 1500 
          });
        } else {
          setIsVerified(false);
          setFormData(prev => ({ ...prev, student_name: '', kelas: '', jeniskelamin: '' }));
          
          // FITUR: Notifikasi jika NIS Salah
          Swal.fire({ 
            toast: true, 
            position: 'top-end', 
            icon: 'error', 
            title: 'Nomor NIS Salah, Siswa tidak di temukan', 
            showConfirmButton: false, 
            timer: 2000 
          });
        }
      } catch (error) { 
        console.error(error); 
      } finally { 
        setFetchingStudent(false); 
      }
    };

    const timeoutId = setTimeout(() => searchStudent(), 800);
    return () => clearTimeout(timeoutId);
  }, [formData.nisn]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const finalValue = name === 'nisn' ? value.replace(/[^0-9]/g, '') : value;
    setFormData(prev => ({ ...prev, [name]: finalValue }));
  };

  const showTutorial = (e: React.MouseEvent) => {
    e.preventDefault();
    const videoUrl = "https://irqphggbsncuplifywul.supabase.co/storage/v1/object/sign/video/Cara%20Upload%20File%20dan%20Share%20Link%20Google%20Drive%20Lewat%20HP%202026.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9kMjA2YTI2NS1hNTMwLTQ5ODktOTBhNS03Yjg2ZmNmZGM0ODYiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ2aWRlby9DYXJhIFVwbG9hZCBGaWxlIGRhbiBTaGFyZSBMaW5rIEdvb2dsZSBEcml2ZSBMZXdhdCBIUCAyMDI2Lm1wNCIsImlhdCI6MTc2OTg4NDg4MiwiZXhwIjoxODY0NDkyODgyfQ.eITFK8P06j4zq857eGx6liWNqnyFeLi4QrP_D12KKeU";
    
    Swal.fire({
      // REVISI LAYOUT TOTAL:
      // 1. Tombol X berada di container sendiri paling atas (flex-end).
      // 2. Judul berada di bawahnya (Center).
      // 3. Video di bawah judul.
      // Ini menjamin judul tidak tertutup tombol X dan subjudul tidak terpotong.
      html: `
        <div class="flex flex-col w-full">
          <!-- ROW 1: TOMBOL X -->
          <div class="flex justify-end mb-1">
            <button 
              id="close-tutorial-btn"
              class="bg-red-500 text-white rounded-full w-9 h-9 flex items-center justify-center shadow-md hover:bg-red-600 transition-all active:scale-90 border-2 border-white"
              style="outline: none;"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
              </svg>
            </button>
          </div>

          <!-- ROW 2: JUDUL & SUBJUDUL -->
          <div class="text-center px-1 mb-4">
             <h3 class="text-lg md:text-xl font-bold text-slate-800 leading-tight">Tutorial Upload Drive</h3>
          </div>

          <!-- ROW 3: VIDEO PLAYER -->
          <div class="w-full bg-white rounded-xl overflow-hidden shadow-2xl border border-slate-200 flex justify-center bg-black">
            <video 
              src="${videoUrl}" 
              controls 
              autoplay
              playsinline
              class="w-full h-auto max-h-[70vh] object-contain"
              style="display: block;"
            >
              Browser Anda tidak mendukung pemutaran video.
            </video>
          </div>
        </div>
      `,
      showConfirmButton: false, 
      width: '95%', // POPUP LEBIH LEBAR AGAR VIDEO JELAS
      padding: '1.25rem',
      didOpen: () => {
        const btn = document.getElementById('close-tutorial-btn');
        if (btn) {
          btn.onclick = () => Swal.close();
        }
      },
      customClass: {
        popup: 'rounded-[2rem]' 
      }
    });
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          // PERTAHANKAN: Max Width 480px (Ukuran WA Low Quality)
          const MAX_WIDTH = 450; 
          let width = img.width;
          let height = img.height;

          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject('Canvas context error');
            return;
          }
          
          ctx.drawImage(img, 0, 0, width, height);
          
          // PERTAHANKAN: Quality 0.4 (40%) - Hasil Base64 sangat kecil
          const dataUrl = canvas.toDataURL('image/jpeg', 0.4);
          resolve(dataUrl);
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setProcessingImage(true);
      try {
        const newPhotos: string[] = [];
        for (let i = 0; i < e.target.files.length; i++) {
          const file = e.target.files[i];
          const compressed = await compressImage(file);
          newPhotos.push(compressed);
        }
        setPhotos(prev => [...prev, ...newPhotos]);
      } catch (error) {
        console.error("Gagal kompresi gambar", error);
        Swal.fire('Error', 'Gagal memproses gambar.', 'error');
      } finally {
        setProcessingImage(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    }
  };

  const removePhoto = (indexToRemove: number) => {
    setPhotos(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const mergePhotos = async (images: string[]): Promise<string> => {
    if (images.length === 0) return '';
    if (images.length === 1) return images[0];

    const loadedImages = await Promise.all(images.map(src => {
      return new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });
    }));

    const width = Math.max(...loadedImages.map(img => img.width));
    const totalHeight = loadedImages.reduce((acc, img) => acc + img.height, 0) + (loadedImages.length - 1) * 20;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = totalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, totalHeight);

    let currentY = 0;
    loadedImages.forEach((img, index) => {
      const x = (width - img.width) / 2;
      ctx.drawImage(img, x, currentY);
      
      if (index < loadedImages.length - 1) {
          ctx.beginPath();
          ctx.moveTo(0, currentY + img.height + 10);
          ctx.lineTo(width, currentY + img.height + 10);
          ctx.strokeStyle = '#e2e8f0'; 
          ctx.lineWidth = 4;
          ctx.stroke();
      }

      currentY += img.height + 20;
    });

    // PERTAHANKAN: Hasil Merge dikompres lagi ke 40%
    return canvas.toDataURL('image/jpeg', 0.4);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 1. VALIDASI DATA TERLEBIH DAHULU
    
    if (!isVerified) { 
      Swal.fire('Ops..', 'Masukkan NIS yang benar agar nama muncul otomatis.', 'warning'); 
      return; 
    }

    if (!formData.task_name) { 
      Swal.fire('Ops..', 'Judul tugas wajib diisi!', 'warning'); 
      return; 
    }

    if (formData.submission_type === 'photo') {
        if (photos.length === 0) { 
            Swal.fire('Ops..', 'Belum ada foto yang diambil!', 'warning'); 
            return; 
        }
    } else {
        if (!formData.content) {
            Swal.fire('Ops..', 'Link Drive wajib diisi!', 'warning'); 
            return;
        }
    }

    // 2. KONFIRMASI USER
    const result = await Swal.fire({ 
      title: 'Kirim Tugas?', 
      text: `Atas nama ${formData.student_name} dari kelas ${formData.kelas}.`, 
      icon: 'question', 
      showCancelButton: true, 
      confirmButtonColor: '#059669' 
    });
    
    if (!result.isConfirmed) {
        return;
    }

    // 3. MULAI PROSES
    setLoading(true);
    
    try {
      let finalContent = formData.content;

      // Proses Merge Foto (Hanya jika tipe foto dan lebih dari 1)
      if (formData.submission_type === 'photo') {
          if (photos.length > 1) {
              try {
                  finalContent = await mergePhotos(photos);
              } catch (err) {
                  console.error(err);
                  Swal.fire('Gagal', 'Gagal Proses foto.', 'error');
                  setLoading(false);
                  return;
              }
          } else {
              finalContent = photos[0];
          }
      }

      // Kirim ke Database
      await db.addTaskSubmission({
        nisn: formData.nisn,
        student_name: formData.student_name,
        kelas: formData.kelas,
        task_name: formData.task_name,
        submission_type: formData.submission_type,
        content: finalContent
      });

      const now = new Date();
      await Swal.fire({
        icon: 'success',
        title: 'Tugas Terkirim!',
        text: `Alhamdulillah... ${formData.student_name} dari kelas ${formData.kelas} sudah mengirim tugas ${formData.task_name}. silahkan screenshot ini sebagai bukti`,
        confirmButtonText: 'OK',
        confirmButtonColor: '#059669',
        customClass: { popup: 'rounded-[2rem]' }
      });

      // Reset Form
      setFormData({ nisn: '', student_name: '', jeniskelamin: '', kelas: '', task_name: '', submission_type: 'photo', content: '' });
      setPhotos([]); 
      setIsVerified(false);
    } catch (err) { 
      Swal.fire('Gagal', 'Sistem error.', 'error'); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-3 md:space-y-6 animate-fadeIn pb-24 px-1 md:px-0">
      <div className="text-center space-y-1">
        <h1 className="text-xl md:text-2xl font-black text-slate-800 uppercase tracking-tight">Kirim Tugas PAI</h1>
        <p className="text-[10px] md:text-xs text-slate-500 font-medium tracking-tight">Masukkan NIS terlebih dahulu untuk mengumpulkan tugas</p>
      </div>

      <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-100">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[9px] font-black text-black uppercase tracking-normal ml-1 mb-1 flex justify-between">
              NOMOR NIS {fetchingStudent && <span className="text-emerald-600 text-[8px] animate-pulse font-normal">loading data siswa...</span>}
            </label>
            <div className="relative">
              <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input 
                type="text" 
                name="nisn" 
                inputMode="numeric" 
                placeholder="masukkan nomor NIS siswa" 
                style={{ colorScheme: 'light' }}
                // PERTAHANKAN: Style Putih Bersih
                className={`w-full pl-10 pr-10 py-3 text-xs rounded-xl border !bg-white !text-black outline-none transition-all placeholder:font-normal font-normal ${isVerified ? 'border-emerald-500 ring-4 ring-emerald-500/5' : 'border-slate-200 focus:border-emerald-500'}`} 
                value={formData.nisn} 
                onChange={handleInputChange} 
                maxLength={10} 
              />
              {isVerified && <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500" size={16} />}
            </div>
          </div>

          <div>
            <label className="block text-[9px] font-black text-black uppercase tracking-normal ml-1 mb-1">Nama Siswa</label>
            <div className="relative">
              <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
              <input 
                type="text" 
                readOnly 
                tabIndex={-1}
                className="w-full pl-10 pr-3 py-3 text-xs rounded-xl border border-slate-100 bg-slate-50 text-black font-bold pointer-events-none placeholder:font-normal" 
                value={formData.student_name} 
                placeholder="nama akan muncul otomatis..." 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[9px] font-black text-black uppercase tracking-normal ml-1 mb-1">Jenis Kelamin</label>
              <input 
                type="text" 
                readOnly 
                tabIndex={-1}
                className="w-full px-4 py-3 text-xs rounded-xl border border-slate-100 bg-slate-50 text-black font-normal pointer-events-none placeholder:font-normal" 
                value={formData.jeniskelamin} 
                placeholder="-" 
              />
            </div>
            <div>
              <label className="block text-[9px] font-black text-black uppercase tracking-normal ml-1 mb-1">Kelas</label>
              <input 
                type="text" 
                readOnly 
                tabIndex={-1}
                className="w-full px-4 py-3 text-xs rounded-xl border border-slate-100 bg-slate-50 text-black font-normal pointer-events-none placeholder:font-normal" 
                value={formData.kelas} 
                placeholder="-" 
              />
            </div>
          </div>

          <div>
            <label className="block text-[9px] font-black text-black uppercase tracking-normal ml-1 mb-1">Judul Tugas / Materi</label>
            <div className="relative">
              <Book className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input 
                type="text" 
                name="task_name" 
                placeholder="tulis judul tugas & halamannya" 
                style={{ colorScheme: 'light' }}
                className="w-full pl-10 pr-4 py-3 text-xs rounded-xl border border-slate-200 !bg-white !text-black outline-none focus:border-emerald-500 font-normal placeholder:font-normal" 
                value={formData.task_name} 
                onChange={handleInputChange} 
              />
            </div>
          </div>

          <div>
            <label className="block text-[9px] font-black text-black uppercase tracking-normal ml-1 mb-1">Metode Pengumpulan</label>
            <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 mb-2">
              <button 
                type="button" 
                onClick={() => setFormData(prev => ({ ...prev, submission_type: 'photo' }))} 
                className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${formData.submission_type === 'photo' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400'}`}
              >
                <Camera size={12} /> Foto Kamera
              </button>
              <button 
                type="button" 
                onClick={() => setFormData(prev => ({ ...prev, submission_type: 'link', content: '' }))} 
                className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-normal transition-all flex items-center justify-center gap-1.5 ${formData.submission_type === 'link' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400'}`}
              >
                <LinkIcon size={12} /> Link Drive
              </button>
            </div>

            {formData.submission_type === 'link' ? (
              <div className="space-y-2 animate-fadeIn">
                <div className="relative">
                  <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input 
                    type="url" 
                    name="content" 
                    placeholder="https://drive.google.com/file/..." 
                    style={{ colorScheme: 'light' }}
                    className="w-full pl-10 pr-4 py-3 text-xs rounded-xl border border-slate-200 !bg-white !text-black outline-none focus:border-emerald-500 italic font-normal placeholder:font-normal" 
                    value={formData.content} 
                    onChange={handleInputChange} 
                  />
                </div>
                <button 
                  type="button"
                  onClick={showTutorial}
                  className="flex items-center gap-1.5 text-[9px] font-normal italic text-blue-600 tracking-tight hover:underline px-1"
                >
                  <Youtube size={12} /> Cara mengupload tugas via Google Drive
                </button>
              </div>
            ) : (
              <div className="animate-fadeIn">
                <input 
                    type="file" 
                    accept="image/*" 
                    multiple 
                    className="hidden" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                />

                {photos.length > 0 ? (
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {photos.map((photo, idx) => (
                                <div key={idx} className="relative group rounded-xl overflow-hidden shadow-sm border border-slate-100 aspect-square">
                                    <img src={photo} className="w-full h-full object-cover" alt={`Preview ${idx + 1}`} />
                                    <button 
                                        type="button"
                                        onClick={() => removePhoto(idx)}
                                        className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full shadow-lg active:scale-95 opacity-90 hover:opacity-100"
                                    >
                                        <X size={12} />
                                    </button>
                                    <span className="absolute bottom-1 right-1 bg-black/50 text-white text-[8px] px-1.5 py-0.5 rounded-md backdrop-blur-sm">
                                        {idx + 1}
                                    </span>
                                </div>
                            ))}
                            
                            <button 
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-emerald-300 bg-emerald-50/50 rounded-xl aspect-square hover:bg-emerald-50 transition-all text-emerald-600 active:scale-95"
                            >
                                <Plus size={24} />
                                <span className="text-[9px] font-bold uppercase">Tambah</span>
                            </button>
                        </div>
                        <p className="text-[10px] text-center text-slate-400 italic">
                             *pastikan foto sudah benar sebelum di kirim !.
                        </p>
                    </div>
                ) : (
                    <div 
                      // FITUR: Proteksi Tombol Foto
                      onClick={() => {
                        if (!isVerified) {
                           Swal.fire({ icon: 'warning', title: 'NIS Belum Diisi', text: 'Silakan masukkan nomor NIS terlebih dahulu.', timer: 2000, showConfirmButton: false });
                           return;
                        }
                        if (!processingImage) fileInputRef.current?.click();
                      }} 
                      className={`border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center transition-all bg-slate-50
                        ${!isVerified ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-emerald-50 hover:border-emerald-200'}
                        ${processingImage ? 'opacity-50 pointer-events-none' : ''}
                      `}
                    >
                      {processingImage ? (
                        <div className="space-y-2">
                           <Loader2 size={24} className="mx-auto text-emerald-600 animate-spin" />
                           <p className="text-[10px] font-bold text-emerald-600">Tunggu Sebentar...</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm border border-slate-100">
                              <ImageIcon size={20} className="text-slate-400" />
                          </div>
                          <div>
                             <p className="text-[11px] font-black text-slate-600 tracking-tight uppercase">Ambil Foto Tugas</p>
                             <p className="text-[10px] font-normal italic text-slate-400">Pastikan Pencahayaan Foto Jelas & Tidak Blur </p>
                          </div>
                        </div>
                      )}
                    </div>
                )}
              </div>
            )}
          </div>

          <button 
            type="submit" 
            disabled={loading || !isVerified || processingImage} 
            className={`w-full py-4 rounded-xl text-xs font-black shadow-lg transition-all uppercase tracking-[0.2em] flex items-center justify-center gap-2 active:scale-95 ${isVerified ? 'bg-emerald-700 text-white shadow-emerald-700/20' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
          >
            {loading || processingImage ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {processingImage ? 'Proses...' : 'Kirim Tugas'}
              </>
            ) : (
              <>
                <Send size={16} />
                Kirim Tugas
              </>
            )}
          </button>
        </form>
      </div>

      <div className="bg-emerald-600 text-white p-5 rounded-[2rem] shadow-lg border border-emerald-500 animate-slideUp">
        <div className="flex items-center gap-2 mb-3">
          <Info size={16} className="text-emerald-100 opacity-90" />
          <h3 className="text-[10px] font-black uppercase tracking-widest">Ringkasan Pengiriman</h3>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-[10px]">
          <div className="space-y-2.5">
            <div>
              <p className="text-emerald-100 font-bold uppercase tracking-tighter opacity-80 mb-0.5">Nama Siswa</p>
              <p className="font-normal text-white truncate w-full" title={formData.student_name}>
                {formData.student_name || 'Menunggu NIS...'}
              </p>
            </div>
            <div>
              <p className="text-emerald-100 font-bold uppercase tracking-tighter opacity-80 mb-0.5">Metode Pengumpulan</p>
              <p className="font-black uppercase text-white">
                  {formData.submission_type === 'photo' ? `FOTO KAMERA (${photos.length} file)` : 'LINK DRIVE'}
              </p>
            </div>
          </div>
          <div className="space-y-2.5">
            <div>
              <p className="text-emerald-100 font-bold uppercase tracking-tighter opacity-80 mb-0.5">Tujuan Guru</p>
              <p className="font-black italic text-white leading-tight">Ahmad Nawasyi, S.Pd</p>
            </div>
            <div>
              <p className="text-emerald-100 font-bold uppercase tracking-tighter opacity-80 mb-0.5">Tanggal</p>
              <p className="font-black text-white">{new Date().toLocaleDateString('id-ID')}</p>
            </div>
          </div>
        </div>
        
        <div className="mt-4 pt-3 border-t border-emerald-500/50">
          <p className="text-[8px] text-emerald-100 text-center leading-relaxed opacity-90 italic font-medium">
            Tugas yang dikirim akan tersimpan secara otomatis.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PublicTasks;