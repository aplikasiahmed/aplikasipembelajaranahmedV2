import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Users, Calendar, CheckCircle2, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { db } from '../services/supabaseMock';
import { Student, GradeLevel } from '../types';
import Swal from 'sweetalert2';

const TeacherInputAbsensi: React.FC = () => {
  const navigate = useNavigate();
  const [grade, setGrade] = useState<GradeLevel>('7');
  const [semester, setSemester] = useState(''); // Default kosong "Pilih Semester"
  const [selectedKelas, setSelectedKelas] = useState('');
  const [availableKelas, setAvailableKelas] = useState<string[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceData, setAttendanceData] = useState<Record<string, string>>({});
  
  // State Tanggal Manual (Tabel Tanggal) - Default Kosong
  const [date, setDate] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    db.getAvailableKelas(grade).then((data: string[]) => {
      setAvailableKelas(data);
      setSelectedKelas(data[0] || '');
    });
  }, [grade]);

  useEffect(() => {
    const fetchStudents = async () => {
      if (!selectedKelas) { setStudents([]); return; }
      setLoading(true);
      try {
        const data = await db.getStudentsByKelas(selectedKelas);
        setStudents(data);
        const initial: Record<string, string> = {};
        data.forEach(s => { if (s.id) initial[s.id] = 'hadir'; });
        setAttendanceData(initial);
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    fetchStudents();
  }, [selectedKelas]);

  const handleStatusChange = (studentId: string, status: string) => {
    setAttendanceData(prev => ({ ...prev, [studentId]: status }));
  };

  const handleSave = async () => {
    // 1. Validasi Kolom Kosong
    if (!selectedKelas || !date || !semester) {
      Swal.fire({ 
        icon: 'warning', 
        title: 'Perhatian', 
        text: 'Kolom kosong wajib di pilih!', 
        heightAuto: false 
      });
      return;
    }

    if (students.length === 0) { 
      Swal.fire({ icon: 'error', title: 'Siswa Tidak Ada', text: 'Pilih kelas yang memiliki data siswa.', heightAuto: false }); 
      return; 
    }
    
    // 2. Konfirmasi Sebelum Kirim
    const result = await Swal.fire({ 
      title: 'Simpan Rekap Absensi?', 
      text: `Kelas ${selectedKelas} - Semester ${semester} - Tanggal ${date}`, 
      icon: 'question', 
      showCancelButton: true, 
      confirmButtonColor: '#d97706',
      confirmButtonText: 'Ya, Simpan',
      cancelButtonText: 'Batal',
      heightAuto: false 
    });

    if (!result.isConfirmed) return;

    setSaving(true);
    try {
      const records = students.map(s => ({ 
        student_id: s.id!, 
        nis: s.nis,                      
        nama_siswa: s.namalengkap,       
        status: (attendanceData[s.id!] || 'hadir') as any, 
        date: date, 
        kelas: selectedKelas, 
        semester: String(semester) 
      }));
      
      await db.addAttendance(records);
      
      // 6. Reset Semester (Clear Content) setelah berhasil
      setSemester('');
      
      Swal.fire({ 
        icon: 'success', 
        title: 'Alhamdulillah', 
        text: `Absensi Kelas ${selectedKelas} tanggal ${date} berhasil disimpan.`, 
        timer: 2000, 
        showConfirmButton: false, 
        heightAuto: false 
      });
    } catch (error: any) {
      console.error("Save Error:", error);
      Swal.fire({ 
        icon: 'error', 
        title: 'Gagal Menyimpan', 
        text: 'Terjadi kesalahan pada sistem database.', 
        confirmButtonColor: '#dc2626',
        heightAuto: false 
      });
    } finally { 
      setSaving(false); 
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-2 md:space-y-6 animate-fadeIn pb-20 px-1 md:px-0">
      <button onClick={() => navigate('/guru')} className="md:hidden flex items-center gap-1.5 text-slate-800 text-[10px] font-black uppercase tracking-tight py-2 mb-1"><ArrowLeft size={14} /> Kembali ke Dashboard</button>
      <div className="bg-amber-600 text-white p-4 md:p-8 rounded-2xl md:rounded-3xl shadow-lg">
        <h1 className="text-base md:text-2xl font-black leading-tight uppercase tracking-tighter">Input Absensi PAI</h1>
        <p className="text-amber-50 text-[9px] md:text-sm mt-0.5 opacity-90">Masukkan kehadiran harian siswa.</p>
      </div>

      <div className="bg-white p-3 md:p-6 rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm space-y-3 md:space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="space-y-1">
            <label className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Jenjang</label>
            <div className="flex gap-1">
              {(['7', '8', '9'] as const).map((g) => (
                <button key={g} onClick={() => setGrade(g)} className={`flex-1 py-1.5 md:py-2 rounded-lg md:rounded-xl text-[9px] font-black border transition-all ${grade === g ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-500 border-slate-200'}`}>{g}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Semester</label>
            <select className="w-full p-2 rounded-lg border border-slate-200 bg-white text-[9px] md:text-xs font-normal outline-none" value={semester} onChange={(e) => setSemester(e.target.value)}>
              <option value="">-- Pilih Semester --</option>
              <option value="1">Semester 1</option>
              <option value="2">Semester 2</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pilih Kelas</label>
            <select className="w-full p-2 rounded-lg border border-slate-200 bg-white text-[9px] md:text-xs font-normal outline-none" value={selectedKelas} onChange={(e) => setSelectedKelas(e.target.value)}><option value="">-- Kelas --</option>{availableKelas.map(k => <option key={k} value={k}>{k}</option>)}</select>
          </div>
          <div className="space-y-1">
            <label className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Tanggal</label>
            <div className="relative">
              <input 
                type="date" 
                className="w-full p-1.5 md:p-2 rounded-lg border border-slate-200 bg-white text-[9px] md:text-xs font-normal outline-none cursor-pointer focus:border-amber-500 text-slate-600 placeholder:text-slate-300" 
                value={date} 
                onChange={(e) => setDate(e.target.value)}
                placeholder="pilih tanggal"
              />
            </div>
          </div>
        </div>

        <div className="border border-slate-100 rounded-xl overflow-hidden bg-white shadow-sm">
          <div className="bg-slate-50 p-2 md:p-3 border-b border-slate-100 flex justify-between items-center"><h3 className="text-[9px] md:text-xs font-bold text-slate-700 uppercase tracking-tight">Daftar Siswa {selectedKelas}</h3>{loading && <Loader2 size={12} className="animate-spin text-amber-600" />}</div>
          <div className="divide-y divide-slate-50 max-h-[350px] overflow-y-auto">
            {students.length > 0 ? students.map((s, idx) => (
              <div key={s.id || s.nis} className="p-2 md:p-4 flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-2 overflow-hidden"><div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-400 border">{idx + 1}</div><p className="text-[10px] md:text-sm font-normal text-slate-800 truncate uppercase">{s.namalengkap}</p></div>
                <div className="flex gap-1 shrink-0">{[{v:'hadir',l:'H',c:'bg-emerald-600'},{v:'sakit',l:'S',c:'bg-amber-500'},{v:'izin',l:'I',c:'bg-blue-600'},{v:'alfa',l:'A',c:'bg-red-600'}].map(o => (<button key={o.v} onClick={() => s.id && handleStatusChange(s.id, o.v)} className={`w-7 h-7 md:w-9 md:h-9 rounded-lg text-[9px] font-normal border transition-all ${attendanceData[s.id!] === o.v ? `${o.c} text-white border-transparent shadow-sm scale-105` : 'bg-white text-slate-400 border-slate-100'}`}>{o.l}</button>))}</div>
              </div>
            )) : <div className="p-10 text-center"><AlertCircle className="mx-auto text-slate-200 mb-2" size={32} /><p className="text-slate-400 text-[9px] font-bold">Pilih Kelas untuk memulai absensi</p></div>}
          </div>
        </div>

        <button onClick={handleSave} disabled={students.length === 0 || saving} className={`w-full py-3 md:py-4 rounded-xl font-black text-[10px] md:text-sm flex items-center justify-center gap-2 transition-all shadow-lg uppercase tracking-widest ${students.length > 0 && !saving ? 'bg-amber-600 hover:bg-amber-700 text-white active:scale-95' : 'bg-slate-200 text-slate-400'}`}>{saving ? <><Loader2 size={16} className="animate-spin" /> Menyimpan...</> : <><Save size={16} /> Simpan Absensi</>}</button>
      </div>
    </div>
  );
};

export default TeacherInputAbsensi;