
import React from 'react';
import { Mail, Instagram, Phone, MapPin, GraduationCap, Award, User } from 'lucide-react';

const PublicProfile: React.FC = () => {
  const profileImageUrl = "https://irqphggbsncuplifywul.supabase.co/storage/v1/object/sign/gambar/profil%20ahmad%20nawasyi%20(2)%20copy.jpg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9kMjA2YTI2NS1hNTMwLTQ5ODktOTBhNS03Yjg2ZmNmZGM0ODYiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJnYW1iYXIvcHJvZmlsIGFobWFkIG5hd2FzeWkgKDIpIGNvcHkuanBnIiwiaWF0IjoxNzY5MzM0NzY1LCJleHAiOjE4NjM5NDI3NjV9.QJzrlkb5m9WovQ7Al_9dVK9tCBGlWwx4vTaHfnO8DzI";

  const education = [
    { title: "Sertifikasi Guru", school: "UIN Syarif Hidayatullah - Jakarta", year: "2025" },
    { title: "Sarjana Pendidikan", school: "Universitas Muhammadiyah Tangerang", year: "2020" },
    { title: "SMA", school: "Ponpes Babus Salam - Tangerang", year: "2009" },
    { title: "SMP", school: "Ponpes Babus Salam - Tangerang", year: "2006" },
    { title: "SDN Karet 3", school: "Tangerang", year: "2003" },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-4 md:space-y-6 animate-fadeIn px-1 md:px-0">
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100">
        <div className="p-4 md:p-8">
          <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6 pb-6 md:pb-8 border-b border-slate-50">
            <div className="relative group shrink-0">
              <img 
                src={profileImageUrl} 
                alt="Ahmad Nawasyi"
                className="w-24 h-24 md:w-40 md:h-40 rounded-2xl border-2 md:border-4 border-slate-50 shadow-md object-cover bg-slate-100"
              />
              <div className="absolute -bottom-1 -right-1 md:-bottom-2 md:-right-2 bg-emerald-600 text-white p-1 md:p-1.5 rounded-lg shadow-lg border-2 border-white">
                <Award size={14} className="md:w-4 md:h-4" />
              </div>
            </div>
            
            <div className="flex-1 w-full flex flex-col items-center md:items-start text-center md:text-left space-y-1 md:space-y-2">
              <div>
                <h1 className="text-lg md:text-3xl font-bold text-slate-800 leading-tight">Ahmad Nawasyi, S.Pd</h1>
                <p className="text-emerald-600 font-semibold text-[10px] md:text-base mt-0.5">Guru Pendidikan Agama Islam & Budi Pekerti</p>
              </div>
              
              <div className="flex gap-1.5 pt-1">
                <button className="p-1.5 md:p-2 rounded-lg md:rounded-xl bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 transition-all border border-transparent hover:border-emerald-100">
                  <Instagram size={14} className="md:w-4 md:h-4" />
                </button>
                <button className="p-1.5 md:p-2 rounded-lg md:rounded-xl bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 transition-all border border-transparent hover:border-emerald-100">
                  <Mail size={14} className="md:w-4 md:h-4" />
                </button>
                <button className="p-1.5 md:p-2 rounded-lg md:rounded-xl bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 transition-all border border-transparent hover:border-emerald-100">
                  <Phone size={14} className="md:w-4 md:h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mt-6 md:mt-8">
            <div className="md:col-span-2 space-y-6 md:space-y-8">
              <section>
                <h2 className="text-[13px] md:text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <User size={14} className="text-emerald-600" /> Profil Singkat
                </h2>
                <div className="p-4 md:p-5 rounded-2xl bg-emerald-50/30 border border-emerald-100/50">
                  <p className="text-slate-600 text-[11px] md:text-base leading-relaxed italic">
                    "Assalamualaikum Warahmatullahi Wabarakatuh. saya adalah pengampu mata pelajaran PAI & Budi Pekerti. yang saat ini 
                    bertugas pada satuan pendidikan SMP PGRI Jatiuwung Kota Tangerang."
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-[13px] md:text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <GraduationCap size={14} className="text-emerald-600" /> Riwayat Pendidikan
                </h2>
                <div className="space-y-3 md:space-y-4">
                  {education.map((edu, index) => (
                    <div key={index} className="flex gap-3 items-start group">
                      <div className="mt-1.5 w-2 h-2 rounded-full bg-emerald-500 shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.3)] group-hover:scale-110 transition-transform"></div>
                      <div className="flex-1 border-l border-slate-100 pl-3 md:pl-5 pb-1 md:pb-2">
                        <h4 className="font-bold text-slate-800 text-xs md:text-base leading-tight">{edu.title}</h4>
                        <p className="text-slate-500 text-[10px] md:text-sm mt-0.5">{edu.school}</p>
                        <div className="inline-block mt-1 bg-emerald-100/40 text-emerald-700 px-2 md:px-3 py-0.5 md:py-1 rounded-md text-[9px] md:text-xs font-bold">
                          Lulus Tahun {edu.year}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="space-y-4 md:space-y-6">
              <div className="bg-slate-50 p-4 md:p-5 rounded-2xl border border-slate-100">
                <h3 className="font-bold text-slate-800 text-[11px] md:text-sm mb-3">Kontak</h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2.5 text-[10px] md:text-sm">
                    <MapPin className="text-emerald-600 shrink-0 mt-0.5" size={12} />
                    <span className="text-slate-600">Kp. Teriti Sepatan Kab. Tangerang </span>
                  </li>
                  <li className="flex items-center gap-2.5 text-[10px] md:text-sm">
                    <Mail className="text-emerald-600 shrink-0" size={12} />
                    <span className="text-slate-600 truncate">ahmadnawasyi36@gmail.com</span>
                  </li>
                </ul>
              </div>

              <div className="bg-emerald-600 p-4 md:p-5 rounded-2xl text-white shadow-lg shadow-emerald-200">
                <div className="flex items-center gap-2 mb-1.5">
                  <Award size={14} />
                  <h3 className="font-bold text-[9px] uppercase tracking-wider">Visi</h3>
                </div>
                <p className="text-emerald-50 text-[10px] md:text-sm leading-relaxed">
                  Membentuk karakter siswa yang berakhlak karimah melalui teladan dan ilmu.
                </p>
              </div>
              <div className="bg-emerald-600 p-4 md:p-5 rounded-2xl text-white shadow-lg shadow-emerald-200">
                <div className="flex items-center gap-2 mb-1.5">
                  <Award size={14} />
                  <h3 className="font-bold text-[9px] uppercase tracking-wider">Misi</h3>
                </div>
                <p className="text-emerald-50 text-[10px] md:text-sm leading-relaxed">
                  Membimbing generasi muda untuk memiliki kecerdasan intelektual sekaligus keluhuran budi pekerti.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicProfile;