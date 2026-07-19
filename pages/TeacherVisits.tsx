import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Activity, 
  Calendar, 
  Users, 
  Search, 
  Trash2, 
  Filter, 
  UserPlus,
  RefreshCw, 
  UserCheck, 
  UserMinus, 
  Award, 
  BookOpen, 
  ClipboardCheck, 
  Clock, 
  ChevronLeft, 
  ChevronRight,
  TrendingUp,
  FileSpreadsheet,
  Monitor,
  Smartphone,
  Tablet,
  Globe
} from 'lucide-react';
import { db } from '../services/supabaseMock';
import Swal from 'sweetalert2';
import { Student } from '../types';
import { generateExcel } from '../utils/excelGenerator';

interface KunjunganRecord {
  id: string;
  nis: string;
  nama: string;
  kelas: string;
  halaman: string;
  timestamp: string;
  device?: string;
  browser?: string;
  duration?: number;
}

const TeacherVisits: React.FC = () => {
  const navigate = useNavigate();

  // Data States
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [visitLogs, setVisitLogs] = useState<KunjunganRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [selectedKelas, setSelectedKelas] = useState('Semua');
  const [searchName, setSearchName] = useState('');
  const [selectedHalaman, setSelectedHalaman] = useState('Semua');
  const [activeTab, setActiveTab] = useState<'log' | 'analisis'>('log'); // 'log' = Aktivitas Real-time, 'analisis' = Rangking Keaktifan

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Ambil data siswa
      const s7 = await db.getStudentsByGrade('7');
      const s8 = await db.getStudentsByGrade('8');
      const s9 = await db.getStudentsByGrade('9');
      const students = [...s7, ...s8, ...s9];
      setAllStudents(students);

      // 2. Ambil log kunjungan
      const logs = await db.getKunjungan();
      // Sort desc by timestamp
      const sortedLogs = [...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setVisitLogs(sortedLogs);
    } catch (err) {
      console.error("Gagal memuat data statistik kunjungan:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Ambil list unik kelas dari data_siswa untuk dropdown filter
  const availKelas = Array.from(new Set(allStudents.map(s => s.kelas).filter(Boolean))).sort();

  // Ambil list unik halaman yang diakses
  const availHalaman = Array.from(new Set(visitLogs.map(v => v.halaman).filter(Boolean))).sort();

  // Reset Logs / Bersihkan Statistik
  const dResetLogs = () => {
    Swal.fire({
      title: 'Hapus Semua Statistik?',
      text: 'Tindakan ini akan mengosongkan seluruh riwayat dan statistik kunjungan di website.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Bersihkan!',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      heightAuto: false,
      customClass: { popup: 'rounded-[1.5rem]' }
    }).then(async (result) => {
      if (result.isConfirmed) {
        setLoading(true);
        try {
          await db.resetKunjungan();
          Swal.fire({
            icon: 'success',
            title: 'Berhasil Direset!',
            text: 'Data statistik kunjungan telah dibersihkan sepenuhnya.',
            timer: 1500,
            showConfirmButton: false,
            heightAuto: false
          });
          loadData();
        } catch (e) {
          Swal.fire({
            icon: 'error',
            title: 'Gagal',
            text: 'Terjadi kesalahan sistem saat mereset data.',
            heightAuto: false
          });
        } finally {
          setLoading(false);
        }
      }
    });
  };

  // ----------------------------------------
  // LOGIKA TAB 1: LOG KUNJUNGAN REAL-TIME
  // ----------------------------------------
  const filteredLogs = visitLogs.filter((log) => {
    const matchKelas = selectedKelas === 'Semua' || String(log.kelas).toLowerCase() === selectedKelas.toLowerCase();
    const matchName = !searchName.trim() || String(log.nama).toLowerCase().includes(searchName.toLowerCase()) || String(log.nis).includes(searchName);
    const matchHalaman = selectedHalaman === 'Semua' || log.halaman === selectedHalaman;
    return matchKelas && matchName && matchHalaman;
  });

  // Pagination for Tab 1
  const totalLogsPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const indexOfLastLog = currentPage * itemsPerPage;
  const indexOfFirstLog = indexOfLastLog - itemsPerPage;
  const currentLogs = filteredLogs.slice(indexOfFirstLog, indexOfLastLog);

  // Format Tanggal
  const formatDateTime = (isoString: string) => {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (_) {
      return isoString;
    }
  };

  // Helper Badge Icon Halaman
  const getPageIcon = (halaman: string) => {
    switch (halaman) {
      case 'Beranda': return <Clock size={12} className="text-blue-500" />;
      case 'Materi PAI': return <BookOpen size={12} className="text-emerald-500" />;
      case 'Cek Absensi': return <ClipboardCheck size={12} className="text-amber-500" />;
      case 'Nilai Siswa': return <Award size={12} className="text-purple-500" />;
      default: return <Activity size={12} className="text-slate-500" />;
    }
  };

  // ----------------------------------------
  // LOGIKA TAB 2: ANALISIS KEAKTIFAN SISWA
  // ----------------------------------------
  // Kita ingin tahu, di antara ALL_STUDENTS, berapa kali masing-masing mengunjungi web.
  // Juga track kunjungan terakhir mereka.
  const studentAnalyticList = allStudents.map((stud) => {
    // Cari semua record kunjungan dengan NIS siswa ini
    const personalVisits = visitLogs.filter(v => String(v.nis) === String(stud.nis));
    const visitCount = personalVisits.length;
    
    // Urutkan kunjungan dari yang terbaru
    const sortedVisits = [...personalVisits].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const lastVisit = sortedVisits[0] || null;

    return {
      nis: stud.nis,
      nama: stud.namalengkap,
      kelas: stud.kelas,
      jeniskelamin: stud.jeniskelamin,
      count: visitCount,
      lastHalaman: lastVisit ? lastVisit.halaman : '-',
      lastTime: lastVisit ? lastVisit.timestamp : ''
    };
  });

  // Filter & Sort list analisis keaktifan
  const filteredAnalytics = studentAnalyticList.filter((item) => {
    const matchKelas = selectedKelas === 'Semua' || String(item.kelas).toLowerCase() === selectedKelas.toLowerCase();
    const matchName = !searchName.trim() || String(item.nama).toLowerCase().includes(searchName.toLowerCase()) || String(item.nis).includes(searchName);
    return matchKelas && matchName;
  }).sort((a, b) => b.count - a.count); // Sort descending by keaktifan (kunjungan terbanyak paling atas)

  // --- TELEMETRY CALCULATIONS ---
  // Helper Format Durasi Sesi
  const formatDuration = (seconds: number) => {
    if (!seconds) return '0d';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  // Hitung Durasi Rata-Rata Sesi
  const totalDuration = visitLogs.reduce((acc, curr) => acc + (curr.duration || 30), 0);
  const avgDuration = visitLogs.length > 0 ? Math.round(totalDuration / visitLogs.length) : 0;

  // Segmentasi Perangkat
  const deviceStats: Record<string, number> = { Mobile: 0, Desktop: 0, Tablet: 0 };
  visitLogs.forEach((v) => {
    const dev = v.device || 'Desktop';
    if (deviceStats[dev] !== undefined) {
      deviceStats[dev] = deviceStats[dev] + 1;
    } else {
      deviceStats[dev] = 1;
    }
  });

  // Segmentasi Browser
  const browserStats: Record<string, number> = {};
  visitLogs.forEach((v) => {
    const br = v.browser || 'Chrome';
    browserStats[br] = (browserStats[br] || 0) + 1;
  });

  // Hitung total ringkasan
  const summary = {
    totalKunjungan: visitLogs.length,
    unikSiswaAktif: new Set(visitLogs.filter(v => v.nis !== 'Anonim').map(v => v.nis)).size,
    belumPernah: studentAnalyticList.filter(s => s.count === 0).length,
    palingSering: studentAnalyticList.length > 0 
      ? [...studentAnalyticList].sort((a, b) => b.count - a.count)[0] 
      : null,
  };

  // Download Keaktifan ke Excel
  const handleExportExcel = async () => {
    if (filteredAnalytics.length === 0) {
      Swal.fire({
        icon: 'info',
        title: 'Data Kosong',
        text: 'Tidak ada data keaktifan untuk diexport.',
        confirmButtonColor: '#059669',
        heightAuto: false
      });
      return;
    }

    try {
      const exportData = filteredAnalytics.map((row, index) => ({
        'NO': index + 1,
        'NIS': row.nis,
        'NAMA LENGKAP': row.nama,
        'KELAS': row.kelas,
        'JUMLAH KUNJUNGAN': row.count,
        'HALAMAN TERAKHIR': row.lastHalaman,
        'AKTIVITAS TERAKHIR': row.lastTime ? formatDateTime(row.lastTime) : '-'
      }));

      const success = await generateExcel(
        exportData, 
        `Analisis_Kunjungan_Siswa_${selectedKelas}`, 
        'Keaktifan Siswa',
        {
          title: 'LAPORAN STATISTIK KEAKTIFAN SISWA',
          subTitle: 'PENDIDIKAN AGAMA ISLAM DAN BUDI PEKERTI',
          kelas: selectedKelas,
          semester: 'Semua'
        }
      );

      if (success) {
        Swal.fire({
          icon: 'success',
          title: 'Berhasil!',
          text: 'Data keaktifan siswa berhasil diekspor sebagai dokumen Excel.',
          timer: 1500,
          showConfirmButton: false,
          heightAuto: false
        });
      } else {
        throw new Error("Gagal membuat file Excel");
      }
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal',
        text: 'Terjadi kegagalan saat mengekspor data ke Excel.',
        heightAuto: false
      });
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <div>
          <button 
            onClick={() => navigate('/guru')} 
            className="group flex items-center gap-2 text-slate-700 hover:text-amber-700 transition-all text-xs font-black uppercase tracking-wider mb-2"
          >
            <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
            <span>DASHBOARD UTAMA</span>
          </button>
          <h1 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-slate-800 flex items-center gap-2 leading-tight">
            <Activity size={24} className="text-emerald-600 animate-pulse" />
            Statistik Kunjungan Web
          </h1>
          <p className="text-slate-500 text-[10px] md:text-xs font-medium leading-tight max-w-xl mt-1">
            Monitor real-time aktivitas kunjungan siswa, estimasi durasi sesi belajar, serta segmentasi perangkat & browser yang digunakan siswa secara langsung.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all active:scale-95"
            title="Muat ulang data"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button 
            onClick={dResetLogs}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-bold transition-all active:scale-95"
            title="Bersihkan log kunjungan"
          >
            <Trash2 size={14} />
            Reset Data
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white p-12 rounded-[2rem] border border-slate-100 shadow-sm text-center space-y-3">
          <div className="w-10 h-10 border-4 border-slate-100 border-t-emerald-600 rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-slate-500 font-medium">Sedang memproses & menyinkronkan statistik kunjungan...</p>
        </div>
      ) : (
        <>
          {/* Bento Grid Info Ringkasan */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Hit Total */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group">
              <div className="absolute right-3 top-3 bg-blue-50 text-blue-600 p-2 rounded-xl">
                <TrendingUp size={20} />
              </div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total Kunjungan</p>
              <h3 className="text-3xl font-black text-slate-800 mt-2">{summary.totalKunjungan}</h3>
              <p className="text-[10px] text-slate-400 font-medium mt-1">Akumulasi klik seluruh halaman</p>
            </div>

            {/* Unik Siswa Masuk */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group">
              <div className="absolute right-3 top-3 bg-emerald-50 text-emerald-600 p-2 rounded-xl">
                <UserCheck size={20} />
              </div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Siswa Aktif</p>
              <h3 className="text-3xl font-black text-emerald-600 mt-2">{summary.unikSiswaAktif}</h3>
              <p className="text-[10px] text-slate-400 font-medium mt-1">Siswa terdaftar yang pernah akses</p>
            </div>

            {/* Belum Pernah Akses */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group">
              <div className="absolute right-3 top-3 bg-red-50 text-red-600 p-2 rounded-xl">
                <UserMinus size={20} />
              </div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Belum Mengakses</p>
              <h3 className="text-3xl font-black text-red-500 mt-2">{summary.belumPernah}</h3>
              <p className="text-[10px] text-slate-400 font-medium mt-1">Siswa nihil jejak kunjungan</p>
            </div>

            {/* Teraktif */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group">
              <div className="absolute right-3 top-3 bg-amber-50 text-amber-600 p-2 rounded-xl">
                <Activity size={20} />
              </div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Siswa Teraktif</p>
              <h3 className="text-sm font-black text-slate-800 mt-2 truncate w-3/4" title={summary.palingSering ? summary.palingSering.nama : '-'}>
                {summary.palingSering && summary.palingSering.count > 0 ? summary.palingSering.nama : 'Nihil'}
              </h3>
              <p className="text-[10px] text-amber-600 font-black mt-1 uppercase">
                {summary.palingSering && summary.palingSering.count > 0 ? `• ${summary.palingSering.count} Kali Akses •` : 'Tidak Ada Aktivitas'}
              </p>
            </div>
          </div>

          {/* Segmentasi & Durasi Sesi Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Durasi Sesi Rata-Rata */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider block">Est. Interaksi Siswa</span>
                <h3 className="text-base font-black text-slate-800 mt-1">Durasi Rata-rata Sesi</h3>
                <p className="text-xs text-slate-400 mt-0.5 font-medium">Lama waktu rata-rata siswa aktif belajar di website</p>
                
                <div className="mt-6 flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-emerald-600 tracking-tight">
                    {formatDuration(avgDuration)}
                  </span>
                  <span className="text-xs text-slate-400 font-bold font-mono">per Kunjungan</span>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-50">
                <div className="flex items-center gap-2.5 text-xs text-slate-500 font-medium bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="p-1 bg-emerald-100 text-emerald-700 rounded-lg">
                    <Clock size={16} />
                  </div>
                  <span>Terlacak otomatis melalui navigasi halaman siswa aktif secara real-time.</span>
                </div>
              </div>
            </div>

            {/* Segmentasi Perangkat */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
              <div>
                <span className="text-[10px] text-indigo-700 font-bold uppercase tracking-wider block">Faktor Responsivitas</span>
                <h3 className="text-base font-black text-slate-800 mt-1">Segmentasi Perangkat</h3>
                <p className="text-xs text-slate-400 mt-0.5 font-medium">Jenis perangkat yang digunakan siswa saat mengakses</p>
              </div>

              <div className="mt-5 space-y-4">
                {Object.entries(deviceStats).map(([device, count]) => {
                  const percentage = visitLogs.length > 0 ? Math.round((count / visitLogs.length) * 100) : 0;
                  
                  // Device specific icons & colors
                  const icon = device === 'Mobile' ? <Smartphone size={16} /> : (device === 'Tablet' ? <Tablet size={16} /> : <Monitor size={16} />);
                  const colorClass = device === 'Mobile' ? 'bg-indigo-600' : (device === 'Desktop' ? 'bg-indigo-400' : 'bg-indigo-300');
                  const textClass = device === 'Mobile' ? 'text-indigo-600' : (device === 'Desktop' ? 'text-blue-500' : 'text-slate-500');
                  
                  return (
                    <div key={device} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs font-black text-slate-700">
                        <span className={`flex items-center gap-1.5 ${textClass}`}>
                          {icon}
                          {device}
                        </span>
                        <span className="font-mono">{count} Akses ({percentage}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className={`h-full ${colorClass} rounded-full transition-all duration-500`} style={{ width: `${percentage}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Segmentasi Browser */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
              <div>
                <span className="text-[10px] text-amber-700 font-bold uppercase tracking-wider block">Sertifikasi Browser</span>
                <h3 className="text-base font-black text-slate-800 mt-1">Segmentasi Browser</h3>
                <p className="text-xs text-slate-400 mt-0.5 font-medium">Aplikasi browser penjelajah yang digunakan siswa</p>
              </div>

              <div className="mt-5 space-y-3.5">
                {Object.entries(browserStats).slice(0, 5).map(([browser, count]) => {
                  const percentage = visitLogs.length > 0 ? Math.round((count / visitLogs.length) * 100) : 0;
                  const colorClass = browser === 'Chrome' ? 'bg-amber-500' : (browser === 'Safari' ? 'bg-amber-400' : (browser === 'Firefox' ? 'bg-orange-400' : (browser === 'Edge' ? 'bg-blue-400' : 'bg-slate-400')));
                  
                  return (
                    <div key={browser} className="space-y-1">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                        <span className="flex items-center gap-1.5 truncate max-w-[150px]">
                          <Globe size={14} className="text-slate-400" />
                          {browser}
                        </span>
                        <span className="font-mono text-slate-500">{count} ({percentage}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className={`h-full ${colorClass} rounded-full transition-all duration-500`} style={{ width: `${percentage}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Tab Selection Panel */}
          <div className="bg-white rounded-2xl border border-slate-100 p-1.5 shadow-sm flex gap-2">
            <button
              onClick={() => { setActiveTab('log'); setCurrentPage(1); }}
              className={`flex-1 py-3 text-xs md:text-sm font-black rounded-xl uppercase tracking-wider transition-all ${
                activeTab === 'log'
                  ? 'bg-emerald-700 text-white shadow-lg shadow-emerald-100'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              📊 Riwayat Log Masuk Web
            </button>
            <button
              onClick={() => { setActiveTab('analisis'); setCurrentPage(1); }}
              className={`flex-1 py-3 text-xs md:text-sm font-black rounded-xl uppercase tracking-wider transition-all ${
                activeTab === 'analisis'
                  ? 'bg-emerald-700 text-white shadow-lg shadow-emerald-100'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              👥 Analisis Keaktifan PerSiswa
            </button>
          </div>

          {/* Interactive Filters Panel */}
          <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
              <Filter size={14} className="text-slate-400" />
              Filter Pencarian
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Filter Kelas */}
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">Pilih Kelas</label>
                <select
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 outline-none focus:border-emerald-600 bg-white"
                  value={selectedKelas}
                  onChange={(e) => { setSelectedKelas(e.target.value); setCurrentPage(1); }}
                >
                  <option value="Semua">Semua Kelas</option>
                  {availKelas.map(k => (
                    <option key={k} value={k}>Kelas {k}</option>
                  ))}
                </select>
              </div>

              {/* Filter Nama Siswa / NIS */}
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">Nama Siswa / NIS</label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Masukkan nama atau NIS..."
                    className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-200 outline-none focus:border-emerald-600"
                    value={searchName}
                    onChange={(e) => { setSearchName(e.target.value); setCurrentPage(1); }}
                  />
                </div>
              </div>

              {/* Tab Log Specific Filter: Filter Halaman */}
              {activeTab === 'log' ? (
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">Pilih Halaman</label>
                  <select
                    className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 outline-none focus:border-emerald-600 bg-white"
                    value={selectedHalaman}
                    onChange={(e) => { setSelectedHalaman(e.target.value); setCurrentPage(1); }}
                  >
                    <option value="Semua">Semua Halaman</option>
                    {availHalaman.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ) : (
                /* Tab Analisis Specific Action: Export Excel */
                <div className="flex items-end">
                  <button
                    onClick={handleExportExcel}
                    className="w-full flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 py-3 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-all active:scale-95 border border-emerald-100"
                  >
                    <FileSpreadsheet size={16} />
                    Ekspor Excel (.xlsx)
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* MAIN OUTPUT AREA */}
          {activeTab === 'log' ? (
            /* TAB 1: LOG KUNJUNGAN REAL-TIME */
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden p-2">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-800">Catatan Aktivitas Pengunjung</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Ditemukan {filteredLogs.length} kunjungan dari filter saat ini</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="p-4 text-[10px] font-black uppercase tracking-wider text-slate-400 text-center w-12">No</th>
                      <th className="p-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Jam Masuk</th>
                      <th className="p-4 text-[10px] font-black uppercase tracking-wider text-slate-400">NIS</th>
                      <th className="p-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Siswa / Pengunjung</th>
                      <th className="p-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Kelas</th>
                      <th className="p-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Mengakses Halaman</th>
                      <th className="p-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Perangkat</th>
                      <th className="p-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Browser</th>
                      <th className="p-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Durasi Sesi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {currentLogs.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-xs text-slate-400 font-medium">
                          Nihil data kunjungan yang cocok dengan filter di atas.
                        </td>
                      </tr>
                    ) : (
                      currentLogs.map((log, index) => {
                        const globalIndex = indexOfFirstLog + index + 1;
                        const isAnonim = log.nis === 'Anonim';
                        return (
                          <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 text-xs font-bold text-slate-400 text-center">{globalIndex}</td>
                            <td className="p-4 text-xs text-slate-600 whitespace-nowrap">
                              <span className="font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] mr-1.5 font-bold">
                                {new Date(log.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {formatDateTime(log.timestamp).split(',')[0]}
                            </td>
                            <td className="p-4 text-xs font-mono font-bold text-slate-500">{log.nis}</td>
                            <td className="p-4 text-xs font-bold text-slate-800">
                              {log.nama}
                              {isAnonim && (
                                <span className="ml-2 bg-slate-100 text-[9px] text-slate-400 px-1.5 py-0.5 rounded-full font-medium">Bukan Siswa</span>
                              )}
                            </td>
                            <td className="p-4 text-xs">
                              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                                isAnonim 
                                  ? 'bg-slate-100 text-slate-500' 
                                  : 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                              }`}>
                                {isAnonim ? 'Umum' : `Kelas ${log.kelas}`}
                              </span>
                            </td>
                            <td className="p-4 text-xs whitespace-nowrap">
                              <span className="inline-flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-100 text-slate-700 font-medium text-[10px]">
                                {getPageIcon(log.halaman)}
                                {log.halaman}
                              </span>
                            </td>
                            <td className="p-4 text-xs font-bold text-indigo-700 capitalize">
                              <span className="bg-indigo-50 px-2 py-1 rounded-lg text-[10px]">
                                {log.device || 'Desktop'}
                              </span>
                            </td>
                            <td className="p-4 text-xs text-slate-600">
                              <span className="bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg text-[10px] font-mono">
                                {log.browser || 'Chrome'}
                              </span>
                            </td>
                            <td className="p-4 text-xs font-black text-emerald-700 whitespace-nowrap">
                              <span className="bg-emerald-50 px-2 py-1 rounded-lg text-[10px]">
                                {formatDuration(log.duration || 30)}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalLogsPages > 1 && (
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-4">
                  <span className="text-[10px] text-slate-400 font-bold">
                    Halaman {currentPage} dari {totalLogsPages} (Total {filteredLogs.length} Baris)
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="p-1 px-3 bg-white border border-slate-200 text-slate-600 text-xs rounded-lg hover:bg-slate-100 transition-all disabled:opacity-40 disabled:hover:bg-white font-bold"
                    >
                      Sebelumnya
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalLogsPages, prev + 1))}
                      disabled={currentPage === totalLogsPages}
                      className="p-1 px-3 bg-white border border-slate-200 text-slate-600 text-xs rounded-lg hover:bg-slate-100 transition-all disabled:opacity-40 disabled:hover:bg-white font-bold"
                    >
                      Berikutnya
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* TAB 2: ANALISIS KEAKTIFAN SISWA */
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden p-2">
              <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-black text-slate-800">Indikator Keaktifan Belajar Mandiri</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Menilai keaktifan siswa mendaftar jejak kunjungan (Berdasarkan jumlah akses)</p>
                </div>
                <div className="flex gap-2 text-[10px] font-bold">
                  <span className="flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-100">● Sangat Aktif (&ge;10)</span>
                  <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-100">● Aktif (1-9)</span>
                  <span className="flex items-center gap-1 bg-slate-100 text-slate-500 px-2 py-0.5 rounded">● Belum Pernah (0)</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="p-4 text-[10px] font-black uppercase tracking-wider text-slate-400 text-center w-12">No</th>
                      <th className="p-4 text-[10px] font-black uppercase tracking-wider text-slate-400">NIS</th>
                      <th className="p-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Nama Siswa</th>
                      <th className="p-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Kelas</th>
                      <th className="p-4 text-[10px] font-black uppercase tracking-wider text-slate-400 text-center">Frek. Kunjungan</th>
                      <th className="p-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Halaman Terakhir</th>
                      <th className="p-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Kunjungan Terakhir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredAnalytics.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-xs text-slate-400 font-medium">
                          Nihil data siswa yang cocok dengan filter di atas.
                        </td>
                      </tr>
                    ) : (
                      filteredAnalytics.map((student, index) => {
                        const isSangatAktif = student.count >= 10;
                        const isAktif = student.count > 0 && student.count < 10;
                        const isNihil = student.count === 0;

                        return (
                          <tr key={student.nis} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 text-xs font-bold text-slate-400 text-center">{index + 1}</td>
                            <td className="p-4 text-xs font-mono font-bold text-slate-500">{student.nis}</td>
                            <td className="p-4 text-xs font-bold text-slate-800">{student.nama}</td>
                            <td className="p-4 text-xs">
                              <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-100">
                                Kelas {student.kelas}
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              {isSangatAktif && (
                                <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 font-black border border-amber-100 px-3 py-1 rounded-full text-xs">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                                  {student.count} Kali (Sangat Aktif)
                                </span>
                              )}
                              {isAktif && (
                                <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 font-black border border-emerald-100 px-3 py-1 rounded-full text-xs">
                                  {student.count} Kali (Aktif)
                                </span>
                              )}
                              {isNihil && (
                                <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-400 font-bold px-3 py-1 rounded-full text-xs">
                                  0 Kali (Nihil)
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-xs">
                              {student.count > 0 ? (
                                <span className="inline-flex items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded-xl border border-slate-100 text-slate-700 font-medium text-[10px]">
                                  {getPageIcon(student.lastHalaman)}
                                  {student.lastHalaman}
                                </span>
                              ) : (
                                <span className="text-slate-300 italic">-</span>
                              )}
                            </td>
                            <td className="p-4 text-xs text-slate-500">
                              {student.lastTime ? formatDateTime(student.lastTime) : <span className="text-slate-300 italic">Belum dibuka</span>}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TeacherVisits;
