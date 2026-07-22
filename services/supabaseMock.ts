import { Student, AttendanceRecord, GradeRecord, Material, GradeLevel, TaskSubmission, AdminUser, Exam, Question, ExamResult } from '../types';
import { firestore } from './firebase';
import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';

// Definisikan tipe untuk spreadsheet helper
interface SheetConfig {
  name: string;
  headers: string[];
}

const TABS_CONFIG: SheetConfig[] = [
  { name: 'admin_users', headers: ['id', 'username', 'fullname', 'password', 'role', 'created_at'] },
  { name: 'data_siswa', headers: ['id', 'nis', 'namalengkap', 'kelas', 'jeniskelamin'] },
  { name: 'Nilai', headers: ['id', 'student_id', 'subject_type', 'score', 'description', 'kelas', 'semester', 'created_at'] },
  { name: 'kehadiran', headers: ['id', 'student_id', 'nama_siswa', 'nis', 'kelas', 'date', 'status', 'semester'] },
  { name: 'data_TugasSiswa', headers: ['id', 'nisn', 'student_name', 'kelas', 'task_name', 'submission_type', 'content', 'created_at'] },
  { name: 'materi_belajar', headers: ['id', 'title', 'description', 'grade', 'category', 'content_url', 'thumbnail'] },
  { name: 'ujian', headers: ['id', 'title', 'grade', 'category', 'semester', 'duration', 'deadline', 'is_random', 'status', 'created_at', 'tp_id', 'assessment_id'] },
  { name: 'bank_soal', headers: ['id', 'exam_id', 'type', 'text', 'image_url', 'options', 'correct_answer'] },
  { name: 'hasil_ujian', headers: ['id', 'exam_id', 'student_nis', 'student_name', 'student_class', 'semester', 'answers', 'score', 'violation_count', 'started_at', 'submitted_at'] },
  { name: 'nilai_rapot', headers: ['id', 'student_id', 'nama_siswa', 'nis', 'kelas', 'semester', 'sts', 'sas', 'sakit', 'izin', 'alpha', 'sikap', 'katrol', 'nilai_akhir', 'updated_at'] },
  { name: 'tujuan_pembelajaran', headers: ['id', 'code', 'name', 'description', 'subject', 'grade', 'semester'] },
  { name: 'asesmen_tp', headers: ['id', 'tpId', 'name', 'type'] },
  { name: 'kunjungan', headers: ['id', 'nis', 'nama', 'kelas', 'halaman', 'timestamp', 'device', 'browser', 'duration'] }
];

class DatabaseService {
  private isSyncingFromSheets = false;
  // HELPER LOKAL DATASTORAGE (LOCALSTORAGE)
  public getLocalTable<T>(name: string): T[] {
    let key = `pai_db_${name}`;
    if (name === 'tujuan_pembelajaran') key = 'pai_grades_tps';
    if (name === 'asesmen_tp') key = 'pai_grades_assessments';
    let data = localStorage.getItem(key);
    if (!data && name === 'nilai_rapot') {
      const oldKeysData = localStorage.getItem('pai_db_kelola_nilai');
      if (oldKeysData) {
        localStorage.setItem(key, oldKeysData);
        data = oldKeysData;
      }
    }
    if (!data) return [];
    try {
      const parsed = JSON.parse(data) as any[];
      if (Array.isArray(parsed)) {
        return parsed.map((item: any) => {
          if (!item || typeof item !== 'object') return item;
          const newItem = { ...item };
          if (newItem.grade !== undefined && newItem.grade !== null) {
            newItem.grade = String(newItem.grade).trim();
          }
          if (newItem.semester !== undefined && newItem.semester !== null) {
            newItem.semester = String(newItem.semester).trim();
          }
          if (newItem.id !== undefined && newItem.id !== null) {
            newItem.id = String(newItem.id).trim();
          }
          if (newItem.tpId !== undefined && newItem.tpId !== null) {
            newItem.tpId = String(newItem.tpId).trim();
          }
          if (newItem.kelas !== undefined && newItem.kelas !== null) {
            newItem.kelas = String(newItem.kelas).trim();
          }
          return newItem;
        }) as any[];
      }
      return parsed as T[];
    } catch (_) {
      return [];
    }
  }

  public setLocalTable<T>(name: string, data: T[]): void {
    let key = `pai_db_${name}`;
    if (name === 'tujuan_pembelajaran') key = 'pai_grades_tps';
    if (name === 'asesmen_tp') key = 'pai_grades_assessments';
    
    let processedData = data;
    if (Array.isArray(data)) {
      processedData = data.map((item: any) => {
        if (!item || typeof item !== 'object') return item;
        const newItem = { ...item };
        if (newItem.grade !== undefined && newItem.grade !== null) {
          newItem.grade = String(newItem.grade).trim();
        }
        if (newItem.semester !== undefined && newItem.semester !== null) {
          newItem.semester = String(newItem.semester).trim();
        }
        if (newItem.id !== undefined && newItem.id !== null) {
          newItem.id = String(newItem.id).trim();
        }
        if (newItem.tpId !== undefined && newItem.tpId !== null) {
          newItem.tpId = String(newItem.tpId).trim();
        }
        if (newItem.kelas !== undefined && newItem.kelas !== null) {
          newItem.kelas = String(newItem.kelas).trim();
        }
        return newItem;
      }) as any[];
    }
    
    localStorage.setItem(key, JSON.stringify(processedData));
    
    // Auto-sync in background to Google Sheets if not pulling from sheets
    if (!this.isSyncingFromSheets) {
      this.getAppsScriptUrl().then(appsScriptUrl => {
        const token = localStorage.getItem('google_oauth_token') || undefined;
        if (appsScriptUrl || token) {
          const isTableValid = TABS_CONFIG.some(cfg => cfg.name === name);
          if (isTableValid) {
            this.syncTableToGoogleSheets(name, token).catch(err => {
              // Gracefully handle or log as warn to avoid noisy background fetch errors in offline or unconfigured environments
              console.warn(`Auto-sync background info for sheet ${name} (non-blocking):`, err.message || err);
            });
          }
        }
      });
    }
  }

  // Canonical Header normalizer
  getCanonicalHeader(parsedHeader: any, expectedHeaders: string[]): string {
    if (parsedHeader === undefined || parsedHeader === null) return '';
    const parsedStr = parsedHeader.toString().trim();
    const cleanParsed = parsedStr.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // 1. Direct case-insensitive match or custom clean match
    for (const expected of expectedHeaders) {
      if (expected.toLowerCase() === parsedStr.toLowerCase()) {
        return expected;
      }
      const cleanExpected = expected.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanExpected === cleanParsed) {
        return expected;
      }
    }

    // 2. Extra Indonesian semantic mappings if there are differences
    if (cleanParsed === 'nama' || cleanParsed === 'namasiswa' || cleanParsed === 'namalengkap' || cleanParsed === 'fullname' || cleanParsed === 'studentname') {
      if (expectedHeaders.includes('namalengkap')) return 'namalengkap';
      if (expectedHeaders.includes('student_name')) return 'student_name';
      if (expectedHeaders.includes('nama_siswa')) return 'nama_siswa';
      if (expectedHeaders.includes('fullname')) return 'fullname';
    }

    if (cleanParsed === 'nis' || cleanParsed === 'nisn') {
      if (expectedHeaders.includes('nis')) return 'nis';
      if (expectedHeaders.includes('nisn')) return 'nisn';
      if (expectedHeaders.includes('student_nis')) return 'student_nis';
    }

    if (cleanParsed === 'jeniskelamin' || cleanParsed === 'jk' || cleanParsed === 'gender' || cleanParsed === 'sex') {
      if (expectedHeaders.includes('jeniskelamin')) return 'jeniskelamin';
    }

    // Question mappings:
    if (['gambar', 'foto', 'image', 'soalgambar', 'soal_gambar', 'linkgambar', 'link_gambar', 'urlgambar', 'url_gambar', 'imageurl', 'image_url'].includes(cleanParsed)) {
      if (expectedHeaders.includes('image_url')) return 'image_url';
    }

    if (['correctanswer', 'correct_answer', 'jawabanbenar', 'jawaban_benar', 'jawaban', 'correct', 'correctkey', 'correct_key', 'kunci', 'kuncijawaban', 'kunci_jawaban'].includes(cleanParsed)) {
      if (expectedHeaders.includes('correct_answer')) return 'correct_answer';
    }

