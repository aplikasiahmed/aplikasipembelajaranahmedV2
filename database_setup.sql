
-- ==========================================================
-- SCRIPT RESET & RE-CREATE TABEL KEHADIRAN (VERSI FIX)
-- JALANKAN INI DI SQL EDITOR SUPABASE
-- ==========================================================

-- 1. Hapus tabel lama
DROP TABLE IF EXISTS "kehadiran";

-- 2. Buat tabel baru dengan struktur yang dioptimalkan
CREATE TABLE "kehadiran" (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID NOT NULL,
    nis TEXT NOT NULL,
    nama_siswa TEXT NOT NULL,
    date DATE NOT NULL,               -- Tipe DATE asli (Sangat baik untuk performa)
    status TEXT NOT NULL,             -- hadir, sakit, izin, alfa
    kelas TEXT NOT NULL,
    semester TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Kebijakan Akses (RLS)
ALTER TABLE "kehadiran" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for public" ON "kehadiran";
CREATE POLICY "Allow all for public" ON "kehadiran" FOR ALL USING (true) WITH CHECK (true);
