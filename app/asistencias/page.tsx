"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AsistenciasPage() {
  const [profesores, setProfesores] = useState<string[]>([]);
  const [profeSeleccionado, setProfeSeleccionado] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [clasesDelDia, setClasesDelDia] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    cargarProfesores();
  }, []);

  async function cargarProfesores() {
    const { data } = await supabase.from("clases").select("profesor");
    const unique = Array.from(new Set(data?.map(d => d.profesor)));
    setProfesores(unique as string[]);
  }

  async function buscarClases() {
    if (!profeSeleccionado) return;
    setLoading(true);
    
    // Obtenemos el nombre del día en español (Asegurando compatibilidad con tu Excel)
    const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    // Importante: al usar split('-') evitamos problemas de zona horaria de JS
    const [yyyy, mm, dd] = fecha.split('-');
    const fechaObj = new Date(Number(yyyy), Number(mm)-1, Number(dd));
    const diaNombre = dias[fechaObj.getDay()];

    const { data, error } = await supabase
      .from("clases")
      .select(`
        id, nombre, tipo,
        inscripciones (
          alumno_id, dia_semana, hora_inicio, estado,
          alumnos ( id, nombre )
        )
      `)
      .eq("profesor", profeSeleccionado);

    // Filtramos solo los alumnos activos y que asisten el día seleccionado
    const filtradas = data?.map(clase => ({
      ...clase,
      alumnos_hoy: clase.inscripciones.filter((ins: any) => 
        ins.estado === "ACTIVO" && 
        ins.dia_semana?.toLowerCase() === diaNombre.toLowerCase()
      )
    })).filter(clase => clase.alumnos_hoy.length > 0);

    setClasesDelDia(filtradas || []);
    setLoading(false);
  }

  async function registrarAsistencia(alumnoId: string, claseId: string, estado: string) {
    let { data: sesion } = await supabase.from("sesiones").select("id").eq("clase_id", claseId).eq("fecha", fecha).single();
    
    if (!sesion) {
      const { data } = await supabase.from("sesiones").insert([{ clase_id: claseId, fecha: fecha, hora_inicio: "00:00" }]).select().single();
      sesion = data;
    }

    await supabase.from("asistencias").upsert({
      sesion_id: sesion!.id,
      alumno_id: alumnoId,
      estado: estado
    }, { onConflict: 'sesion_id,alumno_id' });

    alert(`Asistencia registrada: ${estado}`);
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-slate-800 mb-8">Pase de Lista Profesional</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Seleccionar Fecha</label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="w-full p-2 border rounded-xl" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Profesor</label>
          <select value={profeSeleccionado} onChange={e => setProfeSeleccionado(e.target.value)} className="w-full p-2 border rounded-xl">
            <option value="">Seleccione Profesor...</option>
            {profesores.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <button onClick={buscarClases} className="w-full bg-slate-900 text-white py-2 rounded-xl font-bold hover:bg-black transition">
            {loading ? "Buscando..." : "Cargar Agenda del Día"}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {clasesDelDia.length === 0 && !loading && profeSeleccionado && (
           <p className="text-slate-500 text-center py-10 bg-white rounded-2xl border border-dashed">No hay clases registradas para este profesor en este día de la semana.</p>
        )}

        {clasesDelDia.map(clase => (
          <div key={clase.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="bg-slate-100 p-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-bold text-slate-700">{clase.nombre} <span className="text-xs text-slate-400">({clase.tipo})</span></h3>
            </div>
            <div className="p-4">
              {clase.alumnos_hoy.map((ins: any) => (
                <div key={ins.alumnos.id} className="flex flex-col md:flex-row md:justify-between md:items-center py-3 border-b last:border-0 gap-4">
                  <div>
                    <p className="font-semibold text-slate-800">{ins.alumnos.nombre}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{ins.dia_semana} • {ins.hora_inicio} hrs</p>
                  </div>
                  <div className="flex gap-2">
                    {["PRESENTE", "AUSENTE", "JUSTIFICADO"].map(est => (
                      <button 
                        key={est} 
                        onClick={() => registrarAsistencia(ins.alumnos.id, clase.id, est)}
                        className="px-4 py-2 rounded-lg text-xs font-black border border-slate-200 hover:bg-orange-600 hover:text-white transition"
                      >
                        {est}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}