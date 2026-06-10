import { Student, AttendanceRecord, GradeRecord, Material, GradeLevel, TaskSubmission, AdminUser, Exam, Question, ExamResult } from '../types';

// Definisikan tipe untuk spreadsheet helper
interface SheetConfig {
  name: string;
  headers: string[];
}

const TABS_CONFIG: SheetConfig[] = [
  { name: 'admin_users', headers: ['id', 'username', 'fullname', 'role', 'created_at'] },
  { name: 'data_siswa', headers: ['id', 'nis', 'namalengkap', 'kelas', 'jeniskelamin'] },
  { name: 'Nilai', headers: ['id', 'student_id', 'subject_type', 'score', 'description', 'kelas', 'semester', 'created_at'] },
  { name: 'kehadiran', headers: ['id', 'student_id', 'nama_siswa', 'nis', 'kelas', 'date', 'status', 'semester'] },
  { name: 'data_TugasSiswa', headers: ['id', 'nisn', 'student_name', 'kelas', 'task_name', 'submission_type', 'content', 'created_at'] },
  { name: 'materi_belajar', headers: ['id', 'title', 'description', 'grade', 'category', 'content_url', 'thumbnail'] },
  { name: 'ujian', headers: ['id', 'title', 'grade', 'category', 'semester', 'duration', 'deadline', 'is_random', 'status', 'created_at'] },
  { name: 'bank_soal', headers: ['id', 'exam_id', 'type', 'text', 'image_url', 'options', 'correct_answer'] },
  { name: 'hasil_ujian', headers: ['id', 'exam_id', 'student_nis', 'student_name', 'student_class', 'semester', 'answers', 'score', 'violation_count', 'started_at', 'submitted_at'] }
];

class DatabaseService {
  // HELPER LOKAL DATASTORAGE (LOCALSTORAGE)
  private getLocalTable<T>(name: string): T[] {
    const key = `pai_db_${name}`;
    const data = localStorage.getItem(key);
    if (!data) return [];
    try {
      return JSON.parse(data) as T[];
    } catch (_) {
      return [];
    }
  }

  private setLocalTable<T>(name: string, data: T[]): void {
    const key = `pai_db_${name}`;
    localStorage.setItem(key, JSON.stringify(data));
  }

  // SPREADSHEET ID CONFIGURATION
  async getSpreadsheetId(): Promise<string | null> {
    return localStorage.getItem('google_spreadsheet_id') || '1G_iMlKROJmq0UPb1Angg4IphW7BxVcron8yBEla7p2c';
  }

