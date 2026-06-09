import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  logLevel: 'warn', // Kurangi log di terminal
  server: {
    hmr: {
      overlay: false, // Sembunyikan overlay error jika mengganggu
    }
  },
  build: {
    // Menaikkan batas peringatan ukuran file menjadi 2000kb (2MB)
    // Ini menghilangkan warning "Adjust chunk size limit" di Vercel
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        // Memecah file javascript agar tidak menumpuk di satu file besar (Code Splitting)
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Pisahkan library Excel (xlsx) ke file sendiri
            if (id.includes('xlsx')) {
              return 'vendor-excel';
            }
            // Pisahkan library PDF (jspdf & html2canvas) ke file sendiri
            if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('jspdf-autotable')) {
              return 'vendor-pdf';
            }
            // Pisahkan library UI (Lucide & SweetAlert)
            if (id.includes('lucide-react') || id.includes('sweetalert2')) {
              return 'vendor-ui';
            }
            // Sisanya masuk ke vendor umum
            return 'vendor';
          }
        },
      },
    },
  },
});