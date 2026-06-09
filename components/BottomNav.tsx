
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  User, 
  Award, 
  ClipboardCheck, 
  BookOpen, 
  FileEdit,
  PencilLine
} from 'lucide-react';

const BottomNav: React.FC = () => {
  const location = useLocation();
  
  // Urutan Mobile (7 menu): Nilai, Kumpulkan, Tugas, [Beranda], Materi, Absen, Profil
  const navLinks = [
    { name: 'Cek Nilai', path: '/nilai', icon: Award },
    { name: 'Cek Absensi', path: '/absensi', icon: ClipboardCheck },
    { name: 'Kirim Tugas', path: '/tugas', icon: FileEdit },
    { name: 'Beranda', path: '/', icon: Home },
    { name: 'Materi', path: '/materi', icon: BookOpen },
    { name: 'Kerjakan Soal', path: '/kerjakan-tugas', icon: PencilLine },
    { name: 'Profil Guru', path: '/profil', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 md:hidden h-[70px] shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
      <div className="flex justify-around items-center h-full px-0.5 relative">
        {navLinks.map((link) => {
          const isActive = location.pathname === link.path;
          const isBeranda = link.name === 'Beranda';
          
          if (isBeranda) {
            return (
              <Link
                key={link.path}
                to={link.path}
                className="relative -top-5 flex flex-col items-center group"
              >
                <div className={`p-3.5 rounded-full border-1 border-white shadow-md transition-all duration-300 ${
                  isActive 
                  ? 'bg-emerald-600 text-white scale-110' 
                  : 'bg-emerald-500 text-white hover:bg-emerald-600'
                }`}>
                  <link.icon size={24} strokeWidth={2.5} />
                </div>
                <span className={`text-[8px] font-black tracking-tighter uppercase mt-1 transition-all ${
                  isActive ? 'text-emerald-700 opacity-100' : 'text-slate-400 opacity-80'
                }`}>
                  {link.name}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={link.path}
              to={link.path}
              className={`flex flex-col items-center gap-1 transition-all flex-1 h-full justify-center ${
                isActive ? 'text-emerald-600' : 'text-slate-400'
              }`}
            >
              <link.icon size={16} strokeWidth={isActive ? 2.5 : 2} />
              <span className={`text-[7px] font-bold tracking-tighter uppercase leading-none text-center w-full ${isActive ? 'opacity-100' : 'opacity-80'}`}>
                {link.name}
              </span>
            </Link>
          );
        })}
      </div>
      {/* Safe area for mobile home indicator */}
      <div className="h-safe-bottom bg-white md:hidden"></div>
    </nav>
  );
};

export default BottomNav;