  async setSpreadsheetId(id: string | null): Promise<void> {
    if (id) {
      localStorage.setItem('google_spreadsheet_id', id);
    } else {
      localStorage.removeItem('google_spreadsheet_id');
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
  async syncToGoogleSheets(accessToken: string): Promise<void> {
    const spreadsheetId = await this.getSpreadsheetId();
    if (!spreadsheetId) {
      throw new Error("Spreadsheet ID belum terkonfigurasi!");
    }

    await this.initializeExistingSpreadsheet(spreadsheetId, accessToken);

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
      }, accessToken);
    }
  }

  // Sinkronisasi Google Sheets -> lokal (LocalStorage)
  async syncFromGoogleSheets(accessToken: string): Promise<void> {
    const spreadsheetId = await this.getSpreadsheetId();
    if (!spreadsheetId) {
      throw new Error("Spreadsheet ID belum terkonfigurasi!");
    }

    await this.initializeExistingSpreadsheet(spreadsheetId, accessToken);

    for (const cfg of TABS_CONFIG) {
      const res = await this.fetchSheetsAPI(spreadsheetId, `/values/${encodeURIComponent(cfg.name)}!A1:Z5000`, { method: 'GET' }, accessToken);
      const rows: any[][] = res.values || [];
      if (rows.length <= 1) continue;
      
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
          obj[header] = cellVal;
        });
        
        items.push(obj);
      }

      this.setLocalTable(cfg.name, items);
    }
  }

  // --- ADMIN FUNCTIONS ---
  async verifyAdminLogin(username: string, password: string): Promise<AdminUser | null> {
    const list = await this.getAdmins();
    const match = list.find(a => a.username === username && a.password === password);
    return match || null;
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

  async addAdmin(admin: Partial<AdminUser>): Promise<void> {
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
  }

  async deleteAdmin(id: string): Promise<void> {
    const list = await this.getAdmins();
    const filtered = list.filter(a => a.id !== id);
    this.setLocalTable('admin_users', filtered);
  }

  // --- STUDENT FUNCTIONS ---
  async getStudentByNIS(nis: string): Promise<Student | null> {
    const list = this.getLocalTable<Student>('data_siswa');
    const match = list.find(s => s.nis === nis);
    return match || null;
  }

  async getStudentByNISN(nis: string): Promise<Student | null> {
    return this.getStudentByNIS(nis);
  }

  async getStudentsByKelas(kelas: string): Promise<Student[]> {
    const list = this.getLocalTable<Student>('data_siswa');
    const filtered = list.filter(s => s.kelas === kelas);
    return filtered.sort((a, b) => a.namalengkap.localeCompare(b.namalengkap));
  }

  async getStudentsByGrade(grade: string): Promise<Student[]> {
    const list = this.getLocalTable<Student>('data_siswa');
    return list.filter(s => s.kelas && s.kelas.startsWith(`${grade}.`));
  }

  async getAvailableKelas(grade?: string): Promise<string[]> {
    const list = this.getLocalTable<Student>('data_siswa');
    let filtered = list;
    if (grade) {
      filtered = list.filter(s => s.kelas && s.kelas.startsWith(`${grade}.`));
    }
    const uniqueKelas = Array.from(new Set<string>(filtered.map(s => s.kelas))).filter(Boolean).sort();
    return uniqueKelas;
  }

  async upsertStudents(students: Student[]): Promise<void> {
    const list = this.getLocalTable<Student>('data_siswa');
    for (const s of students) {
      const studentId = s.id || s.nis;
      const cleanStudent = { ...s, id: studentId };
      const idx = list.findIndex(item => item.id === studentId || item.nis === s.nis);
      if (idx > -1) {
        list[idx] = cleanStudent;
      } else {
        list.push(cleanStudent);
      }
    }
    this.setLocalTable('data_siswa', list);
  }

  // --- GRADE FUNCTIONS ---
  async addGrade(grade: Partial<GradeRecord>): Promise<void> {
    const id = grade.id || 'grade_' + Math.random().toString(36).substr(2, 9);
    const cleanGrade = {
      ...grade,
      id,
      created_at: grade.created_at || new Date().toISOString()
    } as GradeRecord;
    const list = this.getLocalTable<GradeRecord>('Nilai');
    list.push(cleanGrade);
    this.setLocalTable('Nilai', list);
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
        filtered = filtered.filter((g: any) => ['1', 'ganjil', 'semester 1'].includes(g.semester.toLowerCase()));
      } else if (s === '2' || s === 'genap') {
        filtered = filtered.filter((g: any) => ['2', 'genap', 'semester 2'].includes(g.semester.toLowerCase()));
      } else {
        filtered = filtered.filter((g: any) => g.semester.toLowerCase() === s);
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
  async resetAllData(): Promise<void> {
    await Promise.all([
      this.resetAttendance(),
      this.resetGrades(),
      this.resetTasks(),
      this.resetStudents(),
      this.resetMaterials(),
      this.setLocalTable('ujian', []),
      this.setLocalTable('bank_soal', []),
      this.setLocalTable('hasil_ujian', [])
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
    let list = this.getLocalTable<Material>('materi_belajar');
    if (list.length === 0) {
      const defaults: Material[] = [
        {
          id: 'mat-1',
          title: 'Mengenal Iman kepada Hari Akhir',
          description: 'Materi PAI Kelas 9 tentang hakikat, tanda-tanda, dan hikmah beriman kepada Hari Kiamat.',
          grade: '9',
          category: 'Aqidah',
          content_url: 'https://docs.google.com/document/d/1G_iMlKROJmq0UPb1Angg4IphW7BxVcron8yBEla7p2c/edit',
          thumbnail: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=500'
        },
        {
          id: 'mat-2',
          title: 'Ketentuan Zakat Fitrah dan Zakat Mal',
          description: 'Materi PAI Kelas 8 tentang rukun, syarat, dan tata cara pelaksanaan ibadah zakat.',
          grade: '8',
          category: 'Fiqih',
          content_url: 'https://docs.google.com/document/d/1G_iMlKROJmq0UPb1Angg4IphW7BxVcron8yBEla7p2c/edit',
          thumbnail: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=500'
        }
      ];
      this.setLocalTable('materi_belajar', defaults);
      list = defaults;
    }
    if (grade) {
      return list.filter(m => m.grade === grade);
    }
    return list;
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
    return list.filter(q => q.exam_id === examId);
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

  async checkStudentExamResult(nis: string, examId: string): Promise<boolean> {
    const list = this.getLocalTable<ExamResult>('hasil_ujian');
    return list.some(r => r.student_nis === nis && r.exam_id === examId);
  }

  async hasExamResults(examId: string): Promise<boolean> {
    const list = this.getLocalTable<ExamResult>('hasil_ujian');
    return list.some(r => r.exam_id === examId);
  }

  async submitExamResult(result: Omit<ExamResult, 'id' | 'submitted_at'>): Promise<ExamResult> {
    const id = 'res_' + Math.random().toString(36).substr(2, 9);
    const newResult = {
      ...result,
      id,
      submitted_at: new Date().toISOString()
    } as ExamResult;
    const list = this.getLocalTable<ExamResult>('hasil_ujian');
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
          description: `${exam.title}`,
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
