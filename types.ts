export type GradeLevel = '7' | '8' | '9';

export interface AdminUser {
  id: string;
  username: string;
  password?: string;
  fullname: string;
  email?: string;
  role: 'Super Admin' | 'Admin';
  created_at: string;
}

export interface Student {
  id?: string;
  nis: string;
  namalengkap: string;
  jeniskelamin: string;
  kelas: string; 
}

export interface AttendanceRecord {
  id: string;
  student_id: string;
  nis: string;           // Tambahan baru
  nama_siswa: string;    // Tambahan baru
  date: string;
  status: 'hadir' | 'sakit' | 'izin' | 'alfa';
  kelas: string;
  semester: string;
}

export interface GradeRecord {
  id: string;
  student_id: string;
  subject_type: 'harian' | 'uts' | 'uas' | 'praktik';
  score: number;
  description: string;
  kelas: string;
  semester: string;
  created_at: string;
}

export interface TaskSubmission {
  id: string;
  nisn: string;
  student_name: string;
  kelas: string;
  task_name: string;
  submission_type: 'link' | 'photo';
  content: string; 
  created_at: string;
}

export interface Material {
  id: string;
  title: string;
  description: string;
  grade: GradeLevel;
  category: 'Aqidah' | 'Fiqih' | 'Sejarah' | 'Akhlak' | 'Al-Quran';
  content_url: string;
  thumbnail?: string;
}

// --- NEW TYPES FOR EXAM SYSTEM ---
export interface Exam {
  id: string;
  title: string;
  grade: GradeLevel;
  category: 'harian' | 'uts' | 'uas' | 'praktik'; // Added category
  semester: string;
  duration: number; // in minutes
  deadline?: string; // New: Batas Akhir Pengerjaan (ISO Date String)
  is_random?: boolean; // New: Acak Soal
  status: 'draft' | 'active' | 'closed';
  created_at: string;
}

export interface Question {
  id: string;
  exam_id: string;
  type: 'pg' | 'essay';
  text: string;
  image_url?: string; // Tambahan: Support Gambar pada Soal
  options?: string[]; // Array of 4 options (A, B, C, D)
  correct_answer: string; // index '0'..'3' for PG, or text key for Essay
}

export interface ExamResult {
  id: string;
  exam_id: string;
  student_nis: string;
  student_name: string;
  student_class: string;
  semester: string; // NEW FIELD: Semester Wajib Ada di Tabel Hasil
  answers: Record<string, string>; // question_id: answer_value
  score: number;
  violation_count?: number; // NEW: Jumlah Pelanggaran
  started_at?: string; // NEW: Waktu mulai mengerjakan
  submitted_at: string;
}