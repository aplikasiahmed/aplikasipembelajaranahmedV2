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
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Code
} from 'lucide-react';
import { db } from '../services/supabaseMock';
import { auth, googleProvider } from '../services/firebase';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import { AdminUser } from '../types';
import Swal from 'sweetalert2';

// Interface untuk data profil Google
interface GoogleUserInfo {
  displayName: string;
  email: string;
  photoURL?: string;
}

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
  const [googleUser, setGoogleUser] = useState<GoogleUserInfo | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string>(() => {
    return localStorage.getItem('google_oauth_client_id') || import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  });
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [appsScriptUrl, setAppsScriptUrl] = useState<string>(() => {
    return localStorage.getItem('google_apps_script_url') || import.meta.env.VITE_GOOGLE_APPS_SCRIPT_URL || '';
  });
  const [useAppsScript, setUseAppsScript] = useState<boolean>(() => {
    return !!localStorage.getItem('google_apps_script_url') || true;
  });
  const [showTutorial, setShowTutorial] = useState(false);
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

    const loadAppsScriptUrl = async () => {
      const url = await db.getAppsScriptUrl();
      setAppsScriptUrl(url || '');
    };
    loadAppsScriptUrl();

    // Ambil sesi login langsung jika tersimpan di localStorage
    const savedToken = localStorage.getItem('google_oauth_token');
    const savedUser = localStorage.getItem('google_oauth_user');
    if (savedToken && savedUser) {
      setGoogleToken(savedToken);
      try {
        setGoogleUser(JSON.parse(savedUser));
      } catch (_) {
        setGoogleUser(null);
      }
    } else {
      // Memantau status login Google via Firebase (Fallback)
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
          setGoogleUser({
            displayName: user.displayName || 'Guru PAI',
            email: user.email || '',
            photoURL: user.photoURL || undefined
          });
        } else {
          setGoogleUser(null);
          setGoogleToken(null);
        }
      });

      return () => unsubscribe();
    }
  }, []);

  const fetchAdmins = async () => {
    setLoading(true);
    const data = await db.getAdmins();
    setAdmins(data);
    setLoading(false);
  };

  const handleSaveAppsScriptUrl = async (urlStr: string) => {
    if (!urlStr.startsWith('https://script.google.com/')) {
      Swal.fire({ icon: 'warning', title: 'Format Salah', text: 'URL Google Apps Script harus dimulai dengan "https://script.google.com/"', heightAuto: false });
      return;
    }
    await db.setAppsScriptUrl(urlStr.trim());
    setAppsScriptUrl(urlStr.trim());
    Swal.fire({ icon: 'success', title: 'Tersimpan!', text: 'URL Google Apps Script berhasil ditautkan dan disimpan!', timer: 1500, showConfirmButton: false, heightAuto: false });
  };

  const handleDeleteAppsScriptUrl = async () => {
    const confirmed = await Swal.fire({
      title: 'Putuskan Hubungan?',
      text: 'Data rekap lokal Anda akan tetap ada, tetapi sinkronisasi otomatis ke Google Sheets akan dihentikan.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#475569',
      confirmButtonText: 'Ya, Putuskan!',
      cancelButtonText: 'Batal',
      heightAuto: false
    });
    if (!confirmed.isConfirmed) return;

    await db.setAppsScriptUrl(null);
    setAppsScriptUrl('');
    Swal.fire({ icon: 'success', title: 'Terputus', text: 'Koneksi dengan Google Apps Script telah dinonaktifkan.', timer: 1500, showConfirmButton: false, heightAuto: false });
  };

  // Google Sheets Handlers
  const handleGoogleSignIn = async () => {
    // Jika Client ID sudah diisi, utamakan direct login (bypas Firebase)
    if (clientId.trim()) {
      handleDirectGoogleSignIn();
      return;
    }

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken || null;
      if (token) {
        setGoogleToken(token);
        const profile = {
          displayName: result.user.displayName || 'Guru PAI',
          email: result.user.email || '',
          photoURL: result.user.photoURL || undefined
        };
        setGoogleUser(profile);
        localStorage.setItem('google_oauth_token', token);
        localStorage.setItem('google_oauth_user', JSON.stringify(profile));
        
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
      let errMsg = err.message || 'Gagal menyambungkan ke Google.';
      
      // Jika errornya adalah unauthorized-domain karena Vercel, jelaskan dengan sangat ramah
      if (err.code === 'auth/unauthorized-domain') {
        errMsg = "Metode Firebase mendeteksi domain Vercel Anda belum didaftarkan di Firebase Console. Gunakan kolom 'Google Client ID' di bawah untuk terhubung secara langsung tanpa Firebase Console!";
      }

      Swal.fire({
        icon: 'error',
        title: 'Penyambungan Gagal',
        text: errMsg,
        confirmButtonColor: '#dc2626',
        heightAuto: false
      });
    }
  };

  const handleDirectGoogleSignIn = async () => {
    if (!clientId.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Client ID Kosong',
        text: 'Silakan isi kolom Google Client ID terlebih dahulu.',
        confirmButtonColor: '#2563eb',
        heightAuto: false
      });
      return;
    }

    localStorage.setItem('google_oauth_client_id', clientId.trim());

    const redirectUri = `${window.location.origin}/`;
    const scopes = [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email'
    ].join(' ');

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth` +
      `?client_id=${encodeURIComponent(clientId.trim())}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=token` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&prompt=consent`;

    const popupWidth = 600;
    const popupHeight = 650;
    const left = window.screen.width / 2 - popupWidth / 2;
    const top = window.screen.height / 2 - popupHeight / 2;
    
    Swal.fire({
      title: 'Menghubungkan...',
      text: 'Silakan masuk & izinkan aplikasi pada jendela popup Google.',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
      heightAuto: false
    });

    const oauthPopup = window.open(
      authUrl,
      'ConnectGoogleSheets',
      `width=${popupWidth},height=${popupHeight},left=${left},top=${top}`
    );

    if (!oauthPopup) {
      Swal.fire({
        icon: 'error',
        title: 'Popup Diblokir',
        text: 'Jendela login diblokir oleh browser. Izinkan popup untuk website ini di pengaturan browser, lalu coba lagi.',
        confirmButtonColor: '#dc2626',
        heightAuto: false
      });
      return;
    }

    const messageListener = async (event: MessageEvent) => {
      // Verifikasi asal usul pesan jika perlu, namun karena kita berjalan di domain dinamis, kita terima GOOGLE_OAUTH_SUCCESS
      if (event.data && event.data.type === 'GOOGLE_OAUTH_SUCCESS') {
        const token = event.data.token;
        if (token) {
          window.removeEventListener('message', messageListener);
          setGoogleToken(token);
          localStorage.setItem('google_oauth_token', token);

          try {
            const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (userinfoRes.ok) {
              const info = await userinfoRes.json();
              const profile = {
                displayName: info.name || 'Guru PAI',
                email: info.email || '',
                photoURL: info.picture || undefined
              };
              setGoogleUser(profile);
              localStorage.setItem('google_oauth_user', JSON.stringify(profile));

              Swal.close();
              setTimeout(() => {
                Swal.fire({
                  icon: 'success',
                  title: 'Koneksi Berhasil!',
                  text: `Selamat datang, ${profile.displayName}. Hubungan langsung Google Sheets aktif.`,
                  timer: 3000,
                  showConfirmButton: false,
                  heightAuto: false
                });
              }, 150);
            } else {
              throw new Error("Gagal mengunduh profil Google.");
            }
          } catch (e) {
            const fallbackProfile = { displayName: 'Guru PAI', email: 'Koneksi Langsung Terjalin' };
            setGoogleUser(fallbackProfile);
            localStorage.setItem('google_oauth_user', JSON.stringify(fallbackProfile));
            Swal.close();
            setTimeout(() => {
              Swal.fire({
                icon: 'success',
                title: 'Koneksi Berhasil!',
                text: 'Hubungan langsung Google Sheets aktif.',
                timer: 2000,
                showConfirmButton: false,
                heightAuto: false
              });
            }, 150);
          }
        }
      }
    };

    window.addEventListener('message', messageListener);

    const checkClosedInterval = setInterval(() => {
      if (oauthPopup.closed) {
        clearInterval(checkClosedInterval);
        setTimeout(() => window.removeEventListener('message', messageListener), 1000);
        if (!localStorage.getItem('google_oauth_token')) {
          Swal.close();
        }
      }
    }, 1000);
  };

  const handleGoogleSignOut = async () => {
    try {
      if (auth.currentUser) {
        await signOut(auth);
      }
    } catch (_) {}
    
    setGoogleToken(null);
    setGoogleUser(null);
    localStorage.removeItem('google_oauth_token');
    localStorage.removeItem('google_oauth_user');
    
    Swal.fire({
      icon: 'success',
      title: 'Terputus',
      text: 'Akun Google Anda telah diputuskan hubungannya.',
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
        
        Swal.close();
        const exportConfirm = await new Promise<any>((resolve) => {
          setTimeout(() => {
            Swal.fire({
              icon: 'success',
              title: 'Koneksi Berhasil!',
              text: 'Google Sheets Anda berhasil terhubung dan diinisialisasi struktur datanya. Kirim data terbaru saat ini ke Google Sheets?',
              showCancelButton: true,
              confirmButtonColor: '#059669',
              cancelButtonColor: '#2563eb',
              confirmButtonText: 'Ya, Ekspor Sekarang',
              cancelButtonText: 'Lewati',
              heightAuto: false
            }).then(resolve);
          }, 150);
        });
        
        if (exportConfirm && exportConfirm.isConfirmed) {
          Swal.fire({
            title: 'Menyinkronkan...',
            text: 'Mengekspor data portal ke Google Sheets...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading(),
            heightAuto: false
          });
          await db.syncToGoogleSheets(googleToken);
          Swal.close();
          setTimeout(() => {
            Swal.fire({
              icon: 'success',
              title: 'Ekspor Berhasil',
              text: 'Seluruh database lokal berhasil disinkronisasikan ke Google Sheets Anda!',
              confirmButtonColor: '#059669',
              heightAuto: false
            });
          }, 150);
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
      Swal.close();
      setTimeout(() => {
        Swal.fire({
          icon: 'error',
          title: 'Tautan Gagal',
          text: err.message || 'Gagal menyambungkan atau menginisialisasi spreadsheet tersebut. Pastikan ID valid dan akun Google Anda memiliki akses pengeditan.',
          confirmButtonColor: '#dc2626',
          heightAuto: false
        });
      }, 150);
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
    if (!appsScriptUrl && !googleToken) {
      Swal.fire({ icon: 'warning', title: 'Akses Ditolak', text: 'Konfigurasikan Url Google Apps Script atau hubungkan akun Google anda untuk melakukan sinkronisasi.', confirmButtonColor: '#059669', heightAuto: false });
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
      await db.syncToGoogleSheets(googleToken || undefined);
      Swal.fire({ icon: 'success', title: 'Sinkronisasi Berhasil', text: 'Semua rekap lokal berhasil diekspor ke Google Sheets!', confirmButtonColor: '#059669', heightAuto: false });
    } catch (err: any) {
      console.error("Gagal Ekspor:", err);
      Swal.fire({ icon: 'error', title: 'Ekspor Gagal', text: err.message, confirmButtonColor: '#dc2626', heightAuto: false });
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncFromSheets = async () => {
    if (!appsScriptUrl && !googleToken) {
      Swal.fire({ icon: 'warning', title: 'Akses Ditolak', text: 'Konfigurasikan Url Google Apps Script atau hubungkan akun Google anda untuk melakukan sinkronisasi.', confirmButtonColor: '#059669', heightAuto: false });
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
      await db.syncFromGoogleSheets(googleToken || undefined);
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
      const res = await db.addAdmin({
        fullname: formData.fullname,
        username: formData.username,
        password: formData.password,
        role: formData.role as any
      });

      if (res.synced) {
        Swal.fire({
          icon: 'success',
          title: 'Admin Ditambahkan',
          text: 'Data admin baru berhasil disimpan & disinkronkan otomatis ke Google Sheets!',
          confirmButtonColor: '#059669',
          heightAuto: false
        });
      } else {
        Swal.fire({
          icon: 'info',
          title: 'Berhasil Disimpan Lokal',
          text: res.error
            ? `Data admin disimpan lokal, tetapi gagal sinkronisasi ke Google Sheets: ${res.error}. Hubungkan kembali Google untuk memperbarui.`
            : 'Data admin baru disimpan secara lokal di browser. Hubungkan Google Sheets di menu utama admin agar rekap bisa disinkronisasikan otomatis.',
          confirmButtonColor: '#2563eb',
          heightAuto: false
        });
      }
      
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
                const res = await db.deleteAdmin(id);
                
                Swal.close();
                setTimeout(() => {
                  if (res.synced) {
                    Swal.fire({ 
                        icon: 'success', 
                        title: 'Terhapus!', 
                        text: `Akun admin ${name} berhasil dihapus dan disinkronkan ke Google Sheets.`, 
                        confirmButtonColor: '#059669',
                        heightAuto: false 
                    });
                  } else {
                    Swal.fire({ 
                        icon: 'success', 
                        title: 'Terhapus Lokal!', 
                        text: res.error 
                          ? `Akun admin ${name} berhasil dihapus secara lokal, tetapi gagal sinkronisasi ke Google Sheets: ${res.error}`
                          : `Akun admin ${name} berhasil dihapus secara lokal.`, 
                        confirmButtonColor: '#2563eb',
                        heightAuto: false 
                    });
                  }
                  fetchAdmins();
                }, 150);
            } catch (err) {
                Swal.close();
                setTimeout(() => {
                  Swal.fire({
                    icon: 'error',
                    title: 'Gagal',
                    text: 'Terjadi kesalahan saat menghapus data.',
                    confirmButtonColor: '#dc2626',
                    heightAuto: false
                  });
                }, 150);
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <h2 className="text-sm md:text-lg font-black text-slate-800 uppercase tracking-tight">Integrasi Database Google Sheets</h2>
              <p className="text-slate-400 text-[10px] md:text-xs">Hubungkan portal ini ke Google Spreadsheet untuk sinkronisasi database secara langsung melalui Web App URL Google Apps Script Anda.</p>
            </div>
          </div>
        </div>

        {/* METODE APPS SCRIPT (MUDAH & INSTAN) */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Form Input URL */}
            <div className="lg:col-span-5 p-5 rounded-2xl border border-slate-100 bg-slate-50/50 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Langkah 1: Tempel Url Web App</span>
                  {appsScriptUrl ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Terhubung
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                      Belum Diisi
                    </span>
                  )}
                </div>

                <p className="text-[10px] md:text-xs text-slate-500 leading-relaxed">
                  Tempel URL Web Aplikasi Google Apps Script dari spreadsheet milik Anda di bawah ini untuk mengaktifkan sinkronisasi otomatis.
                </p>

                <div className="space-y-2">
                  <label className="text-[9px] font-extrabold text-slate-600 uppercase tracking-wider block">Web App URL Google Apps Script</label>
                  <input
                    type="text"
                    value={appsScriptUrl}
                    onChange={(e) => setAppsScriptUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/xxxx/exec"
                    className="w-full px-3 py-2.5 text-[10px] font-mono border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  onClick={() => handleSaveAppsScriptUrl(appsScriptUrl)}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider transition-all shadow-md"
                >
                  Simpan &amp; Tautkan URL
                </button>
                {appsScriptUrl && (
                  <button
                    onClick={handleDeleteAppsScriptUrl}
                    className="px-4 py-3 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-[10px] font-black uppercase tracking-wider transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Dokumentasi Panduan */}
            <div className="lg:col-span-7 p-5 rounded-2xl border border-slate-100 bg-white space-y-3">
              <button
                onClick={() => setShowTutorial(!showTutorial)}
                className="w-full text-left p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Code size={14} className="text-emerald-600" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">Panduan Video / Langkah Membuat Apps Script (Hanya 1 Menit)</span>
                </div>
                {showTutorial ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
              </button>

              {(!appsScriptUrl || showTutorial) && (
                <div className="text-[11px] text-slate-600 space-y-3 p-1 leading-relaxed max-h-[280px] overflow-y-auto pr-2 scrollbar-thin">
                  <div className="font-extrabold text-slate-800 uppercase text-[9px] tracking-wider mb-1">Langkah Demi Langkah:</div>
                  <ol className="list-decimal list-inside space-y-2 pl-1">
                    <li>Buka Google Spreadsheet lokal Anda.</li>
                    <li>Di menu atas, pilih <b>Ekstensi</b> &rarr; <b>Apps Script</b>.</li>
                    <li>Hapus semua kode bawaan di sana.</li>
                    <li>Salin &amp; Tempel kode JavaScript di bawah ini ke editor Apps Script tersebut:</li>
                  </ol>

                  <div className="relative">
                    <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl text-[9px] font-mono overflow-all max-h-48 overflow-y-auto whitespace-pre leading-normal">
{`/* 
  KONEKTOR FOR PORTAL PAI 
  Bebas dari Google Cloud Console!
*/
function doGet(e) {
  var sheetName = e.parameter.sheet;
  if (!sheetName) {
    return ContentService.createTextOutput(JSON.stringify({ error: "Missing sheet" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  var values = [];
  if (sheet.getLastRow() > 0 && sheet.getLastColumn() > 0) {
    values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  }
  // Convert dates
  for (var i = 0; i < values.length; i++) {
    for (var j = 0; j < values[i].length; j++) {
      if (values[i][j] instanceof Date) {
        values[i][j] = values[i][j].toISOString();
      }
    }
  }
  return ContentService.createTextOutput(JSON.stringify({ values: values }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var result = { success: false };
  try {
    var postData = JSON.parse(e.postData.contents);
    var sheetName = postData.sheet;
    var values = postData.values;
    if (sheetName && values) {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) sheet = ss.insertSheet(sheetName);
      sheet.clear();
      if (values.length > 0) {
        sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
      }
      result.success = true;
    }
  } catch (err) {
    result.error = err.toString();
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}`}
                    </pre>
                    <button
                      onClick={() => {
                        const codeText = `function doGet(e) {
  var sheetName = e.parameter.sheet;
  if (!sheetName) return ContentService.createTextOutput(JSON.stringify({ error: "Missing sheet" })).setMimeType(ContentService.MimeType.JSON);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  var values = [];
  if (sheet.getLastRow() > 0 && sheet.getLastColumn() > 0) {
    values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  }
  for (var i = 0; i < values.length; i++) {
    for (var j = 0; j < values[i].length; j++) {
      if (values[i][j] instanceof Date) {
        values[i][j] = values[i][j].toISOString();
      }
    }
  }
  return ContentService.createTextOutput(JSON.stringify({ values: values })).setMimeType(ContentService.MimeType.JSON);
}
function doPost(e) {
  var result = { success: false };
  try {
    var postData = JSON.parse(e.postData.contents);
    var sheetName = postData.sheet;
    var values = postData.values;
    if (sheetName && values) {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) sheet = ss.insertSheet(sheetName);
      sheet.clear();
      if (values.length > 0) sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
      result.success = true;
    }
  } catch (err) {
    result.error = err.toString();
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}`;
                        navigator.clipboard.writeText(codeText);
                        Swal.fire({ icon: 'success', title: 'Berhasil Disalin!', text: 'Salinan siap di-paste di Google Apps Script.', timer: 1200, showConfirmButton: false, heightAuto: false });
                      }}
                      className="absolute right-2 top-2 px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[8px] font-black uppercase tracking-wider transition-all"
                    >
                      Salin Kode
                    </button>
                  </div>

                  <ol className="list-decimal list-inside space-y-2 pl-1" start={5}>
                    <li>Di pojok kanan atas, klik tombol <b>Terapkan (Deploy)</b> &rarr; <b>Terapkan Baru (New deployment)</b>.</li>
                    <li>Klik ikon ⚙️ gerigi di sebelah 'Pilih tipe', lalu pilih <b>Aplikasi Web (Web App)</b>.</li>
                    <li>Di deskripsi isi bebas (misal: "portal-pai-connector").</li>
                    <li>Bagian <b>Jalankan sebagai (Execute as)</b> pilih: <b>Saya (Me / Email Anda)</b>.</li>
                    <li>Bagian <b>Siapa yang memiliki akses (Who has access)</b> pilih: <b>Siapa saja (Anyone)</b>. <span className="text-red-600 font-extrabold">(Sangat penting agar sinkronisasi bisa berjalan tanpa batasan otentikasi)</span>.</li>
                    <li>Klik tombol biru <b>Terapkan (Deploy)</b>. Berikan izin akses (Authorize access) lalu pilih Akun Google Anda, di dialog peringatan pilih 'Advanced' &rarr; 'Go to Untitled project (unsafe)'.</li>
                    <li>Salin teks <b>URL Aplikasi Web (Web App URL)</b> yang berakhiran <code className="bg-slate-100 p-0.5 rounded px-1 text-red-600">/exec</code>. Tempel di kolom input web portal di sebelah kiri.</li>
                  </ol>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Automatic Google Apps Script background sync is active */}
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