import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Award, 
  ClipboardCheck, 
  FileText, 
  ShieldCheck, 
  TrendingUp, 
  Clock,
  ArrowRight,
  FileEdit,
  CheckCircle2,
  LayoutDashboard
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
    { title: 'Input Nilai', path: '/guru/nilai', icon: Award, color: 'bg-emerald-600', text: 'text-emerald-600', bg: 'bg-emerald-50', desc: 'Kelola nilai harian & ujian' },
    { title: 'Input Absensi', path: '/guru/absensi', icon: ClipboardCheck, color: 'bg-amber-600', text: 'text-amber-600', bg: 'bg-amber-50', desc: 'Rekap kehadiran harian' },
    { title: 'Cek Tugas', path: '/guru/tugas-masuk', icon: FileText, color: 'bg-purple-600', text: 'text-purple-600', bg: 'bg-purple-50', desc: 'Koreksi tugas & ujian' },
    { title: 'Bank Soal', path: '/guru/ujian', icon: FileEdit, color: 'bg-pink-600', text: 'text-pink-600', bg: 'bg-pink-50', desc: 'Buat & Kelola Soal Ujian' },
    { title: 'Laporan', path: '/guru/laporan', icon: TrendingUp, color: 'bg-red-600', text: 'text-red-600', bg: 'bg-red-50', desc: 'Export PDF & Excel' },
    { title: 'Kelola Admin', path: '/guru/admin', icon: ShieldCheck, color: 'bg-blue-600', text: 'text-blue-600', bg: 'bg-blue-50', desc: 'Manajemen akun pengajar' },
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
        <StatCard 
            icon={Users} 
            color="emerald" 
            label="Total Siswa" 
            value={stats.totalStudents} 
        />
        <StatCard 
            icon={FileText} 
            color="purple" 
            label="Tugas Masuk" 
            value={stats.tasksToday} 
        />
        <StatCard 
            icon={CheckCircle2} 
            color="pink" 
            label="Tugas Online" 
            value={stats.onlineExamsCount} 
        />
        {/* Status Absensi dengan indikator visual */}
        <div className="bg-white p-4 md:p-5 rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between h-full relative overflow-hidden group hover:border-amber-200 transition-all">
            <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:scale-110 transition-transform"><ClipboardCheck size={80}/></div>
            <div className="w-10 h-10 md:w-12 md:h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-2 shadow-sm">
                <ClipboardCheck size={20} className="md:w-6 md:h-6" />
            </div>
            <div>
                <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Status Absensi</p>
                <div className="flex items-center gap-1.5">
                    <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
                    <p className="font-black text-slate-800 text-sm md:text-lg">Terisi</p>
                </div>
            </div>
        </div>
      </div>

      {/* MENU GRID - 2 Kolom di Mobile */}
      <div>
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-3 ml-1">Menu Kelola</h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5">
            {menuItems.map((item, idx) => (
            <button
                key={idx}
                onClick={() => navigate(item.path)}
                className="bg-white p-4 md:p-6 rounded-[1.8rem] md:rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-emerald-100 transition-all group text-left relative overflow-hidden active:scale-95 flex flex-col justify-between h-full min-h-[140px] md:min-h-[160px]"
            >
                <div className="absolute top-0 right-0 p-4 md:p-6 opacity-[0.03] group-hover:opacity-10 transition-opacity">
                    <item.icon className="w-[60px] h-[60px] md:w-[80px] md:h-[80px]" />
                </div>

                <div>
                    <div className={`w-10 h-10 md:w-14 md:h-14 ${item.bg} ${item.text} rounded-2xl flex items-center justify-center mb-3 shadow-sm group-hover:scale-110 transition-transform`}>
                        <item.icon size={20} className="md:w-7 md:h-7" />
                    </div>
                    <h3 className="font-bold text-slate-800 text-xs md:text-lg leading-tight mb-1 group-hover:text-emerald-700 transition-colors">{item.title}</h3>
                    <p className="text-slate-400 text-[9px] md:text-xs font-medium leading-relaxed line-clamp-2 pr-2">{item.desc}</p>
                </div>
                
                <div className="mt-3 flex justify-end">
                    <div className="bg-slate-50 p-1.5 md:p-2 rounded-xl text-slate-300 group-hover:text-emerald-600 group-hover:bg-emerald-50 transition-colors">
                        <ArrowRight size={14} className="md:w-5 md:h-5" />
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
const StatCard = ({ icon: Icon, color, label, value }: any) => {
    const styles: any = {
        emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'hover:border-emerald-200' },
        purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'hover:border-purple-200' },
        pink: { bg: 'bg-pink-50', text: 'text-pink-600', border: 'hover:border-pink-200' },
        amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'hover:border-amber-200' },
    };
    const s = styles[color] || styles.emerald;

    return (
        <div className={`bg-white p-4 md:p-5 rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between h-full relative overflow-hidden group transition-all ${s.border}`}>
            <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:scale-110 transition-transform"><Icon size={80}/></div>
            <div className={`w-10 h-10 md:w-12 md:h-12 ${s.bg} ${s.text} rounded-2xl flex items-center justify-center mb-2 shadow-sm`}>
                <Icon size={20} className="md:w-6 md:h-6" />
            </div>
            <div>
                <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
                <p className="font-black text-slate-800 text-xl md:text-3xl leading-none">{value}</p>
            </div>
        </div>
    );
}

export default TeacherDashboard;