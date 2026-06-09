import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, 
  User, 
  BookOpen, 
  ClipboardCheck, 
  Award, 
  Settings, 
  LogOut,
  ShieldCheck,
  FileEdit,
  PencilLine,
  LayoutDashboard,
  FileSearch,
  Users
} from 'lucide-react';
import BottomNav from './BottomNav';
import TeacherLogin from '../pages/TeacherLogin';
import Swal from 'sweetalert2';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isTeacherPage = location.pathname.startsWith('/guru');

  const handleLogout = () => {
    Swal.fire({
      title: 'Yakin Ingin Keluar?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#059669',
      cancelButtonColor: '#dc2626',
      confirmButtonText: 'Yakin',
      cancelButtonText: 'Tidak',
      heightAuto: false,
      customClass: {
        popup: 'rounded-[2rem]'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        localStorage.removeItem('isLoggedIn');
        navigate('/');
      }
    });
  };

  // --- REVISI: VALIDASI TOMBOL BACK BROWSER/HP ---
  useEffect(() => {
    if (isTeacherPage) {
      // 1. Masukkan state dummy ke history agar ada yang bisa di-pop
      window.history.pushState(null, '', window.location.href);

      const handlePopState = (event: PopStateEvent) => {
        // 2. Mencegah navigasi balik langsung dengan pushState lagi (tetap di halaman ini)
        window.history.pushState(null, '', window.location.href);
        
        // 3. Tampilkan konfirmasi Logout
        handleLogout();
      };

      // Pasang Event Listener
      window.addEventListener('popstate', handlePopState);

      // Bersihkan saat komponen unmount atau keluar dari halaman guru
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [isTeacherPage, location.pathname]); // Trigger ulang jika pindah halaman internal guru

  const navLinks = [
    { name: 'Beranda', path: '/', icon: Home },
    { name: 'Materi PAI', path: '/materi', icon: BookOpen },
    { name: 'Absensi', path: '/absensi', icon: ClipboardCheck },
    { name: 'Nilai Siswa', path: '/nilai', icon: Award },
    { name: 'Kirim Tugas', path: '/tugas', icon: FileEdit },
    { name: 'Kerjakan Soal', path: '/kerjakan-tugas', icon: PencilLine },
    { name: 'Profil Guru', path: '/profil', icon: User },
  ];

  const teacherLinks = [
    { name: 'Dashboard', path: '/guru', icon: LayoutDashboard },
    { name: 'Input Nilai', path: '/guru/nilai', icon: Award },
    { name: 'Input Absensi', path: '/guru/absensi', icon: ClipboardCheck },
    { name: 'Cek Tugas Siswa', path: '/guru/tugas-masuk', icon: FileSearch },
    { name: 'Bank Soal', path: '/guru/ujian', icon: FileEdit }, // Menu Baru
    { name: 'Laporan Database', path: '/guru/laporan', icon: Settings },
    { name: 'Kelola Admin', path: '/guru/admin', icon: ShieldCheck },
  ];

  if (isTeacherPage) {
    return (
      <div className="min-h-screen flex bg-slate-50">
        <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col sticky top-0 h-screen">
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="bg-amber-600 p-1.5 rounded-lg text-white">
                <Settings size={18} />
              </div>
              <div>
                <h1 className="font-bold text-slate-800 text-sm leading-tight">Admin Guru</h1>
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">Dashbord Guru</p>
              </div>
            </div>
          </div>
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {teacherLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                  location.pathname === link.path 
                    ? 'bg-amber-50 text-amber-700 font-bold shadow-sm' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-amber-600'
                }`}
              >
                <link.icon size={16} />
                <span>{link.name}</span>
              </Link>
            ))}
          </nav>
          <div className="p-4 border-t border-slate-100">
            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 bg-red-600 text-white py-2.5 rounded-xl text-sm font-black shadow-lg shadow-red-200 hover:bg-red-700 transition-all uppercase tracking-widest"
            >
              <LogOut size={16} /> Keluar
            </button>
          </div>
        </aside>
        
        <main className="flex-1 p-4 md:p-8 pb-20 md:pb-8 overflow-y-auto">
          {/* Header Mobile - Diperbarui sesuai permintaan */}
          <header className="md:hidden flex items-center justify-between mb-4 bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex items-center gap-2">
              <div className="bg-slate-800 p-1.5 rounded-lg text-white">
                <LayoutDashboard size={14} />
              </div>
              <span className="font-black text-slate-800 text-[10px] uppercase tracking-tighter">Admin Panel PAI</span>
            </div>
            <button 
              onClick={handleLogout} 
              className="flex items-center gap-1.5 bg-red-600 text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-200 active:scale-95 transition-all"
            >
              <LogOut size={12} strokeWidth={3} /> KELUAR
            </button>
          </header>

          <div className="max-w-4xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-[80px] md:pb-0 overflow-x-hidden">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="bg-emerald-600 p-1.5 rounded-lg text-white shrink-0">
              <BookOpen size={20} />
            </div>
            <span className="font-bold text-[13px] sm:text-lg text-slate-800 whitespace-nowrap">Pend. Agama Islam</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-2 lg:gap-4">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`text-[10px] lg:text-[11px] font-bold transition-all px-2 py-1 rounded-md whitespace-nowrap ${
                  location.pathname === link.path 
                  ? 'bg-emerald-50 text-emerald-700' 
                  : 'text-slate-500 hover:text-emerald-600'
                }`}
              >
                {link.name}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowLoginModal(true)}
              className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg text-[10px] sm:text-xs font-bold hover:bg-blue-900 transition-all"
            >
              Masuk
            </button>
          </div>
        </div>
      </header>

      <main className="p-3 md:p-8">
        <div className="max-w-5xl mx-auto">
          {children}
        </div>
      </main>

      {!isTeacherPage && <BottomNav />}

      {/* Login Modal Overlay */}
      {showLoginModal && (
        <TeacherLogin onClose={() => setShowLoginModal(false)} />
      )}
    </div>
  );
};

export default Layout;