import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import Swal from 'sweetalert2';

// Helper internal untuk menggambar konten halaman
const drawPageContent = (doc: jsPDF, type: 'nilai' | 'absensi', data: any[], meta: any) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    // Header (Sama seperti sebelumnya)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(0);
    
    const title = type === 'nilai' ? 'LAPORAN NILAI SISWA' : 'REKAPITULASI ABSENSI SISWA';
    const subTitle = 'PENDIDIKAN AGAMA ISLAM DAN BUDI PEKERTI';
    
    doc.text(title, pageWidth / 2, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.text(subTitle, pageWidth / 2, 21, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`KELAS ${meta.kelas}`, pageWidth / 2, 28, { align: 'center' });
    
    doc.setLineWidth(0.2); //Garis bawah judul
    doc.line(15, 32, pageWidth - 15, 32);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    if (type === 'absensi' && meta.bulan) {
       doc.text(`Bulan : ${meta.bulan} ${meta.tahun}`, 15, 38);
       doc.text(`Semester : ${meta.semester}`, pageWidth - 15, 38, { align: 'right' });
    } else {
       doc.text(`Semester : ${meta.semester}`, 15, 38);
    }

    // DINAMIS TABLE GENERATION
    let head = [];
    let body = [];

    if (data.length > 0) {
        // Ambil Header dari Keys Data Pertama
        const keys = Object.keys(data[0]);
        head = [keys];
        // Map data ke array values
        body = data.map(obj => Object.values(obj));
    }

    autoTable(doc, {
        head: head,
        body: body,
        startY: 42,
        theme: 'grid',
        headStyles: { 
            fillColor: [5, 150, 105],
            textColor: 255,
            fontSize: 9,
            fontStyle: 'bold',
            halign: 'center'
        },
        bodyStyles: { fontSize: 8, textColor: 50 },
        // Kolom Styles: Kita buat semi-dinamis.
        // Kolom 0 (NO) -> Center
        // Kolom 1 (NIS) -> Center
        // Kolom 2 (NAMA SISWA) -> LEFT (Sesuai Permintaan)
        columnStyles: {
            0: { halign: 'center', cellWidth: 8 }, // REVISI: NO lebih kecil
            1: { halign: 'center', cellWidth: 15 }, // REVISI: NIS Dikecilkan jadi 15
            2: { halign: 'left' }, // NAMA SISWA RATA KIRI
            // Sisanya biar autoTable yang atur (default center dari styles)
        },
        styles: { cellPadding: 1, valign: 'middle', halign: 'center' }
    });

    // Tanda Tangan & Keterangan
    let finalY = (doc as any).lastAutoTable.finalY + 10;
    
    // REVISI 2: Tambahkan Keterangan di Kiri Bawah
    if (type === 'nilai') {
        const legendX = 15;
        // Posisikan legend sejajar dengan TTD atau sedikit dibawahnya
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text("Keterangan:", legendX, finalY);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text("H = Harian", legendX, finalY + 5);
        doc.text("TO = Tugas Online", legendX, finalY + 9);
        doc.text("PTS/UTS = Penilaian Tengah Semester", legendX, finalY + 13);
        doc.text("PAS/UAS = Penilaian Akhir Semester", legendX, finalY + 17);
    }
    
    const currentDate = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    
    // TTD Posisi dinamis (agak ke kanan)
    const signX = pageWidth - 60; 
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(0);
    
    doc.text(`Tangerang, ${currentDate}`, signX, finalY, { align: 'left' });
    doc.text('Guru Mata Pelajaran', signX, finalY + 5, { align: 'left' });
    
    doc.setFont('helvetica', 'bold');
    doc.text('Ahmad Nawasyi, S.Pd', signX, finalY + 25, { align: 'left' });
};

