
-- ============================================================================
-- SCRIPT FULL RESET & SETUP BANK SOAL ONLINE (FIXED PERMISSION & DEADLINE)
-- SILAKAN COPY DAN JALANKAN DI SQL EDITOR SUPABASE (KLIK "RUN")
-- ============================================================================

-- 1. BERSIHKAN TABEL LAMA (Agar tidak error saat dibuat ulang)
DROP TABLE IF EXISTS "hasil_ujian";
DROP TABLE IF EXISTS "bank_soal";
DROP TABLE IF EXISTS "ujian";

-- 2. BUAT TABEL UJIAN (INDUK)
CREATE TABLE "ujian" (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,          -- Judul Ujian
    grade TEXT NOT NULL,          -- Jenjang Kelas ('7', '8', '9')
    category TEXT NOT NULL,       -- Kategori ('harian', 'uts', 'uas', 'praktik')
    semester TEXT NOT NULL,       -- Semester ('1' atau '2')
    duration INTEGER NOT NULL,    -- Durasi dalam menit
    deadline TIMESTAMPTZ,         -- Batas Akhir Pengerjaan (NEW)
    status TEXT DEFAULT 'draft',  -- Status ('draft', 'active')
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. BUAT TABEL BANK SOAL (ANAK 1)
CREATE TABLE "bank_soal" (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    exam_id UUID REFERENCES "ujian"(id) ON DELETE CASCADE,
    type TEXT DEFAULT 'pg',
    text TEXT NOT NULL,
    image_url TEXT,
    options JSONB,
    correct_answer TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. BUAT TABEL HASIL UJIAN (ANAK 2)
CREATE TABLE "hasil_ujian" (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    exam_id UUID REFERENCES "ujian"(id) ON DELETE CASCADE,
    student_nis TEXT NOT NULL,
    student_name TEXT NOT NULL,
    student_class TEXT NOT NULL,
    semester TEXT NOT NULL,
    answers JSONB,
    score NUMERIC NOT NULL,
    started_at TIMESTAMPTZ,       -- WAKTU MULAI (PENTING UNTUK DURASI)
    submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. PENGATURAN KEAMANAN (RLS - PERBAIKAN UTAMA DISINI)
-- Mengizinkan akses 'anon' (aplikasi) dan 'authenticated' (jika login supabase)

-- Aktifkan RLS
ALTER TABLE "ujian" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bank_soal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hasil_ujian" ENABLE ROW LEVEL SECURITY;

-- Hapus Policy Lama
DROP POLICY IF EXISTS "Public Select Ujian" ON "ujian";
DROP POLICY IF EXISTS "Teacher Full Access Ujian" ON "ujian";
DROP POLICY IF EXISTS "Public Select Soal" ON "bank_soal";
DROP POLICY IF EXISTS "Teacher Full Access Soal" ON "bank_soal";
DROP POLICY IF EXISTS "Public Insert Hasil" ON "hasil_ujian";
DROP POLICY IF EXISTS "Teacher Select Hasil" ON "hasil_ujian";

-- === POLICY BARU (LEBIH FLEKSIBEL UNTUK APLIKASI ANDA) ===

-- 1. TABEL UJIAN
-- Boleh dibaca, ditambah, diedit, dihapus oleh aplikasi
CREATE POLICY "App Full Access Ujian" ON "ujian" 
FOR ALL USING (auth.role() IN ('anon', 'authenticated')) 
WITH CHECK (auth.role() IN ('anon', 'authenticated'));

-- 2. TABEL BANK SOAL
-- Boleh dibaca, ditambah, diedit, dihapus oleh aplikasi
CREATE POLICY "App Full Access Soal" ON "bank_soal" 
FOR ALL USING (auth.role() IN ('anon', 'authenticated')) 
WITH CHECK (auth.role() IN ('anon', 'authenticated'));

-- 3. TABEL HASIL UJIAN
-- Boleh dibaca, ditambah, diedit, dihapus oleh aplikasi
CREATE POLICY "App Full Access Hasil" ON "hasil_ujian" 
FOR ALL USING (auth.role() IN ('anon', 'authenticated')) 
WITH CHECK (auth.role() IN ('anon', 'authenticated'));