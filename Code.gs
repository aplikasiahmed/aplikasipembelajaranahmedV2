/**
 * Google Apps Script untuk Sinkronisasi Pembelajaran PAI
 * Template v2 - Mendukung Multi-Foto (content1 s.d content5)
 * 
 * Petunjuk Penggunaan:
 * 1. Buka Google Spreadsheet Anda.
 * 2. Klik menu 'Ekstensi' -> 'Apps Script'.
 * 3. Hapus semua kode bawaan, lalu tempelkan kode di bawah ini.
 * 4. Klik ikon Simpan (kiri atas).
 * 5. Klik tombol 'Terapkan' (Deploy) -> 'Penerapan baru' (New deployment).
 * 6. Pilih Jenis: 'Aplikasi Web' (Web App).
 * 7. Konfigurasi:
 *    - Jalankan sebagai: 'Saya' (Execute as: Me)
 *    - Siapa yang memiliki akses: 'Siapa saja' (Who has access: Anyone)
 * 8. Klik 'Terapkan' (Deploy). Setujui izin akses jika diminta (klik Advanced -> Go to ... (unsafe)).
 * 9. Salin URL Aplikasi Web yang diberikan, lalu tempelkan ke Pengaturan Guru di aplikasi Anda.
 */

function doGet(e) {
  var sheetName = e.parameter.sheet;
  if (!sheetName) {
    return ContentService.createTextOutput(
      JSON.stringify({ error: "Parameter 'sheet' wajib diisi!" })
    ).setMimeType(ContentService.MimeType.JSON);
  }
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  
  var values = [];
  if (sheet.getLastRow() > 0 && sheet.getLastColumn() > 0) {
    values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  }
  
  // Konversi tipe tanggal ke ISO String agar aman saat dikirim
  for (var i = 0; i < values.length; i++) {
    for (var j = 0; j < values[i].length; j++) {
      if (values[i][j] instanceof Date) {
        values[i][j] = values[i][j].toISOString();
      }
    }
  }
  
  return ContentService.createTextOutput(
    JSON.stringify({ values: values })
  ).setMimeType(ContentService.MimeType.JSON);
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
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
      }
      
      // Bersihkan sheet terlebih dahulu
      sheet.clear();
      
      // Tulis data baru dari baris 1, kolom 1
      if (values.length > 0) {
        sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
        
        // Atur agar baris pertama (header) menjadi bold dan berlatar abu-abu muda (opsional)
        sheet.getRange(1, 1, 1, values[0].length)
             .setFontWeight("bold")
             .setBackground("#f3f4f6");
             
        // Otomatis menyesuaikan lebar kolom
        sheet.autoResizeColumns(1, values[0].length);
      }
      
      result.success = true;
    } else {
      result.error = "Parameter 'sheet' atau 'values' tidak valid.";
    }
  } catch (err) {
    result.error = err.toString();
  }
  
  return ContentService.createTextOutput(
    JSON.stringify(result)
  ).setMimeType(ContentService.MimeType.JSON);
}
