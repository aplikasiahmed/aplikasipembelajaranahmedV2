import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Calendar, Clock, BookOpen, Loader2, AlertCircle, ArrowLeft, ClipboardList } from 'lucide-react';
import { db } from '../services/supabaseMock';
import { GradeLevel, JurnalHarian } from '../types';
import Swal from 'sweetalert2';

const TeacherJournal: React.FC = () => {
  const navigate = useNavigate();
  const [grade, setGrade] = useState<GradeLevel>('7');
  const [selectedKelas, setSelectedKelas] = useState('');
  const [availableKelas, setAvailableKelas] = useState<string[]>([]);
  
  // Form fields
  const [tanggal, setTanggal] = useState('');
  const [jamMengajar, setJamMengajar] = useState('2');
  const [deskripsi, setDeskripsi] = useState('');
  
  // List of history journals
  const [journals, setJournals] = useState<JurnalHarian[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch classes
  useEffect(() => {
    db.getAvailableKelas(grade).then((data: string[]) => {
      setAvailableKelas(data);
      setSelectedKelas(data[0] || '');
    });
  }, [grade]);

  // Fetch journals history
  const fetchJournals = async () => {
    setLoading(true);
    try {
      const data = await db.getJurnalHarian();
      // Sort by latest date/created_at
      const sorted = [...data].sort((a, b) => b.created_at.localeCompare(a.created_at));
      setJournals(sorted);
    } catch (err) {
      console.error("Gagal mengambil data jurnal:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJournals();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validasi Kolom Terisi
    if (!tanggal || !selectedKelas || !jamMengajar || !deskripsi.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Perhatian',
        text: 'Semua kolom isian jurnal harian wajib diisi!',
        heightAuto: false
      });
      return;
    }

    // Validasi Tanggal di Masa Depan
    const todayStr = new Date().toLocaleDateString('en-CA'); // Get YYYY-MM-DD in local time zone
    if (tanggal > todayStr) {
      Swal.fire({
        icon: 'error',
        title: 'Tanggal Tidak Valid',
        text: 'Anda tidak dapat menyimpan jurnal pembelajaran untuk tanggal di masa depan!',
        confirmButtonColor: '#dc2626',
        heightAuto: false
      });
      return;
    }

    const result = await Swal.fire({
      title: 'Simpan Jurnal Harian?',
      text: `Menyimpan jurnal untuk Kelas ${selectedKelas}, ${jamMengajar} Jam`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#059669',
      confirmButtonText: 'Ya, Simpan',
      cancelButtonText: 'Batal',
      heightAuto: false
    });

    if (!result.isConfirmed) return;

    setSaving(true);
    try {
      await db.addJurnalHarian({
        tanggal,
        kelas: selectedKelas,
        jam_mengajar: jamMengajar,
        deskripsi: deskripsi.trim()
      });

      // Reset form
      setDeskripsi('');
      
      Swal.fire({
        icon: 'success',
        title: 'Alhamdulillah',
        text: 'Jurnal harian berhasil disimpan!',
        timer: 2000,
        showConfirmButton: false,
        heightAuto: false
      });

      // Reload history
      fetchJournals();
    } catch (error) {
      console.error("Gagal menyimpan jurnal:", error);
      Swal.fire({
        icon: 'error',
        title: 'Gagal Menyimpan',
        text: 'Terjadi kesalahan sistem saat menyimpan jurnal.',
        confirmButtonColor: '#dc2626',
        heightAuto: false
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 md:space-y-6 animate-fadeIn pb-20 px-1 md:px-0">
      <button 
        onClick={() => navigate('/guru')} 
        className="group flex items-center gap-2 text-slate-700 hover:text-emerald-700 transition-all text-xs font-black uppercase tracking-wider mb-4"
      >
        <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
        <span>DASHBOARD UTAMA</span>
      </button>

      {/* Header Banner */}
      <div className="bg-emerald-600 text-white p-4 md:p-8 rounded-2xl md:rounded-3xl shadow-lg flex items-center gap-4">
        <div className="bg-white/10 p-2 rounded-xl border border-white/20">
          <BookOpen size={24} />
        </div>
        <div>
          <h1 className="text-base md:text-2xl font-black leading-tight uppercase tracking-tighter">Jurnal Harian Guru</h1>
          <p className="text-emerald-50 text-[9px] md:text-sm mt-0.5 opacity-90">Catat dan dokumentasikan aktivitas pembelajaran harian PAI.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 items-start">
        {/* Input Form Column */}
        <form onSubmit={handleSave} className="md:col-span-1 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <h2 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-wider border-b pb-2 mb-2 flex items-center gap-1.5">
            <ClipboardList size={16} className="text-emerald-600" />
            Isi Jurnal Baru
          </h2>

          {/* Tanggal */}
          <div className="space-y-1">
            <label className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tanggal</label>
            <input 
              type="date" 
              className="w-full p-2 rounded-lg border border-slate-200 bg-white text-[10px] md:text-xs font-medium outline-none cursor-pointer focus:border-emerald-500 text-slate-600" 
              value={tanggal} 
              onChange={(e) => setTanggal(e.target.value)}
              required
            />
          </div>

          {/* Jenjang */}
          <div className="space-y-1">
            <label className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Jenjang Kelas</label>
            <div className="flex gap-1">
              {(['7', '8', '9'] as const).map((g) => (
                <button 
                  type="button"
                  key={g} 
                  onClick={() => setGrade(g)} 
                  className={`flex-1 py-1 rounded-lg text-[9px] font-black border transition-all ${grade === g ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-500 border-slate-200'}`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Pilih Kelas */}
          <div className="space-y-1">
            <label className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pilih Kelas</label>
            <select 
              className="w-full p-2 rounded-lg border border-slate-200 bg-white text-[10px] md:text-xs font-normal outline-none focus:border-emerald-500 text-slate-600" 
              value={selectedKelas} 
              onChange={(e) => setSelectedKelas(e.target.value)}
              required
            >
              <option value="">-- Kelas --</option>
              {availableKelas.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>

          {/* Jam Mengajar */}
          <div className="space-y-1">
            <label className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Jumlah Jam Mengajar</label>
            <select 
              className="w-full p-2 rounded-lg border border-slate-200 bg-white text-[10px] md:text-xs font-normal outline-none focus:border-emerald-500 text-slate-600" 
              value={jamMengajar} 
              onChange={(e) => setJamMengajar(e.target.value)}
              required
            >
              <option value="2">2 Jam</option>
              <option value="3">3 Jam</option>
              <option value="4">4 Jam</option>
              <option value="5">5 Jam</option>
              <option value="6">6 Jam</option>
            </select>
          </div>

          {/* Deskripsi Jurnal */}
          <div className="space-y-1">
            <label className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Deskripsi Jurnal Mengajar</label>
            <textarea 
              rows={4}
              placeholder="Tulis materi pembelajaran, capaian, dan catatan kelas di sini..."
              className="w-full p-2 rounded-lg border border-slate-200 bg-white text-[10px] md:text-xs font-normal outline-none focus:border-emerald-500 text-slate-600 placeholder:text-slate-300 resize-none" 
              value={deskripsi} 
              onChange={(e) => setDeskripsi(e.target.value)}
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={saving || !tanggal || !selectedKelas || !jamMengajar || !deskripsi.trim()} 
            className={`w-full py-2.5 rounded-xl font-black text-[10px] md:text-xs flex items-center justify-center gap-2 transition-all shadow-md uppercase tracking-wider ${
              saving || !tanggal || !selectedKelas || !jamMengajar || !deskripsi.trim()
                ? 'bg-slate-100 text-slate-300 border border-slate-200 cursor-not-allowed shadow-none' 
                : 'bg-emerald-600 hover:bg-emerald-700 text-white hover:scale-[1.02] active:scale-[0.98]'
            }`}
          >
            {saving ? (
              <><Loader2 size={14} className="animate-spin" /> Menyimpan...</>
            ) : (
              <><Save size={14} /> Simpan Jurnal</>
            )}
          </button>
        </form>

        {/* History List Column */}
        <div className="md:col-span-2 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col h-full min-h-[400px]">
          <h2 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-wider border-b pb-2 mb-2 flex items-center justify-between">
            <span>Riwayat Jurnal Harian</span>
            {journals.length > 0 && (
              <span className="bg-emerald-50 text-emerald-700 text-[9px] px-2 py-0.5 rounded-full font-black">
                {journals.length} Jurnal
              </span>
            )}
          </h2>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 max-h-[450px] pr-1">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={24} className="animate-spin text-emerald-600" />
              </div>
            ) : journals.length > 0 ? (
              journals.map((journal) => (
                <div key={journal.id} className="py-3 flex flex-col gap-1 hover:bg-slate-50/50 transition-all rounded-lg px-2">
                  <div className="flex items-center justify-between gap-2 text-[10px] font-bold">
                    <span className="text-slate-700 flex items-center gap-1">
                      <Calendar size={12} className="text-emerald-600" />
                      {journal.tanggal}
                    </span>
                    <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded text-[8px] font-black uppercase">
                      Kelas {journal.kelas}
                    </span>
                    <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[8px] font-black uppercase flex items-center gap-0.5">
                      <Clock size={10} />
                      {journal.jam_mengajar} Jam
                    </span>
                  </div>
                  <p className="text-[11px] md:text-xs text-slate-600 leading-relaxed mt-1 font-normal whitespace-pre-wrap">
                    {journal.deskripsi}
                  </p>
                  <span className="text-[8px] text-slate-400 font-medium self-end">
                    Diinput pada: {new Date(journal.created_at).toLocaleString('id-ID')}
                  </span>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400">
                <AlertCircle size={32} className="text-slate-200 mb-2" />
                <p className="text-[10px] font-bold">Belum ada catatan jurnal harian</p>
                <p className="text-[9px] text-slate-400 mt-1">Silakan isi formulir di samping untuk menambahkan jurnal</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherJournal;
