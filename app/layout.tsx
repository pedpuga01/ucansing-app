"use client";
import { Montserrat, Poppins } from "next/font/google";
import { usePathname } from "next/navigation";
import "./globals.css";

const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", display: "swap" });
const poppins = Poppins({ weight: ["400", "500", "600", "700"], subsets: ["latin"], variable: "--font-poppins", display: "swap" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (path: string) => pathname === path;

  // Menú actualizado: Eliminamos "Migración" de aquí
  const navItems = [
    { name: "Visión General", path: "/", icon: "📊" },
    { name: "Prospectos", path: "/prospectos", icon: "🎯" },
    { name: "Alumnos", path: "/alumnos", icon: "🎓" },
    { name: "Cursos y Horarios", path: "/cursos", icon: "🎸" },
    { name: "Pase de Lista", path: "/asistencias", icon: "📝" },
    { name: "Finanzas", path: "/finanzas", icon: "💳" }
  ];

  return (
    <html lang="es">
      <head><title>UCANSING | Workspace</title></head>
      <body className={`${montserrat.variable} ${poppins.variable} font-sans flex h-screen bg-[#F8FAFC]`}>
        <aside className="w-[260px] bg-white border-r border-slate-100 flex flex-col z-20">
          <div className="h-24 flex items-center px-8 border-b border-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#0B132D] rounded-xl flex items-center justify-center shadow-md text-white font-bold text-lg" style={{fontFamily: 'var(--font-poppins)'}}>
                U<span className="text-[#D20505]">▲</span>
              </div>
              <div>
                <h2 className="text-[15px] font-bold tracking-wide text-[#0B132D]" style={{fontFamily: 'var(--font-poppins)'}}>UCANSING</h2>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Workspace</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 px-4 py-8 space-y-1 overflow-y-auto">
            <p className="px-4 text-[11px] text-slate-400 uppercase tracking-widest font-bold mb-4 mt-2">Menú Principal</p>
            {navItems.map((item) => (
              <a 
                key={item.path} href={item.path} 
                className={`flex items-center px-4 py-3 rounded-xl transition-all duration-200 group ${isActive(item.path) ? "bg-[#0B132D] text-white shadow-md" : "text-slate-500 hover:bg-slate-50 hover:text-[#0B132D]"}`}
              >
                <span className={`mr-3 text-lg transition-transform duration-200 ${isActive(item.path) ? "scale-110" : "grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-110"}`}>{item.icon}</span>
                <span className="text-[13px] font-semibold">{item.name}</span>
              </a>
            ))}
          </nav>

          <div className="p-4 mb-4 border-t border-slate-50">
            <a href="/configuracion" className={`flex items-center px-6 py-3 rounded-xl transition-all text-[13px] font-semibold group ${isActive('/configuracion') ? "bg-[#FC6827] text-white shadow-md" : "text-slate-400 hover:bg-slate-50 hover:text-[#0B132D]"}`}>
              <span className="mr-3 text-lg transition-all duration-300 group-hover:rotate-90">⚙️</span> Configuración
            </a>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto relative">
          <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-slate-100 to-transparent opacity-50 pointer-events-none -z-10"></div>
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </body>
    </html>
  );
}