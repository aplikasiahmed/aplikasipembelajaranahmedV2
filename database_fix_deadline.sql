
-- ==========================================================
-- SCRIPT PERBAIKAN: MENAMBAHKAN KOLOM DEADLINE
-- JALANKAN INI DI SQL EDITOR SUPABASE UNTUK MENGATASI ERROR
-- ==========================================================

-- Menambahkan kolom 'deadline' ke tabel 'ujian'
-- Tipe data TIMESTAMPTZ agar mendukung tanggal & jam
ALTER TABLE "ujian" 
ADD COLUMN IF NOT EXISTS "deadline" TIMESTAMPTZ;

-- Memastikan kolom bisa bernilai NULL (karena deadline itu opsional)
ALTER TABLE "ujian" 
ALTER COLUMN "deadline" DROP NOT NULL;

-- SELESAI. 
-- Setelah menjalankan script ini (klik RUN), silakan refresh website Bapak.
-- Error "Could not find deadline column" akan hilang.
