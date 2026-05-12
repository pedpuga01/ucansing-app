"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function CursosPage() {
  const [clases, setClases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClases();
  }, []);

  async function fetchClases() {
    setLoading(true);
    const { data, error } = await supabase
      .from("clases")
      .select(`
        *,
        inscripciones (
          id,
          estado,
          alumnos ( nombre )
        )
      `)
      .order("nombre", { ascending: true });

    if (error) console.error("Error:", error);
    else setClases(data || []);
    setLoading(false);
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Catálogo de Cursos</h1>
          <p className="text-slate-500">Configuración de horarios y profesores</p>
        </div>
        <button className="bg-orange-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-orange-700 transition">
          + Nueva Clase
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clases.map((clase) => (
            <div key={clase.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex justify-between items-start mb-4">
                <span className="bg-orange-100 text-orange-700 text-[10px] font-black px-2 py-1 rounded-md uppercase">
                  {clase.tipo}
                </span>
              </div>
              
              <h3 className="text-xl font-bold text-slate-800 mb-1">{clase.nombre}</h3>
              <p className="text-sm text-slate-500 mb-4">Profesor: <span className="font-semibold">{clase.profesor}</span></p>

              <div className="bg-slate-50 rounded-xl p-4 mb-4">
                <div className="flex justify-between text-xs font-bold text-slate-400 uppercase mb-2">
                  <span>Alumnos Inscritos (Activos)</span>
                  <span>{clase.inscripciones?.filter((i:any) => i.estado === 'ACTIVO').length || 0}</span>
                </div>
                <div className="flex -space-x-2 overflow-hidden">
                  {clase.inscripciones?.filter((i:any) => i.estado === 'ACTIVO').slice(0,5).map((ins: any, i: number) => (
                    <div key={i} title={ins.alumnos?.nombre} className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-orange-400 flex items-center justify-center text-white text-[10px] font-bold">
                      {ins.alumnos?.nombre.substring(0,2).toUpperCase()}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button className="flex-1 bg-slate-100 text-slate-600 py-2 rounded-lg text-xs font-bold hover:bg-slate-200 transition">Editar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}