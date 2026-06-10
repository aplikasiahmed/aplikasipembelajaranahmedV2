import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Save, User, Award, CheckCircle2, ArrowLeft, Users, Search, Calendar, FileUp, Download, Upload, Info, FileCheck } from 'lucide-react';
import { db } from '../services/supabaseMock';
import { Student, GradeLevel } from '../types';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { generateExcel } from '../utils/excelGenerator';

// Helper to normalize semester input
const normalizeSemester = (val: string) => {
  const v = String(val).toLowerCase().trim();
  if (v === '1' || v === 'ganjil' || v.includes('ganjil') || v.includes('semester 1')) return '1';
  if (v === '2' || v === 'genap' || v.includes('genap') || v.includes('semester 2')) return '2';
  return val;
};

const TeacherInputGrades: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation(); // Hook untuk menangkap data kiriman
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [grade, setGrade] = useState<GradeLevel>('7');
  const [semester, setSemester] = useState(''); // Default kosong untuk "Pilih Semester"
  const [selectedKelas, setSelectedKelas] = useState('');
  const [availableKelas, setAvailableKelas] = useState<string[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  
  // State untuk Data Nilai (Tanggal Manual)
  const [date, setDate] = useState(''); 
  const [score, setScore] = useState<string>(''); // Default string kosong agar tidak ada angka 0
  const [type, setType] = useState(''); // Default kosong untuk "Pilih Tugas"
  const [desc, setDesc] = useState('');
  
  // State Khusus untuk Kartu Import Excel
  const [importKelas, setImportKelas] = useState('');
  const [importSemester, setImportSemester] = useState(''); // Tambahan State Semester Import
  const [importDate, setImportDate] = useState(''); // 1. Tambahan Dropdown Tanggal Import
  const [selectedFile, setSelectedFile] = useState<File | null>(null); // 2. Tambahan State File Terpilih
  const [allClassesList, setAllClassesList] = useState<string[]>([]); // Semua kelas (7A-9I)

  const [status, setStatus] = useState<'idle' | 'saving' | 'success'>('idle');

  // Load Kelas berdasarkan Jenjang (Untuk Form Manual)
  // FIX: Tambahkan logika cek prefill agar tidak menimpa kelas yang dikirim
  useEffect(() => {
    let isMounted = true;
    db.getAvailableKelas(grade).then((data: string[]) => {
      if (!isMounted) return;
      setAvailableKelas(data);

      const state = location.state as any;
      const prefillKelas = state?.prefill?.kelas;

      // Jika ada kiriman kelas yang valid untuk jenjang ini, JANGAN reset ke data[0]
      if (prefillKelas && data.includes(prefillKelas)) {
          // Biarkan logika prefill yang mengatur selectedKelas
          if (selectedKelas !== prefillKelas) setSelectedKelas(prefillKelas);
      } else {
          // Behavior standar: jika selectedKelas kosong atau tidak ada di list baru, pilih yang pertama
          if (!selectedKelas || !data.includes(selectedKelas)) {
             setSelectedKelas(data[0] || '');
          }
      }
    });
    return () => { isMounted = false; };
  }, [grade, location.state]); 

  // Load SEMUA Kelas (Untuk Dropdown Import Excel) - Langsung Semua Jenjang
  useEffect(() => {
    db.getAvailableKelas().then((data: string[]) => {
      setAllClassesList(data);
      if (data.length > 0) setImportKelas(data[0]);
    });
  }, []);

  // --- LOGIKA AUTO-FILL DARI CEK TUGAS (FIXED) ---
  useEffect(() => {
      const state = location.state as any;
      if (state?.prefill) {
          const p = state.prefill;
          
          // 1. Set Kelas & Jenjang (Prioritas Utama)
          if (p.kelas) {
             const gChar = p.kelas.charAt(0);
             if (['7','8','9'].includes(gChar)) {
                 setGrade(gChar as GradeLevel);
             }
             // Paksa set selectedKelas agar trigger useEffect load siswa
             setSelectedKelas(p.kelas);
          }

          // 2. Set Tanggal (FIX: Gunakan format lokal YYYY-MM-DD agar tidak mundur sehari)
          if (p.date) {
             try {
                const d = new Date(p.date);
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                setDate(`${year}-${month}-${day}`);
             } catch (e) { console.error("Invalid date", e); }
          }

          // 3. Set Keterangan (Dari Judul Tugas)
          if (p.task_name) {
              setDesc(p.task_name);
          }
      }
  }, [location.state]);

  // Load Siswa berdasarkan Kelas (Untuk Form Manual)
  useEffect(() => {
    if (selectedKelas) {
      db.getStudentsByKelas(selectedKelas).then(data => {
          setStudents(data);
          
          // --- AUTO SELECT SISWA (FIXED: Case Insensitive & Trim) ---
          const state = location.state as any;
          if (state?.prefill && state.prefill.student_name && state.prefill.kelas === selectedKelas) {
              const targetName = state.prefill.student_name.toLowerCase().trim();
              
              // Cari siswa dengan nama yang cocok (abaikan huruf besar/kecil)
              const target = data.find(s => s.namalengkap.toLowerCase().trim() === targetName);
              
              if (target && target.id) {
                  setSelectedStudentId(target.id);
              } else {
                  setSelectedStudentId('');
              }
          } else {
              // Reset jika ganti kelas manual
              setSelectedStudentId('');
          }
      });
    } else {
      setStudents([]);
    }
  }, [selectedKelas, location.state]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 1. Validasi Kolom Kosong
    if (!selectedStudentId || !date || !semester || !type || !selectedKelas || score === '' || !desc.trim()) {
      Swal.fire({ 
        icon: 'warning', 
        title: 'Perhatian', 
        text: 'Kolom kosong wajib di isi!', 
        heightAuto: false 
      });
      return;
    }

    const selectedStudentName = students.find(s => s.id === selectedStudentId)?.namalengkap || '-';

    // 2. Konfirmasi Sebelum Kirim
    const result = await Swal.fire({
      title: 'Konfirmasi Kirim Nilai',
      html: `
        <div style="text-align: left; font-size: 0.9em; line-height: 1.5; background: #f8fafc; padding: 15px; border-radius: 10px; border: 1px solid #e2e8f0;">
          <p><strong>Nama:</strong> ${selectedStudentName}</p>
          <p><strong>Kelas:</strong> ${selectedKelas}</p>
          <p><strong>Semester:</strong> ${semester === '1' ? '1 (Ganjil)' : '2 (Genap)'}</p>
          <hr style="margin: 8px 0; border-top: 1px dashed #cbd5e1;">
          <p><strong>Jenis Tugas:</strong> <span style="text-transform: capitalize;">${type}</span></p>
          <p><strong>Nilai:</strong> <span style="color: #059669; font-weight: bold;">${score}</span></p>
          <p><strong>Materi/Ket:</strong> ${desc || '-'}</p>
        </div>
        <p style="margin-top: 10px; font-size: 0.8em; color: #64748b;">Pastikan data sudah benar sebelum dikirim.</p>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#059669',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Ya, Kirim Nilai',
      cancelButtonText: 'Batal',
      heightAuto: false,
      customClass: {
        popup: 'rounded-2xl'
      }
    });

    if (!result.isConfirmed) return;

    setStatus('saving');
    try {
      await db.addGrade({ 
        student_id: selectedStudentId, 
        subject_type: type as 'Harian' | 'PTS' | 'UAS' | 'praktik', 
        score: parseInt(score), 
        description: desc, 
        kelas: selectedKelas, 
        semester,
        created_at: new Date(date).toISOString() 
      });
      
      setStatus('success');
      
      setTimeout(() => { 
        setStatus('idle'); 
        setScore(''); 
        setDesc(''); // Clear content description (Sesuai Permintaan)
        setSelectedStudentId('');
      }, 1500);

      Swal.fire({ icon: 'success', title: 'Nilai Berhasil Disimpan', timer: 1500, showConfirmButton: false, heightAuto: false });
    } catch (err: any) {
      setStatus('idle');
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Terjadi kesalahan sistem.', heightAuto: false });
    }
  };

  // --- FITUR DOWNLOAD & UPLOAD EXCEL ---

  const handleDownloadTemplate = async () => {
    if (!importKelas) {
      Swal.fire({ icon: 'warning', title: 'Pilih Kelas', text: 'Pilih kelas di kartu import terlebih dahulu.', heightAuto: false });
      return;
    }

    if (!importSemester) {
      Swal.fire({ icon: 'warning', title: 'Pilih Semester', text: 'Pilih semester di kartu import terlebih dahulu.', heightAuto: false });
      return;
    }

    Swal.fire({ title: 'Menyiapkan Template...', didOpen: () => Swal.showLoading(), heightAuto: false });

    // Fetch siswa khusus untuk kelas import
    const studentsForTemplate = await db.getStudentsByKelas(importKelas);

    if (studentsForTemplate.length === 0) {
        Swal.close();
        setTimeout(() => {
          Swal.fire({
            icon: 'error',
            title: 'Kelas Kosong',
            text: 'Tidak ada data siswa di kelas ini.',
            confirmButtonColor: '#dc2626',
            heightAuto: false
          });
        }, 150);
        return;
    }

    // Template Data Sesuai Screenshot: NO, NIS, NAMA SISWA, KELAS, SEMESTER, JENIS TUGAS, KET/MATERI, NILAI
    const templateData = studentsForTemplate.map((s, index) => ({
      'NO': index + 1,
      'NIS': s.nis,
      'NAMA SISWA': s.namalengkap,
      'KELAS': importKelas, 
      'SEMESTER': importSemester || '', 
      'JENIS TUGAS': type || '',  // Kosong jika belum pilih (biar diisi di excel via dropdown)
      'KET/MATERI': '', // DIKOSONGKAN (Sesuai Permintaan: Jangan diisi ada)
      'NILAI': ''
    }));

    // Generate Excel (Async await)
    await generateExcel(templateData, `Template_Nilai_${importKelas}`, importKelas, {
        title: 'FORM INPUT NILAI PAI',
        kelas: importKelas,
        semester: importSemester || '-', 
        withValidation: true // Aktifkan Dropdown Excel
    });
    
    Swal.close();
    setTimeout(() => {
      Swal.fire({
        icon: 'success',
        title: 'Template Didownload',
        text: 'Silakan isi nilai menggunakan Excel.',
        timer: 2000,
        showConfirmButton: false,
        heightAuto: false
      });
    }, 150);
  };

  // Hanya memilih file dan menyimpannya ke state
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  // Proses Import setelah Konfirmasi
  const handleProcessImport = async () => {
    if (!selectedFile) return;

    // Validasi Data Import
    if (!importDate || !importKelas || !importSemester) {
       Swal.fire({ 
           icon: 'warning', 
           title: 'Data Kurang', 
           text: 'Mohon lengkapi Kelas, Semester, dan Tanggal Import.', 
           heightAuto: false 
       });
       return;
    }

    // 2. TAMPILKAN POPUP KONFIRMASI (Permintaan Revisi)
    const confirmResult = await Swal.fire({
        title: 'Yakin kirim nilai?',
        html: `<p class="text-sm">Anda akan mengimport data nilai untuk:</p>
               <p class="font-bold text-lg mt-2 text-emerald-600">Kelas: ${importKelas}</p>
               <p class="text-xs text-slate-500 mt-1">Pastikan file excel sudah sesuai template.</p>`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#059669',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Konfirmasi',
        cancelButtonText: 'Cancel',
        reverseButtons: true, // Tombol Cancel di kiri
        heightAuto: false,
        customClass: {
            popup: 'rounded-2xl'
        }
    });

    // Jika user klik Cancel, batalkan proses
    if (!confirmResult.isConfirmed) {
        return;
    }

    // Lanjutkan Proses Membaca File
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // FIX: Range 5 untuk melewati judul
        const data = XLSX.utils.sheet_to_json(ws, { range: 5 }) as any[];

        if (data.length === 0) throw new Error("File kosong atau format salah.");

        Swal.fire({ title: 'Memproses Data...', didOpen: () => Swal.showLoading(), heightAuto: false, allowOutsideClick: false });

        let successCount = 0;
        const currentClassStudents = await db.getStudentsByKelas(importKelas);

        for (const row of data) {
          const rowNis = String(row['NIS'] || row['nis'] || '').trim();
          const rowNilai = row['NILAI'] || row['nilai'];
          
          const rowSem = normalizeSemester(row['SEMESTER'] || row['semester'] || importSemester);
          const rowTypeRaw = String(row['JENIS TUGAS'] || row['jenis tugas'] || type).toLowerCase().trim();
          
          // Fallback: Jika Excel kosong, ambil dari State desc, tapi untuk template download dipastikan kosong.
          const rowKet = row['KET/MATERI'] || row['ket/materi'] || row['KETERANGAN'] || desc || '-';
          
          // Ambil kelas dari row excel atau fallback ke dropdown import
          const rowKelas = row['KELAS'] || row['kelas'] || importKelas;

          let finalType = 'harian';
          if (rowTypeRaw.includes('UTS') || rowTypeRaw.includes('PTS')) finalType = 'UTS';
          else if (rowTypeRaw.includes('UAS') || rowTypeRaw.includes('PAS')) finalType = 'UAS';
          else if (rowTypeRaw.includes('Praktik')) finalType = 'Praktik';
          else if (rowTypeRaw.includes('harian')) finalType = 'harian';
          else if (type) finalType = type;

          if (rowNis && rowNilai !== undefined && rowNilai !== '') {
            const student = currentClassStudents.find(s => s.nis === rowNis);
            
            if (student && student.id) {
              await db.addGrade({ 
                student_id: student.id, 
                subject_type: finalType as any, 
                score: parseInt(rowNilai), 
                description: rowKet, 
                kelas: rowKelas,
                semester: rowSem || '1', 
                created_at: new Date(importDate).toISOString() // Gunakan Import Date
              });
              successCount++;
            }
          }
        }

        Swal.close();
        setTimeout(() => {
          Swal.fire({ 
            icon: 'success', 
            title: 'Import Berhasil', 
            text: `${successCount} nilai berhasil disimpan ke Kelas ${importKelas}.`,
            confirmButtonColor: '#059669',
            heightAuto: false 
          });
        }, 150);
        
        // Reset File Input
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';

      } catch (err) {
        console.error(err);
        Swal.close();
        setTimeout(() => {
          Swal.fire({
            icon: 'error',
            title: 'Gagal',
            text: 'Format file tidak sesuai atau terjadi kesalahan sistem.',
            confirmButtonColor: '#dc2626',
            heightAuto: false
          });
        }, 150);
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-2 md:space-y-6 animate-fadeIn pb-24 px-1 md:px-0">
      <button onClick={() => navigate('/guru')} className="md:hidden flex items-center gap-1.5 text-slate-800 text-[10px] font-black uppercase tracking-tight py-2 mb-1"><ArrowLeft size={14} /> Kembali ke Dashboard</button>
      <div className="bg-emerald-700 text-white p-4 md:p-8 rounded-2xl md:rounded-3xl shadow-lg">
        <h1 className="text-base md:text-2xl font-black leading-tight uppercase tracking-tighter">Input Nilai PAI</h1>
        <p className="text-emerald-50 text-[9px] md:text-sm mt-0.5 opacity-90">Simpan nilai siswa secara manual atau via Excel.</p>
      </div>

      <div className="bg-white p-4 md:p-8 rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm space-y-4">
        <form onSubmit={handleSubmit} className="space-y-3 md:space-y-6">
          {/* Baris 1: Jenjang & Tanggal */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[8px] md:text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Pilih Jenjang</label>
              <div className="flex gap-1">
                {(['7', '8', '9'] as const).map((g) => (
                  <button key={g} type="button" onClick={() => setGrade(g)} className={`flex-1 py-1.5 md:py-2 rounded-lg md:rounded-xl text-[9px] md:text-sm font-normal border transition-all ${grade === g ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-500 border-slate-200'}`}>{g}</button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[8px] md:text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Tanggal</label>
              <div className="relative">
                <input 
                  type="date" 
                  className="w-full p-1.5 md:p-2 rounded-lg border border-slate-200 bg-white text-[10px] md:text-sm font-normal outline-none focus:border-emerald-500 cursor-pointer text-slate-600 placeholder:text-slate-300" 
                  value={date} 
                  onChange={(e) => setDate(e.target.value)} 
                  placeholder="pilih tanggal"
                />
              </div>
            </div>
          </div>

          {/* Baris 2: Kelas & Semester */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[8px] md:text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Nama Kelas</label>
              <select className="w-full p-2 rounded-lg border border-slate-200 bg-white text-[9px] md:text-sm font-normal outline-none" value={selectedKelas} onChange={(e) => setSelectedKelas(e.target.value)}>
                <option value="">-- Pilih Kelas --</option>
                {availableKelas.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[8px] md:text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Semester</label>
              <select className="w-full p-2 rounded-lg border border-slate-200 bg-white text-[9px] md:text-sm font-normal outline-none" value={semester} onChange={(e) => setSemester(e.target.value)}>
                <option value="">-- Pilih Semester --</option>
                <option value="1">Semester 1</option>
                <option value="2">Semester 2</option>
              </select>
            </div>
          </div>

          {/* Nama Siswa */}
          <div className="space-y-1">
            <label className="text-[8px] md:text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Nama Siswa</label>
            <select 
              className="w-full p-2.5 rounded-lg border border-slate-200 bg-white text-[10px] md:text-sm font-normal outline-none" 
              value={selectedStudentId} 
              onChange={(e) => setSelectedStudentId(e.target.value)}
            >
              <option value="">-- Pilih Siswa --</option>
              {students.map(s => <option key={s.id} value={s.id!}>{s.namalengkap}</option>)}
            </select>
          </div>

          {/* Baris 3: Tipe, Nilai, Materi */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="space-y-1">
              <label className="text-[8px] md:text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Jenis Tugas</label>
              <select className="w-full p-2 rounded-lg border border-slate-200 bg-white text-[9px] md:text-sm font-normal outline-none" value={type} onChange={(e: any) => setType(e.target.value)}>
                <option value="">-- Pilih Tugas --</option>
                <option value="Harian">Harian</option>
                <option value="PTS">PTS/UTS</option>
                <option value="UAS">PAS/UAS</option>
                <option value="Praktik">Praktik</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[8px] md:text-xs font-black text-slate-400 uppercase tracking-widest ml-1">NILAI (0-100)</label>
              <input 
                type="number" 
                min="0" 
                max="100" 
                placeholder="0"
                className="w-full p-2 rounded-lg border border-slate-200 bg-white text-[11px] md:text-sm font-black outline-none" 
                value={score} 
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    setScore('');
                  } else {
                    const num = parseInt(val);
                    if (!isNaN(num) && num >= 0 && num <= 100) {
                      setScore(num.toString());
                    }
                  }
                }} 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] md:text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Ket / Materi</label>
              <input 
                type="text" 
                placeholder="Bab/Tugas (min: -)" 
                className="w-full p-2 rounded-lg border border-slate-200 bg-white text-[10px] md:text-sm font-normal outline-none" 
                value={desc} 
                onChange={(e) => setDesc(e.target.value)} 
              />
            </div>
          </div>

          <button type="submit" disabled={status !== 'idle'} className={`w-full py-3 md:py-4 rounded-xl text-[10px] md:text-sm font-black flex items-center justify-center gap-2 shadow-lg uppercase tracking-widest ${status === 'success' ? 'bg-emerald-500 text-white' : 'bg-emerald-700 text-white hover:bg-emerald-800 disabled:bg-slate-200'}`}>
            {status === 'saving' ? 'Menyimpan...' : status === 'success' ? <><CheckCircle2 size={16} /> Berhasil!</> : <><Save size={16} /> Simpan Nilai</>}
          </button>
        </form>
      </div>

      {/* KARTU BARU: IMPORT NILAI VIA EXCEL */}
      <div className="bg-white p-4 md:p-6 rounded-[2rem] border border-slate-200 border-dashed shadow-sm space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
             <div className="bg-blue-50 text-blue-600 p-2 rounded-xl">
               <FileUp size={20} />
             </div>
             <div>
               <h2 className="text-[11px] md:text-sm font-black uppercase tracking-widest text-slate-800">Import Nilai Excel</h2>
               <p className="text-[9px] text-slate-400 font-medium">Download template kelas, isi nilai, lalu upload kembali.</p>
             </div>
          </div>

          <div className="bg-blue-50 p-3 rounded-2xl flex items-start gap-2 border border-blue-100">
             <Info size={16} className="text-blue-600 mt-0.5 shrink-0" />
             <p className="text-[9px] text-blue-800 leading-relaxed font-medium">
               <strong>Cara Pakai:</strong> <br/>
               1. Pilih <strong>Kelas, Tanggal & Semester</strong>.<br/>
               2. Klik <strong>Download Template</strong>.<br/>
               3. Isi kolom <strong>NILAI</strong> di Excel.<br/>
               4. Pilih File lalu Klik <strong>Proses Import</strong>.
             </p>
          </div>

          <div className="space-y-3">
             {/* ROW 1: KELAS & TANGGAL (POSISI DI SAMPING KELAS) */}
             <div className="grid grid-cols-2 gap-3">
                 <div className="space-y-1">
                    <label className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Kelas Import</label>
                    <select 
                      className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-[9px] md:text-xs font-black outline-none text-slate-800 focus:border-blue-500" 
                      value={importKelas} 
                      onChange={(e) => setImportKelas(e.target.value)}
                    >
                      <option value="">-- Pilih Kelas --</option>
                      {allClassesList.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                 </div>
                 
                 {/* 1. DROPDOWN TANGGAL DI SAMPING KELAS */}
                 <div className="space-y-1">
                   <label className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tanggal Import</label>
                   <input 
                     type="date" 
                     className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-[9px] md:text-xs font-black outline-none focus:border-blue-500 cursor-pointer text-slate-800" 
                     value={importDate} 
                     onChange={(e) => setImportDate(e.target.value)} 
                   />
                 </div>
             </div>

             {/* ROW 2: SEMESTER & NAMA FILE (POSISI DI SAMPING SEMESTER) */}
             <div className="grid grid-cols-2 gap-3">
                 <div className="space-y-1">
                    <label className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Semester</label>
                    <select 
                      className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-[10px] md:text-xs font-black outline-none text-slate-800 focus:border-blue-500" 
                      value={importSemester} 
                      onChange={(e) => setImportSemester(e.target.value)}
                    >
                      <option value="">-- Pilih --</option>
                      <option value="1">1 (Ganjil)</option>
                      <option value="2">2 (Genap)</option>
                    </select>
                 </div>

                 {/* 2. KOLOM NAMA FILE */}
                 <div className="space-y-1">
                    <label className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">File Terpilih</label>
                    <input 
                      type="text" 
                      readOnly
                      placeholder="Belum ada file..."
                      value={selectedFile ? selectedFile.name : ''}
                      className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-[9px] md:text-xs font-medium outline-none text-slate-600 truncate" 
                    />
                 </div>
             </div>

             <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={handleDownloadTemplate}
                  className="py-3 rounded-xl bg-slate-100 text-slate-700 font-black text-[9px] md:text-xs uppercase flex flex-col items-center justify-center gap-1 hover:bg-slate-200 transition-all border border-slate-200"
                >
                  <Download size={16} />
                  Download Template
                </button>
                
                {/* TOMBOL PILIH FILE (Hanya Trigger Input) */}
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="py-3 rounded-xl bg-blue-500 text-white font-black text-[9px] md:text-xs uppercase flex flex-col items-center justify-center gap-1 hover:bg-slate-700 transition-all active:scale-95"
                >
                  <Upload size={16} />
                  Pilih File Excel
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileSelect} 
                  accept=".xlsx, .xls" 
                  className="hidden" 
                />
             </div>

             {/* TOMBOL PROSES IMPORT (MUNCUL JIKA FILE ADA) */}
             {selectedFile && (
                <button 
                  onClick={handleProcessImport}
                  className="w-full py-4 rounded-xl bg-emerald-600 text-white font-black text-[10px] md:text-sm uppercase flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 active:scale-95 animate-fadeIn"
                >
                  <FileCheck size={18} />
                  Proses Import Data
                </button>
             )}
          </div>
      </div>
    </div>
  );
};

export default TeacherInputGrades;