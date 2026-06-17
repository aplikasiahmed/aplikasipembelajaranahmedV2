import ExcelJS from 'https://esm.sh/exceljs@4.4.0';
import FileSaver from 'https://esm.sh/file-saver@2.0.5';

interface ExcelMeta {
  title: string;
  subTitle?: string;
  kelas: string;
  semester: string;
  bulan?: string;
  tahun?: string;
  withValidation?: boolean;
  type?: 'nilai' | 'absensi'; // NEW
  availableTypes?: string[];
  availableAssessments?: string[];
}

const setupWorksheet = (sheet: any, data: any[], meta?: ExcelMeta) => {
    // 1. HEADER JUDUL (Tanpa Merge Cell) - Sesuai Permintaan
    if (meta) {
        const titleFont = { bold: true, name: 'Calibri', size: 11 };
        const normalFont = { name: 'Calibri', size: 11 };

        // Row 1: Title Utama
        const cellA1 = sheet.getCell('A1');
        cellA1.value = meta.title;
        cellA1.font = titleFont;

        // Row 2: Subtitle
        const cellA2 = sheet.getCell('A2');
        cellA2.value = 'PENDIDIKAN AGAMA ISLAM DAN BUDI PEKERTI';
        cellA2.font = normalFont;

        // Row 3: Kelas
        const cellA3 = sheet.getCell('A3');
        cellA3.value = `KELAS ${meta.kelas}`;
        cellA3.font = normalFont;

        // Row 4: Semester/Info
        let infoString = `Semester : ${meta.semester}`;
        if (meta.bulan) {
            infoString = `Bulan : ${meta.bulan} ${meta.tahun || ''}`;
        }
        const cellA4 = sheet.getCell('A4');
        cellA4.value = infoString;
        cellA4.font = normalFont;
        
        // Row 5 kosong (Separator)
    }

    // 2. HEADER TABEL DINAMIS (Mulai Baris 6)
    if (data.length > 0) {
        // Ambil Keys dari data pertama sebagai Header Kolom
        const headers = Object.keys(data[0]);
        const headerRow = sheet.getRow(6);
        headerRow.values = headers;

        // Styling Header Tabel
        headerRow.eachCell((cell: any) => {
            cell.font = { bold: true };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });

        // Setup Lebar Kolom (Auto-adjust sederhana)
        sheet.columns = headers.map(key => {
            let width = 12; // Default
            if (key === 'NO') width = 5;
            // REVISI: NIS Dikecilkan jadi 10 (sebelumnya 15)
            else if (key === 'NIS') width = 10;
            else if (key === 'NAMA SISWA') width = 35;
            // REVISI: Kolom Harian 'H-' dibuat sempit (5)
            else if (key.startsWith('H-')) width = 5;
            else if (key === 'TO') width = 8; 
            // REVISI: Kolom Multiple TO 'TO-' dibuat sempit (8)
            else if (key.startsWith('TO-')) width = 8;

            else if (key === 'H') width = 5; // Untuk Absensi
            else if (key === 'S') width = 5;
            else if (key === 'I') width = 5;
            else if (key === 'A') width = 5;
            // REVISI: Support RATA2
            else if (key === 'RATA2') width = 8;
            return { header: key, key: key, width: width };
        });

        // 3. ISI DATA (Mulai Baris 7)
        data.forEach((row, index) => {
            // Karena kita pakai columns definition di atas, kita bisa pakai addRow atau akses langsung
            // Tapi karena headerRow manual di row 6, kita pakai manual row 7+
            const currentRow = sheet.getRow(7 + index);
            
            // Map data object ke values array sesuai urutan headers
            const rowValues: any[] = [];
            headers.forEach(key => {
                rowValues.push(row[key]);
            });
            currentRow.values = rowValues;
            
            // Styling Border Data
            currentRow.eachCell((cell: any) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });

        // REVISI 2: Tambahkan Keterangan (Legend) di Bawah Tabel (Hanya untuk Laporan Nilai)
        if (meta?.type === 'nilai') {
            const lastRowIdx = 7 + data.length;
            const legendStartRow = lastRowIdx + 2;

            const legendFont = { name: 'Calibri', size: 10 };
            
            const cellL1 = sheet.getCell(`A${legendStartRow}`);
            cellL1.value = "Keterangan:";
            cellL1.font = { bold: true, name: 'Calibri', size: 10 };

            const legendItems = [
                "H = Harian",
                "TO = Tugas Online",
                "PTS/UTS = Penilaian Tengah Semester",
                "PAS/UAS = Penilaian Akhir Semester"
            ];

            legendItems.forEach((item, idx) => {
                const cell = sheet.getCell(`A${legendStartRow + 1 + idx}`);
                cell.value = item;
                cell.font = legendFont;
            });
        }
    }

    // 4. FITUR DATA VALIDATION (Hanya untuk Template Import Siswa/Nilai Manual)
    if (meta?.withValidation) {
        const startRow = 7;
        const endRow = 7 + data.length + 50;

        // Find Column indexes
        const headers = Object.keys(data[0]);
        const jenisColIdx = headers.indexOf('JENIS TUGAS');
        const ketColIdx = headers.indexOf('KET/MATERI');
        const nilaiColIdx = headers.indexOf('NILAI');

        const colLetter = (idx: number) => String.fromCharCode(65 + idx);

        if (jenisColIdx !== -1) {
            const col = colLetter(jenisColIdx);
            const types = meta.availableTypes || ['Harian', 'PTS', 'UAS', 'Praktik'];
            const typesFormula = `"${types.join(',')}"`;
            for (let i = startRow; i <= endRow; i++) {
                sheet.getCell(`${col}${i}`).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: [typesFormula],
                    showErrorMessage: true,
                    errorStyle: 'stop',
                    errorTitle: 'Input Tidak Valid',
                    error: 'Pilih Jenis Tugas dari daftar yang disediakan.'
                };
            }
        }

        if (ketColIdx !== -1 && meta.availableAssessments && meta.availableAssessments.length > 0) {
            const col = colLetter(ketColIdx);
            // Replace commas in names so they don't break the list formula separators
            const cleanAsms = meta.availableAssessments.map(name => name.replace(/,/g, ' ').replace(/"/g, ''));
            const asmFormula = `"${cleanAsms.join(',')}"`;

            if (asmFormula.length < 255) {
                for (let i = startRow; i <= endRow; i++) {
                    sheet.getCell(`${col}${i}`).dataValidation = {
                        type: 'list',
                        allowBlank: true,
                        formulae: [asmFormula],
                        showErrorMessage: true,
                        errorStyle: 'stop',
                        errorTitle: 'Input Tidak Valid',
                        error: 'Pilih Penilaian/Tugas dari daftar yang disediakan.'
                    };
                }
            }
        }

        if (nilaiColIdx !== -1) {
            const col = colLetter(nilaiColIdx);
            for (let i = startRow; i <= endRow; i++) {
                sheet.getCell(`${col}${i}`).dataValidation = {
                    type: 'whole',
                    operator: 'between',
                    allowBlank: true,
                    formulae: ['0', '100'],
                    showErrorMessage: true,
                    errorStyle: 'stop',
                    errorTitle: 'Nilai Tidak Valid',
                    error: 'Nilai harus berupa angka bulat antara 0 sampai 100.'
                };
            }
        }
    }
};

export const generateExcel = async (
  data: any[], 
  fileName: string, 
  sheetName: string, 
  meta?: ExcelMeta
) => {
  try {
    if (!data || data.length === 0) return false;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName.substring(0, 30));

    setupWorksheet(worksheet, data, meta);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    const saveAs = (FileSaver as any).saveAs || (FileSaver as any).default || FileSaver;
    saveAs(blob, `${fileName}.xlsx`);
    return true;
  } catch (error) {
    console.error("Excel Error:", error);
    return false;
  }
};

export const generateBatchExcel = async (
    datasets: { data: any[], sheetName: string, meta: ExcelMeta }[],
    fileName: string
) => {
    try {
        if (!datasets || datasets.length === 0) return false;

        const workbook = new ExcelJS.Workbook();

        datasets.forEach(ds => {
            const safeSheetName = ds.sheetName.replace(/[\\/?*[\]]/g, "").substring(0, 30);
            const worksheet = workbook.addWorksheet(safeSheetName);
            setupWorksheet(worksheet, ds.data, ds.meta);
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        const saveAs = (FileSaver as any).saveAs || (FileSaver as any).default || FileSaver;
        saveAs(blob, `${fileName}.xlsx`);
        return true;
    } catch (error) {
        console.error("Batch Excel Error:", error);
        return false;
    }
}