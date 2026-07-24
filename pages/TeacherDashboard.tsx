import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Award, 
  Scroll,
  ClipboardCheck, 
  FileText, 
  ShieldCheck, 
  TrendingUp, 
  Clock,
  ArrowRight,
  FileEdit,
  CheckCircle2,
  LayoutDashboard,
  Settings,
  Scale,
  Target,
  Activity,
  BookOpen,
  ClipboardList
} from 'lucide-react';
import { db } from '../services/supabaseMock';

const TeacherDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalStudents: 0,
    tasksToday: 0,
    onlineExamsCount: 0,
    attendanceDone: false
  });

  useEffect(() => {
    const loadStats = async () => {
      const s7 = await db.getStudentsByGrade('7');
      const s8 = await db.getStudentsByGrade('8');
      const s9 = await db.getStudentsByGrade('9');
      const tasks = await db.getTaskSubmissions();
      const exams = await db.getExamResults();
      
      setStats({
        totalStudents: s7.length + s8.length + s9.length,
        tasksToday: tasks.length,
        onlineExamsCount: exams.length,
        attendanceDone: true
      });
    };
    loadStats();
  }, []);

  const menuItems = [
    { title: 'Tujuan Pembelajaran', path: '/guru/tujuanpembelajaran', icon: Target, color: 'bg-emerald-800', text: 'text-emerald-800', bg: 'bg-emerald-50 border border-emerald-100', desc: 'Kelola Capaian Kompetensi & TP' },
    { title: 'Bobot Penilaian', path: '/guru/bobotnilai', icon: Scale, color: 'bg-emerald-700', text: 'text-emerald-700', bg: 'bg-emerald-50 border border-emerald-100/50', desc: 'Atur Kontribusi Persentase Nilai' },
    { title: 'Materi Pembelajaran', path: '/guru/materi', icon: BookOpen, color: 'bg-emerald-600', text: 'text-emerald-600', bg: 'bg-emerald-50 border border-emerald-100', desc: 'Kelola gambar, modul & teks materi' },
    { title: 'Data Siswa', path: '/guru/datasiswa', icon: Users, color: 'bg-blue-600', text: 'text-blue-600', bg: 'bg-blue-50/80 border border-blue-100', desc: 'Kelola & Import data siswa' },
    { title: 'Jurnal Harian', path: '/guru/jurnal', icon: ClipboardList, color: 'bg-emerald-600', text: 'text-emerald-600', bg: 'bg-emerald-50 border border-emerald-100', desc: 'Catat aktivitas mengajar harian guru' },
    { title: 'Input Nilai', path: '/guru/nilai', icon: Award, color: 'bg-emerald-600', text: 'text-emerald-600', bg: 'bg-emerald-50', desc: 'Kelola nilai harian & ujian' },
    { title: 'Input Absensi', path: '/guru/absensi', icon: ClipboardCheck, color: 'bg-amber-600', text: 'text-amber-600', bg: 'bg-amber-50', desc: 'Rekap kehadiran harian' },
    { title: 'Cek Tugas', path: '/guru/tugas-masuk', icon: FileText, color: 'bg-purple-600', text: 'text-purple-600', bg: 'bg-purple-50', desc: 'Koreksi tugas & ujian' },
    { title: 'Bank Soal', path: '/guru/ujian', icon: FileEdit, color: 'bg-pink-600', text: 'text-pink-600', bg: 'bg-pink-50', desc: 'Buat & Kelola Soal Ujian' },
    { title: 'Nilai Rapot', path: '/guru/Nilai-rapot', icon: Scroll, color: 'bg-emerald-850', text: 'text-emerald-850', bg: 'bg-emerald-50 border border-emerald-150', desc: 'Rekap TP, STS, SAS & Raport akhir' },
    { title: 'Laporan', path: '/guru/laporan', icon: TrendingUp, color: 'bg-red-600', text: 'text-red-600', bg: 'bg-red-50', desc: 'Export PDF & Excel' },
    { title: 'Kelola Admin', path: '/guru/admin', icon: ShieldCheck, color: 'bg-blue-600', text: 'text-blue-600', bg: 'bg-blue-50', desc: 'Manajemen akun pengajar' },
    { title: 'Pengaturan', path: '/guru/pengaturan', icon: Settings, color: 'bg-slate-600', text: 'text-slate-600', bg: 'bg-slate-50', desc: 'Integrasi Sheets, Excel & DB Reset' },
    { title: 'Statistik Kunjungan', path: '/guru/statistik', icon: Activity, color: 'bg-amber-600', text: 'text-amber-600', bg: 'bg-amber-50', desc: 'Monitor aktivitas & keaktifan siswa' },
  ];

  return (
    <div className="space-y-5 animate-fadeIn pb-24 md:pb-10 px-1 md:px-0">
      
      {/* HEADER SECTION - Modern Style */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white md:bg-transparent p-5 md:p-0 rounded-[2rem] md:rounded-none border border-slate-100 md:border-none shadow-sm md:shadow-none">
        <div>
          <div className="flex items-center gap-2 mb-1 md:hidden">
             <div className="p-1.5 bg-slate-100 rounded-lg text-slate-600"><LayoutDashboard size={14}/></div>
             <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Panel Guru</span>
          </div>
          <h1 className="text-xl md:text-3xl font-black text-slate-800 tracking-tight leading-tight">Dashboard Utama</h1>
          <p className="text-slate-500 text-xs md:text-sm font-medium mt-1 leading-relaxed">
            Selamat datang, pantau aktivitas siswa hari ini.
          </p>
        </div>
        <div className="self-start md:self-center flex items-center gap-2 bg-white md:bg-emerald-50 text-slate-600 md:text-emerald-700 px-4 py-2 rounded-xl border border-slate-200 md:border-emerald-100 shadow-sm md:shadow-none">
          <Clock size={16} className="text-emerald-500 md:text-emerald-600" />
          <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider">
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* STATS GRID - 2 Kolom di Mobile untuk Efisiensi & Estetika */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard 
            icon={Users} 
            color="emerald" 
            label="Total Siswa" 
            value={stats.totalStudents} 
            onClick={() => navigate('/guru/datasiswa')}
        />
        <StatCard 
            icon={FileText} 
            color="purple" 
            label="Tugas Masuk" 
            value={stats.tasksToday} 
            onClick={() => navigate('/guru/tugas-masuk')}
        />
        <StatCard 
            icon={CheckCircle2} 
            color="pink" 
            label="Tugas Online" 
            value={stats.onlineExamsCount} 
            onClick={() => navigate('/guru/tugas-masuk')}
        />
        {/* Status Absensi dengan indikator visual */}
        <div 
            onClick={() => navigate('/guru/absensi')}
            className="bg-white p-3.5 md:p-4 rounded-xl md:rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between h-full relative overflow-hidden group hover:border-amber-200 cursor-pointer hover:shadow-md hover:scale-[1.01] active:scale-[0.98] transition-all"
        >
            <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:scale-110 transition-transform"><ClipboardCheck size={60}/></div>
            <div className="w-9 h-9 md:w-10 md:h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-2 shadow-sm">
                <ClipboardCheck size={18} className="md:w-5 md:h-5" />
            </div>
            <div>
                <p className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Status Absensi</p>
                <div className="flex items-center gap-1.5">
                    <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
                    <p className="font-black text-slate-800 text-xs md:text-sm">Terisi</p>
                </div>
            </div>
        </div>
      </div>

      {/* MENU GRID - Responsive grid columns for professional density */}
      <div>
        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-3 ml-1">Menu Kelola</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-2.5 md:gap-3">
            {menuItems.map((item, idx) => (
            <button
                key={idx}
                onClick={() => navigate(item.path)}
                className="bg-white p-2.5 md:p-3.5 rounded-xl border border-slate-100 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all duration-300 ease-out hover:scale-[1.02] active:scale-[0.98] group text-left relative overflow-hidden flex flex-col justify-between h-full min-h-[105px] sm:min-h-[110px] md:min-h-[115px]"
            >
                <div className="absolute top-0 right-0 p-2 md:p-3 opacity-[0.02] group-hover:opacity-[0.06] transition-opacity">
                    <item.icon className="w-[35px] h-[35px] md:w-[45px] md:h-[45px]" />
                </div>

                <div>
                    <div className={`w-7 h-7 md:w-8.5 md:h-8.5 ${item.bg} ${item.text} rounded-lg flex items-center justify-center mb-2 shadow-sm group-hover:scale-105 transition-transform`}>
                        <item.icon size={14} className="md:w-4 md:h-4" />
                    </div>
                    <h3 className="font-extrabold text-slate-800 text-[10px] sm:text-[10.5px] md:text-[11.5px] leading-tight mb-0.5 group-hover:text-emerald-700 transition-colors uppercase tracking-tight">{item.title}</h3>
                    <p className="text-slate-400 text-[8.5px] sm:text-[9px] md:text-[9.5px] font-medium leading-relaxed line-clamp-2 pr-1">{item.desc}</p>
                </div>
                
                <div className="mt-2 flex justify-end">
                    <div className="bg-slate-50 p-1 md:p-1 rounded-lg text-slate-300 group-hover:text-emerald-600 group-hover:bg-emerald-50 transition-colors">
                        <ArrowRight size={10} className="md:w-3.5 md:h-3.5" />
                    </div>
                </div>
            </button>
            ))}
        </div>
      </div>
    </div>
  );
};

// Helper Komponen untuk Card Statistik
const StatCard = ({ icon: Icon, color, label, value, onClick }: any) => {
    const styles: any = {
        emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'hover:border-emerald-200' },
        purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'hover:border-purple-200' },
        pink: { bg: 'bg-pink-50', text: 'text-pink-600', border: 'hover:border-pink-200' },
        amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'hover:border-amber-200' },
    };
    const s = styles[color] || styles.emerald;

    return (
        <div 
            onClick={onClick}
            className={`bg-white p-3.5 md:p-4 rounded-xl md:rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between h-full relative overflow-hidden group transition-all ${s.border} ${onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.01] active:scale-[0.98]' : ''}`}
        >
            <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:scale-110 transition-transform"><Icon size={60}/></div>
            <div className={`w-9 h-9 md:w-10 md:h-10 ${s.bg} ${s.text} rounded-xl flex items-center justify-center mb-2 shadow-sm`}>
                <Icon size={18} className="md:w-5 md:h-5" />
            </div>
            <div>
                <p className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
                <p className="font-black text-slate-800 text-lg md:text-xl leading-none">{value}</p>
            </div>
        </div>
    );
}

export default TeacherDashboard;