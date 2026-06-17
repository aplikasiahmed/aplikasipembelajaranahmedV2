import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Users, 
  UserPlus, 
  Edit, 
  Trash2, 
  Search, 
  Download, 
  Upload, 
  RefreshCw, 
  Save, 
  RotateCcw,
  BookOpen,
  Filter,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';
import { db } from '../services/supabaseMock';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';

// Import Utils
import { generateExcel } from '../utils/excelGenerator';
import { Student } from '../types';

const TeacherStudents: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKelas, setSelectedKelas] = useState('Semua');
  const [availKelas, setAvailKelas] = useState<string[]>([]);
  const [appsScriptUrl, setAppsScriptUrl] = useState<string>('');
  const [syncing, setSyncing] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);

  // Manual Form States
  const [formType, setFormType] = useState<'add' | 'edit'>('add');
  const [editId, setEditId] = useState<string>('');
  const [inputNis, setInputNis] = useState('');
  const [inputNama, setInputNama] = useState('');
  const [inputKelas, setInputKelas] = useState('');
  const [inputJk, setInputJk] = useState('Laki-laki');

  // Load all initial data
  const loadData = async () => {
    setLoading(true);
    try {
      // Get Apps Script URL
      const url = await db.getAppsScriptUrl();
      if (url) setAppsScriptUrl(url);

      // Get all students across all grades
      const s7 = await db.getStudentsByGrade('7');
      const s8 = await db.getStudentsByGrade('8');
      const s9 = await db.getStudentsByGrade('9');
      const allStudents = [...s7, ...s8, ...s9].sort((a, b) => 
        String(a.kelas).localeCompare(String(b.kelas)) || a.namalengkap.localeCompare(b.namalengkap)
      );
      
      setStudents(allStudents);

      // Get list of unique classes
      const classes = await db.getAvailableKelas();
      setAvailKelas(classes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Sync from Sheets
  const handleSyncFromSheets = async () => {
    Swal.fire({
      title: 'Tarik Data Google Sheets',
      text: 'Yakin anda ingin menambahkan/sinkronisasi seluruh data siswa dari Google Sheets?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ya, Tarik Data',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#059669',
      cancelButtonColor: '#64748b',
      heightAuto: false,
      customClass: { popup: 'rounded-[1.5rem]' }
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
          loadData();
        }, 150);
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

  // Import from Excel file
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Swal.fire({
      title: 'Konfirmasi Impor',
      text: 'Yakin Anda ingin mengimpor data siswa dari file Excel ini?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ya, Impor',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#3b82f6',
      cancelButtonColor: '#64748b',
      heightAuto: false,
      customClass: { popup: 'rounded-[1.5rem]' }
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
            didOpen: () => Swal.showLoading(),
            allowOutsideClick: false,
            heightAuto: false
          });

          const studentsImport = data.map((row) => {
            const rowId = row.ID || row.id || row.Id;
            const rawJk = String(row.JK || row.jk || 'L').trim().toUpperCase();
            const resolvedJk = rawJk.startsWith('P') ? 'Perempuan' : 'Laki-laki';
            
            return {
              id: rowId ? String(rowId).trim() : undefined,
              nis: String(row.NIS || row.nis).trim(),
              namalengkap: String(row.NAMA || row.nama || row['NAMA SISWA']).trim(),
              jeniskelamin: resolvedJk,
              kelas: String(row.KELAS || row.kelas).trim()
            };
          });

          await db.upsertStudents(studentsImport);
          
          Swal.close();
          setTimeout(() => {
            Swal.fire({
              icon: 'success',
              title: 'Berhasil!',
              text: `${studentsImport.length} data siswa berhasil diimpor & diperbarui.`,
              confirmButtonColor: '#059669',
              heightAuto: false
            });
            loadData();
          }, 150);
        } catch (err) {
          Swal.close();
          setTimeout(() => {
            Swal.fire({
              icon: 'error',
              title: 'Gagal Impor',
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

  // Download template
  const downloadTemplate = () => {
    const template = [
      { NO: 1, NIS: '12345', 'NAMA SISWA': 'Nama Siswa Contoh', JK: 'L', KELAS: '7.1' }
    ];
    generateExcel(template, 'Template_Import_Siswa', 'SISWA');
  };

  // Save manual student form
  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputNis.trim() || !inputNama.trim() || !inputKelas.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Input Belum Lengkap',
        text: 'Semua kolom inputs wajib diisi!',
        confirmButtonColor: '#f59e0b',
        heightAuto: false
      });
      return;
    }

    // Check unique NIS constraints on adding new
    if (formType === 'add') {
      const exists = students.some(s => s.nis === inputNis.trim());
      if (exists) {
        Swal.fire({
          icon: 'error',
          title: 'NIS Sudah Terdaftar',
          text: `Siswa dengan NIS ${inputNis} sudah ada dalam database.`,
          confirmButtonColor: '#dc2626',
          heightAuto: false
        });
        return;
      }
    }

    const studentData: Student = {
      id: formType === 'edit' ? editId : `student_${inputNis.trim()}`,
      nis: inputNis.trim(),
      namalengkap: inputNama.trim().toUpperCase(),
      kelas: inputKelas.trim(),
      jeniskelamin: inputJk
    };

    try {
      await db.upsertStudents([studentData]);
      
      Swal.fire({
        icon: 'success',
        title: formType === 'add' ? 'Berhasil Ditambah!' : 'Berhasil Diperbarui!',
        text: `Data siswa ${studentData.namalengkap} disimpan sebagai ${studentData.jeniskelamin}.`,
        timer: 1500,
        showConfirmButton: false,
        heightAuto: false
      });

      // Clear Form & Reload Data
      resetForm();
      loadData();
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'Terjadi Kesalahan',
        text: 'Gagal data siswa tidak tersimpan.',
        confirmButtonColor: '#dc2626',
        heightAuto: false
      });
    }
  };

  // Put student into Form edit state
  const handleEditClick = (student: Student) => {
    setFormType('edit');
    setEditId(student.id || '');
    setInputNis(student.nis);
    setInputNama(student.namalengkap);
    setInputKelas(student.kelas);
    const resolvedJk = student.jeniskelamin.toUpperCase().startsWith('P') ? 'Perempuan' : 'Laki-laki';
    setInputJk(resolvedJk);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Reset complete manual additions form
  const resetForm = () => {
    setFormType('add');
    setEditId('');
    setInputNis('');
    setInputNama('');
    setInputKelas('');
    setInputJk('Laki-laki');
  };

  // Delete student single profile action row
  const handleDeleteStudent = (student: Student) => {
    Swal.fire({
      title: 'Hapus Siswa?',
      text: `Yakin ingin menghapus ${student.namalengkap} (NIS: ${student.nis})? Profil siswa akan dihapus serta disinkronkan ke Google Sheets.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      heightAuto: false,
      customClass: { popup: 'rounded-[1.5rem]' }
    }).then(async (result) => {
      if (result.isConfirmed) {
        Swal.fire({
          title: 'Menghapus...',
          text: 'Sedang menghapus data & menyinkronkan ke Google Sheets...',
          allowOutsideClick: false,
          heightAuto: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });

        try {
          if (student.id) {
            await db.deleteStudent(student.id);
            Swal.close();
            setTimeout(() => {
              Swal.fire({
                icon: 'success',
                title: 'Siswa Dihapus',
                text: 'Profil siswa telah berhasil dihapus dari sistem & Google Sheets.',
                timer: 1500,
                showConfirmButton: false,
                heightAuto: false
              });
              loadData();
            }, 150);
          }
        } catch (e: any) {
          console.error(e);
          Swal.close();
          setTimeout(() => {
            Swal.fire({
              icon: 'error',
              title: 'Gagal Menghapus',
              text: 'Terjadi kesalahan saat menyinkronkan ke Google Sheets. Periksa koneksi atau URL Apps Script Anda.',
              confirmButtonColor: '#dc2626',
              heightAuto: false
            });
          }, 150);
        }
      }
    });
  };

  // Filters logic
  const filteredStudents = students.filter(student => {
    const matchesSearch = 
      student.namalengkap.toLowerCase().includes(searchQuery.toLowerCase()) || 
      student.nis.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesKelas = selectedKelas === 'Semua' || student.kelas === selectedKelas;

    return matchesSearch && matchesKelas;
  });

  // Pagination calculation
  const totalItems = filteredStudents.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Statistics counters
  const totalBoys = students.filter(s => s.jeniskelamin.toUpperCase().startsWith('L')).length;
  const totalGirls = students.filter(s => s.jeniskelamin.toUpperCase().startsWith('P')).length;

  return (
    <div className="space-y-6 animate-fadeIn pb-24 px-1 md:px-0">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <button 
            onClick={() => navigate('/guru')} 
            className="group flex items-center gap-2 text-slate-700 hover:text-amber-700 transition-all text-xs font-black uppercase tracking-wider mb-2"
          >
            <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
            <span>DASHBOARD UTAMA</span>
          </button>
          <h1 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-slate-800 leading-tight">
            Manajemen Data Siswa
          </h1>
          <p className="text-slate-500 text-[10px] md:text-xs font-medium leading-tight max-w-xl mt-1">
            Input data siswa secara manual, sinkronisasi Google Sheets, impor template Excel, serta kelola seluruh arsip profil siswa Anda.
          </p>
        </div>
        <div className="bg-amber-600 text-white px-4 py-2.5 rounded-2xl shadow-lg shadow-amber-100 flex items-center gap-2.5 self-start md:self-center">
          <Users size={18} className="opacity-90 animate-pulse" />
          <div className="text-[10px] font-black uppercase tracking-wider">Kelola Siswa</div>
        </div>
      </div>

      {/* STATISTICS CARDS ROW */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between h-full relative overflow-hidden group hover:border-amber-200 transition-all">
          <div className="absolute top-0 right-0 p-3 opacity-[0.03] group-hover:scale-110 transition-transform"><Users size={80}/></div>
          <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-2 shadow-sm">
            <Users size={18} />
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-sans">Total Siswa</p>
            <p className="font-extrabold text-slate-800 text-xl md:text-2xl">{students.length} orang</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between h-full relative overflow-hidden group hover:border-blue-200 transition-all font-sans">
          <div className="absolute top-0 right-0 p-3 opacity-[0.03] group-hover:scale-110 transition-transform"><Users size={80}/></div>
          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-2 shadow-sm">
            <span className="font-black text-xs">L</span>
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Laki-Laki</p>
            <p className="font-extrabold text-slate-800 text-xl md:text-2xl">{totalBoys} orang</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between h-full relative overflow-hidden group hover:border-pink-200 transition-all font-sans font-sans">
          <div className="absolute top-0 right-0 p-3 opacity-[0.03] group-hover:scale-110 transition-transform"><Users size={80}/></div>
          <div className="w-10 h-10 bg-pink-50 text-pink-600 rounded-2xl flex items-center justify-center mb-2 shadow-sm">
            <span className="font-black text-xs">P</span>
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Perempuan</p>
            <p className="font-extrabold text-slate-800 text-xl md:text-2xl">{totalGirls} orang</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between h-full relative overflow-hidden group hover:border-emerald-200 transition-all font-sans">
          <div className="absolute top-0 right-0 p-3 opacity-[0.03] group-hover:scale-110 transition-transform"><BookOpen size={80}/></div>
          <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-2 shadow-sm">
            <BookOpen size={18} />
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Kelas</p>
            <p className="font-extrabold text-slate-800 text-xl md:text-2xl">{availKelas.length} kelas</p>
          </div>
        </div>
      </div>

      {/* TOP ROW: INPUT MANUAL & KELOLA IMPORT SIDE-BY-SIDE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* CARD 1: INPUT DATA SISWA MANUAL */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <UserPlus size={16} />
            </div>
            <h2 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-tight">
              {formType === 'add' ? 'Input Siswa Manual' : 'Edit Data Siswa'}
            </h2>
          </div>

          <form onSubmit={handleSaveStudent} className="space-y-4">
            {/* NIS INPUT */}
            <div className="space-y-1">
              <label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">Nomor Induk Siswa (NIS)</label>
              <input
                type="text"
                placeholder="Contoh: 12154"
                value={inputNis}
                disabled={formType === 'edit'} // NIS is unique key
                onChange={(e) => setInputNis(e.target.value)}
                className="w-full px-3 py-2 text-slate-800 border bg-white border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 disabled:bg-slate-50 disabled:text-slate-400 outline-none"
              />
            </div>

            {/* NAMA LENGKAP */}
            <div className="space-y-1">
              <label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">Nama Lengkap</label>
              <input
                type="text"
                placeholder="Nama Lengkap Siswa"
                value={inputNama}
                onChange={(e) => setInputNama(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 text-slate-800 border bg-white border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>

            {/* KELAS */}
            <div className="space-y-1">
              <label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">Kelas</label>
              <input
                type="text"
                placeholder="Contoh: 7.1, 8.2, 9.3"
                value={inputKelas}
                onChange={(e) => setInputKelas(e.target.value)}
                className="w-full px-3 py-2 text-slate-800 border bg-white border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>

            {/* JENIS KELAMIN */}
            <div className="space-y-1">
              <label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">Jenis Kelamin</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setInputJk('Laki-laki')}
                  className={`py-2 text-xs rounded-xl font-bold border transition-all ${
                    inputJk === 'Laki-laki' 
                      ? 'bg-blue-50 border-blue-500 text-blue-700 font-extrabold shadow-sm' 
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Laki-Laki
                </button>
                <button
                  type="button"
                  onClick={() => setInputJk('Perempuan')}
                  className={`py-2 text-xs rounded-xl font-bold border transition-all ${
                    inputJk === 'Perempuan' 
                      ? 'bg-pink-50 border-pink-500 text-pink-700 font-extrabold shadow-sm' 
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Perempuan
                </button>
              </div>
            </div>

            {/* BUTTONS ACTION */}
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-[0.98] transition-all"
              >
                <Save size={14} />
                <span>{formType === 'add' ? 'Tambah Siswa' : 'Simpan Perubahan'}</span>
              </button>

              {(inputNis || inputNama || inputKelas || formType === 'edit') && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="p-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs flex items-center justify-center transition-all"
                  title="Reset Form"
                >
                  <RotateCcw size={14} />
                </button>
              )}
            </div>
          </form>
        </div>

        {/* CARD 2: KELOLA & IMPORT SISWA (DARI PENGATURAN) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                <Upload size={16} />
              </div>
              <h2 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-tight">Kelola &amp; Import Siswa</h2>
            </div>

            <div className="p-4 bg-emerald-50/70 border border-emerald-100 rounded-2xl space-y-2 text-[10px] md:text-xs text-slate-650 text-slate-650 leading-relaxed">
              <h3 className="font-black text-emerald-850 uppercase tracking-wider flex items-center gap-1">
                💡 Cara Sinkronisasi Masif
              </h3>
              <ol className="list-decimal list-inside space-y-1">
                <li>Buka Google Spreadsheet PAI Anda.</li>
                <li>Pilih tab <strong className="text-slate-800">"data_siswa"</strong>.</li>
                <li>Isi/Paste database ratusan siswa Anda, kolom:
                  <code className="bg-white/85 p-1 rounded-md border border-emerald-200 font-mono text-[9px] block mt-1 max-w-max">
                    id | nis | namalengkap | kelas | jeniskelamin
                  </code>
                </li>
                <li>Setelah terisi, klik tombol <strong className="text-slate-800">"Google Sheets Sync"</strong> di bawah!</li>
              </ol>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-50">
            {appsScriptUrl ? (
              <button 
                onClick={handleSyncFromSheets} 
                disabled={syncing}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 active:scale-95 transition-all"
              >
                <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                <span>{syncing ? 'Mensinkronkan...' : 'Tarik Data dari Google Sheets'}</span>
              </button>
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-[10px] text-amber-700 leading-normal">
                Sistem Google Sheets belum dikonfigurasi. Hubungkan Web App URL Google Script di halaman "Pengaturan" terlebih dahulu.
              </div>
            )}

            <div className="relative flex items-center my-2">
              <div className="flex-grow border-t border-slate-100"></div>
              <span className="flex-shrink mx-2 text-[9px] font-black text-slate-300 uppercase tracking-widest text-center">ATAU SINKRONISASI FILE EXCEL</span>
              <div className="flex-grow border-t border-slate-100"></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={downloadTemplate} 
                className="py-2.5 px-2 bg-slate-100 text-slate-800 hover:bg-slate-200 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1.5 transition-all"
              >
                <Download size={13}/> 
                <span>Template Excel</span>
              </button>
              <div className="relative">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImportExcel} 
                  accept=".xlsx, .xls" 
                  className="hidden" 
                />
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  className="w-full py-2.5 px-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
                >
                  <Upload size={13}/> 
                  <span>Upload Excel</span>
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* BOTTOM PANEL: STUDENT REVIEW TABLE CARD (FULL WIDTH) */}
      <div className="bg-white p-5 md:p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center">
              <Users size={16} />
            </div>
            <div>
              <h2 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-tight">PREVIEW DATA SISWA</h2>
              <p className="text-[10px] text-slate-450 text-slate-400">Total data terfilter: <span className="font-bold text-slate-600">{filteredStudents.length}</span> siswa</p>
            </div>
          </div>
          
          {/* FILTERS */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* LIMIT SISWA PER HALAMAN */}
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-100 shadow-sm">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Tampilkan:</span>
              <input
                type="number"
                min="1"
                max={students.length || 5000}
                value={itemsPerPage}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (val > 0) {
                    setItemsPerPage(val);
                  } else {
                    setItemsPerPage(1); // default min 1
                  }
                  setCurrentPage(1);
                }}
                className="w-12 bg-white border border-slate-200 rounded-lg text-center text-[11px] font-extrabold text-slate-700 focus:ring-2 focus:ring-amber-500 py-0.5 px-1 outline-none"
              />
              <span className="text-[10px] font-bold text-slate-500">Siswa/Hal</span>
            </div>

            {/* FILTER KELAS */}
            <div className="flex items-center gap-1 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-100">
              <Filter size={12} className="text-slate-400" />
              <select
                value={selectedKelas}
                onChange={(e) => {
                  setSelectedKelas(e.target.value);
                  setCurrentPage(1); // reset to first page
                }}
                className="bg-transparent border-none text-[11px] font-bold text-slate-600 focus:ring-0 max-w-[120px] outline-none cursor-pointer"
              >
                <option value="Semua">Semua Kelas</option>
                {availKelas.map(k => (
                  <option key={k} value={k}>Kelas {k}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* SEARCH UTILITY */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search size={14} className="text-slate-400" />
          </span>
          <input
            type="text"
            placeholder="Cari Nama Siswa atau NIS..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1); // reset to first page
            }}
            className="w-full pl-9 pr-3 py-2 text-slate-850 border border-slate-200 bg-slate-50/50 hover:bg-slate-50 focus:bg-white rounded-xl text-xs focus:ring-2 focus:ring-amber-500 transition-all outline-none"
          />
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-2">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-amber-600 rounded-full animate-spin"></div>
            <p className="text-xs text-slate-400 font-bold">Sedang memuat data siswa...</p>
          </div>
        ) : paginatedStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <AlertCircle size={24} className="text-slate-400 mb-1" />
            <p className="text-xs font-bold text-slate-600 uppercase mb-0.5">Data Tidak Ditemukan</p>
            <p className="text-[10px] text-slate-400 max-w-xs leading-normal">
              Siswa dengan pencarian "{searchQuery}" atau kelas "{selectedKelas}" belum terdaftar. Silakan tambah manual atau impor data.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* TABLE CONTAINER */}
            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="py-3 px-4 text-center">No</th>
                    <th className="py-3 px-4">NIS</th>
                    <th className="py-3 px-4">Nama Lengkap</th>
                    <th className="py-3 px-4 text-center">Kelas</th>
                    <th className="py-3 px-4 text-center">Jenis Kelamin</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedStudents.map((student, index) => {
                    const globalIndex = (currentPage - 1) * itemsPerPage + index + 1;
                    const isPerempuan = student.jeniskelamin.toUpperCase().startsWith('P');
                    return (
                      <tr key={student.id || student.nis} className="hover:bg-slate-50/70 transition-colors text-xs text-slate-700">
                        <td className="py-2.5 px-4 text-center font-bold text-slate-400 font-mono">
                          {globalIndex}
                        </td>
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-500">
                          {student.nis}
                        </td>
                        <td className="py-2.5 px-4 font-extrabold text-slate-800">
                          {student.namalengkap}
                        </td>
                        <td className="py-2.5 px-4 text-center select-none">
                          <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full font-bold text-[10px]">
                            {student.kelas}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-center select-none">
                          <span className={`inline-flex items-center justify-center font-bold px-3 py-1 rounded-full text-[10px] border ${
                            isPerempuan 
                              ? 'bg-pink-50 border-pink-100/60 text-pink-700' 
                              : 'bg-blue-50 border-blue-100/60 text-blue-700'
                          }`}>
                            {isPerempuan ? 'Perempuan' : 'Laki-laki'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleEditClick(student)}
                              className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg hover:scale-105 active:scale-95 transition-all"
                              title="Edit Profil"
                            >
                              <Edit size={12} />
                            </button>
                            <button
                              onClick={() => handleDeleteStudent(student)}
                              className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg hover:scale-105 active:scale-95 transition-all"
                              title="Hapus Profil"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* PAGINATION PANEL */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
              <span className="text-slate-400 font-medium select-none">
                Menampilkan <span className="font-bold text-slate-600">{(currentPage - 1) * itemsPerPage + 1}</span> - <span className="font-bold text-slate-600">{Math.min(currentPage * itemsPerPage, totalItems)}</span> dari <span className="font-bold text-slate-600">{totalItems}</span> siswa
              </span>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:hover:bg-transparent transition-all select-none"
                >
                  <ChevronLeft size={14} />
                </button>
                
                <span className="px-3 py-1 bg-slate-100 font-bold rounded-lg text-slate-705 text-slate-700 select-none">
                  {currentPage} / {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:hover:bg-transparent transition-all select-none"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

          </div>
        )}

      </div>

    </div>
  );
};

export default TeacherStudents;
