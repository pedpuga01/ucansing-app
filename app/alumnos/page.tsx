"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AlumnosPage() {
  const [alumnos, setAlumnos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    fetchAlumnos();
  }, []);

  async function fetchAlumnos() {
    setLoading(true);
    // Consulta Relacional SaaS: Alumno -> Cuenta Familiar -> Inscripciones -> Clases
    const { data, error } = await supabase
      .from("alumnos")
      .select(`
        id,
        nombre,
        en_riesgo,
        fecha_nacimiento,
        cuentas_familiares (
          titular_nombre,
          email_contacto,
          telefono,
          estado
        ),
        inscripciones (
          estado,
          precio_final_con_descuento,
          dia_semana,
          hora_inicio,
          clases (
            nombre,
            profesor
          )
        )
      `)
      .order("nombre", { ascending: true });

    if (error) {
      console.error("Error fetching alumnos:", error);
    } else {
      setAlumnos(data || []);
    }
    setLoading(false);
  }

  const alumnosFiltrados = alumnos.filter(al => 
    al.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    al.cuentas_familiares?.titular_nombre?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Panel de Alumnos</h1>
          <p className="text-slate-500">Gestión académica y financiera centralizada</p>
        </div>
        <div className="flex gap-4">
          <input 
            type="text" 
            placeholder="Buscar por alumno o apoderado..." 
            className="px-4 py-2 rounded-xl border border-slate-200 w-80 shadow-sm focus:ring-2 focus:ring-orange-500 outline-none"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <button 
            onClick={fetchAlumnos}
            className="bg-white border border-slate-200 p-2 rounded-xl hover:bg-slate-50 transition"
          >
            🔄
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {alumnosFiltrados.map((alumno) => (
            <div key={alumno.id} className={`bg-white rounded-2xl shadow-sm border ${alumno.en_riesgo ? 'border-red-200 ring-1 ring-red-100' : 'border-slate-200'} p-6 hover:shadow-md transition`}>
              
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">{alumno.nombre}</h3>
                  <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">
                    {alumno.inscripciones?.[0]?.clases?.nombre || "Sin Curso"}
                  </p>
                </div>
                {alumno.en_riesgo && (
                  <span className="bg-red-100 text-red-600 text-[10px] font-black px-2 py-1 rounded-full animate-pulse">
                    ⚠️ EN RIESGO
                  </span>
                )}
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center text-sm text-slate-600">
                  <span className="w-6">👤</span>
                  <span className="truncate">Apoderado: {alumno.cuentas_familiares?.titular_nombre}</span>
                </div>
                <div className="flex items-center text-sm text-slate-600">
                  <span className="w-6">📧</span>
                  <span className="truncate">{alumno.cuentas_familiares?.email_contacto}</span>
                </div>
                <div className="flex items-center text-sm text-slate-600">
                  <span className="w-6">📅</span>
                  <span>
                    {alumno.inscripciones?.[0]?.dia_semana} {alumno.inscripciones?.[0]?.hora_inicio?.substring(0,5)}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Estado Pago</span>
                  <span className={`text-xs font-bold ${alumno.cuentas_familiares?.estado === 'MOROSO' ? 'text-red-500' : 'text-green-500'}`}>
                    ● {alumno.cuentas_familiares?.estado || 'AL_DIA'}
                  </span>
                </div>
                <button className="bg-slate-100 text-slate-600 px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-200 transition">
                  Ver Ficha
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {alumnosFiltrados.length === 0 && !loading && (
        <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
          <p className="text-slate-400 font-medium">No se encontraron alumnos con esos criterios.</p>
          <p className="text-xs text-slate-300 mt-1">Asegúrate de haber completado la migración exitosamente.</p>
        </div>
      )}
    </div>
  );
}