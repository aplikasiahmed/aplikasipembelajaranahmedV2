-- ==========================================================
-- SCRIPT UPDATE: MENAMBAHKAN KOLOM PELANGGARAN
-- JALANKAN INI DI SQL EDITOR SUPABASE
-- ==========================================================

-- Menambahkan kolom 'violation_count' ke tabel 'hasil_ujian'
-- Tipe integer, default 0
ALTER TABLE "hasil_ujian" 
ADD COLUMN IF NOT EXISTS "violation_count" INTEGER DEFAULT 0;

-- SELESAI. 
-- Klik RUN untuk menjalankan.