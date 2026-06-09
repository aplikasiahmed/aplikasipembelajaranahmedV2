import { Student, AttendanceRecord, GradeRecord, Material, GradeLevel, TaskSubmission, AdminUser, Exam, Question, ExamResult } from '../types';
import { firestore } from './firebase';
import { 
  collection, 
  getDocs, 
  getDoc, 
  doc, 
  setDoc, 
  addDoc, 
  deleteDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  limit 
} from 'firebase/firestore';

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
  // SPREADSHEET MANAGER SETTINGS
  async getSpreadsheetId(): Promise<string | null> {
    try {
      const snap = await getDoc(doc(firestore, 'settings', 'config'));
      if (snap.exists() && snap.data().spreadsheetId) {
        return snap.data().spreadsheetId;
      }
    } catch (e) {
      console.error("Gagal membaca Google Sheets ID dari Firestore: ", e);
    }
    return localStorage.getItem('google_spreadsheet_id') || '1G_iMlKROJmq0UPb1Angg4IphW7BxVcron8yBEla7p2c';
  }

  async setSpreadsheetId(id: string | null): Promise<void> {
    try {
      await setDoc(doc(firestore, 'settings', 'config'), { spreadsheetId: id }, { merge: true });
    } catch (e) {
      console.error("Gagal menyimpan Google Sheets ID ke Firestore: ", e);
    }
    if (id) {
      localStorage.setItem('google_spreadsheet_id', id);
    } else {
      localStorage.removeItem('google_spreadsheet_id');
    }
  }

  // --- SPREADSHEET REST INTEGRATION SERVICES ---
  
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
    // 1. Buat Spreadsheet Utama dengan tab utama 'admin_users'
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
    
    // 2. Tambah 8 sheet tab lainnya
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

    // 3. Tulis Headers (Bila ada data atau setidaknya kolom list baris 1) ke setiap tab sheet
    for (const cfg of TABS_CONFIG) {
      await this.fetchSheetsAPI(spreadsheetId, `/values/${cfg.name}!A1:Z1?valueInputOption=USER_ENTERED`, {
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

  // Sync lokal Firestore -> Google Sheets
  async syncToGoogleSheets(accessToken: string): Promise<void> {
    const spreadsheetId = await this.getSpreadsheetId();
    if (!spreadsheetId) {
      throw new Error("Spreadsheet ID belum terkonfigurasi!");
    }

    for (const cfg of TABS_CONFIG) {
      // Ambil seluruh dokumen dari Firestore
      const querySnapshot = await getDocs(collection(firestore, cfg.name));
      const items = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      
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

      // Clear baris lama dengan menulis data baru dan sisa baris kosong
      // Kita gunakan update range penuh
      await this.fetchSheetsAPI(spreadsheetId, `/values/${cfg.name}!A1:Z5000?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        body: JSON.stringify({
          range: `${cfg.name}!A1:Z5000`,
          majorDimension: 'ROWS',
          values: values
        })
      }, accessToken);
    }
  }

  // Sync Google Sheets -> lokal Firestore
  async syncFromGoogleSheets(accessToken: string): Promise<void> {
    const spreadsheetId = await this.getSpreadsheetId();
    if (!spreadsheetId) {
      throw new Error("Spreadsheet ID belum terkonfigurasi!");
    }

    for (const cfg of TABS_CONFIG) {
      const res = await this.fetchSheetsAPI(spreadsheetId, `/values/${cfg.name}!A1:Z5000`, { method: 'GET' }, accessToken);
      const rows: any[][] = res.values || [];
      if (rows.length <= 1) continue; // Hanya header atau kosong
      
      const headers = rows[0];
      const items: any[] = [];
      
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length === 0 || !row[0]) continue; // ID kosong dilewati
        
        const obj: any = {};
        headers.forEach((header, colIdx) => {
          let cellVal = row[colIdx];
          if (cellVal === undefined || cellVal === null) cellVal = '';
          
          // Deserialisasi JSON jika berupa array/object
          if (typeof cellVal === 'string' && (cellVal.startsWith('[') || cellVal.startsWith('{'))) {
            try {
              cellVal = JSON.parse(cellVal);
            } catch (_) {}
          }
          obj[header] = cellVal;
        });
        
        items.push(obj);
      }

      // Tulis ulang koleksi di Firestore
      for (const item of items) {
        if (item.id) {
          const { id, ...data } = item;
          await setDoc(doc(firestore, cfg.name, id), data);
        }
      }
    }
  }

  // --- ADMIN FUNCTIONS ---
  async verifyAdminLogin(username: string, password: string): Promise<AdminUser | null> {
    const ref = collection(firestore, 'admin_users');
    const snap = await getDocs(ref);
    
    // Auto-seed akun guru jika database Firestore masih kosong sempurna
    if (snap.empty) {
      const defaultAdmin: AdminUser = {
        id: 'default-admin-pai',
        fullname: 'Bapak Guru PAI',
        username: 'guru',
        password: '123',
        role: 'Super Admin',
        created_at: new Date().toISOString()
      };
      await setDoc(doc(firestore, 'admin_users', 'default-admin-pai'), defaultAdmin);
    }

    const q = query(ref, where('username', '==', username), where('password', '==', password));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return null;
    
    const docData = querySnapshot.docs[0];
    return { id: docData.id, ...docData.data() } as AdminUser;
  }

  async getAdmins(): Promise<AdminUser[]> {
    const querySnapshot = await getDocs(query(collection(firestore, 'admin_users'), orderBy('created_at', 'desc')));
    return querySnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as AdminUser[];
  }

  async addAdmin(admin: Partial<AdminUser>): Promise<void> {
    const id = admin.id || doc(collection(firestore, 'admin_users')).id;
    const cleanAdmin = {
      ...admin,
      id,
      created_at: admin.created_at || new Date().toISOString()
    };
    await setDoc(doc(firestore, 'admin_users', id), cleanAdmin);
  }

  async deleteAdmin(id: string): Promise<void> {
    await deleteDoc(doc(firestore, 'admin_users', id));
  }

  // --- STUDENT FUNCTIONS ---
  async getStudentByNIS(nis: string): Promise<Student | null> {
    const q = query(collection(firestore, 'data_siswa'), where('nis', '==', nis));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return null;
    const d = querySnapshot.docs[0];
    return { id: d.id, ...d.data() } as Student;
  }

  async getStudentByNISN(nis: string): Promise<Student | null> {
    return this.getStudentByNIS(nis);
  }

  async getStudentsByKelas(kelas: string): Promise<Student[]> {
    const q = query(collection(firestore, 'data_siswa'), where('kelas', '==', kelas));
    const querySnapshot = await getDocs(q);
    const students = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Student[];
    return students.sort((a, b) => a.namalengkap.localeCompare(b.namalengkap));
  }

  async getStudentsByGrade(grade: string): Promise<Student[]> {
    const ref = collection(firestore, 'data_siswa');
    // Implementasi LIKE 'grade.%' versi firestore
    const q = query(
      ref, 
      where('kelas', '>=', `${grade}.`), 
      where('kelas', '<=', `${grade}.\uf8ff`)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Student[];
  }

  async getAvailableKelas(grade?: string): Promise<string[]> {
    const ref = collection(firestore, 'data_siswa');
    let q;
    if (grade) {
      q = query(ref, where('kelas', '>=', `${grade}.`), where('kelas', '<=', `${grade}.\uf8ff`));
    } else {
      q = query(ref);
    }
    const querySnapshot = await getDocs(q);
    const uniqueKelas = Array.from(new Set<string>(querySnapshot.docs.map(d => d.data().kelas as string))).sort();
    return uniqueKelas;
  }

  async upsertStudents(students: Student[]): Promise<void> {
    for (const s of students) {
      // Unik berdasarkan nis siswa sebagai Document ID
      const studentId = s.nis;
      const cleanStudent = { ...s, id: studentId };
      await setDoc(doc(firestore, 'data_siswa', studentId), cleanStudent);
    }
  }

  // --- GRADE FUNCTIONS ---
  async addGrade(grade: Partial<GradeRecord>): Promise<void> {
    const id = doc(collection(firestore, 'Nilai')).id;
    const cleanGrade = {
      ...grade,
      id,
      created_at: grade.created_at || new Date().toISOString()
    };
    await setDoc(doc(firestore, 'Nilai', id), cleanGrade);
  }

  async getGradesByStudent(studentId: string): Promise<GradeRecord[]> {
    const q = query(
      collection(firestore, 'Nilai'), 
      where('student_id', '==', studentId),
      orderBy('created_at', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as GradeRecord[];
  }

  async getGradesByKelas(kelas: string, semester?: string): Promise<any[]> {
    const q = query(collection(firestore, 'Nilai'), where('kelas', '==', kelas));
    const querySnapshot = await getDocs(q);
    let grades = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    if (semester) {
      const s = semester.toLowerCase();
      if (s === '1' || s === 'ganjil') {
        grades = grades.filter((g: any) => ['1', 'ganjil', 'semester 1', 'ganjil'].includes(g.semester.toLowerCase()));
      } else if (s === '2' || s === 'genap') {
        grades = grades.filter((g: any) => ['2', 'genap', 'semester 2', 'genap'].includes(g.semester.toLowerCase()));
      } else {
        grades = grades.filter((g: any) => g.semester.toLowerCase() === s);
      }
    }

    // Ambil detail siswa
    const students = await this.getStudentsByKelas(kelas);
    return grades.map((g: any) => ({
      ...g,
      data_siswa: students.find(s => s.id === g.student_id) || { namalengkap: 'Siswa', nis: '-' }
    }));
  }

  // --- ATTENDANCE FUNCTIONS ---
  async addAttendance(records: Partial<AttendanceRecord>[]): Promise<void> {
    for (const record of records) {
      const id = doc(collection(firestore, 'kehadiran')).id;
      const cleanRecord = {
        ...record,
        id,
        created_at: new Date().toISOString()
      };
      await setDoc(doc(firestore, 'kehadiran', id), cleanRecord);
    }
  }

  async getAttendanceByStudent(studentId: string): Promise<AttendanceRecord[]> {
    const q = query(
      collection(firestore, 'kehadiran'),
      where('student_id', '==', studentId),
      orderBy('date', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as AttendanceRecord[];
  }

  async getAttendanceByKelas(kelas: string, semester?: string, month?: string, year?: string): Promise<any[]> {
    const q = query(collection(firestore, 'kehadiran'), where('kelas', '==', kelas));
    const querySnapshot = await getDocs(q);
    let attendance = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    if (semester) {
      attendance = attendance.filter((a: any) => String(a.semester) === String(semester));
    }

    if (month) {
      const selectedYear = year || new Date().getFullYear().toString();
      const prefix = `${selectedYear}-${month.padStart(2, '0')}`;
      attendance = attendance.filter((a: any) => a.date && a.date.startsWith(prefix));
    }

    return attendance.sort((a: any, b: any) => a.date.localeCompare(b.date)).map((a: any) => ({
      ...a,
      data_siswa: { namalengkap: a.nama_siswa, nis: a.nis }
    }));
  }

  // --- RESET FUNCTIONS ---
  async resetAttendance(): Promise<void> {
    const snap = await getDocs(collection(firestore, 'kehadiran'));
    for (const d of snap.docs) {
      await deleteDoc(doc(firestore, 'kehadiran', d.id));
    }
  }
  async resetGrades(): Promise<void> {
    const snap = await getDocs(collection(firestore, 'Nilai'));
    for (const d of snap.docs) {
      await deleteDoc(doc(firestore, 'Nilai', d.id));
    }
  }
  async resetTasks(): Promise<void> {
    const snap = await getDocs(collection(firestore, 'data_TugasSiswa'));
    for (const d of snap.docs) {
      await deleteDoc(doc(firestore, 'data_TugasSiswa', d.id));
    }
  }
  async resetStudents(): Promise<void> {
    const snap = await getDocs(collection(firestore, 'data_siswa'));
    for (const d of snap.docs) {
      await deleteDoc(doc(firestore, 'data_siswa', d.id));
    }
  }
  async resetMaterials(): Promise<void> {
    const snap = await getDocs(collection(firestore, 'materi_belajar'));
    for (const d of snap.docs) {
      await deleteDoc(doc(firestore, 'materi_belajar', d.id));
    }
  }
  async resetAllData(): Promise<void> {
    await Promise.all([
      this.resetAttendance(),
      this.resetGrades(),
      this.resetTasks(),
      this.resetStudents(),
      this.resetMaterials()
    ]);
  }

  // --- TASK FUNCTIONS ---
  async addTaskSubmission(submission: Partial<TaskSubmission>): Promise<void> {
    const id = doc(collection(firestore, 'data_TugasSiswa')).id;
    const cleanSub = {
      ...submission,
      id,
      created_at: submission.created_at || new Date().toISOString()
    };
    await setDoc(doc(firestore, 'data_TugasSiswa', id), cleanSub);
  }

  async getTaskSubmissions(grade?: string): Promise<TaskSubmission[]> {
    const ref = collection(firestore, 'data_TugasSiswa');
    let q = query(ref, orderBy('created_at', 'desc'));
    
    const querySnapshot = await getDocs(q);
    let submissions = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as TaskSubmission[];

    if (grade) {
      submissions = submissions.filter(s => s.kelas && s.kelas.startsWith(`${grade}.`));
    }
    return submissions;
  }

  async deleteTaskSubmission(id: string): Promise<void> {
    await deleteDoc(doc(firestore, 'data_TugasSiswa', id));
  }

  async getMaterials(grade?: GradeLevel): Promise<Material[]> {
    const ref = collection(firestore, 'materi_belajar');
    const q = grade ? query(ref, where('grade', '==', grade)) : query(ref);
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Material[];
  }

  // --- EXAM & QUESTION FUNCTIONS ---
  async getExams(): Promise<Exam[]> {
    const querySnapshot = await getDocs(query(collection(firestore, 'ujian'), orderBy('created_at', 'asc')));
    return querySnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Exam[];
  }

  async getExamById(id: string): Promise<Exam | undefined> {
    const snap = await getDoc(doc(firestore, 'ujian', id));
    if (!snap.exists()) return undefined;
    return { id: snap.id, ...snap.data() } as Exam;
  }

  async createExam(exam: Omit<Exam, 'id' | 'created_at'>): Promise<Exam> {
    const id = doc(collection(firestore, 'ujian')).id;
    const newExam = {
      ...exam,
      id,
      created_at: new Date().toISOString()
    };
    await setDoc(doc(firestore, 'ujian', id), newExam);
    return newExam as Exam;
  }

  async updateExam(id: string, updates: Partial<Exam>): Promise<void> {
    await updateDoc(doc(firestore, 'ujian', id), updates);
  }

  async updateExamStatus(id: string, status: 'draft' | 'active' | 'closed'): Promise<void> {
    await updateDoc(doc(firestore, 'ujian', id), { status });
  }

  async deleteExam(id: string): Promise<void> {
    await deleteDoc(doc(firestore, 'ujian', id));
  }

  async getQuestionsByExamId(examId: string): Promise<Question[]> {
    const q = query(collection(firestore, 'bank_soal'), where('exam_id', '==', examId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Question[];
  }

  async addQuestion(question: Omit<Question, 'id'>): Promise<Question> {
    const id = doc(collection(firestore, 'bank_soal')).id;
    const newQuestion = { ...question, id };
    await setDoc(doc(firestore, 'bank_soal', id), newQuestion);
    return newQuestion as Question;
  }

  async updateQuestion(id: string, updates: Partial<Question>): Promise<void> {
    await updateDoc(doc(firestore, 'bank_soal', id), updates);
  }

  async deleteQuestion(id: string): Promise<void> {
    await deleteDoc(doc(firestore, 'bank_soal', id));
  }

  async deleteAllQuestionsByExamId(examId: string): Promise<void> {
    const questions = await this.getQuestionsByExamId(examId);
    for (const q of questions) {
      await deleteDoc(doc(firestore, 'bank_soal', q.id));
    }
  }

  // --- student exam view ---
  async getAllActiveExams(): Promise<Exam[]> {
    const q = query(collection(firestore, 'ujian'), where('status', '==', 'active'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Exam[];
  }

  async getActiveExamsByGrade(grade: string, semester: string): Promise<Exam[]> {
    const q = query(
      collection(firestore, 'ujian'), 
      where('status', '==', 'active'),
      where('grade', '==', grade),
      where('semester', '==', String(semester))
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Exam[];
  }

  async checkStudentExamResult(nis: string, examId: string): Promise<boolean> {
    const q = query(
      collection(firestore, 'hasil_ujian'),
      where('student_nis', '==', nis),
      where('exam_id', '==', examId),
      limit(1)
    );
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  }

  async hasExamResults(examId: string): Promise<boolean> {
    const q = query(collection(firestore, 'hasil_ujian'), where('exam_id', '==', examId), limit(1));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  }

  async submitExamResult(result: Omit<ExamResult, 'id' | 'submitted_at'>): Promise<ExamResult> {
    const id = doc(collection(firestore, 'hasil_ujian')).id;
    const newResult = {
      ...result,
      id,
      submitted_at: new Date().toISOString()
    };
    await setDoc(doc(firestore, 'hasil_ujian', id), newResult);

    // Integrasi ke Buku Nilai
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

    return newResult as ExamResult;
  }

  async getExamResults(grade?: string, semester?: string): Promise<any[]> {
    const ref = collection(firestore, 'hasil_ujian');
    const querySnapshot = await getDocs(ref);
    let results = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

    if (semester) {
      results = results.filter(r => String(r.semester) === String(semester));
    }
    if (grade) {
      results = results.filter(r => r.student_class && r.student_class.startsWith(`${grade}.`));
    }

    // Ambil detail judul ujian dari memori untuk melengkapi objek
    const exams = await this.getExams();
    return results.map(r => {
      const ex = exams.find(e => e.id === r.exam_id);
      return {
        ...r,
        ujian: ex ? { title: ex.title, category: ex.category, duration: ex.duration } : { title: 'Ujian dihapus', category: 'harian', duration: 0 }
      };
    }).sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));
  }

  async deleteExamResult(id: string): Promise<void> {
    const snap = await getDoc(doc(firestore, 'hasil_ujian', id));
    if (snap.exists()) {
      const resData = snap.data();
      const student = await this.getStudentByNIS(resData.student_nis);
      const exam = await this.getExamById(resData.exam_id);

      if (student && student.id && exam) {
        // Hapus nilai terkait
        const q = query(
          collection(firestore, 'Nilai'),
          where('student_id', '==', student.id)
        );
        const qSnap = await getDocs(q);
        const matchTitle = exam.title;
        for (const gd of qSnap.docs) {
          const dDesc = gd.data().description;
          if (dDesc === matchTitle) {
            await deleteDoc(doc(firestore, 'Nilai', gd.id));
          }
        }
      }
    }
    await deleteDoc(doc(firestore, 'hasil_ujian', id));
  }
}

export const db = new DatabaseService();
