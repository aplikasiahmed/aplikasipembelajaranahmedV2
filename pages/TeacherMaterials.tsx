import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  BookOpen, 
  Plus, 
  Trash2, 
  Edit2, 
  Save, 
  Search, 
  Filter, 
  Image as ImageIcon, 
  FileText, 
  Link as LinkIcon, 
  GraduationCap, 
  BookOpenCheck,
  CalendarDays,
  Eye,
  RefreshCw,
  FolderOpen
} from 'lucide-react';
import { db } from '../services/supabaseMock';
import Swal from 'sweetalert2';
import { Material, GradeLevel, Student } from '../types';

interface TP {
  id: string;
  code: string;
  name: string;
  description: string;
  subject: string;
  grade: string;
  semester: string;
}

const CATEGORIES = ['Aqidah', 'Fiqih', 'Sejarah', 'Akhlak', 'Al-Quran'] as const;

const TeacherMaterials: React.FC = () => {
  const navigate = useNavigate();

  // --- DATABASE STATES ---
  const [materials, setMaterials] = useState<Material[]>([]);
  const [tps, setTps] = useState<TP[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // --- FILTER & SEARCH STATES ---
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterGrade, setFilterGrade] = useState<string>('Semua');
  const [filterCategory, setFilterCategory] = useState<string>('Semua');

  // --- FORM STATES ---
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Individual Form Fields
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [grade, setGrade] = useState<GradeLevel>('7');
  const [semester, setSemester] = useState<string>('1'); // '1' atau '2'
  const [selectedTpId, setSelectedTpId] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('Semua Kelas');
  const [category, setCategory] = useState<'Aqidah' | 'Fiqih' | 'Sejarah' | 'Akhlak' | 'Al-Quran'>('Aqidah');
  const [contentUrl, setContentUrl] = useState<string>('');
  const [thumbnail, setThumbnail] = useState<string>('');
  const [textContent, setTextContent] = useState<string>('');

  // Local storage / Image Upload helper
  const [imagePreview, setImagePreview] = useState<string>('');

  // --- FETCH DATA ---
  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Ambil materi
      const list = await db.getMaterials();
      setMaterials(list);

      // 2. Ambil TP (Tujuan Pembelajaran)
      const listTps = db.getLocalTable<TP>('tujuan_pembelajaran');
      setTps(listTps);

      // 3. Ambil data siswa untuk segmentasi kelas
      const listStudents = db.getLocalTable<Student>('data_siswa');
      setStudents(listStudents);
    } catch (err) {
      console.error('Gagal memuat data materi:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // --- DYNAMIC OPTION LISTS ---
  // Ambil daftar kelas unik berdasarkan Jenjang Kelas yang sedang di-input
  const getAvailableClassesForGrade = (selectedGrade: string) => {
    const filtered = students.filter(s => s.kelas && s.kelas.trim().startsWith(selectedGrade));
    const classes = Array.from(new Set(filtered.map(s => s.kelas))).sort();
    return ['Semua Kelas', ...classes];
  };

  // Ambil daftar TP yang sesuai dengan Jenjang Kelas & Semester yang dipilih
  const getFilteredTpsForForm = (selectedGrade: string, selectedSemester: string) => {
    return tps.filter(t => String(t.grade) === String(selectedGrade) && String(t.semester) === String(selectedSemester));
  };

  // --- HANDLE IMAGE UPLOAD (BASE64) ---
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setThumbnail(base64String);
        setImagePreview(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  // --- OPEN FORM FOR ADD / EDIT ---
  const openAddForm = () => {
    setEditId(null);
    setTitle('');
    setDescription('');
    setGrade('7');
    setSemester('1');
    setSelectedTpId('');
    setSelectedClass('Semua Kelas');
    setCategory('Aqidah');
    setContentUrl('');
    setThumbnail('');
    setTextContent('');
    setImagePreview('');
    setIsFormOpen(true);
  };

  const openEditForm = (mat: Material) => {
    setEditId(mat.id);
    setTitle(mat.title || '');
    setDescription(mat.description || '');
    setGrade(mat.grade || '7');
    setSemester(mat.semester || '1');
    setSelectedTpId(mat.tp_id || '');
    setSelectedClass(mat.kelas || 'Semua Kelas');
    setCategory(mat.category || 'Aqidah');
    setContentUrl(mat.content_url || '');
    setThumbnail(mat.thumbnail || '');
    setTextContent(mat.text_content || '');
    setImagePreview(mat.thumbnail || '');
    setIsFormOpen(true);
  };

  // --- SAVE / UPDATE SUBMIT ---
  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal',
        text: 'Judul materi wajib diisi!',
        heightAuto: false
      });
      return;
    }

    try {
      const payload = {
        title,
        description,
        grade,
        category,
        content_url: contentUrl,
        thumbnail,
        semester,
        kelas: selectedClass,
        tp_id: selectedTpId,
        text_content: textContent
      };

      if (editId) {
        // Edit mode
        await db.updateMaterial(editId, payload);
        Swal.fire({
          icon: 'success',
          title: 'Berhasil',
          text: 'Materi pembelajaran berhasil diperbarui.',
          timer: 1500,
          showConfirmButton: false,
          heightAuto: false
        });
      } else {
        // Add mode
        await db.createMaterial(payload);
        Swal.fire({
          icon: 'success',
          title: 'Berhasil',
          text: 'Materi pembelajaran baru berhasil disimpan.',
          timer: 1500,
          showConfirmButton: false,
          heightAuto: false
        });
      }

      setIsFormOpen(false);
      loadData();
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'Gagal',
        text: 'Gagal menyimpan materi pembelajaran.',
        heightAuto: false
      });
    }
  };

  // --- DELETE MATERIAL ---
  const handleDeleteMaterial = (id: string) => {
    Swal.fire({
      title: 'Hapus Materi ini?',
      text: 'Materi yang dihapus tidak dapat dipulihkan kembali oleh guru.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus!',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      heightAuto: false,
      customClass: { popup: 'rounded-[1.5rem]' }
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await db.deleteMaterial(id);
          Swal.fire({
            icon: 'success',
            title: 'Terhapus!',
            text: 'Materi berhasil dihapus.',
            timer: 1500,
            showConfirmButton: false,
            heightAuto: false
          });
          loadData();
        } catch (e) {
          Swal.fire({
            icon: 'error',
            title: 'Gagal',
            text: 'Gagal menghapus materi.',
            heightAuto: false
          });
        }
      }
    });
  };

  // --- FILTERED MATERIALS FOR DISPLAY ---
  const filteredMaterials = materials.filter(m => {
    const matchSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        m.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchGrade = filterGrade === 'Semua' || m.grade === filterGrade;
    const matchCategory = filterCategory === 'Semua' || m.category === filterCategory;
    return matchSearch && matchGrade && matchCategory;
  });

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <div>
          <button 
            onClick={() => navigate('/guru')} 
            className="group flex items-center gap-2 text-slate-700 hover:text-amber-700 transition-all text-xs font-black uppercase tracking-wider mb-2"
          >
            <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
            <span>DASHBOARD UTAMA</span>
          </button>
          <h1 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-slate-800 flex items-center gap-2 leading-tight">
            <BookOpen size={24} className="text-emerald-600" />
            Kelola Materi Pembelajaran
          </h1>
          <p className="text-slate-500 text-[10px] md:text-xs font-medium leading-tight max-w-xl mt-1">
            Buat, edit, dan bagikan modul materi Pendidikan Agama Islam (PAI) lengkap dengan teks materi, gambar ilustrasi, serta tautan sumber belajar eksternal.
          </p>
        </div>

        {!isFormOpen && (
          <button 
            onClick={openAddForm}
            className="flex items-center gap-2 px-5 py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-100 transition-all active:scale-95 self-start md:self-auto"
          >
            <Plus size={16} />
            Tambah Materi Baru
          </button>
        )}
      </div>

      {loading ? (
        <div className="bg-white p-12 rounded-[2rem] border border-slate-100 shadow-sm text-center space-y-3">
          <div className="w-10 h-10 border-4 border-slate-100 border-t-emerald-600 rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-slate-500 font-medium">Sedang memproses & menyinkronkan data materi...</p>
        </div>
      ) : isFormOpen ? (
        /* --- FORM ADD / EDIT MATERI --- */
        <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <div>
              <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider block">Formulir Materi</span>
              <h2 className="text-lg font-black text-slate-800">
                {editId ? 'Perbarui Materi Pembelajaran' : 'Buat Materi Pembelajaran Baru'}
              </h2>
            </div>
            <button
              onClick={() => setIsFormOpen(false)}
              className="text-xs font-bold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-all"
            >
              Batal
            </button>
          </div>

          <form onSubmit={handleSaveMaterial} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Kolom Kiri: Meta Informasi */}
              <div className="space-y-4">
                {/* Judul */}
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">Judul Materi</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Ketentuan Wudhu & Tayamum"
                    className="w-full px-3.5 py-3 text-xs rounded-xl border border-slate-200 outline-none focus:border-emerald-600 font-medium"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                {/* Deskripsi Singkat */}
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">Deskripsi Ringkas (Abstrak)</label>
                  <textarea
                    rows={2}
                    placeholder="Tulis ringkasan singkat isi materi untuk memancing minat baca siswa..."
                    className="w-full px-3.5 py-3 text-xs rounded-xl border border-slate-200 outline-none focus:border-emerald-600 font-medium resize-none"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                {/* Grid Dropdowns */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Kategori */}
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">Kategori PAI</label>
                    <select
                      className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 outline-none focus:border-emerald-600 bg-white"
                      value={category}
                      onChange={(e) => setCategory(e.target.value as any)}
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* Jenjang Kelas */}
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">Jenjang Kelas</label>
                    <select
                      className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 outline-none focus:border-emerald-600 bg-white"
                      value={grade}
                      onChange={(e) => {
                        const nextGrade = e.target.value as GradeLevel;
                        setGrade(nextGrade);
                        setSelectedClass('Semua Kelas');
                        setSelectedTpId('');
                      }}
                    >
                      <option value="7">Kelas VII (7)</option>
                      <option value="8">Kelas VIII (8)</option>
                      <option value="9">Kelas IX (9)</option>
                    </select>
                  </div>

                  {/* Semester */}
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">Semester</label>
                    <select
                      className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 outline-none focus:border-emerald-600 bg-white"
                      value={semester}
                      onChange={(e) => {
                        setSemester(e.target.value);
                        setSelectedTpId('');
                      }}
                    >
                      <option value="1">1 (Ganjil)</option>
                      <option value="2">2 (Genap)</option>
                    </select>
                  </div>

                  {/* Segmentasi Kelas Spesifik */}
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">Kelas Spesifik</label>
                    <select
                      className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 outline-none focus:border-emerald-600 bg-white"
                      value={selectedClass}
                      onChange={(e) => setSelectedClass(e.target.value)}
                    >
                      {getAvailableClassesForGrade(grade).map(cls => (
                        <option key={cls} value={cls}>{cls}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Hubungkan dengan Tujuan Pembelajaran (TP) */}
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block flex items-center gap-1">
                    <BookOpenCheck size={12} className="text-emerald-600" />
                    Hubungkan ke Tujuan Pembelajaran (TP)
                  </label>
                  <select
                    className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 outline-none focus:border-emerald-600 bg-white"
                    value={selectedTpId}
                    onChange={(e) => setSelectedTpId(e.target.value)}
                  >
                    <option value="">-- Tanpa Menghubungkan TP --</option>
                    {getFilteredTpsForForm(grade, semester).map(t => (
                      <option key={t.id} value={t.id}>
                        [{t.code}] {t.name} - {t.description.substring(0, 50)}...
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    *Pilihan TP disaring otomatis berdasarkan Jenjang Kelas & Semester yang dipilih di atas.
                  </p>
                </div>
              </div>

              {/* Kolom Kanan: Media & Konten Utama */}
              <div className="space-y-4">
                {/* Gambar Thumbnail */}
                <div className="space-y-2">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Gambar Ilustrasi / Thumbnail Materi</label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder="Tempel link URL gambar eksternal di sini..."
                        className="w-full px-3.5 py-3 text-xs rounded-xl border border-slate-200 outline-none focus:border-emerald-600 font-medium mb-2"
                        value={thumbnail}
                        onChange={(e) => {
                          setThumbnail(e.target.value);
                          setImagePreview(e.target.value);
                        }}
                      />
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400">Atau Unggah langsung:</span>
                        <input
                          type="file"
                          accept="image/*"
                          id="materi-img-upload"
                          className="hidden"
                          onChange={handleImageChange}
                        />
                        <label
                          htmlFor="materi-img-upload"
                          className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg text-[10px] font-bold text-slate-700 cursor-pointer transition-all active:scale-95"
                        >
                          <ImageIcon size={12} />
                          Pilih Berkas Foto
                        </label>
                      </div>
                    </div>

                    {/* Preview Box */}
                    <div className="w-24 h-24 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 self-center">
                      {imagePreview ? (
                        <img referrerPolicy="no-referrer" src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-center text-slate-300">
                          <ImageIcon size={24} className="mx-auto" />
                          <span className="text-[8px] font-bold uppercase">Nihil Foto</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Link Dokumen Tambahan */}
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block flex items-center gap-1">
                    <LinkIcon size={12} className="text-indigo-600" />
                    Tautan Sumber Tambahan (URL Google Docs/Drive/YouTube) - Opsional
                  </label>
                  <input
                    type="url"
                    placeholder="Contoh: https://docs.google.com/document/d/..."
                    className="w-full px-3.5 py-3 text-xs rounded-xl border border-slate-200 outline-none focus:border-emerald-600 font-medium"
                    value={contentUrl}
                    onChange={(e) => setContentUrl(e.target.value)}
                  />
                </div>

                {/* Teks Materi Lengkap */}
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block flex items-center gap-1">
                    <FileText size={12} className="text-amber-600" />
                    Teks Isi Materi Pembelajaran Lengkap
                  </label>
                  <textarea
                    rows={6}
                    required
                    placeholder="Tulis teks pembahasan lengkap di sini secara terstruktur dan komprehensif..."
                    className="w-full px-3.5 py-3 text-xs rounded-xl border border-slate-200 outline-none focus:border-emerald-600 font-medium font-sans"
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                  />
                  <p className="text-[9px] text-slate-400 mt-1">
                    *Materi yang Anda tulis akan disajikan dengan layout membaca khusus yang interaktif untuk siswa.
                  </p>
                </div>
              </div>
            </div>

            {/* Submit Button Row */}
            <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95"
              >
                Kembali ke Daftar
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-6 py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-100 transition-all active:scale-95"
              >
                <Save size={16} />
                {editId ? 'Simpan Perubahan' : 'Terbitkan Materi'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* --- LIST MATERI VIEW --- */
        <>
          {/* Filter Panel */}
          <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
              <Filter size={14} className="text-slate-400" />
              Saring Materi Pembelajaran
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Cari Kata Kunci */}
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">Cari Judul / Ringkasan</label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Masukkan kata kunci..."
                    className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-200 outline-none focus:border-emerald-600"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {/* Saring Jenjang */}
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">Jenjang Kelas</label>
                <select
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 outline-none focus:border-emerald-600 bg-white"
                  value={filterGrade}
                  onChange={(e) => setFilterGrade(e.target.value)}
                >
                  <option value="Semua">Semua Jenjang</option>
                  <option value="7">Kelas VII (7)</option>
                  <option value="8">Kelas VIII (8)</option>
                  <option value="9">Kelas IX (9)</option>
                </select>
              </div>

              {/* Saring Kategori */}
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">Kategori PAI</label>
                <select
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 outline-none focus:border-emerald-600 bg-white"
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                >
                  <option value="Semua">Semua Kategori</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Grid Modul Materi */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMaterials.length === 0 ? (
              <div className="col-span-full bg-white p-12 rounded-[2rem] border border-slate-100 shadow-sm text-center">
                <FolderOpen size={48} className="text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-black text-slate-700">Tidak Ada Materi Ditemukan</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  Belum ada materi pembelajaran yang diterbitkan guru dengan kriteria pencarian ini.
                </p>
              </div>
            ) : (
              filteredMaterials.map((mat) => {
                // Cari info TP yang terhubung
                const matchedTp = tps.find(t => String(t.id) === String(mat.tp_id));

                return (
                  <div key={mat.id} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col justify-between group hover:shadow-md transition-all duration-300">
                    <div>
                      {/* Image Thumbnail */}
                      <div className="h-40 bg-slate-50 relative overflow-hidden">
                        {mat.thumbnail ? (
                          <img 
                            referrerPolicy="no-referrer" 
                            src={mat.thumbnail} 
                            alt={mat.title} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 gap-2">
                            <BookOpen size={40} />
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Modul Belajar PAI</span>
                          </div>
                        )}
                        <span className="absolute left-4 top-4 bg-emerald-700 text-white font-black text-[9px] px-2.5 py-1 rounded-full uppercase tracking-wider shadow-md">
                          {mat.category}
                        </span>
                        <span className="absolute right-4 top-4 bg-white/95 text-slate-800 font-extrabold text-[9px] px-2.5 py-1 rounded-full shadow-md">
                          Semester {mat.semester || '1'}
                        </span>
                      </div>

                      {/* Content Area */}
                      <div className="p-5 space-y-3.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="bg-emerald-50 text-emerald-800 font-extrabold text-[9px] px-2 py-0.5 rounded-lg border border-emerald-100">
                            Kelas {mat.grade}
                          </span>
                          <span className="bg-indigo-50 text-indigo-800 font-extrabold text-[9px] px-2 py-0.5 rounded-lg border border-indigo-100">
                            {mat.kelas || 'Semua Kelas'}
                          </span>
                        </div>

                        <div>
                          <h3 className="font-black text-slate-800 text-sm leading-tight line-clamp-1 group-hover:text-emerald-700 transition-colors" title={mat.title}>
                            {mat.title}
                          </h3>
                          <p className="text-[11px] text-slate-400 font-medium line-clamp-2 mt-1">
                            {mat.description || 'Tidak ada deskripsi singkat.'}
                          </p>
                        </div>

                        {/* TP details */}
                        {matchedTp ? (
                          <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                            <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wide">Tujuan Pembelajaran Terkait:</span>
                            <p className="text-[10px] font-bold text-slate-700 line-clamp-1">
                              [{matchedTp.code}] {matchedTp.name}
                            </p>
                          </div>
                        ) : (
                          <div className="p-2.5 bg-slate-50 border border-slate-100 border-dashed rounded-xl text-center">
                            <span className="text-[9px] text-slate-400 italic">Tidak terhubung ke TP pembelajaran</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action buttons footer */}
                    <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2 rounded-b-[2rem]">
                      <span className="text-[9px] text-slate-400 font-bold font-mono">
                        {mat.created_at ? new Date(mat.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) : 'Baru'}
                      </span>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => openEditForm(mat)}
                          className="flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 p-2 rounded-xl text-[10px] font-bold border border-slate-200 transition-all active:scale-95"
                          title="Edit Materi"
                        >
                          <Edit2 size={12} className="text-slate-500" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteMaterial(mat.id)}
                          className="flex items-center gap-1 bg-red-50 hover:bg-red-100 text-red-600 p-2 rounded-xl text-[10px] font-bold border border-red-100 transition-all active:scale-95"
                          title="Hapus Materi"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default TeacherMaterials;