export const generatePDFReport = (
  type: 'nilai' | 'absensi',
  data: any[],
  meta: { kelas: string; semester: string; bulan?: string; tahun?: string }
) => {
  try {
    // 1. LOGIKA ORIENTASI KERTAS (Sesuai Permintaan 3)
    // Jika kolom data lebih dari 10 (Indikasi banyak nilai Harian), gunakan LANDSCAPE
    const keys = data.length > 0 ? Object.keys(data[0]) : [];
    const orientation = keys.length > 10 ? 'landscape' : 'portrait';

    const doc = new jsPDF({ orientation: orientation });
    
    drawPageContent(doc, type, data, meta);
    
    // Footer Halaman
    const pageCount = doc.getNumberOfPages();
    const title = type === 'nilai' 
      ? `LAPORAN NILAI SISWA ${meta.kelas} semester ${meta.semester}` 
      : `Rekap Absensi Mapel PAI Kelas ${meta.kelas} Bulan ${meta.bulan} semester ${meta.semester}`;
      
    const downloadDate = new Date().toLocaleDateString('id-ID');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(6);
        doc.setTextColor(100);
        doc.text(`${title} - ${downloadDate}`, 15, pageHeight - 10);
        doc.text(`Hal ${i} dari ${pageCount}`, pageWidth - 15, pageHeight - 10, { align: 'right' });
    }

    const fileName = type === 'nilai' 
        ? `Laporan_Nilai_${meta.kelas}_Sem${meta.semester}.pdf` 
        : `Rekap_Absen_${meta.kelas}_${meta.bulan}__Semesster${meta.semester}.pdf`;
    doc.save(fileName);

    Swal.fire({ icon: 'success', title: 'PDF Berhasil Dibuat', timer: 1500, showConfirmButton: false, heightAuto: false });
  } catch (error) {
    console.error('PDF Error:', error);
    Swal.fire('Gagal', 'Terjadi kesalahan PDF.', 'error');
  }
};

// Fungsi Baru untuk Batch PDF
export const generateBatchPDFReport = (
    type: 'nilai' | 'absensi',
    datasets: { data: any[], meta: any }[]
) => {
    try {
        // 1. LOGIKA ORIENTASI KERTAS UNTUK BATCH
        // Cek apakah ada satupun dataset yang kolomnya > 10. Jika ya, seluruh dokumen jadi Landscape agar aman.
        let maxCols = 0;
        datasets.forEach(ds => {
            if (ds.data.length > 0) {
                const cols = Object.keys(ds.data[0]).length;
                if (cols > maxCols) maxCols = cols;
            }
        });
        const orientation = maxCols > 10 ? 'landscape' : 'portrait';

        const doc = new jsPDF({ orientation: orientation });
        
        datasets.forEach((ds, index) => {
            if (index > 0) doc.addPage();
            drawPageContent(doc, type, ds.data, ds.meta);
        });

        // Footer Halaman Global
        const pageCount = doc.getNumberOfPages();
        const title = type === 'nilai' ? 'Rekap Nilai' : 'Rekap Absensi';
        const downloadDate = new Date().toLocaleDateString('id-ID');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(8);
            doc.setTextColor(100);
            doc.text(`${title} - ${downloadDate}`, 15, pageHeight - 10);
            doc.text(`Hal ${i} dari ${pageCount}`, pageWidth - 15, pageHeight - 10, { align: 'right' });
        }

        const fileName = type === 'nilai' 
            ? `Laporan_Nilai_SEMUA_KELAS_Sem${datasets[0].meta.semester}.pdf` 
            : `Rekap_Absen_SEMUA_KELAS_${datasets[0].meta.bulan}.pdf`;
        doc.save(fileName);

        Swal.fire({ icon: 'success', title: 'Eksport PDF Berhasil', text: 'Semua kelas dalam satu file.', timer: 1500, showConfirmButton: false, heightAuto: false });

    } catch (error) {
        console.error('Batch PDF Error:', error);
        Swal.fire('Gagal', 'Terjadi kesalahan Eksport PDF.', 'error');
    }
}