import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  ShieldCheck, 
  Lock, 
  UserCog, 
  ArrowLeft, 
  Trash2, 
  Loader2, 
  UserPlus, 
  AlertCircle,
  Save,
  X,
  KeyRound,
  CheckCircle2,
  FileSpreadsheet,
  Link2,
  RefreshCw,
  CloudLightning,
  LogOut,
  ExternalLink
} from 'lucide-react';
import { db } from '../services/supabaseMock';
import { auth, googleProvider } from '../services/firebase';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { AdminUser } from '../types';
import Swal from 'sweetalert2';

const TeacherAdminManagement: React.FC = () => {
  const navigate = useNavigate();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  
  // State untuk Toggle Form Tambah Admin
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // State Form Data
  const [formData, setFormData] = useState({
    fullname: '',
    username: '',
    password: '',
    confirmPassword: '',
    role: 'Admin'
  });

  // State Integrasi Google Sheets
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [manualSheetId, setManualSheetId] = useState('');
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchAdmins();

    // Memuat spreadsheet id saat ini
    const loadSheetId = async () => {
      const id = await db.getSpreadsheetId();
      setSpreadsheetId(id);
    };
    loadSheetId();

    // Memantau status login Google
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setGoogleUser(user);
      } else {
        setGoogleUser(null);
        setGoogleToken(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchAdmins = async () => {
    setLoading(true);
    const data = await db.getAdmins();
    setAdmins(data);
    setLoading(false);
  };

  // Google Sheets Handlers
  const handleGoogleSignIn = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken || null;
      if (token) {
        setGoogleToken(token);
        setGoogleUser(result.user);
        Swal.fire({
          icon: 'success',
          title: 'Terhubung ke Google',
          text: 'Akun Google Anda berhasil disambungkan dengan izin spreadsheets dan drive.',
          timer: 2000,
          showConfirmButton: false,
          heightAuto: false
        });
      } else {
        throw new Error("Gagal memperoleh token akses.");
       }
    } catch (err: any) {
      console.error("Gagal masuk Google:", err);
      Swal.fire({
        icon: 'error',
        title: 'Penyambungan Gagal',
        text: err.message || 'Gagal menyambungkan ke Google.',
        confirmButtonColor: '#dc2626',
        heightAuto: false
      });
    }
  };

  const handleGoogleSignOut = async () => {
    await signOut(auth);
    setGoogleToken(null);
    setGoogleUser(null);
    Swal.fire({
      icon: 'success',
      title: 'Keluar Google',
      text: 'Akun Google diputus hubungannya dari sesi ini.',
      timer: 1500,
      showConfirmButton: false,
      heightAuto: false
    });
  };

  const handleCreateNewSpreadsheet = async () => {
    if (!googleToken) {
      Swal.fire({ icon: 'warning', title: 'Belum Terhubung', text: 'Silakan hubungkan akun Google terlebih dahulu!', confirmButtonColor: '#059669', heightAuto: false });
      return;
    }
    setSheetsLoading(true);
    try {
      const id = await db.createDatabaseSpreadsheet(googleToken);
      setSpreadsheetId(id);
      Swal.fire({
        icon: 'success',
        title: 'Spreadsheet Dibuat',
        text: 'Google Spreadsheet baru berhasil dikonfigurasi sebagai database!',
        confirmButtonColor: '#059669',
        heightAuto: false
      });
    } catch (err: any) {
      console.error("Gagal membuat Spreadsheet:", err);
      Swal.fire({ icon: 'error', title: 'Pembuatan Gagal', text: err.message, confirmButtonColor: '#dc2626', heightAuto: false });
    } finally {
      setSheetsLoading(false);
    }
  };

  const handleLinkExistingSpreadsheet = async () => {
    if (!manualSheetId.trim()) {
      Swal.fire({ icon: 'warning', title: 'ID Kosong', text: 'Silakan masukkan ID Spreadsheet Google Anda.', confirmButtonColor: '#059669', heightAuto: false });
      return;
    }
    // Extract ID if a full URL is pasted
    let idToSave = manualSheetId.trim();
    if (idToSave.includes('/d/')) {
      const parts = idToSave.split('/d/');
      if (parts[1]) {
        idToSave = parts[1].split('/')[0];
      }
    }

    setSheetsLoading(true);
    try {
      await db.setSpreadsheetId(idToSave);
      setSpreadsheetId(idToSave);
      
      if (googleToken) {
        Swal.fire({
          title: 'Mempersiapkan Spreadsheet...',
          text: 'Mengonfigurasi struktur tabel & kolom di Google Sheets...',
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading(),
          heightAuto: false
        });
        
        // Inisialisasi sheet dan header di spreadsheet kosong milik user
        await db.initializeExistingSpreadsheet(idToSave, googleToken);
        
        // Tanya user apakah ingin langsung ekspor data lokal ke Sheets
        const exportConfirm = await Swal.fire({
          icon: 'success',
          title: 'Koneksi Berhasil!',
          text: 'Google Sheets Anda berhasil terhubung dan diinisialisasi struktur datanya. Kirim data terbaru saat ini ke Google Sheets?',
          showCancelButton: true,
          confirmButtonColor: '#059669',
          cancelButtonColor: '#2563eb',
          confirmButtonText: 'Ya, Ekspor Sekarang',
          cancelButtonText: 'Lewati',
          heightAuto: false
        });
        
        if (exportConfirm.isConfirmed) {
          Swal.fire({
            title: 'Menyinkronkan...',
            text: 'Mengekspor data portal ke Google Sheets...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading(),
            heightAuto: false
          });
          await db.syncToGoogleSheets(googleToken);
          Swal.fire({
            icon: 'success',
            title: 'Ekspor Berhasil',
            text: 'Seluruh database lokal berhasil disinkronisasikan ke Google Sheets Anda!',
            confirmButtonColor: '#059669',
            heightAuto: false
          });
        }
      } else {
        Swal.fire({
          icon: 'success',
          title: 'ID Spreadsheet Disimpan',
          text: 'ID disimpan di sesi. Silakan "Hubungkan Akun Google Belajar" terlebih dahulu di Langkah 1 untuk menginisialisasi atau mensinkronkan data.',
          confirmButtonColor: '#059669',
          heightAuto: false
        });
      }
      setManualSheetId('');
    } catch (err: any) {
      console.error("Gagal menautkan spreadsheet:", err);
      Swal.fire({
        icon: 'error',
        title: 'Tautan Gagal',
        text: err.message || 'Gagal menyambungkan atau menginisialisasi spreadsheet tersebut. Pastikan ID valid dan akun Google Anda memiliki akses pengeditan.',
        confirmButtonColor: '#dc2626',
        heightAuto: false
      });
    } finally {
      setSheetsLoading(false);
    }
  };

  const handleDisconnectSpreadsheet = async () => {
    const confirmed = await Swal.fire({
      title: 'Putuskan Koneksi Sheets?',
      text: 'Database tidak akan disinkronkan lagi ke Google Sheets ini.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Ya, Putuskan!',
      cancelButtonText: 'Batal',
      heightAuto: false
    });
    if (!confirmed.isConfirmed) return;

    await db.setSpreadsheetId(null);
    setSpreadsheetId(null);
    Swal.fire({
      icon: 'success',
      title: 'Selesai',
      text: 'Koneksi dengan Google Sheets terputus.',
      timer: 1500,
      showConfirmButton: false,
      heightAuto: false
    });
  };

  const handleSyncToSheets = async () => {
    if (!googleToken) {
      Swal.fire({ icon: 'warning', title: 'Akses Ditolak', text: 'Hubungkan akun Google anda untuk melakukan sinkronisasi.', confirmButtonColor: '#059669', heightAuto: false });
      return;
    }
    const confirmed = await Swal.fire({
      title: 'Ekspor Data ke Sheets?',
      text: 'Tindakan ini akan menimpa seluruh rekap di Google Sheets dengan data terbaru saat ini!',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#059669',
      cancelButtonColor: '#dc2626',
      confirmButtonText: 'Ya, Ekspor!',
      cancelButtonText: 'Batal',
      heightAuto: false
    });
    if (!confirmed.isConfirmed) return;

    setSyncing(true);
    try {
      await db.syncToGoogleSheets(googleToken);
      Swal.fire({ icon: 'success', title: 'Sinkronisasi Berhasil', text: 'Semua rekap lokal berhasil diekspor ke Google Sheets!', confirmButtonColor: '#059669', heightAuto: false });
    } catch (err: any) {
      console.error("Gagal Ekspor:", err);
      Swal.fire({ icon: 'error', title: 'Ekspor Gagal', text: err.message, confirmButtonColor: '#dc2626', heightAuto: false });
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncFromSheets = async () => {
    if (!googleToken) {
      Swal.fire({ icon: 'warning', title: 'Akses Ditolak', text: 'Hubungkan akun Google anda untuk melakukan sinkronisasi.', confirmButtonColor: '#059669', heightAuto: false });
      return;
    }
    const confirmed = await Swal.fire({
      title: 'Impor Data dari Sheets?',
      text: 'Tindakan ini akan menimpa data portal lokal di cloud dengan data rekap di Google Sheets!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#059669',
      cancelButtonColor: '#dc2626',
      confirmButtonText: 'Ya, Impor!',
      cancelButtonText: 'Batal',
      heightAuto: false
    });
    if (!confirmed.isConfirmed) return;

    setSyncing(true);
    try {
      await db.syncFromGoogleSheets(googleToken);
      Swal.fire({ icon: 'success', title: 'Penarikan Berhasil', text: 'Semua rekap dari Google Sheets berhasil dimasukkan ke portal lokal!', confirmButtonColor: '#059669', heightAuto: false });
      fetchAdmins(); // Refresh lists
    } catch (err: any) {
      console.error("Gagal Impor:", err);
      Swal.fire({ icon: 'error', title: 'Impor Gagal', text: err.message, confirmButtonColor: '#dc2626', heightAuto: false });
    } finally {
      setSyncing(false);
    }
  };

  // Handle Input Change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Handle Submit Tambah Admin (Gantikan Popup Lama)
  const handleSaveAdmin = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Validasi Kolom Kosong
    if (!formData.fullname || !formData.username || !formData.password || !formData.confirmPassword) {
      Swal.fire({ icon: 'warning', title: 'Data Belum Lengkap', text: 'Semua kolom wajib diisi!', heightAuto: false });
      return;
    }

    // 2. Validasi Password Match
    if (formData.password !== formData.confirmPassword) {
      Swal.fire({ icon: 'error', title: 'Password Tidak Cocok', text: 'Konfirmasi password harus sama dengan password baru.', heightAuto: false });
      return;
    }

    // 3. Cek Username Duplikat (Simple Check di Frontend dari data yang sudah di-fetch)
    const isDuplicate = admins.some(a => a.username.toLowerCase() === formData.username.toLowerCase());
    if (isDuplicate) {
       Swal.fire({ icon: 'error', title: 'Username Terpakai', text: 'Username ini sudah digunakan admin lain.', heightAuto: false });
       return;
    }

    setIsSaving(true);
    try {
      await db.addAdmin({
        fullname: formData.fullname,
        username: formData.username,
        password: formData.password,
        role: formData.role as any
      });

      Swal.fire({ icon: 'success', title: 'Admin Ditambahkan', text: 'Data admin baru berhasil disimpan.', timer: 1500, showConfirmButton: false, heightAuto: false });
      
      // Reset Form & Refresh Data
      setFormData({ fullname: '', username: '', password: '', confirmPassword: '', role: 'Admin' });
      setShowAddForm(false);
      fetchAdmins();

    } catch (err: any) {
      Swal.fire('Gagal', 'Terjadi kesalahan sistem saat menyimpan.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Hapus Admin dengan 2x Validasi (Token Server)
  const handleDeleteAdmin = async (id: string, name: string) => {
    // Cek jumlah admin (min 1)
    if (admins.length <= 1) {
      Swal.fire('Ditolak', 'Minimal harus ada 1 Admin di sistem.', 'warning');
      return;
    }

    // VALIDASI 1: Konfirmasi Biasa
    const confirmResult = await Swal.fire({
      title: 'Hapus Admin?',
      html: `Apakah Anda yakin ingin menghapus akun <b>${name}</b>?<br/>Tindakan ini tidak dapat dibatalkan.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Ya, Lanjut Hapus',
      cancelButtonText: 'Batal',
      reverseButtons: true,
      heightAuto: false
    });

    if (!confirmResult.isConfirmed) return;

    // VALIDASI 2: Token ID Server
    const { value: token } = await Swal.fire({
      title: 'Verifikasi Keamanan',
      text: 'Masukkan Token ID Server',
      input: 'password',
      inputPlaceholder: 'Token ID Server',
      inputAttributes: {
        autocapitalize: 'off',
        autocorrect: 'off'
      },
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Verifikasi & Hapus',
      cancelButtonText: 'Batal',
      heightAuto: false
    });

    if (token) {
        if (token === "PAI_ADMIN_GURU") {
            // Token Benar -> Eksekusi Hapus
            try {
                Swal.fire({ title: 'Menghapus...', didOpen: () => Swal.showLoading(), heightAuto: false });
                await db.deleteAdmin(id);
                
                await Swal.fire({ 
                    icon: 'success', 
                    title: 'Terhapus!', 
                    text: `Akun admin ${name} berhasil dihapus.`, 
                    timer: 1500, 
                    showConfirmButton: false,
                    heightAuto: false 
                });
                
                fetchAdmins();
            } catch (err) {
                Swal.fire('Gagal', 'Terjadi kesalahan saat menghapus data.', 'error');
            }
        } else {
            // Token Salah
            Swal.fire({ 
                icon: 'error', 
                title: 'Token Salah!', 
                text: 'Token ID Server tidak valid. Penghapusan dibatalkan.', 
                heightAuto: false 
            });
        }
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-3 md:space-y-6 animate-fadeIn pb-20 px-1 md:px-0">
      <button 
        onClick={() => navigate('/guru')}
        className="md:hidden flex items-center gap-1.5 text-slate-800 text-[10px] font-black uppercase tracking-tight py-2 mb-1"
      >
        <ArrowLeft size={14} className="text-slate-900" /> Kembali ke Dashboard
      </button>

      {/* HEADER & TOMBOL TOGGLE */}
      <div className="bg-blue-600 text-white p-4 md:p-8 rounded-2xl md:rounded-3xl shadow-lg flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-base md:text-2xl font-black leading-tight uppercase tracking-tighter">Kelola Admin</h1>
          <p className="text-white text-[10px] md:text-sm mt-0.5 opacity-80">Manajemen akses guru pengampu PAI.</p>
        </div>
        
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className={`px-5 py-3 rounded-xl md:rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest ${showAddForm ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-blue-800 hover:bg-blue-900 text-white'}`}
        >
          {showAddForm ? <><X size={18} /> Batal</> : <><UserPlus size={18} /> Tambah Admin</>}
        </button>
      </div>

      {/* CARD FORM TAMBAH ADMIN (KARTU BARU SESUAI PERMINTAAN) */}
      {showAddForm && (
        <div className="animate-slideDown">
            <div className="bg-white p-5 md:p-8 rounded-[2rem] border border-blue-100 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                   <UserCog size={120} className="text-emerald-800" />
                </div>
                
                <div className="flex items-center gap-2 mb-6 relative z-10">
                   <div className="bg-blue-100 text-blue-700 p-2 rounded-xl">
                      <UserPlus size={20} />
                   </div>
                   <h2 className="text-sm md:text-lg font-black text-slate-800 uppercase tracking-tight">Form Admin Baru</h2>
                </div>

                <form onSubmit={handleSaveAdmin} className="space-y-4 md:space-y-6 relative z-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Nama Lengkap */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Nama Lengkap</label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input 
                                    type="text" 
                                    name="fullname"
                                    placeholder="Contoh: Ahmad Nawasyi, S.Pd"
                                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-xs font-bold outline-none focus:border-emerald-500 focus:bg-white transition-all placeholder:font-normal"
                                    value={formData.fullname}
                                    onChange={handleInputChange}
                                />
                            </div>
                        </div>

                         {/* Username */}
                         <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Username Login</label>
                            <div className="relative">
                                <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input 
                                    type="text" 
                                    name="username"
                                    placeholder="Username tanpa spasi"
                                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-xs font-bold outline-none focus:border-emerald-500 focus:bg-white transition-all placeholder:font-normal"
                                    value={formData.username}
                                    onChange={handleInputChange}
                                />
                            </div>
                        </div>

                         {/* Password */}
                         <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Password Baru</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input 
                                    type="password" 
                                    name="password"
                                    placeholder="******"
                                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-xs font-bold outline-none focus:border-emerald-500 focus:bg-white transition-all placeholder:font-normal"
                                    value={formData.password}
                                    onChange={handleInputChange}
                                />
                            </div>
                        </div>

                         {/* Konfirmasi Password (BARU) */}
                         <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Konfirmasi Password</label>
                            <div className="relative">
                                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input 
                                    type="password" 
                                    name="confirmPassword"
                                    placeholder="Ulangi password..."
                                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-xs font-bold outline-none focus:border-emerald-500 focus:bg-white transition-all placeholder:font-normal"
                                    value={formData.confirmPassword}
                                    onChange={handleInputChange}
                                />
                            </div>
                        </div>
                        
                        {/* Role Selection */}
                         <div className="space-y-1 md:col-span-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Level Akses</label>
                            <div className="flex gap-2">
                                <button 
                                    type="button" 
                                    onClick={() => setFormData({...formData, role: 'Admin'})}
                                    className={`flex-1 py-3 rounded-xl text-xs font-black uppercase border transition-all flex items-center justify-center gap-2 ${formData.role === 'Admin' ? 'bg-blue-600 text-white border-blue-800 shadow-md' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}
                                >
                                    Admin Biasa
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setFormData({...formData, role: 'Super Admin'})}
                                    className={`flex-1 py-3 rounded-xl text-xs font-black uppercase border transition-all flex items-center justify-center gap-2 ${formData.role === 'Super Admin' ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-white text-slate-400 border-slate-200 hover:bg-emerald-50'}`}
                                >
                                    <ShieldCheck size={14} /> Super Admin
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="pt-2">
                        <button 
                            type="submit" 
                            disabled={isSaving}
                            className="w-full bg-blue-900 hover:bg-blue-700 text-white py-4 rounded-xl text-xs font-black uppercase tracking-[0.2em] shadow-lg shadow-blue-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            {isSaving ? <><Loader2 size={16} className="animate-spin" /> Menyimpan...</> : <><Save size={16} /> Simpan Data Admin</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* LIST ADMIN */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
        {loading ? (
          <div className="md:col-span-2 p-10 flex flex-col items-center justify-center space-y-3 bg-white rounded-3xl border border-slate-100">
            <Loader2 size={32} className="animate-spin text-emerald-600" />
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Mengambil Data Admin...</p>
          </div>
        ) : admins.map((admin) => (
          <div key={admin.id} className="bg-white p-4 md:p-6 rounded-2xl md:rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-lg transition-all">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
              <ShieldCheck className="w-16 h-16 md:w-24 md:h-24" />
            </div>
            
            <div className="flex items-center gap-3 md:gap-4 relative z-10">
              <div className={`w-10 h-10 md:w-16 md:h-16 rounded-xl md:rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0 ${admin.role === 'Super Admin' ? 'bg-emerald-600' : 'bg-blue-600'}`}>
                <UserCog size={24} />
              </div>
              <div className="overflow-hidden">
                <h2 className="text-xs md:text-base font-black text-slate-800 truncate uppercase tracking-tight">{admin.fullname}</h2>
                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                  <span className={`text-[7px] md:text-[8px] font-black uppercase px-2 py-0.5 rounded-lg border shadow-sm ${admin.role === 'Super Admin' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                    {admin.role}
                  </span>
                  <span className="text-slate-400 text-[8px] font-bold flex items-center gap-1 truncate tracking-tight">
                    <User size={10} /> @{admin.username}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 md:mt-8 flex gap-2 relative z-10">
              <div className="flex-1 p-2 md:p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Terdaftar Sejak</p>
                <p className="text-[9px] font-bold text-slate-600">{new Date(admin.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
              <button 
                onClick={() => handleDeleteAdmin(admin.id, admin.fullname)}
                className="px-4 md:px-6 rounded-xl md:rounded-2xl bg-red-50 text-red-600 border border-red-100 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center shadow-sm active:scale-95"
                title="Hapus Admin"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* INTEGRASI GOOGLE SHEETS */}
      <div className="bg-white p-5 md:p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
            <FileSpreadsheet size={24} />
          </div>
          <div>
            <h2 className="text-sm md:text-lg font-black text-slate-800 uppercase tracking-tight">Koneksi Database Google Sheets</h2>
            <p className="text-slate-400 text-[10px] md:text-xs">Ubah dan sinkronisasikan rekap Portal PAI Guru Anda langsung dengan Google Spreadsheet milik Anda.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* STEP 1: AKUN GOOGLE */}
          <div className="p-5 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Langkah 1: Akun Google</span>
              {googleUser ? (
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Terhubung
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-500">
                  Belum Terhubung
                </span>
              )}
            </div>

            {googleUser ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100">
                  {googleUser.photoURL ? (
                    <img src={googleUser.photoURL} alt="Avatar" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xs">
                      G
                    </div>
                  )}
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-slate-700 truncate">{googleUser.displayName}</p>
                    <p className="text-[9px] text-slate-400 truncate">{googleUser.email}</p>
                  </div>
                </div>
                <button
                  onClick={handleGoogleSignOut}
                  className="w-full py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                >
                  <LogOut size={12} /> Putuskan Akun Google
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[10px] text-slate-500 leading-relaxed italic">
                  Sambungkan ke Google Drive & Sheets untuk memperoleh autentikasi izin membuat dan mengedit spreadsheet database.
                </p>
                <button
                  onClick={handleGoogleSignIn}
                  className="w-full py-3 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-[10px] font-black uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <CloudLightning size={14} /> Hubungkan Akun Google Belajar
                </button>
              </div>
            )}
          </div>

          {/* STEP 2: PILIH SPREADSHEET */}
          <div className="p-5 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Langkah 2: Tautkan Spreadsheet</span>
            
            {!googleUser ? (
              <div className="h-28 flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-xl bg-white p-4 text-center">
                <FileSpreadsheet size={24} className="text-slate-300 mb-1" />
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Tersedia setelah Akun Google Terhubung</p>
              </div>
            ) : spreadsheetId ? (
              <div className="space-y-3">
                <div className="p-3 bg-white rounded-xl border border-slate-100 space-y-1.5">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">ID Spreadsheet Aktif</p>
                  <p className="text-[9px] font-mono text-slate-600 truncate bg-slate-50 p-1 rounded border overflow-hidden select-all">{spreadsheetId}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1"
                  >
                    Buka Spreadsheet <ExternalLink size={10} />
                  </a>
                  <button
                    onClick={handleDisconnectSpreadsheet}
                    className="py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 text-[10px] font-black uppercase tracking-wider transition-all"
                  >
                    Putus Koneksi
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={handleCreateNewSpreadsheet}
                  disabled={sheetsLoading}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2"
                >
                  {sheetsLoading ? <><Loader2 size={12} className="animate-spin" /> Sedang Membuat...</> : <><FileSpreadsheet size={14} /> Buat Spreadsheet PAI Baru</>}
                </button>
                
                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-slate-200"></div>
                  <span className="flex-shrink mx-3 text-slate-400 text-[8px] font-black uppercase tracking-widest">atau Tautkan Spreadsheet Lama</span>
                  <div className="flex-grow border-t border-slate-200"></div>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualSheetId}
                    onChange={(e) => setManualSheetId(e.target.value)}
                    placeholder="Masukkan Spreadsheet ID atau URL Penuh..."
                    className="flex-1 px-3 py-2 text-[10px] border border-slate-200 rounded-xl focus:ring-1 focus:ring-emerald-500 bg-white"
                  />
                  <button
                    onClick={handleLinkExistingSpreadsheet}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                  >
                    Tautkan
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* STEP 3: BI-DIRECTIONAL SYNC MECHANISM */}
        {googleUser && spreadsheetId && (
          <div className="pt-4 border-t border-slate-100 space-y-4">
            <div className="bg-slate-50 rounded-2xl p-4 md:p-6 border border-slate-100 space-y-4">
              <div className="flex items-center gap-2">
                <RefreshCw size={16} className={`text-emerald-600 ${syncing ? 'animate-spin' : ''}`} />
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Sinkronisasi Data Dua Arah</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* EXPORT TO SHEETS */}
                <div className="bg-white p-4 rounded-xl border border-slate-100 flex flex-col justify-between space-y-3">
                  <div>
                    <h4 className="text-[10px] font-black text-emerald-700 uppercase tracking-wider">Ekspor (Cloud ➔ Google Sheets)</h4>
                    <p className="text-[9px] md:text-xs text-slate-400 mt-1">
                      Mengunggah seluruh rekap nilai, absensi, tugas, materi, dan hasil ujian dari cloud server menuju Google Spreadsheet Anda.
                    </p>
                  </div>
                  <button
                    onClick={handleSyncToSheets}
                    disabled={syncing}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-1"
                  >
                    {syncing ? <Loader2 size={12} className="animate-spin" /> : 'Mulai Ekspor Sekarang'}
                  </button>
                </div>

                {/* IMPORT FROM SHEETS */}
                <div className="bg-white p-4 rounded-xl border border-slate-100 flex flex-col justify-between space-y-3">
                  <div>
                    <h4 className="text-[10px] font-black text-blue-700 uppercase tracking-wider">Impor (Google Sheets ➔ Cloud)</h4>
                    <p className="text-[9px] md:text-xs text-slate-400 mt-1">
                      Mengambil seluruh data rekap dari file Google Spreadsheet Anda dan menimpa database cloud lokal Anda di web.
                    </p>
                  </div>
                  <button
                    onClick={handleSyncFromSheets}
                    disabled={syncing}
                    className="w-full py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-[10px] font-black uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-1"
                  >
                    {syncing ? <Loader2 size={12} className="animate-spin" /> : 'Mulai Impor Sekarang'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-start gap-3">
        <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={16} />
        <div className="space-y-1">
          <p className="text-[9px] md:text-[10px] text-amber-800 font-black uppercase tracking-widest">Informasi Keamanan</p>
          <p className="text-[9px] md:text-[10px] text-amber-700 leading-relaxed italic">
            Semua admin memiliki akses penuh ke data nilai dan absensi. Hapus akun guru yang sudah tidak bertugas untuk menjaga kerahasiaan data siswa.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TeacherAdminManagement;