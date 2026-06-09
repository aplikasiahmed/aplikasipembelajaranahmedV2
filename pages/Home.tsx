
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Calendar, Quote } from 'lucide-react';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const features = [
    { title: 'Kelas 7', desc: 'Materi dalam tahap pengembangan konten', color: 'bg-blue-500' },
    { title: 'Kelas 8', desc: 'Materi dalam tahap pengembangan konten', color: 'bg-emerald-500' },
    { title: 'Kelas 9', desc: 'Materi dalam tahap pengembangan konten', color: 'bg-amber-500' },
  ];

  return (
    <div className="space-y-8 animate-fadeIn pb-6">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-[1.5rem] bg-emerald-700 text-white p-6 md:p-10 shadow-xl shadow-emerald-200">
        <div className="relative z-10 md:w-3/4 space-y-4">
          <h1 className="text-xl md:text-xl font-extrabold leading-tight tracking-tight">
            Cerdas Berilmu, Mulia Berakhlak
          </h1>
          <p className="text-emerald-50 text-sm md:text-base max-w-lg leading-relaxed opacity-90">
            Portal pembelajaran terpadu Pendidikan Agama Islam
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <button 
              onClick={() => navigate('/materi')}
              className="bg-white text-emerald-700 px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-emerald-50 transition-all shadow-md active:scale-95"
            >
              Lihat Materi
            </button>
            <button 
              onClick={() => navigate('/nilai')}
              className="bg-emerald-600 text-white border border-emerald-500/50 px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-emerald-800 transition-all shadow-md active:scale-95"
            >
              Cek Nilai Saya
            </button>
          </div>
        </div>
        
        <div className="absolute right-[-10%] top-[-10%] h-[120%] w-1/2 opacity-5 hidden lg:block pointer-events-none">
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
            <path fill="#FFFFFF" d="M44.7,-76.4C58.3,-69.2,70.1,-58.5,78.2,-45.5C86.4,-32.5,90.9,-17.3,90.1,-2.3C89.4,12.7,83.4,27.5,74.5,40.3C65.5,53.2,53.6,64.1,39.9,71.7C26.1,79.2,10.6,83.4,-4.1,80.5C-18.9,77.5,-32.8,67.5,-45.6,56.8C-58.4,46.1,-70.1,34.8,-76.1,21C-82.1,7.2,-82.3,-9.1,-77.8,-24.1C-73.3,-39.2,-64.1,-52.9,-51.6,-61.6C-39.2,-70.4,-23.5,-74.1,-8.1,-80.1C7.3,-86.1,23,-83.6,44.7,-76.4Z" transform="translate(100 100)" />
          </svg>
        </div>
      </section>

      {/* Stats/Grades - Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {features.map((item, idx) => (
          <div key={idx} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all duration-300 group cursor-default">
            <div className={`w-10 h-10 ${item.color} rounded-xl mb-4 flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform`}>
              <Users size={20} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">{item.title}</h3>
            <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
            <div className="mt-4 flex items-center gap-2 text-slate-300 font-bold text-[10px] uppercase tracking-wider group-hover:text-emerald-600 transition-colors">
              Detail Kelas <Calendar size={12} />
            </div>
          </div>
        ))}
      </div>

      {/* Hadith Section - Positioned above footer */}
      <section className="bg-white p-6 md:p-8 rounded-[2rem] border border-emerald-100 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-[0.05] text-emerald-900 pointer-events-none group-hover:scale-110 transition-transform duration-500">
          <Quote size={80} />
        </div>
        <div className="relative z-10 flex flex-col items-center text-center space-y-1">
          <span className="text-emerald-600 font-bold text-[10px] uppercase tracking-[0.1em] mb-1">
            Rasulullah SAW Bersabda:
          </span>
          <p className="text-slate-700 text-[9px] md:text-base font-medium leading-relaxed italic max-w-2xl">
            “Siapa yang menempuh jalan untuk mencari ilmu, maka Allah akan mudahkan baginya jalan menuju surga.”
          </p>
          <span className="text-slate-400 font-bold text-[10px] tracking-widest">
            (HR Muslim)
          </span>
        </div>
      </section>
    </div>
  );
};

export default Home;
