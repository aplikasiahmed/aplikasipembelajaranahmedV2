import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Settings, 
  ShieldAlert, 
  ArrowLeft,
  Scale,
  Plus,
  Minus,
  RefreshCw,
  Award,
  FileText,
  CheckCircle2,
  Clock,
  Layers,
  Percent,
  Save,
  AlertTriangle
} from 'lucide-react';
import Swal from 'sweetalert2';

interface GradeWeights {
  harian: number; // Nilai Tugas TP
  sts: number; // Sumatif Tengah Semester (STS)
  sas: number; // Sumatif Akhir Semester (SAS)
  kehadiran: number; // Kehadiran
  sikap: number; // Nilai Sikap
}

const TeacherWeightSettings: React.FC = () => {
  const navigate = useNavigate();
  const [weights, setWeights] = useState<GradeWeights>({ 
    harian: 35, 
    sts: 20, 
    sas: 20, 
    kehadiran: 10, 
    sikap: 15 
  });
  const [kkm, setKkm] = useState<number>(71);

  // Load weights and KKM from localStorage on mount
  useEffect(() => {
    const savedWeights = localStorage.getItem('pai_grade_weights');
    if (savedWeights) {
      try { 
        const parsed = JSON.parse(savedWeights);
        setWeights({
          harian: parsed.harian !== undefined ? Number(parsed.harian) : 35,
          sts: parsed.sts !== undefined ? Number(parsed.sts) : 20,
          sas: parsed.sas !== undefined ? Number(parsed.sas) : 20,
          kehadiran: parsed.kehadiran !== undefined ? Number(parsed.kehadiran) : 10,
          sikap: parsed.sikap !== undefined ? Number(parsed.sikap) : 15,
        });
      } catch (e) { 
        console.error("Gagal meload bobot penilaian:", e); 
      }
    }

    const savedKkm = localStorage.getItem('pai_kkm');
    if (savedKkm) {
      setKkm(Number(savedKkm));
    }
  }, []);

  const handleSaveWeights = () => {
    const total = 
      Number(weights.harian) + 
      Number(weights.sts) + 
      Number(weights.sas) + 
      Number(weights.kehadiran) + 
      Number(weights.sikap);
      
    if (total !== 100) {
      Swal.fire({
        icon: 'error',
        title: 'Bobot Tidak Valid',
        text: `Total bobot harus tepat 100%, saat ini totalnya: ${total}%`,
        confirmButtonColor: '#059669',
        heightAuto: false
      });
      return;
    }

    // Simpan ke localStorage
    localStorage.setItem('pai_grade_weights', JSON.stringify(weights));
    localStorage.setItem('pai_kkm', String(kkm));
    
    Swal.fire({ 
      icon: 'success', 
      title: 'Skema Bobot Disimpan', 
      text: 'Perubahan ini telah diterapkan dan langsung memengaruhi kalkulasi nilai rapor seluruh kelas.',
      timer: 3000, 
      showConfirmButton: true, 
      confirmButtonColor: '#059669',
      heightAuto: false 
    });
  };

  const handleSaveKkmOnly = () => {
    localStorage.setItem('pai_kkm', String(kkm));
    Swal.fire({ 
      icon: 'success', 
      title: 'Batas KKM Diperbarui', 
      text: `Nilai KKM berhasil diatur menjadi ${kkm} dan otomatis diterapkan ke seluruh interval predikat rapor siswa.`,
      timer: 3000, 
      showConfirmButton: true, 
      confirmButtonColor: '#059669',
      heightAuto: false 
    });
  };

  const adjustWeight = (key: keyof GradeWeights, amount: number) => {
    setWeights(prev => {
      const current = prev[key];
      const newVal = Math.max(0, Math.min(100, current + amount));
      return { ...prev, [key]: newVal };
    });
  };

  const adjustKkm = (amount: number) => {
    setKkm(prev => Math.max(50, Math.min(100, prev + amount)));
  };

  const resetToDefault = () => {
    Swal.fire({
      title: 'Kembalikan ke Default?',
      text: 'Skema pembobotan akan dikembalikan ke standar kurikulum (Tugas 35%, STS 20%, SAS 20%, Sikap 15%, Presensi 10%)',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ya, Reset',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#059669',
      cancelButtonColor: '#64748b',
      heightAuto: false
    }).then((result) => {
      if (result.isConfirmed) {
        setWeights({
          harian: 35,
          sts: 20,
          sas: 20,
          kehadiran: 10,
          sikap: 15
        });
        Swal.fire({
          icon: 'success',
          title: 'Direset!',
          text: 'Bobot telah dikembalikan ke skema default.',
          timer: 1500,
          showConfirmButton: false,
          heightAuto: false
        });
      }
    });
  };

  const totalCalculated = Number(weights.kehadiran) + Number(weights.sikap) + Number(weights.harian) + Number(weights.sts) + Number(weights.sas);

  // SVG Ring calculation
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, totalCalculated) / 100) * circumference;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fadeIn pb-24 px-2 md:px-0 font-sans" id="teacher-weight-settings-container">
      
      {/* HEADER BAR */}
      <div className="flex items-center justify-between pb-2">
        <button 
          onClick={() => navigate('/guru')} 
          className="group flex items-center gap-2 text-slate-700 hover:text-emerald-700 transition-all text-xs font-black uppercase tracking-wider mb-2"
          id="btn-back-to-dashboard-utama"
        >
          <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
          <span>DASHBOARD UTAMA</span>
        </button>
      </div>

      {/* JUMBOTRON HEADER */}
      <div className="bg-gradient-to-r from-teal-800 to-emerald-700 text-white p-6 md:p-8 rounded-[1.8rem] md:rounded-[2.5rem] shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none transform translate-x-4">
          <Scale size={185} />
        </div>
        <div className="relative z-10 space-y-2">
          <span className="bg-emerald-600 border border-emerald-500 text-emerald-50 text-[10px] md:text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full">
            Fitur Lanjutan Guru
          </span>
          <h1 className="text-xl md:text-3xl font-black uppercase tracking-tight">
            Bobot Penilaian Rapor
          </h1>
          <p className="text-emerald-100/90 text-xs md:text-sm font-medium max-w-2xl leading-relaxed">
            Atur skema persentase kontribusi setiap instrumen penilaian dalam penentuan skor Nilai Akhir secara akurat dan otomatis sesuai peraturan kurikulum madrasah/sekolah Anda.
          </p>
        </div>
      </div>

      {/* CORE GRID CONTENT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT PANEL: ADJUSTMENT PANEL */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white p-5 md:p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Settings className="text-slate-400" size={18} />
                <h2 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-widest">
                  Panel Pengaturan Persentase
                </h2>
              </div>
              <button 
                onClick={resetToDefault}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-emerald-700 hover:border-emerald-200 text-[10px] font-black uppercase tracking-widest transition"
              >
                <RefreshCw size={11} />
                <span>Reset Default</span>
              </button>
            </div>

            {/* SLIDERS COMPONENT LIST */}
            <div className="space-y-4">
              
              {/* COMPONENT 1: KEHADIRAN */}
              <div className="bg-slate-50 hover:bg-white p-4 rounded-2xl border border-slate-100/70 hover:border-cyan-200 hover:shadow-sm transition-all duration-300">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-cyan-100 text-cyan-800 rounded-lg">
                      <CheckCircle2 size={16} />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                        Kehadiran
                      </h3>
                      <p className="text-[9px] text-slate-400">Persentase tingkat kehadiran masuk kelas siswa</p>
                    </div>
                  </div>
                  <span className="text-sm font-black text-cyan-700 bg-cyan-50 px-2.5 py-0.5 rounded-lg border border-cyan-100">
                    {weights.kehadiran}%
                  </span>
                </div>
                
                <div className="flex items-center gap-4 mt-2">
                  <button 
                    onClick={() => adjustWeight('kehadiran', -5)}
                    className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
                  >
                    <Minus size={14} />
                  </button>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    step="5"
                    value={weights.kehadiran}
                    onChange={(e) => setWeights({ ...weights, kehadiran: parseInt(e.target.value) })}
                    className="flex-1 accent-cyan-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
                  />
                  <button 
                    onClick={() => adjustWeight('kehadiran', 5)}
                    className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* COMPONENT 2: SIKAP & PERILAKU */}
              <div className="bg-slate-50 hover:bg-white p-4 rounded-2xl border border-slate-100/70 hover:border-purple-200 hover:shadow-sm transition-all duration-300">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-purple-100 text-purple-800 rounded-lg">
                      <Award size={16} />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                        Penilaian Sikap & Perilaku
                      </h3>
                      <p className="text-[9px] text-slate-400">Nilai Kepribadian, adab & akhlak mulia</p>
                    </div>
                  </div>
                  <span className="text-sm font-black text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-lg border border-purple-100">
                    {weights.sikap}%
                  </span>
                </div>
                
                <div className="flex items-center gap-4 mt-2">
                  <button 
                    onClick={() => adjustWeight('sikap', -5)}
                    className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
                  >
                    <Minus size={14} />
                  </button>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    step="5"
                    value={weights.sikap}
                    onChange={(e) => setWeights({ ...weights, sikap: parseInt(e.target.value) })}
                    className="flex-1 accent-purple-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
                  />
                  <button 
                    onClick={() => adjustWeight('sikap', 5)}
                    className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* COMPONENT 3: TUGAS HARIAN PER TP */}
              <div className="bg-slate-50 hover:bg-white p-4 rounded-2xl border border-slate-100/70 hover:border-emerald-200 hover:shadow-sm transition-all duration-300">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
                      <FileText size={16} />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                        Tugas Harian Per TP
                      </h3>
                      <p className="text-[9px] text-slate-400">Rata-rata input nilai Tugas TP</p>
                    </div>
                  </div>
                  <span className="text-sm font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-100">
                    {weights.harian}%
                  </span>
                </div>
                
                <div className="flex items-center gap-4 mt-2">
                  <button 
                    onClick={() => adjustWeight('harian', -5)}
                    className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
                  >
                    <Minus size={14} />
                  </button>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    step="5"
                    value={weights.harian}
                    onChange={(e) => setWeights({ ...weights, harian: parseInt(e.target.value) })}
                    className="flex-1 accent-emerald-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
                  />
                  <button 
                    onClick={() => adjustWeight('harian', 5)}
                    className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* COMPONENT 4: STS */}
              <div className="bg-slate-50 hover:bg-white p-4 rounded-2xl border border-slate-100/70 hover:border-rose-200 hover:shadow-sm transition-all duration-300">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-rose-100 text-rose-800 rounded-lg">
                      <Clock size={16} />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                        Sumatif Tengah Semester (STS)
                      </h3>
                      <p className="text-[9px] text-slate-400">Nilai Ujian Tengah Semester (PTS)</p>
                    </div>
                  </div>
                  <span className="text-sm font-black text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-lg border border-rose-100">
                    {weights.sts}%
                  </span>
                </div>
                
                <div className="flex items-center gap-4 mt-2">
                  <button 
                    onClick={() => adjustWeight('sts', -5)}
                    className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
                  >
                    <Minus size={14} />
                  </button>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    step="5"
                    value={weights.sts}
                    onChange={(e) => setWeights({ ...weights, sts: parseInt(e.target.value) })}
                    className="flex-1 accent-rose-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
                  />
                  <button 
                    onClick={() => adjustWeight('sts', 5)}
                    className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* COMPONENT 5: SAS */}
              <div className="bg-slate-50 hover:bg-white p-4 rounded-2xl border border-slate-100/70 hover:border-indigo-200 hover:shadow-sm transition-all duration-300">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-100 text-indigo-800 rounded-lg">
                      <Layers size={16} />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                        Sumatif Akhir Semester (SAS)
                      </h3>
                      <p className="text-[9px] text-slate-400">Nilai Ujian Akhir Semester (PAS)</p>
                    </div>
                  </div>
                  <span className="text-sm font-black text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-100">
                    {weights.sas}%
                  </span>
                </div>
                
                <div className="flex items-center gap-4 mt-2">
                  <button 
                    onClick={() => adjustWeight('sas', -5)}
                    className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
                  >
                    <Minus size={14} />
                  </button>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    step="5"
                    value={weights.sas}
                    onChange={(e) => setWeights({ ...weights, sas: parseInt(e.target.value) })}
                    className="flex-1 accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
                  />
                  <button 
                    onClick={() => adjustWeight('sas', 5)}
                    className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

            </div>

            {/* SAVE BUTTON */}
            <div className="pt-2">
              <button 
                onClick={handleSaveWeights}
                disabled={totalCalculated !== 100}
                className={`w-full py-3.5 px-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 ${totalCalculated === 100 ? 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer' : 'bg-slate-200 text-slate-450 cursor-not-allowed'}`}
                id="btn-save-weights"
              >
                <Save size={16} />
                <span>Simpan Skema Bobot</span>
              </button>
            </div>

          </div>

          {/* PANEL PENGATURAN KKM */}
          <div className="bg-white p-5 md:p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Award className="text-slate-400" size={18} />
                <h2 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-widest">
                  Panel Pengaturan KKM Rapor
                </h2>
              </div>
            </div>

            <div className="bg-slate-50 hover:bg-white p-4 rounded-2xl border border-slate-100/70 hover:border-emerald-200 hover:shadow-sm transition-all duration-300">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
                    <Award size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                      Kriteria Ketuntasan Minimal (KKM)
                    </h3>
                    <p className="text-[9px] text-slate-400">Nilai batas ketuntasan minimum untuk hasil rapor siswa</p>
                  </div>
                </div>
                <span className="text-sm font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-100">
                  {kkm}
                </span>
              </div>
              
              <div className="flex items-center gap-4 mt-2">
                <button 
                  onClick={() => adjustKkm(-1)}
                  className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
                  type="button"
                >
                  <Minus size={14} />
                </button>
                <input 
                  type="range" 
                  min="50" 
                  max="100" 
                  step="1"
                  value={kkm}
                  onChange={(e) => setKkm(parseInt(e.target.value))}
                  className="flex-1 accent-emerald-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
                />
                <button 
                  onClick={() => adjustKkm(1)}
                  className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
                  type="button"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button 
                onClick={handleSaveKkmOnly}
                className="w-full py-3.5 px-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white cursor-pointer"
                id="btn-save-kkm"
              >
                <Save size={16} />
                <span>Simpan Nilai KKM</span>
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: VISUALIZATION & RULES */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* CARD 1: DYNAMIC WHEEL STATS */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center space-y-4">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">
              Live Tracker Akumulasi
            </h3>

            {/* CIRCULAR PROGRESS */}
            <div className="relative flex items-center justify-center">
              <svg className="w-36 h-36 transform -rotate-90">
                {/* Background Ring */}
                <circle 
                  cx="72" 
                  cy="72" 
                  r={radius} 
                  stroke="#f1f5f9" 
                  strokeWidth="10" 
                  fill="transparent" 
                />
                {/* Filled Ring */}
                <circle 
                  cx="72" 
                  cy="72" 
                  r={radius} 
                  stroke={totalCalculated === 100 ? '#059669' : '#e11d48'} 
                  strokeWidth="10" 
                  fill="transparent" 
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-500 ease-out"
                />
              </svg>
              {/* Inner Label */}
              <div className="absolute flex flex-col items-center">
                <span className="text-2xl font-black text-slate-800">{totalCalculated}%</span>
                <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">
                  Terakumulasi
                </span>
              </div>
            </div>

            {/* BALANCE ALERT STATUS */}
            {totalCalculated === 100 ? (
              <div className="bg-emerald-50 text-emerald-800 border border-emerald-100 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span>Sempurna! Total Bobot Tepat 100%</span>
              </div>
            ) : (
              <div className="bg-rose-50 text-rose-800 border border-rose-100 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 animate-pulse">
                <AlertTriangle size={16} className="text-rose-600" />
                <span>Selisih: {100 - totalCalculated}% (Sisa: {totalCalculated}%)</span>
              </div>
            )}
          </div>

          {/* CARD 2: KETENTUAN DAN PERSYARATAN */}
          <div className="bg-white p-5 md:p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <ShieldAlert className="text-amber-500" size={18} />
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">
                Kriteria &amp; Ketentuan
              </h3>
            </div>

            <div className="text-xs text-slate-600 space-y-3 leading-relaxed">
              <p>
                Sistem pembobotan ini mengikuti regulasi kurikulum evaluasi digital. Harap perhatikan hal-hal berikut:
              </p>
              <ul className="list-disc list-inside space-y-2 pl-1 font-medium text-[11px] text-slate-500">
                <li>
                  Total dari kelima komponen <strong className="text-slate-800">wajib tepat 100%</strong> untuk dapat disimpan.
                </li>
                <li>
                  Setiap kali tombol <strong className="text-slate-700">"Simpan Skema Bobot"</strong> diklik, nilai rekapitulasi rapor seluruh siswa Anda akan otomatis terhitung ulang dalam waktu kurang dari 1 detik.
                </li>
                <li>
                  Gunakan tombol <span className="px-1 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-750 text-[10px]"><RefreshCw size={8} className="inline mr-0.5" />Reset Default</span> di atas untuk mengembalikan skema evaluasi ke format ideal sistem kurikulum madrasah.
                </li>
              </ul>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};

export default TeacherWeightSettings;
