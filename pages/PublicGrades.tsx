import React, { useState } from 'react';
import { Search, Award, AlertCircle, Calendar } from 'lucide-react';
import { db } from '../services/supabaseMock';
import { Student, GradeRecord } from '../types';
import Swal from 'sweetalert2';

const PublicGrades: React.FC = () => {
  const [nis, setNis] = useState('');
  const [semester, setSemester] = useState('0'); // Default '0' agar muncul "Pilih Semester"
  const [student, setStudent] = useState<Student | null>(null);
  const [allGrades, setAllGrades] = useState<GradeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

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
        const studentGrades = await db.getGradesByStudent(found.id!);
        setAllGrades(studentGrades);
        
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

  // Helper untuk format tanggal 00/00/0000
  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB'); // Format dd/mm/yyyy
  };

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
        <div className="space-y-4 animate-slideUp">
          <div className="bg-emerald-700 text-white p-5 rounded-[2rem] shadow-lg flex justify-between items-center relative overflow-hidden">
             <div className="absolute right-[-10%] top-[-20%] opacity-10 pointer-events-none">
              <Award size={120} />
            </div>
            <div className="space-y-1 relative z-10">
              <p className="text-emerald-200 text-[8px] font-bold uppercase tracking-widest">DATA SISWA • SEMESTER {semester}</p>
              <h2 className="text-sm md:text-xl font-bold leading-tight uppercase tracking-tight">{student.namalengkap}</h2>
              {/* Added Gender Next to NIS */}
              <p className="text-emerald-100 text-[10px] font-medium">Kelas {student.kelas} • NIS {student.nis} • {student.jeniskelamin}</p>
            </div>
            
            {/* Rata-rata Section with Disclaimer */}
            <div className="flex flex-col items-end shrink-0 ml-2 relative z-10">
              <div className="bg-white/10 px-4 py-2 rounded-2xl border border-white/20 text-center backdrop-blur-sm w-full">
                <p className="text-[8px] uppercase font-black opacity-80 mb-0.5">Rata-rata</p>
                <p className="text-lg md:text-2xl font-black">
                  {filteredGrades.length > 0 ? (filteredGrades.reduce((a, b) => a + b.score, 0) / filteredGrades.length).toFixed(1) : '0'}
                </p>
              </div>
              <p className="text-[8px] font-normal text-white text-right italic mt-1 opacity-90">
                *nilai akan berubah sewaktu-waktu
              </p>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
            {filteredGrades.length > 0 ? (
              <div className="w-full">
                {/* REVISI: Menggunakan Table untuk Layout Lebih Rapi */}
                <div className="w-full max-h-[218px] md:max-h-[400px] overflow-y-auto overflow-x-auto scrollbar-thin">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 sticky top-0 z-10">
                      <tr>
                        <th className="p-3 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pl-4 w-1/5">Tanggal</th>
                        <th className="p-3 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 w-1/5">Penilaian</th>
                        <th className="p-3 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 w-2/5">Keterangan</th>
                        <th className="p-3 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center w-1/5">Nilai</th>
                      </tr>
                    </thead>
                    <tbody className="text-[10px] md:text-xs">
                      {filteredGrades.map((g, idx) => (
                        <tr 
                          key={g.id} 
                          className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]'}`}
                        >
                          {/* Tanggal (Format Normal) */}
                          <td className="p-2 md:p-3 text-slate-500 font-normal pl-4">
                            {formatDate(g.created_at)}
                          </td>

                          {/* Tipe Penilaian */}
                          <td className="p-2 md:p-3 font-normal text-slate-500 capitalize tracking-tight truncate">
                            {g.subject_type}
                          </td>

                          {/* Keterangan (Wrap text agar tidak terpotong) */}
                          <td className="p-2 md:p-3 text-slate-500 font-normal italic break-words leading-tight">
                            {g.description || '-'}
                          </td>

                          {/* Nilai */}
                          <td className="p-2 md:p-3 text-center">
                            <span className={`inline-block w-8 py-1 rounded-lg font-black text-[10px] md:text-xs ${g.score >= 75 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                              {g.score}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center space-y-3">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200">
                  <AlertCircle size={24} />
                </div>
                <div>
                  <p className="text-slate-800 font-black text-sm uppercase tracking-tight">Data belum tersedia</p>
                  <p className="text-slate-400 text-[10px] font-medium leading-relaxed">Guru belum menginput nilai untuk Semester {semester}.</p>
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