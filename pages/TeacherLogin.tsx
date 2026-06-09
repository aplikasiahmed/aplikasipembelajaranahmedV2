import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, Eye, EyeOff, BookOpen, X, Loader2 } from 'lucide-react';
import Swal from 'sweetalert2';
import { db } from '../services/supabaseMock';

interface TeacherLoginProps {
  onClose: () => void;
}

const TeacherLogin: React.FC<TeacherLoginProps> = ({ onClose }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim() || !password.trim()) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Username dan Password wajib diisi!', confirmButtonColor: '#059669', heightAuto: false });
      return;
    }

    setLoading(true);
    try {
      const admin = await db.verifyAdminLogin(username, password);
      
      if (admin) {
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('adminName', admin.fullname);
        localStorage.setItem('adminRole', admin.role);
        
        Swal.fire({
          icon: 'success',
          title: 'Akses Diberikan',
          text: `Selamat datang, ${admin.fullname}!`,
          timer: 1500,
          showConfirmButton: false,
          heightAuto: false
        }).then(() => {
          onClose();
          navigate('/guru');
        });
      } else {
        Swal.fire({ icon: 'error', title: 'Gagal Masuk', text: 'Username atau Password salah.', confirmButtonColor: '#dc2626', heightAuto: false });
      }
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Kesalahan Sistem', text: 'Gagal terhubung ke database server.', confirmButtonColor: '#dc2626', heightAuto: false });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="absolute inset-0" onClick={onClose}></div>
      {/* Ukuran form dikecilkan sesuai permintaan Bapak Guru (max-w-[320px]) */}
      <div className="bg-white w-full max-w-[320px] rounded-[2.5rem] shadow-1xl overflow-hidden relative animate-slideUp">
        <button onClick={onClose} className="absolute right-4 top-4 z-10 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full transition-all shadow-lg active:scale-95">
          <X size={14} />
        </button>

        <div className="bg-emerald-700 p-5 text-center text-white">
          <div className="inline-flex bg-white/20 p-2 rounded-xl mb-2 backdrop-blur-sm">
            <BookOpen size={20} />
          </div>
          {/* UPDATED TYPOGRAPHY: Font Bold & Subtitle Size Adjusted */}
          <h1 className="text-sm font-bold uppercase tracking-tight leading-tight">Masuk Dashboard Guru</h1>
          <p className="text-emerald-50 text-[10px] mt-1 font-medium opacity-90 tracking-wide">Akses Khusus Guru Pengajar</p>
        </div>
        
        <form onSubmit={handleLogin} className="p-5 space-y-3">
          <div className="space-y-1">
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input 
                type="text" 
                className="w-full pl-10 pr-4 py-2.5 text-[11px] rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-normal text-black"
                placeholder="masukkan username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input 
                type={showPassword ? "text" : "password"}
                className="w-full pl-10 pr-10 py-2.5 text-[11px] rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-normal text-black"
                placeholder="Kata Sandi"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-black py-3.5 rounded-2xl shadow-md shadow-emerald-700/20 transition-all disabled:opacity-50 active:scale-95 flex justify-center items-center gap-2 uppercase tracking-[0.2em] mt-2">
            {loading ? <Loader2 size={14} className="animate-spin" /> : 'MASUK'}
          </button>
          
          <p className="text-center text-slate-400 text-[9px] leading-relaxed italic px-2">
            "hanya guru yang dapat masuk!"
          </p>
        </form>
      </div>
    </div>
  );
};

export default TeacherLogin;