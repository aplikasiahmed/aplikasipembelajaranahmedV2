import React, { useState, useEffect, useRef } from 'react';
import { Search, Timer, CheckCircle, ShieldAlert, LogOut, ChevronLeft, ChevronRight, Flag, Grid, User, Calendar, X, ArrowRight, BookOpen, AlertTriangle, Loader2, HelpCircle, AlertOctagon, Clock, LogIn } from 'lucide-react';
import { db } from '../services/supabaseMock';
import { Student, Exam, Question } from '../types';
import Swal from 'sweetalert2';

const PublicExam: React.FC = () => {
  // --- STATES UTAMA ---
  const [step, setStep] = useState<'public_list' | 'exam' | 'result'>('public_list');
  
  // Data User & Ujian
  const [nis, setNis] = useState('');
  const [loginSemester, setLoginSemester] = useState('0'); // NEW: State Semester Login
  const [student, setStudent] = useState<Student | null>(null);
  const [activeExams, setActiveExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [loadingLogin, setLoadingLogin] = useState(false);
  
  // UI State
  const [showLoginModal, setShowLoginModal] = useState(false); // NEW: Modal Login State

  // State Pengerjaan
  const [answers, setAnswers] = useState<Record<string, string>>({}); 
  const [timeLeft, setTimeLeft] = useState(0); 
  const [score, setScore] = useState(0);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set());
  const [showNavMobile, setShowNavMobile] = useState(false);
  const [startTime, setStartTime] = useState<string>('');

  // --- MODAL STATES (PENGGANTI SWEETALERT) ---
  const [violationCount, setViolationCount] = useState(0); 
  const [showViolationModal, setShowViolationModal] = useState(false); 
  const [showFinishModal, setShowFinishModal] = useState(false); // Modal Konfirmasi Selesai
  const [isSubmitting, setIsSubmitting] = useState(false); // Loading Submit
  
  // Refs untuk logika realtime tanpa render ulang
  const violationRef = useRef(0); 
  const isPaused = useRef(false); // Kunci sensor utama

  // --- HELPER: SHUFFLE ARRAY (PENGACAK SOAL) ---
  const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  // --- 0. FETCH ALL ACTIVE EXAMS ON MOUNT (NEW FLOW) ---
  useEffect(() => {
    const fetchActiveExams = async () => {
        setLoadingExams(true);
        const exams = await db.getAllActiveExams();
        setActiveExams(exams);
        setLoadingExams(false);
    };
    fetchActiveExams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- 1. RESTORE SESSION ---
  useEffect(() => {
    const savedSession = localStorage.getItem('pai_exam_session');
    if (savedSession) {
        try {
            const session = JSON.parse(savedSession);
            const now = new Date().getTime();
            const end = new Date(session.endTime).getTime();
            const remaining = Math.floor((end - now) / 1000);

            if (remaining > 0) {
                setStudent(session.student);
                setSelectedExam(session.exam);
                setQuestions(session.questions);
                setAnswers(session.answers || {});
                setStartTime(session.startTime);
                setTimeLeft(remaining);
                setStep('exam');
                setViolationCount(session.violationCount || 0);
                violationRef.current = session.violationCount || 0;
            } else {
                localStorage.removeItem('pai_exam_session');
            }
        } catch (e) {
            localStorage.removeItem('pai_exam_session');
        }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- 2. UPDATE SESSION ---
  useEffect(() => {
    if (step === 'exam' && selectedExam && student) {
        const endTime = new Date(new Date(startTime).getTime() + selectedExam.duration * 60000).toISOString();
        const sessionData = {
            student,
            exam: selectedExam,
            questions,
            answers,
            startTime,
            endTime, 
            violationCount: violationRef.current
        };
        localStorage.setItem('pai_exam_session', JSON.stringify(sessionData));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, violationCount, step, selectedExam, student, questions, startTime]); 

  // --- HANDLERS: NEW FLOW LOGIC ---

  const handleExamClick = (exam: Exam) => {
      setSelectedExam(exam);
      setNis(''); // Reset NIS
      setLoginSemester('0'); // Reset Semester
      setLoadingLogin(false); // Reset Loading State agar tidak stuck jika sebelumnya cancel
      setShowLoginModal(true); // Tampilkan Modal Login
  };

  const handleCloseLoginModal = () => {
      setShowLoginModal(false);
      setSelectedExam(null);
  };

  const handleLoginAndStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExam) return;

    // Helper untuk Error & Close Modal
    const failLogin = (text: string) => {
        setLoadingLogin(false);
        setShowLoginModal(false);
        setSelectedExam(null); // Reset agar modal tertutup sepenuhnya secara konsep
        
        Swal.fire({
            icon: 'error',
            title: 'Gagal Masuk',
            text: text,
            position: 'center', // REVISI: Kembali ke tengah layar
            timer: 3000,
            showConfirmButton: false,
            customClass: {
                popup: 'rounded-2xl'
            }
        });
    };

    // VALIDASI SEMESTER
    if (loginSemester === '0') {
        failLogin('Silakan pilih semester terlebih dahulu.');
        return;
    }
    // CEK KECOCOKAN SEMESTER
    if (loginSemester !== selectedExam.semester) {
        failLogin(`Soal ini untuk Semester ${selectedExam.semester}, Anda memilih Semester ${loginSemester}.`);
        return;
    }

    if (!nis.trim()) {
        failLogin('Masukkan Nomor Induk Siswa.');
        return;
    }

    setLoadingLogin(true);
    try {
      // 1. Cek Siswa di DB
      const s = await db.getStudentByNIS(nis);
      
      if (!s) {
        failLogin('NIS Tidak Ditemukan. Periksa kembali.');
        return;
      }

      // 2. Validasi Kelas Siswa vs Kelas Ujian (PENTING!)
      const studentGrade = s.kelas ? s.kelas.charAt(0) : ''; 
      if (studentGrade !== selectedExam.grade) {
          failLogin(`Soal untuk Kelas ${selectedExam.grade}, Anda Kelas ${s.kelas}.`);
          return;
      }

      setStudent(s);

      // 3. Cek Apakah Sudah Mengerjakan
      const hasTaken = await db.checkStudentExamResult(s.nis, selectedExam.id);
      if (hasTaken) {
          failLogin('Anda sudah mengerjakan soal ini (Hanya 1x).');
          return;
      }

      // 4. Ambil Soal
      const q = await db.getQuestionsByExamId(selectedExam.id);
      if (q.length === 0) {
        failLogin('Soal belum tersedia untuk ujian ini.');
        return;
      }

      // TUTUP MODAL LOGIN DULU (Login Berhasil)
      setShowLoginModal(false);

      // 5. Tampilkan Peraturan (Rules)
      const rules = await Swal.fire({
        title: `Halo, ${s.namalengkap}`,
        html: `
          <div class="text-left space-y-2 mt-2">
              <p class="text-xs text-center text-emerald-600 mb-2 font-bold">Anda akan mengerjakan: ${selectedExam.title}</p>
              <div class="bg-red-50 border border-red-100 p-3 rounded-xl flex gap-3">
                  <div class="text-red-500 shrink-0"><ShieldAlert size={24} /></div>
                  <div>
                      <h4 class="font-bold text-red-600 text-sm text-center">DILARANG CURANG!</h4>
                      <p class="text-xs text-red-500 leading-tight text-center mt-1">Sistem mendeteksi jika Anda membuka Google, Ai, WA, atau lainya.</p>
                  </div>
              </div>
              <ul class="text-xs space-y-1 text-slate-600 list-disc pl-4 font-medium">
                  <li>Soal hanya dapat siswa kerjakan 1x.</li>
                  <li>Dilarang Screenshoot soal & menyebarluaskan.</li>
                  <li>Dilarang keluar dari halaman soal.</li>
                  <li>Jika melanggar 3x, Akan DISKUALIFIKASI dan tidak dapat mengerjakan soal berikutnya.</li>
                  <li>Perhatikan waktu saat mengerjakan soal.</li>
                  <li>Jangan Lupa untuk berdoa sebelum mengerjakan soal.</li>
              </ul>
          </div>
        `,
        icon: 'info',
        showCancelButton: true,
        confirmButtonColor: '#059669',
        confirmButtonText: 'KERJAKAN SOAL',
        cancelButtonText: 'Batal',
        heightAuto: false,
        allowOutsideClick: false
      });

      if (rules.isConfirmed) {
          // 6. Mulai Ujian
          const startTimeIso = new Date().toISOString();
          const endTimeIso = new Date(new Date().getTime() + selectedExam.duration * 60000).toISOString();
          
          // REVISI: Cek apakah soal harus diacak atau tidak
          let finalQuestions = q;
          if (selectedExam.is_random) {
              finalQuestions = shuffleArray(q);
          }

          setQuestions(finalQuestions);
          setAnswers({});
          setCurrentQIndex(0);
          setFlaggedQuestions(new Set());
          setTimeLeft(selectedExam.duration * 60);
          setStartTime(startTimeIso);

          setViolationCount(0); 
          violationRef.current = 0; 
          isPaused.current = false; 
          setShowViolationModal(false);
          setShowFinishModal(false);
          setIsSubmitting(false);
          
          setStep('exam');
      } else {
          // Jika User Batal di Rules (Klik Batal), Reset Loading
          setLoadingLogin(false);
      }

    } catch (err) {
      failLogin('Terjadi kesalahan sistem. Coba lagi.');
    } finally {
      // setLoadingLogin handled by failLogin or success flow
    }
  };

  // --- SUBMIT FUNCTION ---
  const handleSubmitExam = async (forced = false) => {
    isPaused.current = true; // Matikan sensor
    setShowViolationModal(false); 
    setShowFinishModal(false);
    setIsSubmitting(true); // Tampilkan Loading Overlay Custom

    localStorage.removeItem('pai_exam_session');

    let correct = 0;
    questions.forEach(q => {
      if (answers[q.id] === q.correct_answer) correct++;
    });
    const finalScore = Math.round((correct / questions.length) * 100);
    setScore(finalScore);

    try {
      await db.submitExamResult({
          exam_id: selectedExam!.id,
          student_nis: student!.nis,
          student_name: student!.namalengkap,
          student_class: student!.kelas,
          semester: selectedExam!.semester, 
          answers: answers,
          score: finalScore,
          started_at: startTime,
          violation_count: violationRef.current // KIRIM DATA PELANGGARAN KE DB
      });
    } catch (e) {
      console.error(e);
    }

    setIsSubmitting(false);
    setStep('result');
  };

  // --- LOGIKA ANTI-CURANG (CUSTOM) ---
  useEffect(() => {
    if (step !== 'exam') return;

    const triggerViolation = () => {
        if (isPaused.current) return; // Jika sedang pause, abaikan

        isPaused.current = true; // Kunci Sensor
        violationRef.current += 1;
        setViolationCount(violationRef.current);
        setShowViolationModal(true); // Tampilkan Modal Pelanggaran
    };

    const handleVisibility = () => {
        if (document.hidden) triggerViolation();
    };

    const handleBlur = () => {
        setTimeout(() => {
            if (!document.hasFocus() && !document.hidden && !isPaused.current) {
                triggerViolation();
            }
        }, 300);
    };

    // TAMBAHAN: DETEKSI TOMBOL SCREENSHOT (KEYUP - DESKTOP)
    // FIX: Gunakan 'any' untuk event agar aman dari strict type check saat build
    const handleKeyUp = (e: any) => {
        if (isPaused.current) return;

        // 1. Tombol PrintScreen (Windows)
        if (e.key === 'PrintScreen') {
            e.preventDefault();
            triggerViolation();
        }

        // 2. Kombinasi Shortcut Screenshot (Mac & Windows)
        // Mac: Command + Shift + 3/4/5
        // Windows: Win + Shift + S
        if ((e.metaKey || e.ctrlKey || e.key === 'Meta') && e.shiftKey) {
            if (['3', '4', '5', 's', 'S'].includes(e.key)) {
                e.preventDefault();
                triggerViolation();
            }
        }
    };

    // TAMBAHAN BARU: DETEKSI GESTUR 3 JARI (MOBILE)
    // FIX: Gunakan 'any' untuk event agar aman dari strict type check saat build
    const handleTouchStart = (e: any) => {
        if (isPaused.current) return;
        // Jika terdeteksi lebih dari 2 jari (3, 4, dst) menyentuh layar
        // Ini biasa digunakan untuk screenshot 3 jari di Android/iOS atau gestures multitasking
        if (e.touches && e.touches.length > 2) {
            triggerViolation();
        }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("keyup", handleKeyUp); 
    // Tambahkan Event Listener Touch
    window.addEventListener("touchstart", handleTouchStart, { passive: false });
    
    // Prevent Back
    const handlePopState = () => {
        window.history.pushState(null, "", window.location.href);
    };
    window.history.pushState(null, "", window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
        document.removeEventListener("visibilitychange", handleVisibility);
        window.removeEventListener("blur", handleBlur);
        window.removeEventListener("keyup", handleKeyUp);
        window.removeEventListener("touchstart", handleTouchStart);
        window.removeEventListener('popstate', handlePopState);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]); 

  // --- HANDLER MODAL ---
  const handleCloseViolationModal = () => {
      if (violationCount >= 3) {
          handleSubmitExam(true);
      } else {
          setShowViolationModal(false);
          // Beri jeda agar tidak langsung kena blur lagi saat klik tutup
          setTimeout(() => {
              isPaused.current = false;
          }, 1000);
      }
  };

  // --- HANDLER TOMBOL SELESAI (REVISI: MENGGUNAKAN CUSTOM MODAL) ---
  const handleFinishClick = () => {
      isPaused.current = true; // PAUSE SENSOR SEGERA
      setShowFinishModal(true); // TAMPILKAN MODAL CUSTOM
  };

  const handleConfirmFinish = () => {
      setShowFinishModal(false);
      handleSubmitExam(false);
  };

  const handleCancelFinish = () => {
      setShowFinishModal(false);
      // RESUME SENSOR setelah jeda
      setTimeout(() => {
          isPaused.current = false;
      }, 500);
  };

  // Timer
  useEffect(() => {
    let timer: any;
    if (step === 'exam' && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft(p => p - 1), 1000);
    } else if (step === 'exam' && timeLeft <= 0) {
      handleSubmitExam(true); 
    }
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, timeLeft]);

  const formatTime = (s: number) => {
    if (s < 0) return "00:00";
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
  };

  const handleAnswer = (qId: string, idx: number) => {
    setAnswers(prev => ({ ...prev, [qId]: String(idx) }));
  };

  const toggleFlag = (qId: string) => {
      const newFlags = new Set(flaggedQuestions);
      newFlags.has(qId) ? newFlags.delete(qId) : newFlags.add(qId);
      setFlaggedQuestions(newFlags);
  };

  // --- RENDER VIEWS ---

  // 1. PLACEHOLDER (Jika tidak ada soal)
  if (!loadingExams && activeExams.length === 0 && step === 'public_list') {
      return (
        <div className="flex flex-col items-center justify-center min-h-[40vh] md:min-h-[50vh] space-y-2 md:space-y-4 animate-fadeIn px-4 text-center">
            <div className="bg-slate-200/50 p-3 md:p-4 rounded-full mb-2">
                <div className="w-8 h-8 md:w-12 md:h-12 border-4 border-slate-300 border-t-emerald-600 rounded-full animate-spin"></div>
            </div>
            <h1 className="text-lg md:text-2xl font-bold text-slate-800">Kerjakan Soal</h1>
            <p className="text-[10px] md:text-sm text-slate-500 max-w-xs">Belum ada soal yang harus di kerjakan</p>
        </div>
      );
  }

  // 2. PUBLIC LIST (Daftar Soal + Modal Login)
  if (step === 'public_list') {
    return (
      <div className="max-w-2xl mx-auto space-y-4 animate-fadeIn pb-24 px-1 md:px-0 pt-4">
        <div className="text-center space-y-1 mb-4">
          <h1 className="text-xl md:text-2xl font-black text-slate-800 uppercase tracking-tight">Kerjakan Soal</h1>
          <p className="text-[10px] md:text-xs text-slate-500 font-medium tracking-tight">Pilih soal yang ingin dikerjakan dari daftar di bawah.</p>
        </div>

        <div className="space-y-3">
             {activeExams.map(exam => {
               const isExpired = exam.deadline && new Date() > new Date(exam.deadline);
               return (
                 <div key={exam.id} className={`bg-white p-5 rounded-2xl border shadow-sm transition-all ${isExpired ? 'border-slate-100 bg-slate-50/30' : 'border-slate-100 hover:border-emerald-300'}`}>
                   <div className="mb-4">
                      {/* HEADER CARD */}
                      <div className="flex items-center gap-3 mb-2">
                          <div className="flex items-center gap-1.5 text-emerald-600">
                             <BookOpen size={12} className={isExpired ? "text-slate-400" : "text-emerald-600"}/>
                             <span className={`text-[10px] font-black uppercase ${isExpired ? "text-slate-400" : "text-emerald-600"}`}>Kelas {exam.grade} • Semester {exam.semester}</span>
                          </div>
                          
                          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md ${isExpired ? 'bg-slate-100 text-slate-400' : 'bg-emerald-50 text-emerald-700'}`}>
                             <Timer size={12} />
                             <span className="text-[10px] font-black uppercase">Durasi {exam.duration} Menit</span>
                          </div>
                      </div>

                      <h3 className={`font-bold text-sm uppercase leading-tight ${isExpired ? 'text-slate-400' : 'text-slate-800'}`}>{exam.title}</h3>
                      <p className="text-[8px] text-slate-400 mt-1 capitalize font-bold">{exam.category}</p>
                      
                      {exam.deadline && (
                          <div className="mt-2">
                              {/* REVISI: TAMPILAN DEADLINE AGAR LEBIH JELAS (TANGGAL & JAM DIPISAH) */}
                              <div className={`flex items-center gap-1.5 text-[10px] font-black capitalize w-full ${isExpired ? 'text-slate-400 bg-slate-100 px-3 py-2 rounded-lg' : 'text-red-600 bg-red-100 px-3 py-2 rounded-lg'}`}>
                                  <Clock size={12} />
                                  <span>Batas Kerjakan Soal: {new Date(exam.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} • Pukul {new Date(exam.deadline).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              <p className="text-[8px] md:text-[10px] font-medium italic text-slate-500 mt-1.5 leading-tight">
                                *Soal tidak dapat dikerjakan apabila lewat dari tanggal & waktu ini
                              </p>
                          </div>
                      )}
                   </div>
                   
                   {/* TOMBOL MASUK / WAKTU HABIS */}
                   <button 
                     onClick={() => !isExpired && handleExamClick(exam)} 
                     disabled={!!isExpired}
                     className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 ${isExpired ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                   >
                     {isExpired ? <><AlertOctagon size={14}/> Waktu Telah Habis</> : <><LogIn size={12} /> MASUK</>}
                   </button>
                 </div>
               );
             })}
        </div>

        {/* --- MODAL POPUP LOGIN UJIAN (REVISI: CENTERED & ALERT TOP & SIZE FIX) --- */}
        {showLoginModal && selectedExam && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                <div className="absolute inset-0" onClick={handleCloseLoginModal}></div>
                
                {/* FIXED: max-w-[320px] agar lebih ideal di HP */}
                <div className="bg-white w-full max-w-[320px] rounded-[2.5rem] shadow-2xl relative overflow-hidden animate-slideUp">
                    {/* Header Modal */}
                    <div className="bg-emerald-600 p-6 pt-8 pb-10 text-center relative">
                        <button onClick={handleCloseLoginModal} className="absolute right-4 top-4 text-emerald-100 hover:text-white bg-red-500 p-2 rounded-full backdrop-blur-sm transition-all active:scale-90">
                            <X size={16} />
                        </button>
                        <h2 className="text-white text-lg font-black uppercase tracking-tight leading-tight mb-1">{selectedExam.title}</h2>
                        <div className="flex justify-center gap-2 text-[9px] font-bold text-emerald-100 uppercase tracking-widest">
                            <span className="bg-emerald-700/50 px-2 py-0.5 rounded-lg border border-emerald-500/30">Kelas {selectedExam.grade}</span>
                            <span className="bg-emerald-700/50 px-2 py-0.5 rounded-lg border border-emerald-500/30">Semester {selectedExam.semester}</span>
                        </div>
                    </div>

                    {/* Form Body - Overlap Effect */}
                    <div className="px-6 pb-8 -mt-6 relative z-10">
                        <div className="bg-white rounded-[2rem] p-6 shadow-xl border border-slate-100 space-y-4">
                            <div className="text-center space-y-1 mb-2">
                                {/* REVISI: Mengubah font-black menjadi font-bold dan text-slate-500 menjadi font-medium sesuai permintaan */}
                                <p className="text-xs font-bold text-slate-800 uppercase">Masuk Untuk Kerjakan Soal</p>
                                <p className="text-[11px] text-slate-500 font-medium">Pilih Semester & Masukkan NIS</p>
                            </div>
                            
                            <form onSubmit={handleLoginAndStart} className="space-y-3">
                                {/* Dropdown Semester */}
                                <div className="space-y-1">
                                    <div className="relative">
                                        <select 
                                            className="w-full px-4 py-3 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-800 font-normal outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all appearance-none"
                                            value={loginSemester}
                                            onChange={(e) => setLoginSemester(e.target.value)}
                                        >
                                            <option value="0">-- Pilih Semester --</option>
                                            <option value="1">Semester 1 (Ganjil)</option>
                                            <option value="2">Semester 2 (Genap)</option>
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                            <ChevronRight size={14} className="rotate-90" />
                                        </div>
                                    </div>
                                </div>

                                {/* Input NIS */}
                                <div className="space-y-1">
                                    <div className="relative">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input 
                                            type="text" 
                                            inputMode="numeric" 
                                            className="w-full pl-11 pr-4 py-3 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-normal outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all placeholder:font-normal" 
                                            placeholder="Masukkan Nomor NIS siswa" 
                                            value={nis} 
                                            onChange={(e) => setNis(e.target.value.replace(/[^0-9]/g, ''))}
                                        />
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <button 
                                        type="submit" 
                                        disabled={loadingLogin} 
                                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-emerald-600/30 transition-all active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        {loadingLogin ? <><Loader2 size={14} className="animate-spin"/> Memproses...</> : 'MULAI MENGERJAKAN SOAL'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>
    );
  }

  // 4. EXAM INTERFACE (Sama seperti sebelumnya)
  if (step === 'exam' && selectedExam && questions.length > 0) {
    const currentQ = questions[currentQIndex];
    const answeredCount = Object.keys(answers).length;
    const unansweredCount = questions.length - answeredCount;
    // Hitung jumlah soal ragu-ragu
    const flaggedCount = flaggedQuestions.size;
    const isCurrentFlagged = flaggedQuestions.has(currentQ.id);

    return (
      <div className="fixed inset-0 z-[9000] bg-slate-100 flex flex-col overflow-hidden select-none" onContextMenu={(e) => e.preventDefault()}>
        {/* HEADER (OPTIMASI MOBILE) */}
        <div className="bg-white border-b border-emerald-100 shadow-md p-2 md:p-3 z-50 flex items-center justify-between shrink-0 h-16 md:h-20">
           <div className="flex items-center gap-2 md:gap-3 flex-1 overflow-hidden">
              <div className="hidden md:flex w-12 h-12 bg-emerald-600 text-white rounded-xl items-center justify-center shadow-lg"><User size={24} /></div>
              <div className="space-y-0.5 overflow-hidden">
                 <h2 className="text-[10px] md:text-lg font-black text-slate-800 uppercase leading-none truncate">{student?.namalengkap}</h2>
                 <p className="text-[8px] md:text-xs text-slate-500 font-bold uppercase truncate">{selectedExam.title}</p>
                 {/* REVISI: MENAMPILKAN KELAS DI BAWAH TYPE SOAL */}
                 <p className="text-[8px] md:text-xs text-emerald-600 font-black uppercase truncate">Kelas {student?.kelas}</p>
                 <div className="hidden md:flex items-center gap-2 text-[9px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md w-fit"><Calendar size={10}/> <span>{new Date().toLocaleDateString('id-ID')}</span></div>
              </div>
           </div>
           
           <div className="flex items-center gap-2 md:gap-4 shrink-0">
               {/* INDIKATOR PELANGGARAN (MUNCUL DI MOBILE) & TEKS "Poin Pelanggaran" */}
               {violationCount > 0 && (
                   <div className="flex items-center gap-1 bg-red-50 text-red-600 px-2 py-1 rounded-lg border border-red-100 animate-pulse">
                      <ShieldAlert size={12} className="md:w-3.5 md:h-3.5" />
                      <span className="text-[8px] md:text-[10px] font-black uppercase">Poin Pelanggaran {violationCount}/3</span>
                   </div>
               )}
               
               <div className="text-right">
                  <p className="text-[7px] md:text-[8px] text-slate-400 font-bold uppercase tracking-widest hidden md:block">Sisa Waktu</p>
                  <p className={`text-base md:text-2xl font-black font-mono leading-none ${timeLeft < 300 ? 'text-red-600 animate-pulse' : 'text-slate-800'}`}>{formatTime(timeLeft)}</p>
               </div>
               
               {/* TOMBOL SELESAI (TEKS SELALU MUNCUL) */}
               <button 
                 onClick={handleFinishClick} 
                 className="bg-red-600 text-white px-3 py-2 md:px-4 md:py-2.5 rounded-lg md:rounded-xl text-[9px] md:text-xs font-black uppercase tracking-wider shadow-lg active:scale-95 transition-all flex items-center gap-1 md:gap-2"
               >
                 <LogOut size={12} className="md:w-3.5 md:h-3.5" strokeWidth={3} /> <span>Selesai</span>
               </button>
           </div>
        </div>

        {/* BODY */}
        <div className="flex flex-1 overflow-hidden relative">
            
            {/* === LOADING OVERLAY (CUSTOM) === */}
            {isSubmitting && (
                <div className="absolute inset-0 z-[10001] bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center space-y-4 animate-fadeIn">
                    <Loader2 size={48} className="text-emerald-600 animate-spin" />
                    <div className="text-center">
                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Menyimpan Jawaban...</h3>
                        <p className="text-xs text-slate-500 font-medium">Mohon tunggu, jangan keluar dari halaman.</p>
                    </div>
                </div>
            )}

            {/* === CUSTOM VIOLATION MODAL === */}
            {showViolationModal && (
                <div className="absolute inset-0 z-[10000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
                    <div className="bg-white w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl animate-scaleUp">
                        <div className="bg-red-600 p-6 text-center text-white">
                            <ShieldAlert size={60} className="mx-auto mb-2 opacity-90" />
                            <h2 className="text-2xl font-black uppercase tracking-tighter leading-none">PELANGGARAN {violationCount}/3</h2>
                            <p className="text-xs font-medium text-red-100 mt-1 uppercase tracking-widest">Sistem Anti-Curang Terdeteksi</p>
                        </div>
                        <div className="p-6 text-center space-y-4">
                            <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                                {/* UPDATE TEKS PERINGATAN SCREENSHOT */}
                                <p className="text-sm font-bold text-red-800 leading-relaxed">
                                    Anda terdeteksi melakukan pelanggaran.
                                </p>
                            </div>
                            
                            {violationCount >= 3 ? (
                                <p className="text-xs text-slate-500 font-medium">
                                    Maaf, Anda telah melanggar aturan sebanyak 3 kali. <br/>
                                    <span className="text-red-600 font-bold">Anda dihentikan otomatis.</span>
                                </p>
                            ) : (
                                <p className="text-xs text-slate-500 font-medium">
                                    Harap tetap di halaman soal. Pelanggaran ke-3 akan menyebabkan diskualifikasi.
                                </p>
                            )}

                            <button 
                                onClick={handleCloseViolationModal}
                                className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg active:scale-95 transition-all ${violationCount >= 3 ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-amber-500 text-white hover:bg-amber-600'}`}
                            >
                                {violationCount >= 3 ? 'KUMPULKAN JAWABAN' : 'SAYA MENGERTI (OK)'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* === CUSTOM FINISH MODAL (REVISI BARU: DETEKSI KOSONG & RAGU-RAGU) === */}
            {showFinishModal && (
                <div className="absolute inset-0 z-[10000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
                    <div className="bg-white w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl animate-scaleUp border border-slate-200">
                        <div className="bg-slate-50 p-6 text-center border-b border-slate-100">
                            {unansweredCount > 0 || flaggedCount > 0 ? (
                                <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                                    <AlertTriangle size={32} />
                                </div>
                            ) : (
                                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                                    <HelpCircle size={32} />
                                </div>
                            )}
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Konfirmasi Selesai</h2>
                        </div>
                        
                        <div className="p-6 space-y-4">
                            {/* REVISI: TAMPILKAN STATUS SOAL KOSONG & RAGU-RAGU */}
                            {(unansweredCount > 0 || flaggedCount > 0) ? (
                                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 text-center space-y-1">
                                    {unansweredCount > 0 && (
                                        <p className="text-amber-800 font-bold text-sm">Masih ada {unansweredCount} soal kosong!</p>
                                    )}
                                    {flaggedCount > 0 && (
                                        <p className="text-amber-700 font-bold text-sm">Masih ada {flaggedCount} soal ragu-ragu!</p>
                                    )}
                                    <p className="text-amber-600 text-xs mt-2">Apakah Anda yakin ingin mengumpulkan?</p>
                                </div>
                            ) : (
                                <p className="text-center text-slate-500 font-medium text-sm">
                                    Anda telah menjawab semua soal. Yakin ingin keluar?
                                </p>
                            )}

                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <button 
                                    onClick={handleCancelFinish}
                                    className="py-3 rounded-xl bg-slate-200 text-slate-600 font-black uppercase text-xs hover:bg-slate-300 transition-all active:scale-95"
                                >
                                    Batal
                                </button>
                                <button 
                                    onClick={handleConfirmFinish}
                                    className="py-3 rounded-xl bg-emerald-600 text-white font-black uppercase text-xs hover:bg-emerald-700 transition-all shadow-lg active:scale-95"
                                >
                                    Ya, Kumpulkan
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-1 flex flex-col h-full relative overflow-y-auto bg-slate-50">
               <div className="w-full bg-slate-200 h-1"><div className="bg-emerald-500 h-1 transition-all duration-300" style={{ width: `${((currentQIndex + 1) / questions.length) * 100}%` }}></div></div>
               <div className="p-3 md:p-8 flex-1 flex flex-col justify-center max-w-4xl mx-auto w-full">
                  {/* REVISI MOBILE: PADDING DIPERKECIL (p-3 untuk mobile) */}
                  <div className="bg-white p-3 md:p-8 rounded-[1.5rem] md:rounded-[2rem] shadow-xl border border-slate-100 relative min-h-[350px] md:min-h-[400px] flex flex-col">
                      <div className="flex justify-between items-start mb-4 md:mb-6">
                          <span className="bg-emerald-600 text-white px-3 py-1 md:px-4 md:py-1.5 rounded-lg md:rounded-xl text-[10px] md:text-sm font-black shadow-md uppercase">Soal No. {currentQIndex + 1}</span>
                          <button onClick={() => toggleFlag(currentQ.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${isCurrentFlagged ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-slate-50 text-slate-400 border-slate-200'}`}><Flag size={12} fill={isCurrentFlagged ? "currentColor" : "none"} /> Klik Ragu-ragu</button>
                      </div>
                      {currentQ.image_url && <div className="mb-4 md:mb-6 rounded-xl md:rounded-2xl overflow-hidden border border-slate-100 shadow-sm max-w-lg mx-auto bg-slate-50"><img src={currentQ.image_url} alt="Soal" className="w-full h-auto object-contain max-h-[250px] md:max-h-[300px]" /></div>}
                      <div className="flex-1 mb-4 md:mb-6"><p className="text-sm md:text-base font-medium text-slate-800 leading-relaxed text-justify">{currentQ.text}</p></div>
                      
                      {/* REVISI MOBILE: GAP DIPERKECIL */}
                      <div className="grid grid-cols-1 gap-2 md:gap-3">
                         {currentQ.options?.map((opt, optIdx) => {
                           const isSelected = answers[currentQ.id] === String(optIdx);
                           // Logic Warna Berubah jika Ragu-ragu
                           let btnClass = 'bg-white border-slate-100 text-slate-600 hover:border-emerald-300';
                           let badgeClass = 'bg-slate-50 border-slate-200 text-slate-400';

                           if (isSelected) {
                               if (isCurrentFlagged) {
                                   // JIKA RAGU-RAGU: KUNING
                                   btnClass = 'bg-amber-50 border-amber-500 text-amber-900 shadow-md ring-2 ring-amber-500/20';
                                   badgeClass = 'bg-amber-500 border-amber-500 text-white';
                               } else {
                                   // JIKA NORMAL: HIJAU
                                   btnClass = 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-md ring-2 ring-emerald-500/20';
                                   badgeClass = 'bg-emerald-500 border-emerald-500 text-white';
                               }
                           }

                           return (
                             // REVISI MOBILE: PADDING OPSI DIPERKECIL (p-2.5)
                             <button key={optIdx} onClick={() => handleAnswer(currentQ.id, optIdx)} className={`w-full text-left p-2.5 md:p-4 rounded-xl border-2 transition-all text-xs md:text-sm flex items-center gap-3 md:gap-4 group active:scale-[0.98] ${btnClass}`}>
                                <div className={`w-7 h-7 md:w-8 md:h-8 rounded-lg border-2 flex items-center justify-center text-[10px] md:text-xs font-black shrink-0 transition-colors ${badgeClass}`}>{['A','B','C','D'][optIdx]}</div>
                                <span className="leading-relaxed font-medium">{opt}</span>
                             </button>
                           );
                         })}
                      </div>
                  </div>
               </div>
               <div className="p-3 md:p-4 bg-white border-t border-slate-200 flex justify-between items-center shrink-0 gap-2">
                  <button onClick={() => currentQIndex > 0 && setCurrentQIndex(p => p - 1)} disabled={currentQIndex === 0} className="flex-1 md:flex-none flex items-center justify-center gap-1.5 md:gap-2 px-3 py-3 md:px-5 rounded-xl bg-slate-100 text-slate-600 font-bold text-[10px] md:text-xs hover:bg-slate-200 disabled:opacity-50"><ChevronLeft size={14} className="md:w-4 md:h-4"/> Sebelumnya</button>
                  <button onClick={() => setShowNavMobile(!showNavMobile)} className="md:hidden flex items-center gap-1.5 px-3 py-3 rounded-xl bg-slate-800 text-white font-bold text-[10px]"><Grid size={14}/> <span className="text-[9px]">NO. SOAL</span></button>
                  
                  {/* TOMBOL SELESAI / SELANJUTNYA (BAWAH) */}
                  {currentQIndex === questions.length - 1 ? (
                      <button onClick={handleFinishClick} className="flex-1 md:flex-none flex items-center justify-center gap-1.5 md:gap-2 px-3 py-3 md:px-6 rounded-xl bg-emerald-600 text-white font-black text-[10px] md:text-xs uppercase hover:bg-emerald-700 shadow-lg"><CheckCircle size={14} className="md:w-4 md:h-4"/> Selesai</button>
                  ) : (
                      <button onClick={() => setCurrentQIndex(p => p + 1)} className="flex-1 md:flex-none flex items-center justify-center gap-1.5 md:gap-2 px-3 py-3 md:px-6 rounded-xl bg-blue-600 text-white font-bold text-[10px] md:text-xs hover:bg-blue-700 shadow-lg">Selanjutnya <ChevronRight size={14} className="md:w-4 md:h-4"/></button>
                  )}
               </div>
            </div>
            
            {/* NAVIGATOR (KANAN) */}
            <div className={`fixed inset-y-0 right-0 z-[9050] w-64 bg-white shadow-2xl transform transition-transform duration-300 md:relative md:transform-none md:w-80 md:border-l md:border-slate-200 md:shadow-none flex flex-col ${showNavMobile ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50"><h3 className="font-black text-slate-700 text-sm uppercase flex items-center gap-2"><Grid size={16} className="text-emerald-600"/> Navigasi Soal</h3><button onClick={() => setShowNavMobile(false)} className="md:hidden p-1 text-slate-400 hover:text-red-500"><X size={20} /></button></div>
                {/* REVISI: MENGUBAH GRID MENJADI 5 KOLOM AGAR KOTAK LEBIH KECIL DI MOBILE */}
                <div className="flex-1 overflow-y-auto p-4"><div className="grid grid-cols-5 gap-2">{questions.map((q, idx) => {
                    const isAnswered = !!answers[q.id]; const isFlagged = flaggedQuestions.has(q.id); const isCurrent = currentQIndex === idx;
                    let bgClass = 'bg-slate-50 border-slate-200 text-slate-500';
                    if (isAnswered) bgClass = 'bg-emerald-500 border-emerald-600 text-white';
                    if (isFlagged) bgClass = 'bg-amber-400 border-amber-500 text-white';
                    if (isCurrent) bgClass = 'ring-2 ring-blue-500 ring-offset-2 border-blue-500 text-blue-600 font-black';
                    return (<button key={q.id} onClick={() => { setCurrentQIndex(idx); setShowNavMobile(false); }} className={`aspect-square rounded-lg border flex items-center justify-center text-xs font-bold transition-all shadow-sm active:scale-95 ${bgClass}`}>{idx + 1}{isFlagged && <div className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-white"></div>}</button>);
                })}</div></div>
                <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-2">
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium"><div className="w-3 h-3 bg-emerald-500 rounded-sm"></div> Sudah Dijawab</div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium"><div className="w-3 h-3 bg-amber-400 rounded-sm"></div> Klik Ragu-ragu</div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium"><div className="w-3 h-3 bg-slate-200 rounded-sm border border-slate-300"></div> Belum Dijawab</div>
                </div>
            </div>
            {showNavMobile && <div className="fixed inset-0 bg-black/50 z-[9040] md:hidden backdrop-blur-sm" onClick={() => setShowNavMobile(false)}></div>}
        </div>
      </div>
    );
  }

  // 5. RESULT PAGE
  if (step === 'result') {
    return (
      <div className="max-w-md mx-auto min-h-[60vh] flex flex-col items-center justify-center px-4 animate-slideUp text-center">
        <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-emerald-100 animate-bounce"><CheckCircle size={48} strokeWidth={3} /></div>
        <h1 className="text-sm font-black text-slate-800 uppercase tracking-tight mb-2">Mengerjakan Soal Selesai!</h1>
        <p className="text-xs text-slate-500 mb-8 max-w-xs mx-auto">Nilai telah tersimpan otomatis ke Buku Nilai, Nilai bisa langsung di lihat pada menu Cek Nilai</p>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl w-full space-y-2 mb-8 relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-cyan-500"></div>
           <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nilai Kamu</p>
           <p className="text-5xl font-black text-emerald-600 tracking-tighter">{score}</p>
        </div>
        <button onClick={() => { setStep('public_list'); setNis(''); setSelectedExam(null); }} className="bg-emerald-600 text-white px-8 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg hover:bg-slate-800 transition-all active:scale-95 flex items-center gap-2"><ArrowRight size={16} /> Selesai</button>
      </div>
    );
  }

  return null;
};

export default PublicExam;