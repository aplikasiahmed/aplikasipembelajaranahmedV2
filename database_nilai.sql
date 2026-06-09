-- ==========================================================
-- SCRIPT RESET & RE-CREATE TABEL NILAI (VERSI OTOMATIS)
-- JALANKAN INI DI SQL EDITOR SUPABASE
-- ==========================================================

-- 1. Hapus tabel lama agar bersih
DROP TABLE IF EXISTS "Nilai";

-- 2. Buat tabel baru dengan kolom lengkap sesuai permintaan Bapak
CREATE TABLE "Nilai" (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID NOT NULL,     -- Dikirim dari Aplikasi
    nis TEXT,                     -- AKAN DIISI OTOMATIS OLEH DATABASE
    nama_siswa TEXT,              -- AKAN DIISI OTOMATIS OLEH DATABASE
    subject_type TEXT NOT NULL,   -- Type Penilaian
    score NUMERIC NOT NULL,       -- Score Nilai
    description TEXT,             -- Deskripsi Tugas
    kelas TEXT NOT NULL,          -- Kelas
    semester TEXT NOT NULL,       -- Semester
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Aktifkan Keamanan (RLS)
ALTER TABLE "Nilai" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Access" ON "Nilai";
CREATE POLICY "Public Access" ON "Nilai" FOR ALL USING (true) WITH CHECK (true);

-- ==========================================================
-- FITUR PINTAR (TRIGGER)
-- Ini yang membuat Bapak tidak perlu ubah kodingan aplikasi
-- ==========================================================

-- A. Buat Fungsi Pencari Data Siswa
CREATE OR REPLACE FUNCTION public.auto_fill_student_details()
RETURNS TRIGGER AS $$
BEGIN
  -- Ambil NIS dan Nama Lengkap dari tabel 'data_siswa' berdasarkan student_id
  -- Lalu masukkan ke kolom nis dan nama_siswa di tabel Nilai
  SELECT nis, namalengkap INTO NEW.nis, NEW.nama_siswa
  FROM "data_siswa"
  WHERE id = NEW.student_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B. Pasang Pemicu (Trigger) ke Tabel Nilai
DROP TRIGGER IF EXISTS on_nilai_insert ON "Nilai";
CREATE TRIGGER on_nilai_insert
BEFORE INSERT ON "Nilai"
FOR EACH ROW EXECUTE PROCEDURE public.auto_fill_student_details();

-- SELESAI.
-- Sekarang saat Guru Input Nilai dari aplikasi, Database akan otomatis
-- melengkapi Nama dan NIS siswa tersebut.