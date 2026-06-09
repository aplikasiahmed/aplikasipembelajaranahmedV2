import React from 'react';

const PublicMaterials: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] md:min-h-[50vh] space-y-2 md:space-y-4 animate-fadeIn px-4 text-center">
      <div className="bg-slate-200/50 p-3 md:p-4 rounded-full mb-2">
        <div className="w-8 h-8 md:w-12 md:h-12 border-4 border-slate-300 border-t-emerald-600 rounded-full animate-spin"></div>
      </div>
      <h1 className="text-lg md:text-2xl font-bold text-slate-800">Materi Pembelajaran</h1>
      <p className="text-[10px] md:text-sm text-slate-500 max-w-xs">
        materi pembelajaran sedang dalam tahap pengembangan konten oleh guru
      </p>
    </div>
  );
};

export default PublicMaterials;