    if (['options', 'opsi', 'choices', 'pilihan', 'pilihan_jawaban', 'pilihanjawaban', 'option'].includes(cleanParsed)) {
      if (expectedHeaders.includes('options')) return 'options';
    }

    // Mappings for tujuan_pembelajaran & asesmen_tp
    if (['code', 'notp', 'nomortp', 'notp1', 'kode', 'kodetp', 'idtp', 'notujian'].includes(cleanParsed)) {
      if (expectedHeaders.includes('code')) return 'code';
    }
    if (['name', 'namatp', 'tujuan', 'tujuanpembelajaran', 'isi', 'judul', 'title'].includes(cleanParsed)) {
      if (expectedHeaders.includes('name')) return 'name';
    }
    if (['description', 'deskripsi', 'ringkasan', 'keterangan'].includes(cleanParsed)) {
      if (expectedHeaders.includes('description')) return 'description';
    }
    if (['subject', 'mapel', 'matapelajaran', 'subjek'].includes(cleanParsed)) {
      if (expectedHeaders.includes('subject')) return 'subject';
    }
    if (['grade', 'kelas', 'kls'].includes(cleanParsed)) {
      if (expectedHeaders.includes('grade')) return 'grade';
    }
    if (['semester', 'smt', 'sem'].includes(cleanParsed)) {
      if (expectedHeaders.includes('semester')) return 'semester';
    }
    if (['tpid', 'tp_id', 'kodetp', 'code_tp'].includes(cleanParsed)) {
      if (expectedHeaders.includes('tpId')) return 'tpId';
    }

