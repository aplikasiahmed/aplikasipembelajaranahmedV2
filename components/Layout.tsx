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
  Users,
  Scroll,
  TrendingUp,
  Scale,
  Target,
  Activity,
  Menu,
  ClipboardList,
  ArrowLeft
} from 'lucide-react';
import BottomNav from './BottomNav';
import TeacherLogin from '../pages/TeacherLogin';
import Swal from 'sweetalert2';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isTeacherPage = location.pathname.startsWith('/guru');

  // Tutup sidebar saat berganti halaman/rute
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

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
    { name: 'Tujuan Pembelajaran', path: '/guru/tujuanpembelajaran', icon: Target },
    { name: 'Bobot Penilaian', path: '/guru/bobotnilai', icon: Scale },
    { name: 'Materi Pembelajaran', path: '/guru/materi', icon: BookOpen },
    { name: 'Data Siswa', path: '/guru/datasiswa', icon: Users },
    { name: 'Jurnal Harian', path: '/guru/jurnal', icon: ClipboardList },
    { name: 'Input Nilai', path: '/guru/nilai', icon: Award },
    { name: 'Input Absensi', path: '/guru/absensi', icon: ClipboardCheck },
    { name: 'Cek Tugas Siswa', path: '/guru/tugas-masuk', icon: FileSearch },
    { name: 'Bank Soal', path: '/guru/ujian', icon: FileEdit },
    { name: 'Nilai Rapot', path: '/guru/Nilai-rapot', icon: Scroll },
    { name: 'Laporan Nilai', path: '/guru/laporan', icon: TrendingUp },
    { name: 'Kelola Admin', path: '/guru/admin', icon: ShieldCheck },
    { name: 'Pengaturan', path: '/guru/pengaturan', icon: Settings },
    { name: 'Statistik Kunjungan', path: '/guru/statistik', icon: Activity },
  ];

  if (isTeacherPage) {
    return (
      <div className="min-h-screen flex bg-slate-50 overflow-x-hidden relative teacher-panel">
        {/* Sidebar Container */}
        <aside 
          className={`bg-white border-r border-slate-200 flex flex-col fixed lg:sticky top-0 h-screen z-50 transition-all duration-300 ${
            isSidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full lg:translate-x-0 lg:w-0'
          } overflow-hidden`}
        >
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-amber-600 p-1.5 rounded-lg text-white">
                <Settings size={18} />
              </div>
              <div>
                <h1 className="font-bold text-slate-800 text-xs leading-tight">Admin Guru</h1>
                <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">Dashboard</p>
              </div>
            </div>
            {/* Close button inside sidebar on tablet/mobile */}
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"
            >
              <ArrowLeft size={16} />
            </button>
          </div>
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {teacherLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => {
                  if (window.innerWidth < 1024) setIsSidebarOpen(false);
                }}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
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
          <div className="p-3 border-t border-slate-100">
            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 bg-red-600 text-white py-2 rounded-xl text-xs font-black shadow-lg shadow-red-100 hover:bg-red-700 transition-all uppercase tracking-wider"
            >
              <LogOut size={14} /> Keluar
            </button>
          </div>
        </aside>

        {/* Sidebar backdrop overlay on tablet/mobile */}
        {isSidebarOpen && (
          <div 
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden"
          />
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header Bar */}
          <header className="bg-white border-b border-slate-100 h-16 px-4 md:px-6 flex items-center justify-between sticky top-0 z-30 shrink-0">
            <div className="flex items-center gap-3">
              {/* Hamburger Button */}
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-all active:scale-95"
                title="Toggle Sidebar"
              >
                <Menu size={20} strokeWidth={2.5} />
              </button>
              
              <div className="flex items-center gap-1">
                <span className="font-black text-slate-800 text-xs md:text-sm uppercase tracking-tight">
                  ADMIN PANEL GURU PAI
                </span>
              </div>
            </div>

            <button 
              onClick={handleLogout} 
              className="flex items-center gap-1.5 bg-red-600 text-white px-3 py-1.5 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest shadow-md shadow-red-100 hover:bg-red-700 active:scale-95 transition-all"
            >
              <LogOut size={12} strokeWidth={3} /> <span className="hidden sm:inline">KELUAR</span>
            </button>
          </header>

          <main className="flex-1 p-3 md:p-6 pb-20 md:pb-6 overflow-y-auto">
            <div className="max-w-5xl mx-auto w-full">
              {children}
            </div>
          </main>
        </div>
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