
import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import PublicProfile from './pages/PublicProfile';
import PublicGrades from './pages/PublicGrades';
import PublicAbsensi from './pages/PublicAbsensi';
import PublicTasks from './pages/PublicTasks';
import PublicMaterials from './pages/PublicMaterials';
import PublicExam from './pages/PublicExam';
import TeacherDashboard from './pages/TeacherDashboard';
import TeacherInputGrades from './pages/TeacherInputGrades';
import TeacherInputAbsensi from './pages/TeacherInputAbsensi';
import TeacherReports from './pages/TeacherReports';
import TeacherTaskCheck from './pages/TeacherTaskCheck';
import TeacherAdminManagement from './pages/TeacherAdminManagement';
import TeacherExams from './pages/TeacherExams';
import TeacherExamEditor from './pages/TeacherExamEditor';

// Higher Order Component for Route Protection
// Fix: Use React.FC and make children optional to resolve the "Property 'children' is missing" JSX error
const ProtectedRoute: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
  if (!isLoggedIn) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="flex flex-col items-center justify-center min-h-[40vh] md:min-h-[50vh] space-y-2 md:space-y-4 animate-fadeIn px-4 text-center">
    <div className="bg-slate-200/50 p-3 md:p-4 rounded-full mb-2">
      <div className="w-8 h-8 md:w-12 md:h-12 border-4 border-slate-300 border-t-emerald-600 rounded-full animate-spin"></div>
    </div>
    <h1 className="text-lg md:text-2xl font-bold text-slate-800">{title}</h1>
    <p className="text-[10px] md:text-sm text-slate-500 max-w-xs">Halaman ini sedang dalam tahap pengembangan konten oleh guru</p>
  </div>
);

// Scroll to top on route change
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const App: React.FC = () => {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ScrollToTop />
      <Layout>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/profil" element={<PublicProfile />} />
          <Route path="/nilai" element={<PublicGrades />} />
          <Route path="/absensi" element={<PublicAbsensi />} />
          <Route path="/tugas" element={<PublicTasks />} />
          {/* Halaman Ujian Siswa (Sudah bukan Placeholder) */}
          <Route path="/kerjakan-tugas" element={<PublicExam />} />
          <Route path="/materi" element={<PublicMaterials />} />
          
          {/* Protected Teacher Routes */}
          <Route path="/guru" element={
            <ProtectedRoute>
              <TeacherDashboard />
            </ProtectedRoute>
          } />
          {/* Route Baru: Bank Soal & Editor */}
          <Route path="/guru/ujian" element={
            <ProtectedRoute>
              <TeacherExams />
            </ProtectedRoute>
          } />
          <Route path="/guru/ujian/edit/:id" element={
            <ProtectedRoute>
              <TeacherExamEditor />
            </ProtectedRoute>
          } />

          <Route path="/guru/nilai" element={
            <ProtectedRoute>
              <TeacherInputGrades />
            </ProtectedRoute>
          } />
          <Route path="/guru/absensi" element={
            <ProtectedRoute>
              <TeacherInputAbsensi />
            </ProtectedRoute>
          } />
          <Route path="/guru/laporan" element={
            <ProtectedRoute>
              <TeacherReports />
            </ProtectedRoute>
          } />
          <Route path="/guru/tugas-masuk" element={
            <ProtectedRoute>
              <TeacherTaskCheck />
            </ProtectedRoute>
          } />
          <Route path="/guru/admin" element={
            <ProtectedRoute>
              <TeacherAdminManagement />
            </ProtectedRoute>
          } />
          
          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