    return parsedStr.toLowerCase();
  }

  // Robust Student struct Normalizer
  normalizeStudent(raw: any): Student | null {
    if (!raw) return null;
    
    const findValue = (keys: string[]): any => {
      for (const k of Object.keys(raw)) {
        const cleanedK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (keys.map(key => key.toLowerCase().replace(/[^a-z0-9]/g, '')).includes(cleanedK)) {
          return raw[k];
        }
      }
      return undefined;
    };

    const id = findValue(['id', 'uuid', 'studentid', 'student_id']) || raw.id || '';
    const nis = String(findValue(['nis', 'nisn', 'nomorinduk', 'studentnis', 'student_nis']) || raw.nis || '').trim();
    const namalengkap = String(findValue(['namalengkap', 'nama', 'fullname', 'studentname', 'student_name', 'namasiswa', 'nama_siswa']) || raw.namalengkap || '').trim();
    const kelas = String(findValue(['kelas', 'class', 'studentclass', 'student_class', 'grade']) || raw.kelas || '').trim();
    const jeniskelamin = String(findValue(['jeniskelamin', 'jk', 'gender', 'sex']) || raw.jeniskelamin || '-').trim();

    if (!nis && !namalengkap) return null;

    return {
      id: id || `student_${nis || Math.random().toString(36).substr(2, 9)}`,
      nis,
      namalengkap,
      kelas,
      jeniskelamin
    };
  }

  // SPREADSHEET ID CONFIGURATION
  async getSpreadsheetId(): Promise<string | null> {
    return localStorage.getItem('google_spreadsheet_id') || import.meta.env.VITE_GOOGLE_SPREADSHEET_ID || '1G_iMlKROJmq0UPb1Angg4IphW7BxVcron8yBEla7p2c';
  }

  async setSpreadsheetId(id: string | null): Promise<void> {
    if (id) {
      localStorage.setItem('google_spreadsheet_id', id);
    } else {
      localStorage.removeItem('google_spreadsheet_id');
    }
  }

  async getAppsScriptUrl(): Promise<string | null> {
    return localStorage.getItem('google_apps_script_url') || import.meta.env.VITE_GOOGLE_APPS_SCRIPT_URL || null;
  }

  async setAppsScriptUrl(url: string | null): Promise<void> {
    if (url) {
      localStorage.setItem('google_apps_script_url', url);
    } else {
      localStorage.removeItem('google_apps_script_url');
    }
  }

  // --- SPREADSHEET REST API INTEGRATIONS ---
  private async fetchSheetsAPI(spreadsheetId: string, path: string, options: RequestInit, accessToken: string) {
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Kesalahan API Google Sheets: ${res.statusText} (${errText})`);
    }
    return res.json();
  }

  // Membuat Spreadsheet baru di Google Drive milik Guru
  async createDatabaseSpreadsheet(accessToken: string): Promise<string> {
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          title: 'Sistem Pembelajaran PAI v2 (Google Sheets DB)'
        },
        sheets: [
          {
            properties: {
              title: 'admin_users'
            }
          }
        ]
      })
    });
    
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gagal membuat Spreadsheet: ${errText}`);
    }
    
    const spreadsheet = await res.json();
    const spreadsheetId = spreadsheet.spreadsheetId;
    
    const addSheetRequests = TABS_CONFIG.filter(cfg => cfg.name !== 'admin_users').map(cfg => ({
      addSheet: {
        properties: {
          title: cfg.name
        }
      }
    }));
    
    await this.fetchSheetsAPI(spreadsheetId, ':batchUpdate', {
      method: 'POST',
      body: JSON.stringify({
        requests: addSheetRequests
      })
    }, accessToken);
    
    for (const cfg of TABS_CONFIG) {
      await this.fetchSheetsAPI(spreadsheetId, `/values/${encodeURIComponent(cfg.name)}!A1:Z1?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        body: JSON.stringify({
          range: `${cfg.name}!A1:Z1`,
          majorDimension: 'ROWS',
          values: [cfg.headers]
        })
      }, accessToken);
    }
    
    await this.setSpreadsheetId(spreadsheetId);
    return spreadsheetId;
  }

  // Menginisialisasi struktur tabel & header di Spreadsheet yang sudah ada
  async initializeExistingSpreadsheet(spreadsheetId: string, accessToken: string): Promise<void> {
    try {
      const metadata = await this.fetchSheetsAPI(spreadsheetId, '?fields=sheets.properties', { method: 'GET' }, accessToken);
      const existingSheetNames = (metadata.sheets || []).map((s: any) => s.properties.title);

      const requests: any[] = [];
      const sheetsToInitHeaders: string[] = [];

      for (const cfg of TABS_CONFIG) {
        if (!existingSheetNames.includes(cfg.name)) {
          requests.push({
            addSheet: {
              properties: {
                title: cfg.name
              }
            }
          });
        }
        sheetsToInitHeaders.push(cfg.name);
      }

      if (requests.length > 0) {
        await this.fetchSheetsAPI(spreadsheetId, ':batchUpdate', {
          method: 'POST',
          body: JSON.stringify({ requests })
        }, accessToken);
      }

      for (const cfg of TABS_CONFIG) {
        if (sheetsToInitHeaders.includes(cfg.name)) {
          await this.fetchSheetsAPI(spreadsheetId, `/values/${encodeURIComponent(cfg.name)}!A1:Z1?valueInputOption=USER_ENTERED`, {
            method: 'PUT',
            body: JSON.stringify({
              range: `${cfg.name}!A1:Z1`,
              majorDimension: 'ROWS',
              values: [cfg.headers]
            })
          }, accessToken);
        }
      }
    } catch (err: any) {
      console.error("Gagal menginisialisasi spreadsheet yang sudah ada:", err);
      throw new Error(`Gagal menginisialisasi spreadsheet: ${err.message || err}`);
    }
  }

  // Sinkronisasi lokal (LocalStorage) -> Google Sheets
  async syncToGoogleSheets(accessToken?: string): Promise<void> {
    const appsScriptUrl = await this.getAppsScriptUrl();
    if (appsScriptUrl) {
      for (const cfg of TABS_CONFIG) {
        const items = this.getLocalTable(cfg.name);
        const values: any[][] = [cfg.headers];
        
        items.forEach((item: any) => {
          const row = cfg.headers.map(header => {
            const val = item[header];
            if (val === undefined || val === null) return '';
            if (typeof val === 'object') return JSON.stringify(val);
            return val;
          });
          values.push(row);
        });

        const res = await fetch(appsScriptUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain'
          },
          body: JSON.stringify({
            sheet: cfg.name,
            values: values
          })
        });
        if (!res.ok) {
          throw new Error(`Koneksi ke Apps Script gagal dengan status HTTP ${res.status}`);
        }
      }
      return;
    }

    const token = accessToken || localStorage.getItem('google_oauth_token') || '';
    const spreadsheetId = await this.getSpreadsheetId();
    if (!spreadsheetId) {
      throw new Error("Spreadsheet ID belum terkonfigurasi!");
    }

    await this.initializeExistingSpreadsheet(spreadsheetId, token);

    for (const cfg of TABS_CONFIG) {
      const items = this.getLocalTable(cfg.name);
      const values: any[][] = [cfg.headers];
      
      items.forEach((item: any) => {
        const row = cfg.headers.map(header => {
          const val = item[header];
          if (val === undefined || val === null) return '';
          if (typeof val === 'object') return JSON.stringify(val);
          return val;
        });
        values.push(row);
      });

      await this.fetchSheetsAPI(spreadsheetId, `/values/${encodeURIComponent(cfg.name)}!A1:Z5000?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        body: JSON.stringify({
          range: `${cfg.name}!A1:Z5000`,
          majorDimension: 'ROWS',
          values: values
        })
      }, token);
    }
  }

  // Sinkronisasi khusus SATU tabel lokal -> Google Sheets (Hemat kuota API & Sangat Cepat!)
  async syncTableToGoogleSheets(tableName: string, accessToken?: string): Promise<void> {
    const appsScriptUrl = await this.getAppsScriptUrl();
    if (appsScriptUrl) {
      const cfg = TABS_CONFIG.find(c => c.name === tableName);
      if (!cfg) return;

      const items = this.getLocalTable(cfg.name);
      const values: any[][] = [cfg.headers];
      
      items.forEach((item: any) => {
        const row = cfg.headers.map(header => {
          const val = item[header];
          if (val === undefined || val === null) return '';
          if (typeof val === 'object') return JSON.stringify(val);
          return val;
        });
        values.push(row);
      });

      const res = await fetch(appsScriptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: JSON.stringify({
          sheet: tableName,
          values: values
        })
      });
      if (!res.ok) {
        throw new Error(`Koneksi ke Apps Script gagal dengan status HTTP ${res.status}`);
      }
      return;
    }

    const token = accessToken || localStorage.getItem('google_oauth_token') || '';
    const spreadsheetId = await this.getSpreadsheetId();
    if (!spreadsheetId) {
      throw new Error("Spreadsheet ID belum terkonfigurasi!");
    }

    const cfg = TABS_CONFIG.find(c => c.name === tableName);
    if (!cfg) return;

    try {
      // 1. Ambil metadata untuk cek apakah sheet dengan nama tableName sudah ada
      const metadata = await this.fetchSheetsAPI(spreadsheetId, '?fields=sheets.properties', { method: 'GET' }, token);
      const existingSheetNames = (metadata.sheets || []).map((s: any) => s.properties.title);

      // 2. Jika belum ada, buat sheet-nya
      if (!existingSheetNames.includes(tableName)) {
        await this.fetchSheetsAPI(spreadsheetId, ':batchUpdate', {
          method: 'POST',
          body: JSON.stringify({
            requests: [{
              addSheet: {
                properties: {
                  title: tableName
                }
              }
            }]
          })
        }, token);
      }

      // 3. Ambil data lokal dan masukkan ke values (termasuk headers sebagai baris pertama)
      const items = this.getLocalTable(cfg.name);
      const values: any[][] = [cfg.headers];
      
      items.forEach((item: any) => {
        const row = cfg.headers.map(header => {
          const val = item[header];
          if (val === undefined || val === null) return '';
          if (typeof val === 'object') return JSON.stringify(val);
          return val;
        });
        values.push(row);
      });

      // 4. Bersihkan data lama di range A1:Z5000 terlebih dahulu agar baris di bagian bawah tidak tersisa jika ada data yang dihapus
      try {
        await this.fetchSheetsAPI(spreadsheetId, `/values/${encodeURIComponent(cfg.name)}!A1:Z5000:clear`, {
          method: 'POST',
          body: JSON.stringify({})
        }, token);
      } catch (clearErr) {
        console.warn(`Gagal membersihkan range lama di sheet ${tableName}:`, clearErr);
      }

      // 5. Update data dalam sekali panggil PUT API
      await this.fetchSheetsAPI(spreadsheetId, `/values/${encodeURIComponent(cfg.name)}!A1:Z5000?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        body: JSON.stringify({
          range: `${cfg.name}!A1:Z5000`,
          majorDimension: 'ROWS',
          values: values
        })
      }, token);

      console.log(`Berhasil menyinkronkan tabel ${tableName} ke Google Sheets.`);
    } catch (err: any) {
      console.error(`Gagal menyinkronkan tabel ${tableName} ke Google Sheets:`, err);
      throw err;
    }
  }

  // Sinkronisasi Google Sheets -> lokal (LocalStorage)
  async syncFromGoogleSheets(accessToken?: string): Promise<void> {
    this.isSyncingFromSheets = true;
    try {
      const appsScriptUrl = await this.getAppsScriptUrl();
      if (appsScriptUrl) {
        for (const cfg of TABS_CONFIG) {
          try {
            const res = await fetch(`${appsScriptUrl}?sheet=${encodeURIComponent(cfg.name)}`, { method: 'GET' });
            if (res.ok) {
              const json = await res.json();
              const rows: any[][] = json.values || [];
              if (rows.length > 1) {
                const headers = rows[0];
                const items: any[] = [];
                for (let i = 1; i < rows.length; i++) {
                  const row = rows[i];
                  if (row.length === 0 || !row[0]) continue;
                  const obj: any = {};
                  headers.forEach((header, colIdx) => {
                    let cellVal = row[colIdx];
                    if (cellVal === undefined || cellVal === null) cellVal = '';
                    
                    if (typeof cellVal === 'string' && (cellVal.startsWith('[') || cellVal.startsWith('{'))) {
                      try {
                        cellVal = JSON.parse(cellVal);
                      } catch (_) {}
                    }
                    const canonicalKey = this.getCanonicalHeader(header, cfg.headers);
                    if (canonicalKey) {
                      obj[canonicalKey] = cellVal;
                    }
                  });
                  items.push(obj);
                }
                this.setLocalTable(cfg.name, items);
              } else {
                this.setLocalTable(cfg.name, []);
              }
            }
          } catch (e) {
            console.warn(`Gagal menarik data ${cfg.name} via Apps Script:`, e);
          }
        }
        return;
      }

      const token = accessToken || localStorage.getItem('google_oauth_token') || '';
      const spreadsheetId = await this.getSpreadsheetId();
      if (!spreadsheetId) {
        throw new Error("Spreadsheet ID belum terkonfigurasi!");
      }

      let fetchedViaREST = false;

      // Coba lewat REST API jika token tersedia
      if (token) {
        try {
          await this.initializeExistingSpreadsheet(spreadsheetId, token);

          for (const cfg of TABS_CONFIG) {
            const res = await this.fetchSheetsAPI(spreadsheetId, `/values/${encodeURIComponent(cfg.name)}!A1:Z5000`, { method: 'GET' }, token);
            const rows: any[][] = res.values || [];
            if (rows.length <= 1) {
              this.setLocalTable(cfg.name, []);
              continue;
            }
            
            const headers = rows[0];
            const items: any[] = [];
            
            for (let i = 1; i < rows.length; i++) {
              const row = rows[i];
              if (row.length === 0 || !row[0]) continue;
              
              const obj: any = {};
              headers.forEach((header, colIdx) => {
                let cellVal = row[colIdx];
                if (cellVal === undefined || cellVal === null) cellVal = '';
                
                if (typeof cellVal === 'string' && (cellVal.startsWith('[') || cellVal.startsWith('{'))) {
                  try {
                    cellVal = JSON.parse(cellVal);
                  } catch (_) {}
                }
                const canonicalKey = this.getCanonicalHeader(header, cfg.headers);
                if (canonicalKey) {
                  obj[canonicalKey] = cellVal;
                }
              });
              
              items.push(obj);
            }

            this.setLocalTable(cfg.name, items);
          }
          fetchedViaREST = true;
          console.log("Berhasil menyinkronkan seluruh tabel dari Google Sheets melalui REST API.");
        } catch (errREST) {
          console.warn("Gagal menarik data via REST API, mencoba dengan GViz Public fallback:", errREST);
        }
      }

      // Fallback ke GViz Public REST API jika belum berhasil ditarik via REST API atau tidak memiliki token
      if (!fetchedViaREST) {
        console.log("Menarik data database spreadsheet menggunakan Google Visualization API (Public Fallback)...");
        for (const cfg of TABS_CONFIG) {
          try {
            const publicRes = await fetch(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(cfg.name)}`);
            if (publicRes.ok) {
              const txt = await publicRes.text();
              const match = txt.match(/google\.visualization\.Query\.setResponse\(([\s\S]*?)\);/);
              if (match) {
                const json = JSON.parse(match[1]);
                if (json.table && json.table.rows) {
                  const cols = json.table.cols || [];
                  const headers = cols.map((c: any) => c.label || '').filter(Boolean);
                  const activeHeaders = headers.length > 0 ? headers : cfg.headers;

                  const items: any[] = [];
                  json.table.rows.forEach((row: any) => {
                    const obj: any = {};
                    if (row.c) {
                      row.c.forEach((cell: any, idx: number) => {
                        const key = activeHeaders[idx];
                        if (key) {
                          let val = cell ? cell.v : null;
                          if (val === null || val === undefined) val = '';
                          
                          if (typeof val === 'string' && (val.startsWith('[') || val.startsWith('{'))) {
                            try {
                              val = JSON.parse(val);
                            } catch (_) {}
                          }
                          const canonicalKey = this.getCanonicalHeader(key, cfg.headers);
                          if (canonicalKey) {
                            obj[canonicalKey] = val;
                          }
                        }
                      });
                    }
                    // Filter row-row kosong
                    if (Object.keys(obj).length > 0 && (obj.id || obj.nis || obj.nisn || obj.title || obj.code || obj.name || obj.tpId)) {
                      items.push(obj);
                    }
                  });

                  this.setLocalTable(cfg.name, items);
                }
              }
            }
          } catch (ePublic) {
            console.warn(`Gagal menarik data ${cfg.name} via GViz Public fallback:`, ePublic);
          }
        }
      }
    } finally {
      this.isSyncingFromSheets = false;
    }
  }

  // --- ADMIN FUNCTIONS ---
  async verifyAdminLogin(username: string, password: string): Promise<AdminUser | null> {
    let isSynced = false;
    this.isSyncingFromSheets = true;
    try {
      // Langkah 1: Cek Google Apps Script Web App URL jika tersedia
    const appsScriptUrl = await this.getAppsScriptUrl();
    if (appsScriptUrl) {
      try {
        const res = await fetch(`${appsScriptUrl}?sheet=admin_users`, { method: 'GET' });
        if (res.ok) {
          const json = await res.json();
          const rows: any[][] = json.values || [];
          if (rows.length > 1) {
            const headers = rows[0];
            const items: any[] = [];
            for (let i = 1; i < rows.length; i++) {
              const row = rows[i];
              if (row.length === 0 || !row[0]) continue;
              const obj: any = {};
              headers.forEach((header, colIdx) => {
                let cellVal = row[colIdx];
                if (cellVal === undefined || cellVal === null) cellVal = '';
                obj[header] = cellVal;
              });
              items.push(obj);
            }
            if (items.length > 0) {
              this.setLocalTable('admin_users', items);
              isSynced = true;
            }
          }
        }
      } catch (eScript) {
        console.warn("Gagal menarik data admin_users via Apps Script:", eScript);
      }
    }

    // Langkah 2: Jika Apps Script tidak ada atau gagal, cek via Google Sheets REST API / GViz Public
    if (!isSynced) {
      const spreadsheetId = await this.getSpreadsheetId();
      if (spreadsheetId) {
        const cachedToken = localStorage.getItem('google_oauth_token');
        
        // Tarik data admin_users menggunakan OAuth token jika tersedia
        if (cachedToken) {
          try {
            const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/admin_users!A1:Z5000`, {
              headers: {
                'Authorization': `Bearer ${cachedToken}`
              }
            });
            if (res.ok) {
              const data = await res.json();
              const rows: any[][] = data.values || [];
              if (rows.length > 1) {
                const headers = rows[0];
                const items: any[] = [];
                for (let i = 1; i < rows.length; i++) {
                  const row = rows[i];
                  if (row.length === 0 || !row[0]) continue;
                  const obj: any = {};
                  headers.forEach((header, colIdx) => {
                    let cellVal = row[colIdx];
                    if (cellVal === undefined || cellVal === null) cellVal = '';
                    obj[header] = cellVal;
                  });
                  items.push(obj);
                }
                if (items.length > 0) {
                  this.setLocalTable('admin_users', items);
                  isSynced = true;
                }
              }
            }
          } catch (eToken) {
            console.warn("Gagal menarik data via OAuth token, mencoba metode alternatif:", eToken);
          }
        }

        // Jika OAuth tidak terisi atau gagal, coba tarik data dari GViz Public
        if (!isSynced) {
          try {
            const publicRes = await fetch(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=admin_users`);
            if (publicRes.ok) {
              const txt = await publicRes.text();
              const match = txt.match(/google\.visualization\.Query\.setResponse\(([\s\S]*?)\);/);
              if (match) {
                const json = JSON.parse(match[1]);
                if (json.table && json.table.rows) {
                  const cols = json.table.cols || [];
                  const headers = cols.map((c: any) => c.label || '').filter(Boolean);
                  const activeHeaders = headers.length > 0 ? headers : ['id', 'username', 'fullname', 'password', 'role', 'created_at'];

                  const items = json.table.rows.map((row: any) => {
                    const obj: any = {};
                    if (row.c) {
                      row.c.forEach((cell: any, idx: number) => {
                        const key = activeHeaders[idx];
                        if (key) {
                          let val = cell ? cell.v : null;
                          if (val === null || val === undefined) val = '';
                          obj[key] = String(val);
                        }
                      });
                    }
                    return obj;
                  }).filter((item: any) => item.username);

                  if (items.length > 0) {
                    this.setLocalTable('admin_users', items);
                    isSynced = true;
                  }
                }
              }
            }
          } catch (ePublic) {
            console.warn("Gagal menarik data via Google GViz Public API:", ePublic);
          }
        }
      }
    }

    // Ambil data admin di cache lokal (yang terupdate) dan cek kecocokannya
    const list = await this.getAdmins();
    const match = list.find(a => a.username === username && String(a.password) === String(password));
    return match || null;
    } finally {
      this.isSyncingFromSheets = false;
    }
  }

  async getAdmins(): Promise<AdminUser[]> {
    const table = this.getLocalTable<AdminUser>('admin_users');
    if (table.length === 0) {
      const defaultAdmin: AdminUser = {
        id: 'default-admin-pai',
        fullname: 'Bapak Guru PAI',
        username: 'guru',
        password: '123',
        role: 'Super Admin',
        created_at: new Date().toISOString()
      };
      const seeded = [defaultAdmin];
      this.setLocalTable('admin_users', seeded);
      return seeded;
    }
    return table.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async addAdmin(admin: Partial<AdminUser>): Promise<{ success: boolean; synced: boolean; error?: string }> {
    const id = admin.id || 'admin_' + Math.random().toString(36).substr(2, 9);
    const cleanAdmin = {
      ...admin,
      id,
      created_at: admin.created_at || new Date().toISOString()
    } as AdminUser;
    const list = await this.getAdmins();
    const existingIdx = list.findIndex(a => a.id === id);
    if (existingIdx > -1) {
      list[existingIdx] = cleanAdmin;
    } else {
      list.push(cleanAdmin);
    }
    this.setLocalTable('admin_users', list);

    let synced = false;
    let syncError = '';
    const appsScriptUrl = await this.getAppsScriptUrl();
    const token = localStorage.getItem('google_oauth_token');
    
    if (appsScriptUrl || token) {
      try {
        await this.syncTableToGoogleSheets('admin_users', token || undefined);
        synced = true;
      } catch (err: any) {
        console.error("Gagal melakukan auto-ekspor admin ke Google Sheets:", err);
        syncError = err.message || String(err);
      }
    }
    return { success: true, synced, error: syncError };
  }

  async deleteAdmin(id: string): Promise<{ success: boolean; synced: boolean; error?: string }> {
    const list = await this.getAdmins();
    const filtered = list.filter(a => a.id !== id);
    this.setLocalTable('admin_users', filtered);

    let synced = false;
    let syncError = '';
    const appsScriptUrl = await this.getAppsScriptUrl();
    const token = localStorage.getItem('google_oauth_token');
    
    if (appsScriptUrl || token) {
      try {
        await this.syncTableToGoogleSheets('admin_users', token || undefined);
        synced = true;
      } catch (err: any) {
        console.error("Gagal melakukan auto-ekspor admin ke Google Sheets setelah penghapusan:", err);
        syncError = err.message || String(err);
      }
    }
    return { success: true, synced, error: syncError };
  }

  // --- STUDENT FUNCTIONS ---
  async getStudentByNIS(nis: string | number): Promise<Student | null> {
    if (nis === undefined || nis === null) return null;
    const cleanNis = nis.toString().trim().toLowerCase();
    if (!cleanNis) return null;

    const list = this.getLocalTable<any>('data_siswa');
    for (const item of list) {
      const normalized = this.normalizeStudent(item);
      if (normalized) {
        if (normalized.nis.toLowerCase() === cleanNis) {
          return normalized;
        }
      }
    }
    return null;
  }

  async getStudentByNISN(nis: string | number): Promise<Student | null> {
    return this.getStudentByNIS(nis);
  }

  async getStudentsByKelas(kelas: string): Promise<Student[]> {
    const list = this.getLocalTable<any>('data_siswa');
    const result: Student[] = [];
    for (const item of list) {
      const normalized = this.normalizeStudent(item);
      if (normalized && normalized.kelas.toLowerCase() === kelas.toLowerCase()) {
        result.push(normalized);
      }
    }
    return result.sort((a, b) => a.namalengkap.localeCompare(b.namalengkap));
  }

  async getStudentsByGrade(grade: string): Promise<Student[]> {
    const list = this.getLocalTable<any>('data_siswa');
    const result: Student[] = [];
    for (const item of list) {
      const normalized = this.normalizeStudent(item);
      if (normalized && normalized.kelas && normalized.kelas.startsWith(`${grade}.`)) {
        result.push(normalized);
      }
    }
    return result;
  }

  async getAvailableKelas(grade?: string): Promise<string[]> {
    const list = this.getLocalTable<any>('data_siswa');
    const result: string[] = [];
    for (const item of list) {
      const normalized = this.normalizeStudent(item);
      if (normalized && normalized.kelas) {
        if (!grade || normalized.kelas.startsWith(`${grade}.`)) {
          result.push(normalized.kelas);
        }
      }
    }
    return Array.from(new Set<string>(result)).filter(Boolean).sort();
  }

  async upsertStudents(students: Student[]): Promise<void> {
    const list = this.getLocalTable<any>('data_siswa');
    const normalizedList = list.map(item => this.normalizeStudent(item)).filter(Boolean) as Student[];

    for (const s of students) {
      const cleanS = this.normalizeStudent(s);
      if (!cleanS) continue;
      
      const idx = normalizedList.findIndex(item => item.id === cleanS.id || item.nis === cleanS.nis);
      if (idx > -1) {
        normalizedList[idx] = cleanS;
      } else {
        normalizedList.push(cleanS);
      }
    }
    this.setLocalTable('data_siswa', normalizedList);

    // Sinkronisasi sinkron ke Google Sheets jika integrasi dikonfigurasi
    const appsScriptUrl = await this.getAppsScriptUrl();
    const spreadsheetId = await this.getSpreadsheetId();
    if (appsScriptUrl || spreadsheetId) {
      const token = localStorage.getItem('google_oauth_token') || undefined;
      await this.syncTableToGoogleSheets('data_siswa', token);
    }
  }

  async deleteStudent(id: string): Promise<void> {
    const list = this.getLocalTable<any>('data_siswa');
    const filtered = list.filter(item => {
      const norm = this.normalizeStudent(item);
      return norm ? norm.id !== id : true;
    });
    this.setLocalTable('data_siswa', filtered);

    // Sinkronisasi sinkron ke Google Sheets jika integrasi dikonfigurasi
    const appsScriptUrl = await this.getAppsScriptUrl();
    const spreadsheetId = await this.getSpreadsheetId();
    if (appsScriptUrl || spreadsheetId) {
      const token = localStorage.getItem('google_oauth_token') || undefined;
      await this.syncTableToGoogleSheets('data_siswa', token);
    }
  }

  // --- GRADE FUNCTIONS ---
  async addGrade(grade: Partial<GradeRecord>): Promise<void> {
    const list = this.getLocalTable<GradeRecord>('Nilai');
    
    // Check if an existing grade record for this student, description, kelas and semester exists, and update it
    const existingIdx = list.findIndex(g => 
      g.student_id === grade.student_id && 
      g.description === grade.description && 
      g.kelas === grade.kelas && 
      g.semester === grade.semester
    );

    if (existingIdx !== -1) {
      list[existingIdx] = {
        ...list[existingIdx],
        ...grade,
        created_at: grade.created_at || list[existingIdx].created_at || new Date().toISOString()
      };
    } else {
      const id = grade.id || 'grade_' + Math.random().toString(36).substr(2, 9);
      const cleanGrade = {
        ...grade,
        id,
        created_at: grade.created_at || new Date().toISOString()
      } as GradeRecord;
      list.push(cleanGrade);
    }
    this.setLocalTable('Nilai', list);

      // Real-time integration: recalculate and save corresponding nilai_rapot record automatically!
      if (grade.student_id && grade.semester && grade.kelas) {
        await this.recalculateAndSaveKelolaNilaiForStudent(grade.student_id, String(grade.semester), String(grade.kelas));
      }
  }

  async recalculateAndSaveKelolaNilaiForStudent(studentId: string, semester: string, kelas: string): Promise<void> {
    if (!studentId || !semester || !kelas) return;
    try {
      const studentList = this.getLocalTable<any>('data_siswa');
      const student = studentList.find(s => s.id === studentId);
      const studentGradeLevel = kelas.trim().charAt(0) || '7';

      // 1. Fetch student's grades for this class and semester
      const gradesList = this.getLocalTable<GradeRecord>('Nilai');
      const studentGrades = gradesList.filter(g => 
        g.student_id === studentId && 
        String(g.semester) === String(semester) && 
        g.kelas === kelas
      );

      // 2. Fetch TPs, Assessments, and Weights
      const tps = this.getLocalTable<any>('tujuan_pembelajaran');
      const assessments = this.getLocalTable<any>('asesmen_tp');
      const savedWeights = localStorage.getItem('pai_grade_weights');
      const weights = savedWeights ? JSON.parse(savedWeights) : { harian: 35, sts: 20, sas: 20, kehadiran: 10, sikap: 15 };

      // Filter active TPs for this grade & semester and sort starting from TP 1
      const currentClassTps = tps
        .filter((t: any) => String(t.grade) === String(studentGradeLevel) && String(t.semester) === String(semester))
        .sort((a: any, b: any) => {
          const codeA = String(a.code || '').toLowerCase();
          const codeB = String(b.code || '').toLowerCase();
          return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
        });

      // 3. Map student's grades into assessment scores
      const tpScores: Record<string, number> = {};
      let studentSts: number | '' = '';
      let studentSas: number | '' = '';

      studentGrades.forEach(g => {
        const typeLower = String(g.subject_type).toLowerCase().trim();
        if (typeLower === 'uts' || typeLower === 'pts') {
          studentSts = g.score;
        } else if (typeLower === 'uas' || typeLower === 'pas') {
          studentSas = g.score;
        } else {
          if (g.description) {
            tpScores[g.description] = g.score;
          }
        }
      });

      // 4. Calculate TP scores & Nilai Harian Avg
      let sumHarian = 0;
      let countHarian = 0;

      currentClassTps.forEach((tp: any) => {
        // Find assessments tied to this TP
        const tpAsms = assessments.filter((a: any) => String(a.tpId) === String(tp.id));
        if (tpAsms.length > 0) {
          let sumAsm = 0;
          let countAsm = 0;
          tpAsms.forEach((asm: any) => {
            const val = tpScores[asm.id];
            if (val !== undefined && val !== null && val !== '') {
              sumAsm += Number(val);
              countAsm++;
            }
          });
          if (countAsm > 0) {
            sumHarian += sumAsm / countAsm;
            countHarian++;
          }
        }
      });

      const harianAvg = countHarian > 0 ? parseFloat((sumHarian / countHarian).toFixed(1)) : null;

      // 5. Fetch existing nilai_rapot record to hold attitudes, katrol etc.
      const kelolaList = this.getLocalTable<any>('nilai_rapot');
      const overallKey = `${studentId}_${semester}`;
      const existingKelola = kelolaList.find(x => x.id === overallKey) || {};

      // 6. Compute attendance counts from kehadiran table
      const attRecords = this.getLocalTable<any>('kehadiran').filter(att => 
        att.student_id === studentId && 
        String(att.semester) === String(semester)
      );

      let sakit = 0, izin = 0, alpha = 0;
      if (attRecords.length > 0) {
        attRecords.forEach(att => {
          if (att.status === 'sakit') sakit++;
          else if (att.status === 'izin') izin++;
          else if (att.status === 'alfa' || att.status === 'alpha') alpha++;
        });
      } else {
        sakit = existingKelola.sakit || 0;
        izin = existingKelola.izin || 0;
        alpha = existingKelola.alpha || 0;
      }

      const getAttendanceScore = (sk: number, iz: number, al: number): number => {
        const deduction = (sk * 1) + (iz * 2) + (al * 5);
        return Math.max(0, 100 - deduction);
      };
      const kehadiranScore = getAttendanceScore(sakit, izin, alpha);

      // Attitude
      const sikapStr = existingKelola.sikap || '';
      const getAttitudeScore = (s: string, nh: number | null): number => {
        if (s === 'Sangat Baik') return 95;
        if (s === 'Baik') return 85;
        if (s === 'Cukup') return 75;
        if (s === 'Perlu Bimbingan') return 60;
        return nh !== null ? Math.round(nh) : 85;
      };
      const sikapScore = getAttitudeScore(sikapStr, harianAvg);

      const katrol = existingKelola.katrol !== undefined && existingKelola.katrol !== '' ? Number(existingKelola.katrol) : 0;

      // 7. Calculate Nilai Akhir
      let finalScore: number | '' = '';
      if (harianAvg !== null) {
        const wHarian = (weights.harian ?? 35) / 100;
        const wSts = (weights.sts ?? 20) / 100;
        const wSas = (weights.sas ?? 20) / 100;
        const wKehadiran = (weights.kehadiran ?? 10) / 100;
        const wSikap = (weights.sikap ?? 15) / 100;

        const result = 
          (harianAvg * wHarian) + 
          ((studentSts !== '' ? studentSts : 0) * wSts) + 
          ((studentSas !== '' ? studentSas : 0) * wSas) + 
          (kehadiranScore * wKehadiran) + 
          (sikapScore * wSikap);

        finalScore = Math.min(100, Math.max(0, Math.round(result) + katrol));
      }

      const updatedRecord = {
        id: overallKey,
        student_id: studentId,
        nama_siswa: student?.namalengkap || existingKelola.nama_siswa || 'Siswa',
        nis: student?.nis || existingKelola.nis || '-',
        kelas: kelas,
        semester: semester,
        sts: studentSts,
        sas: studentSas,
        sakit,
        izin,
        alpha,
        sikap: sikapStr,
        katrol: existingKelola.katrol !== undefined ? existingKelola.katrol : '',
        nilai_akhir: finalScore,
        updated_at: new Date().toISOString()
      };

      const matchIdx = kelolaList.findIndex(x => x.id === overallKey);
      if (matchIdx !== -1) {
        kelolaList[matchIdx] = updatedRecord;
      } else {
        kelolaList.push(updatedRecord);
      }
      this.setLocalTable('nilai_rapot', kelolaList);

    } catch (e) {
      console.error("Gagal sinkronisasikan nilai_rapot secara otomatis:", e);
    }
  }

  async getGradesByStudent(studentId: string): Promise<GradeRecord[]> {
    const list = this.getLocalTable<GradeRecord>('Nilai');
    return list.filter(g => g.student_id === studentId).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async getGradesByKelas(kelas: string, semester?: string): Promise<any[]> {
    const list = this.getLocalTable<GradeRecord>('Nilai');
    let filtered = list.filter(g => g.kelas === kelas);

    if (semester) {
      const s = semester.toLowerCase();
      if (s === '1' || s === 'ganjil') {
        filtered = filtered.filter((g: any) => ['1', 'ganjil', 'semester 1'].includes(String(g.semester || '').toLowerCase()));
      } else if (s === '2' || s === 'genap') {
        filtered = filtered.filter((g: any) => ['2', 'genap', 'semester 2'].includes(String(g.semester || '').toLowerCase()));
      } else {
        filtered = filtered.filter((g: any) => String(g.semester || '').toLowerCase() === s);
      }
    }

    const students = await this.getStudentsByKelas(kelas);
    return filtered.map((g: any) => ({
      ...g,
      data_siswa: students.find(s => s.id === g.student_id) || { namalengkap: 'Siswa', nis: '-' }
    }));
  }

  // --- ATTENDANCE FUNCTIONS ---
  async addAttendance(records: Partial<AttendanceRecord>[]): Promise<void> {
    const list = this.getLocalTable<AttendanceRecord>('kehadiran');
    for (const record of records) {
      const id = record.id || 'att_' + Math.random().toString(36).substr(2, 9);
      const cleanRecord = {
        ...record,
        id,
        created_at: new Date().toISOString()
      } as AttendanceRecord;
      list.push(cleanRecord);
    }
    this.setLocalTable('kehadiran', list);
  }

  async getAttendanceByStudent(studentId: string): Promise<AttendanceRecord[]> {
    const list = this.getLocalTable<AttendanceRecord>('kehadiran');
    return list.filter(a => a.student_id === studentId).sort((a, b) => b.date.localeCompare(a.date));
  }

  async getAttendanceByKelas(kelas: string, semester?: string, month?: string, year?: string): Promise<any[]> {
    const list = this.getLocalTable<AttendanceRecord>('kehadiran');
    let filtered = list.filter(a => a.kelas === kelas);

    if (semester) {
      filtered = filtered.filter((a: any) => String(a.semester) === String(semester));
    }

    if (month) {
      const selectedYear = year || new Date().getFullYear().toString();
      const prefix = `${selectedYear}-${month.padStart(2, '0')}`;
      filtered = filtered.filter((a: any) => a.date && a.date.startsWith(prefix));
    }

    return filtered.sort((a: any, b: any) => a.date.localeCompare(b.date)).map((a: any) => ({
      ...a,
      data_siswa: { namalengkap: a.nama_siswa, nis: a.nis }
    }));
  }

  // --- KELOLA NILAI FUNCTIONS ---
  async getKelolaNilai(): Promise<any[]> {
    return this.getLocalTable<any>('nilai_rapot');
  }

  async saveKelolaNilai(records: any[]): Promise<void> {
    const list = this.getLocalTable<any>('nilai_rapot');
    
    for (const record of records) {
      const idx = list.findIndex(item => item.id === record.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...record, updated_at: new Date().toISOString() };
      } else {
        list.push({ ...record, updated_at: new Date().toISOString() });
      }
    }
    
    this.setLocalTable('nilai_rapot', list);
  }

  // --- RESET FUNCTIONS ---
  async resetAttendance(): Promise<void> {
    this.setLocalTable('kehadiran', []);
  }
  async resetGrades(): Promise<void> {
    this.setLocalTable('Nilai', []);
  }
  async resetTasks(): Promise<void> {
    this.setLocalTable('data_TugasSiswa', []);
  }
  async resetStudents(): Promise<void> {
    this.setLocalTable('data_siswa', []);
  }
  async resetMaterials(): Promise<void> {
    this.setLocalTable('materi_belajar', []);
  }
  async resetExams(): Promise<void> {
    this.setLocalTable('ujian', []);
  }
  async resetQuestions(): Promise<void> {
    this.setLocalTable('bank_soal', []);
  }
  async resetExamResults(): Promise<void> {
    this.setLocalTable('hasil_ujian', []);
  }
  async resetTujuanPembelajaran(): Promise<void> {
    this.setLocalTable('tujuan_pembelajaran', []);
  }
  async resetAsesmenTp(): Promise<void> {
    this.setLocalTable('asesmen_tp', []);
  }
  async resetKunjungan(): Promise<void> {
    this.setLocalTable('kunjungan', []);
  }
  async logKunjungan(nis: string, nama: string, kelas: string, halaman: string): Promise<void> {
    try {
      const records = this.getLocalTable<any>('kunjungan') || [];
      
      // Deteksi Device
      let device = 'Desktop';
      const ua = navigator.userAgent || '';
      if (/tablet|ipad|playbook|silk/i.test(ua)) {
        device = 'Tablet';
      } else if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Opera Mini/i.test(ua)) {
        device = 'Mobile';
      } else if (window.innerWidth < 768) {
        device = 'Mobile';
      } else if (window.innerWidth < 1024) {
        device = 'Tablet';
      }

      // Deteksi Browser
      let browser = 'Chrome';
      if (ua.indexOf("Firefox") > -1) {
        browser = "Firefox";
      } else if (ua.indexOf("SamsungBrowser") > -1) {
        browser = "Samsung Browser";
      } else if (ua.indexOf("Opera") > -1 || ua.indexOf("OPR") > -1) {
        browser = "Opera";
      } else if (ua.indexOf("Trident") > -1) {
        browser = "IE";
      } else if (ua.indexOf("Edge") > -1 || ua.indexOf("Edg") > -1) {
        browser = "Edge";
      } else if (ua.indexOf("Chrome") > -1) {
        browser = "Chrome";
      } else if (ua.indexOf("Safari") > -1) {
        browser = "Safari";
      }

      // Durasi sesi (detik)
      const sessionKey = 'pai_session_start_time';
      let duration = 30; // default/fallback
      const sessionStartStr = sessionStorage.getItem(sessionKey);
      if (sessionStartStr) {
        const diffSeconds = Math.round((Date.now() - parseInt(sessionStartStr)) / 1000);
        duration = Math.max(5, Math.min(diffSeconds, 1800)); // limit max 30 menit
      } else {
        sessionStorage.setItem(sessionKey, Date.now().toString());
        duration = Math.floor(Math.random() * 25) + 10; // random 10-35s awal
      }

      const newRecord = {
        id: 'v_' + Math.random().toString(36).substr(2, 9),
        nis: nis || 'Anonim',
        nama: nama || 'Pengunjung Umum',
        kelas: kelas || 'Umum',
        halaman,
        timestamp: new Date().toISOString(),
        device,
        browser,
        duration
      };
      
      records.push(newRecord);
      this.setLocalTable('kunjungan', records);
    } catch (e) {
      console.error("Gagal mencatat kunjungan:", e);
    }
  }
  async getKunjungan(): Promise<any[]> {
    const records = this.getLocalTable<any>('kunjungan') || [];
    return records.filter((r: any) => r && r.id && !r.id.startsWith('v_seed_'));
  }
  async resetAllData(): Promise<void> {
    await Promise.all([
      this.resetAttendance(),
      this.resetGrades(),
      this.resetTasks(),
      this.resetStudents(),
      this.resetMaterials(),
      this.resetExams(),
      this.resetQuestions(),
      this.resetExamResults(),
      this.resetTujuanPembelajaran(),
      this.resetAsesmenTp(),
      this.resetKunjungan()
    ]);
  }

  // --- TASK FUNCTIONS ---
  async addTaskSubmission(submission: Partial<TaskSubmission>): Promise<void> {
    const id = submission.id || 'task_' + Math.random().toString(36).substr(2, 9);
    const cleanSub = {
      ...submission,
      id,
      created_at: submission.created_at || new Date().toISOString()
    } as TaskSubmission;
    const list = this.getLocalTable<TaskSubmission>('data_TugasSiswa');
    list.push(cleanSub);
    this.setLocalTable('data_TugasSiswa', list);
  }

  async getTaskSubmissions(grade?: string): Promise<TaskSubmission[]> {
    let list = this.getLocalTable<TaskSubmission>('data_TugasSiswa');
    list = list.sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (grade) {
      list = list.filter(s => s.kelas && s.kelas.startsWith(`${grade}.`));
    }
    return list;
  }

  async deleteTaskSubmission(id: string): Promise<void> {
    const list = this.getLocalTable<TaskSubmission>('data_TugasSiswa');
    const filtered = list.filter(s => s.id !== id);
    this.setLocalTable('data_TugasSiswa', filtered);
  }

  async getMaterials(grade?: GradeLevel): Promise<Material[]> {
    let list: Material[] = [];
    try {
      const querySnapshot = await getDocs(collection(firestore, 'materi_belajar'));
      const firestoreList: Material[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        firestoreList.push({
          id: docSnap.id,
          title: data.title || '',
          description: data.description || '',
          grade: data.grade || '7',
          category: data.category || 'Aqidah',
          content_url: data.content_url || '',
          thumbnail: data.thumbnail || '',
          semester: data.semester || '1',
          kelas: data.kelas || 'Semua Kelas',
          tp_id: data.tp_id || '',
          text_content: data.text_content || '',
          created_at: data.created_at || new Date().toISOString()
        } as Material);
      });

      if (firestoreList.length > 0) {
        list = firestoreList;
        // Sinkronisasi data Firestore ke localStorage untuk caching offline
        this.setLocalTable('materi_belajar', list);
      } else {
        list = this.getLocalTable<Material>('materi_belajar');
      }
    } catch (err) {
      console.warn("Gagal menarik data materi dari Firestore, menggunakan fallback LocalStorage:", err);
      list = this.getLocalTable<Material>('materi_belajar');
    }

    list = list.filter(m => m.id !== 'mat-1' && m.id !== 'mat-2');

    if (grade) {
      return list.filter(m => m.grade === grade);
    }
    return list;
  }

  async createMaterial(material: Omit<Material, 'id'>): Promise<Material> {
    const list = this.getLocalTable<Material>('materi_belajar') || [];
    const id = 'mat_' + Math.random().toString(36).substr(2, 9);
    const newMaterial: Material = {
      ...material,
      id,
      created_at: new Date().toISOString()
    };
    list.push(newMaterial);
    this.setLocalTable('materi_belajar', list);

    try {
      await setDoc(doc(firestore, 'materi_belajar', id), {
        title: newMaterial.title || '',
        description: newMaterial.description || '',
        grade: newMaterial.grade || '7',
        category: newMaterial.category || 'Aqidah',
        content_url: newMaterial.content_url || '',
        thumbnail: newMaterial.thumbnail || '',
        semester: newMaterial.semester || '1',
        kelas: newMaterial.kelas || 'Semua Kelas',
        tp_id: newMaterial.tp_id || '',
        text_content: newMaterial.text_content || '',
        created_at: newMaterial.created_at || new Date().toISOString()
      });
      console.log('Materi berhasil disimpan ke Firestore:', id);
    } catch (err) {
      console.error('Gagal menyimpan materi ke Firestore:', err);
    }

    return newMaterial;
  }

  async updateMaterial(id: string, data: Partial<Material>): Promise<Material> {
    const list = this.getLocalTable<Material>('materi_belajar') || [];
    const index = list.findIndex(m => m.id === id);
    if (index === -1) {
      throw new Error('Materi tidak ditemukan');
    }
    const updated = { ...list[index], ...data };
    list[index] = updated;
    this.setLocalTable('materi_belajar', list);

    try {
      await setDoc(doc(firestore, 'materi_belajar', id), {
        title: updated.title || '',
        description: updated.description || '',
        grade: updated.grade || '7',
        category: updated.category || 'Aqidah',
        content_url: updated.content_url || '',
        thumbnail: updated.thumbnail || '',
        semester: updated.semester || '1',
        kelas: updated.kelas || 'Semua Kelas',
        tp_id: updated.tp_id || '',
        text_content: updated.text_content || '',
        created_at: updated.created_at || new Date().toISOString()
      }, { merge: true });
      console.log('Materi berhasil diperbarui di Firestore:', id);
    } catch (err) {
      console.error('Gagal memperbarui materi di Firestore:', err);
    }

    return updated;
  }

  async deleteMaterial(id: string): Promise<void> {
    const list = this.getLocalTable<Material>('materi_belajar') || [];
    const filtered = list.filter(m => m.id !== id);
    this.setLocalTable('materi_belajar', filtered);

    try {
      await deleteDoc(doc(firestore, 'materi_belajar', id));
      console.log('Materi berhasil dihapus dari Firestore:', id);
    } catch (err) {
      console.error('Gagal menghapus materi dari Firestore:', err);
    }
  }

  // --- EXAM & QUESTION FUNCTIONS ---
  async getExams(): Promise<Exam[]> {
    const list = this.getLocalTable<Exam>('ujian');
    return list.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  async getExamById(id: string): Promise<Exam | undefined> {
    const list = this.getLocalTable<Exam>('ujian');
    return list.find(e => e.id === id);
  }

  async createExam(exam: Omit<Exam, 'id' | 'created_at'>): Promise<Exam> {
    const id = 'exam_' + Math.random().toString(36).substr(2, 9);
    const newExam = {
      ...exam,
      id,
      created_at: new Date().toISOString()
    } as Exam;
    const list = this.getLocalTable<Exam>('ujian');
    list.push(newExam);
    this.setLocalTable('ujian', list);
    return newExam;
  }

  async updateExam(id: string, updates: Partial<Exam>): Promise<void> {
    const list = this.getLocalTable<Exam>('ujian');
    const idx = list.findIndex(e => e.id === id);
    if (idx > -1) {
      list[idx] = { ...list[idx], ...updates };
      this.setLocalTable('ujian', list);
    }
  }

  async updateExamStatus(id: string, status: 'draft' | 'active' | 'closed'): Promise<void> {
    await this.updateExam(id, { status });
  }

  async deleteExam(id: string): Promise<void> {
    const list = this.getLocalTable<Exam>('ujian');
    const filtered = list.filter(e => e.id !== id);
    this.setLocalTable('ujian', filtered);
    await this.deleteAllQuestionsByExamId(id);
  }

  async getQuestionsByExamId(examId: string): Promise<Question[]> {
    const list = this.getLocalTable<Question>('bank_soal');
    return list.filter(q => q.exam_id === examId).map(q => {
      const raw = q as any;
      const id = raw.id || '';
      const exam_id = raw.exam_id || '';
      const type = raw.type || 'pg';
      const text = raw.text || '';
      
      // Map multiple Indonesian or general names for image column
      const image_url = raw.image_url || raw.gambar || raw.foto || raw.image_path || raw.image || '';
      
      let options = raw.options;
      if (typeof options === 'string') {
        try {
          options = JSON.parse(options);
        } catch (_) {
          options = options.split(',').map((o: string) => o.trim());
        }
      }
      
      const correct_answer = String(raw.correct_answer || raw.jawaban_benar || raw.jawaban || '0');
      
      return {
        id,
        exam_id,
        type,
        text,
        image_url,
        options: Array.isArray(options) ? options : [],
        correct_answer
      } as Question;
    });
  }

  async addQuestion(question: Omit<Question, 'id'>): Promise<Question> {
    const id = 'q_' + Math.random().toString(36).substr(2, 9);
    const newQuestion = { ...question, id } as Question;
    const list = this.getLocalTable<Question>('bank_soal');
    list.push(newQuestion);
    this.setLocalTable('bank_soal', list);
    return newQuestion;
  }

  async updateQuestion(id: string, updates: Partial<Question>): Promise<void> {
    const list = this.getLocalTable<Question>('bank_soal');
    const idx = list.findIndex(q => q.id === id);
    if (idx > -1) {
      list[idx] = { ...list[idx], ...updates };
      this.setLocalTable('bank_soal', list);
    }
  }

  async deleteQuestion(id: string): Promise<void> {
    const list = this.getLocalTable<Question>('bank_soal');
    const filtered = list.filter(q => q.id !== id);
    this.setLocalTable('bank_soal', filtered);
  }

  async deleteAllQuestionsByExamId(examId: string): Promise<void> {
    const list = this.getLocalTable<Question>('bank_soal');
    const filtered = list.filter(q => q.exam_id !== examId);
    this.setLocalTable('bank_soal', filtered);
  }

  // --- student exam view ---
  async getAllActiveExams(): Promise<Exam[]> {
    const list = this.getLocalTable<Exam>('ujian');
    return list.filter(e => e.status === 'active');
  }

  async getActiveExamsByGrade(grade: string, semester: string): Promise<Exam[]> {
    const list = this.getLocalTable<Exam>('ujian');
    return list.filter(e => e.status === 'active' && e.grade === grade && String(e.semester) === String(semester));
  }

  async checkStudentExamResult(nis: string | number, examId: string | number): Promise<boolean> {
    if (nis === undefined || nis === null) return false;
    const cleanNis = nis.toString().trim().toLowerCase();
    const cleanExamId = examId.toString().trim().toLowerCase();

    const list = this.getLocalTable<ExamResult>('hasil_ujian');
    return list.some(r => {
      const rNis = r.student_nis ? r.student_nis.toString().trim().toLowerCase() : '';
      const rExamId = r.exam_id ? r.exam_id.toString().trim().toLowerCase() : '';
      return rNis === cleanNis && rExamId === cleanExamId;
    });
  }

  async hasExamResults(examId: string): Promise<boolean> {
    const list = this.getLocalTable<ExamResult>('hasil_ujian');
    const cleanExamId = examId.toString().trim().toLowerCase();
    return list.some(r => r.exam_id && r.exam_id.toString().trim().toLowerCase() === cleanExamId);
  }

  async submitExamResult(result: Omit<ExamResult, 'id' | 'submitted_at'>): Promise<ExamResult> {
    const list = this.getLocalTable<ExamResult>('hasil_ujian');
    
    // Safety check: prevent duplicate submissions of the same exam by the same NIS
    const cleanNis = result.student_nis.toString().trim().toLowerCase();
    const cleanExamId = result.exam_id.toString().trim().toLowerCase();
    const existing = list.find(r => {
      const rNis = r.student_nis ? r.student_nis.toString().trim().toLowerCase() : '';
      const rExamId = r.exam_id ? r.exam_id.toString().trim().toLowerCase() : '';
      return rNis === cleanNis && rExamId === cleanExamId;
    });

    if (existing) {
      console.warn("Safety Check: duplicate submission detected for NIS", cleanNis, "and exam", cleanExamId);
      return existing;
    }

    const id = 'res_' + Math.random().toString(36).substr(2, 9);
    const newResult = {
      ...result,
      id,
      submitted_at: new Date().toISOString()
    } as ExamResult;
    list.push(newResult);
    this.setLocalTable('hasil_ujian', list);

    try {
      const student = await this.getStudentByNIS(result.student_nis);
      const exam = await this.getExamById(result.exam_id);

      if (student && exam) {
        await this.addGrade({
          student_id: student.id!,
          subject_type: exam.category,
          score: result.score,
          description: exam.assessment_id || exam.title,
          kelas: result.student_class,
          semester: exam.semester,
          created_at: new Date().toISOString()
        });
      }
    } catch (e) {
      console.error("Gagal melakukan auto-grading:", e);
    }

    return newResult;
  }

  async getExamResults(grade?: string, semester?: string): Promise<any[]> {
    const list = this.getLocalTable<ExamResult>('hasil_ujian');
    let filtered = list;

    if (semester) {
      filtered = filtered.filter(r => String(r.semester) === String(semester));
    }
    if (grade) {
      filtered = filtered.filter(r => r.student_class && r.student_class.startsWith(`${grade}.`));
    }

    const exams = await this.getExams();
    return filtered.map(r => {
      const ex = exams.find(e => e.id === r.exam_id);
      return {
        ...r,
        ujian: ex ? { title: ex.title, category: ex.category, duration: ex.duration } : { title: 'Ujian dihapus', category: 'harian', duration: 0 }
      };
    }).sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));
  }

  async deleteExamResult(id: string): Promise<void> {
    const list = this.getLocalTable<ExamResult>('hasil_ujian');
    const targetIdx = list.findIndex(r => r.id === id);
    if (targetIdx > -1) {
      const resData = list[targetIdx];
      const student = await this.getStudentByNIS(resData.student_nis);
      const exam = await this.getExamById(resData.exam_id);

      if (student && student.id && exam) {
        const grades = this.getLocalTable<GradeRecord>('Nilai');
        const filteredGrades = grades.filter(g => !(g.student_id === student.id && g.description === exam.title));
        this.setLocalTable('Nilai', filteredGrades);
      }
      list.splice(targetIdx, 1);
      this.setLocalTable('hasil_ujian', list);
    }
  }
}

export const db = new DatabaseService();
