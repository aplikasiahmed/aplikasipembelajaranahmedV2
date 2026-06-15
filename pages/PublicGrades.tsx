import React, { useState } from 'react';
import { Search, Award, AlertCircle, Calendar, BookOpen, Layers, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { db } from '../services/supabaseMock';
import { Student, GradeRecord } from '../types';
import Swal from 'sweetalert2';

const PublicGrades: React.FC = () => {
  const [nis, setNis] = useState('');
  const [semester, setSemester] = useState('0'); // Default '0' agar muncul "Pilih Semester"
  const [student, setStudent] = useState<Student | null>(null);
  const [allGrades, setAllGrades] = useState<GradeRecord[]>([]);
  const [allKelolaRecords, setAllKelolaRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [openTps, setOpenTps] = useState<Record<string, boolean>>({});

  const toggleTp = (id: string) => {
    setOpenTps(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validasi Semester Wajib Dipilih
    if (semester === '0') {
      Swal.fire({ 
        icon: 'warning', 
        title: 'Pilih Semester', 
        text: 'Silakan pilih semester terlebih dahulu!', 
        confirmButtonColor: '#059669', 
        heightAuto: false 
      });
      return;
    }

    if (!nis.trim()) {
      Swal.fire({ icon: 'warning', title: 'NIS Kosong', text: 'Silakan masukkan nomor NIS Anda!', confirmButtonColor: '#059669', heightAuto: false });
      return;
    }

    setLoading(true);
    setHasSearched(true);
    try {
      const found = await db.getStudentByNIS(nis);
      if (found) {
        setStudent(found);
        
        // 1. Ambil data nilai standard dari table "Nilai"
        const studentGrades = await db.getGradesByStudent(found.id!);
        setAllGrades(studentGrades);

        // 2. Ambil data Kelola Nilai dari table "kelola_nilai" untuk pencocokan real-time
        const kList = await db.getKelolaNilai();
        const studentKelola = kList.filter(item => String(item.student_id) === String(found.id));
        setAllKelolaRecords(studentKelola);
        
        Swal.fire({ 
            toast: true, 
            position: 'top-end', 
            icon: 'success', 
            title: `Halo, ${found.namalengkap}`, 
            text: ``,
            showConfirmButton: false, 
            timer: 2500 
        });
      
      } else {
        setStudent(null);
        setAllGrades([]);
        setAllKelolaRecords([]);
        Swal.fire({ icon: 'error', title: 'Gagal', text: 'Nomor NIS tidak terdaftar.', confirmButtonColor: '#059669', heightAuto: false });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Filter dan Sort Data berdasarkan Tanggal (Ascending/Berurutan)
  const filteredGrades = allGrades
    .filter(g => String(g.semester) === String(semester))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  // Helper untuk format tanggal dd/mm/yyyy
  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB'); // Format dd/mm/yyyy
  };

  // --- DYNAMIC CALCULATIONS & INTEGRATION WITH SPREADSHEET/LEDGER MODE ---
  const kelolaRecord = allKelolaRecords.find(item => String(item.semester) === String(semester));

  // Ambil state ledger PAI dari localStorage yang sinkron dengan guru
  const savedTps = localStorage.getItem('pai_grades_tps');
  const savedAsms = localStorage.getItem('pai_grades_assessments');
  const savedTpScores = localStorage.getItem('pai_grades_tp_scores');
  const savedWeights = localStorage.getItem('pai_grade_weights');

  const localTps = savedTps ? JSON.parse(savedTps) : [];
  const localAsms = savedAsms ? JSON.parse(savedAsms) : [];
  const localTpScores = savedTpScores ? JSON.parse(savedTpScores) : {};
  const localWeights = savedWeights ? JSON.parse(savedWeights) : { harian: 35, sts: 20, sas: 20, kehadiran: 10, sikap: 15 };

  const studentGradeLevel = student?.kelas ? String(student.kelas).trim().charAt(0) : '7';

  // Helper resolve details dari penilaian / tugas guru yang diambil dari JENIS PENILAIAN pada kelola-nilai
  const resolveAssignmentDetails = (g: GradeRecord) => {
    if (g.subject_type === 'harian' || g.subject_type === 'praktik') {
      const asm = localAsms.find((a: any) => String(a.id) === String(g.description));
      if (asm) {
        return {
          taskName: asm.name || 'Tugas',
          jenisPenilaian: asm.type || (g.subject_type === 'praktik' ? 'Praktik' : 'Harian')
        };
      }
    }
    const normalizedType = String(g.subject_type).toLowerCase();
    const typeLabel = normalizedType === 'uts' ? 'Sumatif Tengah Semester (STS)' :
                      normalizedType === 'uas' ? 'Sumatif Akhir Semester (SAS)' :
                      normalizedType === 'praktik' ? 'Praktik' : 'Sumatif Harian';
    return {
      taskName: g.description && !g.description.includes('asm-') ? g.description : typeLabel,
      jenisPenilaian: typeLabel
    };
  };

  // Filter TPs yang sesuai dengan level kelas dan semester siswa saat ini dan diurutkan dari TP 1
  const currentClassTps = localTps
    .filter((t: any) => t.grade === studentGradeLevel && String(t.semester) === String(semester))
    .sort((a: any, b: any) => {
      const codeA = String(a.code || '').toLowerCase();
      const codeB = String(b.code || '').toLowerCase();
      return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
    });

  // Fungsi pengitung nilai real-time per TP
  const getTpScore = (tpId: string) => {
    const relatedAsms = localAsms.filter((a: any) => a.tpId === tpId);
    if (relatedAsms.length === 0) return null;

    let sum = 0;
    let count = 0;
    relatedAsms.forEach((asm: any) => {
      const scoreKey = `${student?.id}_${asm.id}`;
      const scoreVal = localTpScores[scoreKey];
      if (scoreVal !== undefined && scoreVal !== null && scoreVal !== '') {
        sum += Number(scoreVal);
        count++;
      }
    });

    return count > 0 ? parseFloat((sum / count).toFixed(1)) : null;
  };

  // Nilai Harian (Rata-rata seluruh TP)
  const getNilaiHarian = () => {
    if (currentClassTps.length === 0) return null;

    let sum = 0;
    let count = 0;

    currentClassTps.forEach((tp: any) => {
      const tpScore = getTpScore(tp.id);
      if (tpScore !== null) {
        sum += tpScore;
        count++;
      }
    });

    return count > 0 ? parseFloat((sum / count).toFixed(1)) : null;
  };

  const harian = getNilaiHarian();

  // Ambil detail overalls dari localStorage
  const overallKey = `${student?.id}_${semester}`;
  const localOveralls = localStorage.getItem('pai_grades_overalls') ? JSON.parse(localStorage.getItem('pai_grades_overalls')!) : {};
  const localOver = localOveralls[overallKey] || {};

  // Resolve nilai STS, SAS, kehadiran, sikap dari database/Google Sheets, atau local state sebagai fallback
  const stsVal = (kelolaRecord && (kelolaRecord.sts !== '' && kelolaRecord.sts !== null)) ? Number(kelolaRecord.sts) : (localOver.sts !== '' && localOver.sts !== undefined ? Number(localOver.sts) : null);
  const sasVal = (kelolaRecord && (kelolaRecord.sas !== '' && kelolaRecord.sas !== null)) ? Number(kelolaRecord.sas) : (localOver.sas !== '' && localOver.sas !== undefined ? Number(localOver.sas) : null);
  
  const sakit = kelolaRecord ? (kelolaRecord.sakit || 0) : (localOver.kehadiran?.sakit || 0);
  const izin = kelolaRecord ? (kelolaRecord.izin || 0) : (localOver.kehadiran?.izin || 0);
  const alpha = kelolaRecord ? (kelolaRecord.alpha || 0) : (localOver.kehadiran?.alpha || 0);

  const getAttendanceScore = (sk: number, iz: number, al: number): number => {
    const deduction = (sk * 1) + (iz * 2) + (al * 5);
    return Math.max(0, 100 - deduction);
  };
  const kehadiranScore = getAttendanceScore(sakit, izin, alpha);

  const sikapStr = kelolaRecord ? (kelolaRecord.sikap || '') : (localOver.sikap || '');
  const getAttitudeScore = (s: string, nh: number | null): number => {
    if (s === 'Sangat Baik') return 95;
    if (s === 'Baik') return 85;
    if (s === 'Cukup') return 75;
    if (s === 'Perlu Bimbingan') return 60;
    return nh !== null ? Math.round(nh) : 85;
  };
  const sikapScore = getAttitudeScore(sikapStr, harian);

  const katrol = (kelolaRecord && (kelolaRecord.katrol !== '' && kelolaRecord.katrol !== null)) ? Number(kelolaRecord.katrol) : (localOver.katrol !== '' && localOver.katrol !== undefined ? Number(localOver.katrol) : 0);

  // RATA-RATA REAL (INTEGRATIVE / SPREADSHEET LEDGER):
  // Menjumlahkan harian, STS, SAS, kehadiran, sikap dan membaginya dengan 5
  const rawHarian = harian !== null ? harian : (kelolaRecord && kelolaRecord.harian ? Number(kelolaRecord.harian) : null);
  
  const realAverage = (() => {
    if (rawHarian !== null) {
      const h = rawHarian;
      const t = stsVal ?? 0;
      const s = sasVal ?? 0;
      const k = kehadiranScore;
      const sk = sikapScore;
      return parseFloat(((h + t + s + k + sk) / 5).toFixed(1));
    }
    // Fallback ke baris Rata-Rata Ledger synched di tabel Nilai
    const ledgerEntry = filteredGrades.find(g => g.description && g.description.includes('Rata-Rata Ledger'));
    if (ledgerEntry) return ledgerEntry.score;

    // Fallback terakhir: Rata-Rata aritmatika tabel Nilai
    if (filteredGrades.length > 0) {
      return parseFloat((filteredGrades.reduce((a, b) => a + b.score, 0) / filteredGrades.length).toFixed(1));
    }
    return 0;
  })();

  // NILAI AKHIR RAPOR (INTEGRATIVE / WEIGHTED):
  const realNilaiAkhir = (() => {
    if (kelolaRecord && kelolaRecord.nilai_akhir !== '' && kelolaRecord.nilai_akhir !== null) {
      return Number(kelolaRecord.nilai_akhir);
    }
    if (rawHarian !== null) {
      const wHarian = (localWeights.harian ?? 35) / 100;
      const wSts = (localWeights.sts ?? 20) / 100;
      const wSas = (localWeights.sas ?? 20) / 100;
      const wKehadiran = (localWeights.kehadiran ?? 10) / 100;
      const wSikap = (localWeights.sikap ?? 15) / 100;

      const result = 
        (rawHarian * wHarian) + 
        ((stsVal ?? 0) * wSts) + 
        ((sasVal ?? 0) * wSas) + 
        (kehadiranScore * wKehadiran) + 
        (sikapScore * wSikap);

      return Math.min(100, Math.max(0, Math.round(result) + katrol));
    }
    // Fallback ke baris Nilai Akhir synched di tabel Nilai
    const naEntry = filteredGrades.find(g => g.description && g.description.includes('Nilai Akhir Rapor'));
    if (naEntry) return naEntry.score;
    return null;
  })();

  // PREDIKAT & DESKRIPSI CAPAIAN KOMPETENSI (Sangat Memahami & Perlu Bimbingan)
  const getStudentPredicateAndDesc = (finalScore: number | null): { pred: string; desc: string } => {
    if (finalScore === null) return { pred: '-', desc: '-' };
    let pred = 'D';
    if (finalScore >= 91) pred = 'A';
    else if (finalScore >= 81) pred = 'B';
    else if (finalScore >= 71) pred = 'C';

    const fallbackDesc: Record<string, string> = {
      'A': 'Menunjukkan penguasaan materi yang sangat baik pada seluruh tujuan pembelajaran.',
      'B': 'Menunjukkan penguasaan materi yang baik pada sebagian besar tujuan pembelajaran.',
      'C': 'Menunjukkan penguasaan materi yang cukup dan perlu peningkatan pada beberapa tujuan pembelajaran.',
      'D': 'Memerlukan bimbingan dan penguatan meningkatkan kompetensi tujuan pembelajaran.'
    };

    if (currentClassTps.length === 0) {
      return { pred, desc: fallbackDesc[pred] };
    }

    const tpEvaluations = currentClassTps
      .map((tp: any) => {
        const val = getTpScore(tp.id);
        return { tp, score: val };
      })
      .filter((item): item is { tp: any, score: number } => item.score !== null);

    if (tpEvaluations.length === 0) {
      return { pred, desc: fallbackDesc[pred] };
    }

    tpEvaluations.sort((a, b) => b.score - a.score);
    const maxEval = tpEvaluations[0];
    const minEval = tpEvaluations[tpEvaluations.length - 1];

    let desc = '';
    if (maxEval.score >= 75) {
      desc += `Sangat memahami ${maxEval.tp.name || maxEval.tp.description}`;
    } else {
      desc += `Cukup memahami ${maxEval.tp.name || maxEval.tp.description}`;
    }

    if (minEval && minEval.tp.id !== maxEval.tp.id && minEval.score < 80) {
      desc += `, namun masih perlu bimbingan/peningkatan dalam hal ${minEval.tp.name || minEval.tp.description}.`;
    } else {
      desc += `, serta konsisten menunjukkan penguasaan yang baik pada seluruh indikator lainnya.`;
    }

    return { pred, desc };
  };

  const finalPredObj = getStudentPredicateAndDesc(realNilaiAkhir);

  return (
    <div className="max-w-2xl mx-auto space-y-4 md:space-y-6 animate-fadeIn pb-10 px-1 md:px-0">
      <div className="text-center space-y-1">
        <h1 className="text-xl md:text-2xl font-black text-slate-800 uppercase tracking-tight">Cek Nilai Siswa</h1>
        <p className="text-[10px] md:text-xs text-slate-500 font-medium tracking-tight">Pilih Semester & masukkan NIS untuk melihat nilai.</p>
      </div>

      <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100">
        <form onSubmit={handleSearch} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <select 
              className="w-full px-4 py-3 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 font-normal outline-none focus:ring-2 focus:ring-emerald-500/10"
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
            >
              <option value="0">Pilih Semester</option>
              <option value="1">Semester 1 (Ganjil)</option>
              <option value="2">Semester 2 (Genap)</option>
            </select>
            
            <div className="relative md:col-span-2">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input 
                type="text" 
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Masukkan nomor NIS siswa" 
                className="w-full pl-10 pr-4 py-3 text-xs rounded-xl border border-slate-200 bg-white text-slate-900 font-normal outline-none focus:border-emerald-500 transition-all shadow-sm"
                value={nis}
                onChange={(e) => setNis(e.target.value.replace(/[^0-9]/g, ''))}
              />
            </div>
          </div>
          <button type="submit" disabled={loading} className="w-full bg-emerald-700 text-white px-5 py-3.5 rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest hover:bg-emerald-800 active:scale-95 shadow-lg shadow-emerald-700/20 flex items-center justify-center gap-2 transition-all">
            {loading ? 'Mencari...' : <><Search size={14} /> CARI NILAI SAYA</>}
          </button>
        </form>
      </div>

      {hasSearched && student && (
        <div className="space-y-4 md:space-y-6 animate-slideUp">
          
          {/* USER CARD PROFILE AND LEADER METRICS */}
          <div className="bg-gradient-to-br from-emerald-700 to-emerald-800 text-white p-5 md:p-6 rounded-[2rem] shadow-lg flex flex-col md:flex-row justify-between gap-4 items-start md:items-center relative overflow-hidden">
            <div className="absolute right-[-10%] top-[-20%] opacity-10 pointer-events-none">
              <Award size={120} />
            </div>
            <div className="space-y-1.5 relative z-10 w-full md:w-auto">
              <p className="text-emerald-200 text-[8px] md:text-[9px] font-extrabold uppercase tracking-widest bg-emerald-900/40 w-max px-3 py-1 rounded-full border border-emerald-500/20">
                PENCARIAN BERHASIL • SEMESTER {semester === '1' ? '1' : '2'}
              </p>
              <h2 className="text-base md:text-xl font-bold leading-tight uppercase tracking-tight">{student.namalengkap}</h2>
              <p className="text-emerald-100 text-[10px] md:text-xs font-semibold opacity-90">Kelas {student.kelas} • NIS {student.nis} • {student.jeniskelamin}</p>
            </div>
            
            {/* Rata-rata section */}
            <div className="flex gap-2.5 items-center relative z-10 w-full md:w-auto shrink-0 mt-2 md:mt-0">
              <div className="bg-white/15 px-5 py-3 rounded-2xl border border-white/25 text-center backdrop-blur-sm w-full md:w-auto min-w-[110px]">
                <p className="text-[8px] md:text-[9px] uppercase font-black text-emerald-100 mb-0.5 tracking-wider whitespace-nowrap">NILAI AKHIR</p>
                <p className="text-lg md:text-2xl font-black text-white leading-none">
                  {(realNilaiAkhir !== null ? realNilaiAkhir : (realAverage ?? 0)).toFixed(1)}
                </p>
              </div>
            </div>
          </div>

          {/* DETAIL NILAI TUJUAN PEMBELAJARAN (TP) WITh DETAILED ASSESSMENTS */}
          {currentClassTps.length > 0 ? (
            <div className="bg-white p-4 md:p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-50 pb-3">
                <BookOpen className="text-emerald-700" size={16} />
                <h3 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-wider">Rincian Nilai per Tugas TP</h3>
              </div>
              <div className="space-y-4">
                {currentClassTps.map((tp) => {
                  const tpScore = getTpScore(tp.id);
                  const relatedAsms = localAsms.filter((a: any) => String(a.tpId) === String(tp.id));

                  return (
                    <div key={tp.id} className="bg-slate-50/50 p-4 rounded-3xl border border-slate-100/70 space-y-3">
                      {/* TP Header */}
                      <div 
                        onClick={() => toggleTp(tp.id)}
                        className="flex justify-between items-start gap-4 cursor-pointer hover:bg-slate-200/20 p-1.5 -m-1.5 rounded-2xl transition-all"
                      >
                        <div className="space-y-1">
                          <span className="text-[8px] font-black uppercase text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
                            {tp.code}
                          </span>
                          <h4 className="text-[11px] md:text-xs font-bold text-slate-800 uppercase leading-snug mt-1">
                            {tp.name || tp.description}
                          </h4>
                          <p className="text-[9px] text-slate-400 font-semibold leading-relaxed italic">{tp.description}</p>
                        </div>
                        <div className="text-right shrink-0 flex items-center gap-2">
                          <div className={`px-2.5 py-1.5 rounded-xl font-black text-[9px] md:text-[10px] shadow-sm ${tpScore !== null ? (tpScore >= 75 ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white') : 'bg-slate-200 text-slate-500'}`}>
                            RATA-RATA: {tpScore !== null ? tpScore : '-'}
                          </div>
                          <div className="p-1 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
                            {openTps[tp.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </div>
                        </div>
                      </div>

                      {/* Assessments list under this TP */}
                      {openTps[tp.id] && (
                        <div className="space-y-2 pt-2 border-t border-slate-100 pl-1 md:pl-2 animate-fadeIn">
                          {relatedAsms.length > 0 ? (
                            relatedAsms.map((asm: any) => {
                              const scoreKey = `${student?.id}_${asm.id}`;
                              const scoreVal = localTpScores[scoreKey];
                              const hasScore = scoreVal !== undefined && scoreVal !== null && scoreVal !== '';
                              
                              return (
                                <div key={asm.id} className="flex justify-between items-center bg-white p-2.5 md:p-3 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                                  <div className="space-y-0.5 max-w-[75%]">
                                    <p className="text-[10px] md:text-xs font-bold text-slate-700 leading-snug">{asm.name}</p>
                                    <span className="inline-block px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[7px] font-black uppercase rounded mt-0.5">
                                      {asm.type || 'Harian'}
                                    </span>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <span className={`inline-block min-w-[28px] text-center px-2 py-1 rounded-xl text-xs font-black ${hasScore ? (Number(scoreVal) >= 75 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100') : 'bg-slate-50 text-slate-300'}`}>
                                      {hasScore ? scoreVal : '-'}
                                    </span>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-[9px] text-slate-400 italic pl-1">Belum ada tugas/asesmen untuk kompetensi TP ini.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 text-center space-y-1.5">
              <Layers className="mx-auto text-slate-300" size={32} />
              <p className="text-[11px] font-black text-slate-700 uppercase">Nilai TP Belum Diatur</p>
              <p className="text-[9px] text-slate-400 leading-relaxed max-w-sm mx-auto">Guru belum mengatur kompetensi TP di dashboard ledger untuk kelas level ini.</p>
            </div>
          )}

          {/* LAINNYA & CATATAN TUGAS PENILAIAN */}
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-100">
              <h3 className="text-xs md:text-sm font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar size={14} /> Riwayat Penilaian Masuk
              </h3>
            </div>
            
            {filteredGrades.length > 0 ? (
              <div className="w-full">
                {/* Desktop View Table */}
                <div className="hidden md:block w-full max-h-[400px] overflow-y-auto overflow-x-auto scrollbar-thin">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-100">
                      <tr>
                        <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pl-4 w-1/5">Tanggal</th>
                        <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 w-2/5">Penilaian / Tugas</th>
                        <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 w-1/5">Keterangan</th>
                        <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center w-1/5">Nilai</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs">
                      {filteredGrades.map((g, idx) => {
                        const details = resolveAssignmentDetails(g);
                        return (
                          <tr 
                            key={g.id} 
                            className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]'}`}
                          >
                            <td className="p-3 text-slate-500 font-normal pl-4">
                              {formatDate(g.created_at)}
                            </td>
                            <td className="p-3 font-semibold text-slate-700 capitalize tracking-tight truncate max-w-[180px]">
                              {details.taskName}
                            </td>
                            <td className="p-3 text-slate-500 font-medium italic break-words leading-tight">
                              {details.jenisPenilaian}
                            </td>
                            <td className="p-3 text-center">
                              <span className={`inline-block w-8 py-1 rounded-lg font-black text-center text-xs ${g.score >= 75 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100/50' : 'bg-amber-50 text-amber-600 border border-amber-100/50'}`}>
                                {g.score}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View Card Stack (Professional Mobile Ideal) */}
                <div className="block md:hidden divide-y divide-slate-105 max-h-[350px] overflow-y-auto scrollbar-thin">
                  {filteredGrades.map((g) => {
                    const details = resolveAssignmentDetails(g);
                    return (
                      <div key={g.id} className="p-4 space-y-2 hover:bg-slate-50/50 transition-colors bg-white">
                        <div className="flex justify-between items-start">
                          <div className="space-y-0.5">
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">
                              {formatDate(g.created_at)}
                            </span>
                            <h4 className="text-[11px] font-bold text-slate-800 leading-tight">
                              {details.taskName}
                            </h4>
                          </div>
                          <span className={`inline-block px-2.5 py-1 rounded-xl font-black text-[11px] shadow-sm ${g.score >= 75 ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'}`}>
                            {g.score}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[9px] text-slate-500 font-medium italic">
                          <span>Keterangan Jenis:</span>
                          <span className="text-emerald-700 font-semibold">{details.jenisPenilaian}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-12 text-center space-y-3">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200">
                  <AlertCircle size={24} />
                </div>
                <div>
                  <p className="text-slate-800 font-black text-sm uppercase tracking-tight">Rincian Riwayat Kosong</p>
                  <p className="text-slate-400 text-[10px] font-medium leading-relaxed">Belum ada riwayat manual terdaftar.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicGrades;
