import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Download, 
  FileText, 
  Trash2, 
  ArrowLeft, 
  Database, 
  ShieldAlert, 
  Upload,
  FileUp,
  AlertTriangle,
  RefreshCw,
  FileSpreadsheet,
  Code,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  Settings
} from 'lucide-react';
import { db } from '../services/supabaseMock';
import Swal from 'sweetalert2';

// Import Utils
import { verifySecurityToken } from '../utils/security';

const TeacherSettings: React.FC = () => {
  const navigate = useNavigate();
  
  const [appsScriptUrl, setAppsScriptUrl] = useState<string>('');
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    db.getAppsScriptUrl().then(url => {
      if (url) setAppsScriptUrl(url);
    });
  }, []);

  const secureReset = async (type: 'absensi' | 'nilai' | 'tugas' | 'siswa' | 'materi' | 'ujian' | 'bank_soal' | 'hasil_ujian' | 'tujuan_pembelajaran' | 'asesmen_tp' | 'semua') => {
    const labels = { 
      absensi: 'Absensi', 
      nilai: 'Nilai', 
      tugas: 'Tugas', 
      siswa: 'Data Siswa', 
      materi: 'Materi Belajar',
      ujian: 'Ujian',
      bank_soal: 'Bank Soal',
      hasil_ujian: 'Hasil Ujian',
      tujuan_pembelajaran: 'Tujuan Pembelajaran',
      asesmen_tp: 'Asesmen TP',
      semua: 'SEMUA DATABASE' 
    };
    const confirm = await Swal.fire({
      title: 'Hapus Data?',
      text: `Apakah Bapak yakin ingin menghapus ${labels[type]}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      heightAuto: false
    });

    if (!confirm.isConfirmed) return;

    const token = await verifySecurityToken('Masukkan Kode Token ID Server:');

    if (token === "PAI_ADMIN_GURU") {
      Swal.fire({ title: 'Menghapus...', didOpen: () => Swal.showLoading(), heightAuto: false });
      try {
        if (type === 'absensi') await db.resetAttendance();
        else if (type === 'nilai') await db.resetGrades();
        else if (type === 'tugas') await db.resetTasks();
        else if (type === 'siswa') await db.resetStudents();
        else if (type === 'materi') await db.resetMaterials();
        else if (type === 'ujian') await db.resetExams();
        else if (type === 'bank_soal') await db.resetQuestions();
        else if (type === 'hasil_ujian') await db.resetExamResults();
        else if (type === 'tujuan_pembelajaran') await db.resetTujuanPembelajaran();
        else if (type === 'asesmen_tp') await db.resetAsesmenTp();
        else await db.resetAllData();
        
        Swal.close();
        setTimeout(() => {
          Swal.fire({
            icon: 'success',
            title: 'Berhasil',
            text: 'Data telah dibersihkan.',
            confirmButtonColor: '#059669',
            heightAuto: false
          });
        }, 150);
      } catch (err) {
        Swal.close();
        setTimeout(() => {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Gagal membersihkan data.',
            confirmButtonColor: '#dc2626',
            heightAuto: false
          });
        }, 150);
      }
    } else if (token !== null) {
      Swal.fire({ icon: 'error', title: 'Token Salah', text: 'Token Keamanan PAI tidak valid!', confirmButtonColor: '#dc2626', heightAuto: false });
    }
  };

  const handleSaveAppsScriptUrl = async (urlStr: string) => {
    if (!urlStr.startsWith('https://script.google.com/')) {
      Swal.fire({ icon: 'warning', title: 'Format Salah', text: 'URL Google Apps Script harus dimulai dengan "https://script.google.com/"', heightAuto: false });
      return;
    }
    await db.setAppsScriptUrl(urlStr.trim());
    setAppsScriptUrl(urlStr.trim());
    Swal.fire({ icon: 'success', title: 'Tersimpan!', text: 'URL Google Apps Script berhasil ditautkan dan disimpan!', timer: 1500, showConfirmButton: false, heightAuto: false });
  };

  const handleDeleteAppsScriptUrl = async () => {
    const confirmed = await Swal.fire({
      title: 'Putuskan Hubungan?',
      text: 'Data rekap lokal Anda akan tetap ada, tetapi sinkronisasi otomatis ke Google Sheets akan dihentikan.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#475569',
      confirmButtonText: 'Ya, Putuskan!',
      cancelButtonText: 'Batal',
      heightAuto: false
    });
    if (!confirmed.isConfirmed) return;

    await db.setAppsScriptUrl(null);
    setAppsScriptUrl('');
    Swal.fire({ icon: 'success', title: 'Terputus', text: 'Koneksi dengan Google Apps Script telah dinonaktifkan.', timer: 1500, showConfirmButton: false, heightAuto: false });
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-24 px-1">
      {/* Header Responsif */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex-1">
          <button 
            onClick={() => navigate('/guru')} 
            className="group flex items-center gap-2 text-slate-700 hover:text-emerald-700 transition-all text-xs font-black uppercase tracking-wider mb-2"
            id="btn-back-to-dashboard-utama"
          >
            <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
            <span>DASHBOARD UTAMA</span>
          </button>
          <h1 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-slate-800 leading-tight">
            Pengaturan Aplikasi &amp; Database
          </h1>
          <p className="text-slate-500 text-[10px] md:text-xs font-medium leading-tight max-w-xl mt-1">
            Konfigurasi server, integrasi Google Sheets, kelola &amp; impor data siswa, serta pemeliharaan kebersihan database.
          </p>
        </div>
        <div className="bg-emerald-600 text-white px-4 py-2.5 rounded-2xl shadow-lg shadow-emerald-100 flex items-center gap-2.5 self-start md:self-center">
          <Settings size={18} className="opacity-90 animate-spin-slow" />
          <div className="text-[9px] font-bold uppercase tracking-wider">Pengaturan Portal</div>
        </div>
      </div>

      {/* RENDER BODY CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Google Sheets */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* CARDS 1: INTEGRASI GOOGLE SHEETS */}
          <div className="bg-white p-5 md:p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                <FileSpreadsheet size={24} />
              </div>
              <div>
                <h2 className="text-sm md:text-lg font-black text-slate-800 uppercase tracking-tight">Integrasi Database Google Sheets</h2>
                <p className="text-slate-400 text-[10px] md:text-xs">Hubungkan portal ini ke Google Spreadsheet untuk sinkronisasi database secara langsung melalui Web App URL.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col space-y-4">
                <div className="p-5 rounded-2xl border border-slate-100 bg-slate-50/50 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Langkah 1: Tempel Url Web App</span>
                      {appsScriptUrl ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Terhubung
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                          Belum Diisi
                        </span>
                      )}
                    </div>

                    <p className="text-[10px] md:text-xs text-slate-500 leading-relaxed">
                      Tempel URL Web Aplikasi Google Apps Script dari spreadsheet milik Anda di bawah ini untuk mengaktifkan sinkronisasi otomatis.
                    </p>

                    <div className="space-y-2">
                      <label className="text-[9px] font-extrabold text-slate-600 uppercase tracking-wider block">Web App URL Google Apps Script</label>
                      <input
                        type="text"
                        value={appsScriptUrl}
                        onChange={(e) => setAppsScriptUrl(e.target.value)}
                        placeholder="https://script.google.com/macros/s/xxxx/exec"
                        className="w-full px-3 py-2.5 text-[10px] font-mono border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex gap-2">
                    <button
                      onClick={() => handleSaveAppsScriptUrl(appsScriptUrl)}
                      className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider transition-all shadow-md"
                    >
                      Simpan &amp; Tautkan URL
                    </button>
                    {appsScriptUrl && (
                      <button
                        onClick={handleDeleteAppsScriptUrl}
                        className="px-4 py-3 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-[10px] font-black uppercase tracking-wider transition-all"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-5 rounded-2xl border border-slate-100 bg-white space-y-3">
                  <button
                    onClick={() => setShowTutorial(!showTutorial)}
                    className="w-full text-left p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 transition-all flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Code size={14} className="text-emerald-600" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">Langkah Membuat Apps Script</span>
                    </div>
                    {showTutorial ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                  </button>

                  {(!appsScriptUrl || showTutorial) && (
                    <div className="text-[11px] text-slate-600 space-y-3 p-1 leading-relaxed max-h-[250px] overflow-y-auto pr-2 scrollbar-thin">
                      <div className="font-extrabold text-slate-800 uppercase text-[9px] tracking-wider mb-1">Panduan Cepat (1 Menit):</div>
                      <ol className="list-decimal list-inside space-y-2 pl-1">
                        <li>Buka Google Spreadsheet milik Anda.</li>
                        <li>Di menu atas, pilih <b>Ekstensi</b> &rarr; <b>Apps Script</b>.</li>
                        <li>Hapus seluruh kode bawaan yang ada.</li>
                        <li>Salin &amp; Tempel kode JavaScript di bawah ke editor Apps Script:</li>
                      </ol>

                      <div className="relative">
                        <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl text-[9px] font-mono overflow-all max-h-36 overflow-y-auto whitespace-pre leading-normal">
{`function doGet(e) {
  var sheetName = e.parameter.sheet;
  if (!sheetName) return ContentService.createTextOutput(JSON.stringify({ error: "Missing sheet" })).setMimeType(ContentService.MimeType.JSON);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  var values = [];
  if (sheet.getLastRow() > 0 && sheet.getLastColumn() > 0) {
    values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  }
  for (var i = 0; i < values.length; i++) {
    for (var j = 0; j < values[i].length; j++) {
      if (values[i][j] instanceof Date) {
        values[i][j] = values[i][j].toISOString();
      }
    }
  }
  return ContentService.createTextOutput(JSON.stringify({ values: values })).setMimeType(ContentService.MimeType.JSON);
}
function doPost(e) {
  var result = { success: false };
  try {
    var postData = JSON.parse(e.postData.contents);
    var sheetName = postData.sheet;
    var values = postData.values;
    if (sheetName && values) {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) sheet = ss.insertSheet(sheetName);
      sheet.clear();
      if (values.length > 0) sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
      result.success = true;
    }
  } catch (err) {
    result.error = err.toString();
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}`}
                        </pre>
                        <button
                          onClick={() => {
                            const codeText = `function doGet(e) {
  var sheetName = e.parameter.sheet;
  if (!sheetName) return ContentService.createTextOutput(JSON.stringify({ error: "Missing sheet" })).setMimeType(ContentService.MimeType.JSON);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  var values = [];
  if (sheet.getLastRow() > 0 && sheet.getLastColumn() > 0) {
    values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  }
  for (var i = 0; i < values.length; i++) {
    for (var j = 0; j < values[i].length; j++) {
      if (values[i][j] instanceof Date) {
        values[i][j] = values[i][j].toISOString();
      }
    }
  }
  return ContentService.createTextOutput(JSON.stringify({ values: values })).setMimeType(ContentService.MimeType.JSON);
}
function doPost(e) {
  var result = { success: false };
  try {
    var postData = JSON.parse(e.postData.contents);
    var sheetName = postData.sheet;
    var values = postData.values;
    if (sheetName && values) {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) sheet = ss.insertSheet(sheetName);
      sheet.clear();
      if (values.length > 0) sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
      result.success = true;
    }
  } catch (err) {
    result.error = err.toString();
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}`;
                            navigator.clipboard.writeText(codeText);
                            Swal.fire({ icon: 'success', title: 'Berhasil Disalin!', text: 'Salinan siap di-paste di Google Apps Script.', timer: 1200, showConfirmButton: false, heightAuto: false });
                          }}
                          className="absolute right-2 top-2 px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[8px] font-black uppercase tracking-wider transition-all"
                        >
                          Salin Kode
                        </button>
                      </div>

                      <ol className="list-decimal list-inside space-y-2 pl-1" start={5}>
                        <li>Klik <b>Terapkan (Deploy)</b> &rarr; <b>Terapkan Baru (New deployment)</b>.</li>
                        <li>Pilih tipe: <b>Aplikasi Web (Web App)</b>.</li>
                        <li>Pilih akses: <b>Siapa saja (Anyone)</b>.</li>
                        <li>Selesaikan Deployment, lalu copy <b>Web App URL</b> yang berakhiran <code className="bg-slate-100 p-0.5 rounded px-1 text-red-650">/exec</code> ke kolom di sebelah.</li>
                      </ol>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Reset Database */}
        <div className="lg:col-span-5 space-y-6">
          {/* CARDS 3: RESET DATABASE */}
          <div className="bg-white p-5 md:p-8 rounded-[2rem] border border-red-100 border-dashed shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 text-red-600 rounded-xl"><ShieldAlert size={18}/></div>
              <h2 className="text-[11px] md:text-sm font-black uppercase tracking-widest text-red-600">Reset Database</h2>
            </div>
            <div className="flex items-start gap-2 px-3 py-2 bg-red-50/50 rounded-xl border border-red-100">
              <AlertTriangle size={14} className="text-red-600 mt-0.5 shrink-0" />
              <p className="text-[8px] font-bold text-red-700 uppercase italic">Membutuhkan Token Keamanan PAI.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => secureReset('siswa')} className="p-2.5 bg-slate-800 text-white rounded-xl text-[8px] font-black uppercase active:scale-95 transition-all">Reset Data Siswa</button>
              <button onClick={() => secureReset('absensi')} className="p-2.5 bg-slate-800 text-white rounded-xl text-[8px] font-black uppercase active:scale-95 transition-all">Reset Absensi</button>
              <button onClick={() => secureReset('nilai')} className="p-2.5 bg-slate-800 text-white rounded-xl text-[8px] font-black uppercase active:scale-95 transition-all">Reset Nilai</button>
              <button onClick={() => secureReset('tugas')} className="p-2.5 bg-slate-800 text-white rounded-xl text-[8px] font-black uppercase active:scale-95 transition-all">Reset Tugas</button>
              <button onClick={() => secureReset('materi')} className="p-2.5 bg-slate-800 text-white rounded-xl text-[8px] font-black uppercase active:scale-95 transition-all">Reset Materi Belajar</button>
              <button onClick={() => secureReset('ujian')} className="p-2.5 bg-slate-800 text-white rounded-xl text-[8px] font-black uppercase active:scale-95 transition-all">Reset Ujian</button>
              <button onClick={() => secureReset('bank_soal')} className="p-2.5 bg-slate-800 text-white rounded-xl text-[8px] font-black uppercase active:scale-95 transition-all">Reset Bank Soal</button>
              <button onClick={() => secureReset('hasil_ujian')} className="p-2.5 bg-slate-800 text-white rounded-xl text-[8px] font-black uppercase active:scale-95 transition-all">Reset Hasil Ujian</button>
              <button onClick={() => secureReset('tujuan_pembelajaran')} className="p-2.5 bg-slate-800 text-white rounded-xl text-[8px] font-black uppercase active:scale-95 transition-all">Reset Tujuan Pembelajaran</button>
              <button onClick={() => secureReset('asesmen_tp')} className="p-2.5 bg-slate-800 text-white rounded-xl text-[8px] font-black uppercase active:scale-95 transition-all">Reset Asesmen TP</button>
              <button onClick={() => secureReset('semua')} className="p-3.5 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase col-span-2 shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">
                <Trash2 size={16}/> Hapus Seluruh Data
              </button>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-start gap-3">
            <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={16} />
            <div className="space-y-1">
              <p className="text-[9px] md:text-[10px] text-amber-800 font-black uppercase tracking-widest">Informasi Keamanan</p>
              <p className="text-[9px] md:text-[10px] text-amber-700 leading-relaxed italic">
                Akses pengelolaan admin, reset database, dan sinkronisasi Google Sheets terbatas hanya kepada guru pengajar bersangkutan. Harap lakukan backup berkala sebelum melakukan reset.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default TeacherSettings;
