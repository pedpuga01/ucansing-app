"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AsistenciasPage() {
  const [fechaSeleccionada, setFechaSeleccionada] = useState(new Date().toISOString().split('T')[0]);
  const [clasesDelDia, setClasesDelDia] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [claseActiva, setClaseActiva] = useState<any>(null);
  const [asistenciasForm, setAsistenciasForm] = useState<Record<string, string>>({});

  useEffect(() => { cargarClasesDelDia(); }, [fechaSeleccionada]);

  async function cargarClasesDelDia() {
    setIsLoading(true);
    // Solucionar timezone: Forzar la fecha a mediodía UTC para obtener el día correcto de la semana
    const diasStr = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const d = new Date(fechaSeleccionada + "T12:00:00Z"); 
    const diaSemanaStr = diasStr[d.getDay()];

    const { data: clasesBase } = await supabase
      .from("clases").select(`*, disciplinas(nombre), inscripciones(students(id, name, status))`)
      .eq("dia_semana", diaSemanaStr).order("hora_inicio");

    const { data: sesionesHoy } = await supabase
      .from("sesiones_clase").select(`*`).eq("fecha", fechaSeleccionada);

    if (clasesBase) {
      const clasesConSesion = clasesBase.map(c => {
        const sesion = sesionesHoy?.find(s => s.clase_id === c.id);
        const inscritosActivos = c.inscripciones?.filter((i:any) => i.students?.status === 'Activo') || [];
        return { ...c, sesion_id: sesion?.id, estado_sesion: sesion?.estado || "Pendiente", alumnos: inscritosActivos };
      });
      setClasesDelDia(clasesConSesion);
    }
    setIsLoading(false);
  }

  async function abrirPaseDeLista(clase: any) {
    setClaseActiva(clase);
    let form: Record<string, string> = {};
    if (clase.sesion_id) {
      const { data } = await supabase.from("asistencias").select("student_id, estado_asistencia").eq("sesion_id", clase.sesion_id);
      data?.forEach(a => form[a.student_id] = a.estado_asistencia);
    } else {
      clase.alumnos.forEach((a:any) => form[a.students.id] = "Pendiente");
    }
    setAsistenciasForm(form);
    setIsModalOpen(true);
  }

  async function guardarAsistencia() {
    let sId = claseActiva.sesion_id;
    if (!sId) {
      const { data, error } = await supabase.from("sesiones_clase").insert([{ clase_id: claseActiva.id, fecha: fechaSeleccionada, estado: "Realizada" }]).select().single();
      if(error) return alert("Error creando sesión: " + error.message);
      sId = data.id;
    }
    const inserts = Object.entries(asistenciasForm).map(([student_id, estado]) => ({ sesion_id: sId, student_id, estado_asistencia: estado }));
    await supabase.from("asistencias").upsert(inserts, { onConflict: 'sesion_id,student_id' });
    setIsModalOpen(false);
    cargarClasesDelDia();
  }

  return (
    <div className="p-10 space-y-8 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0B132D] tracking-tight">Pase de Lista (Asistencias)</h1>
          <p className="text-[#64748B] mt-1 font-medium">Motor V2.0 - Control diario por bloque y profesor.</p>
        </div>
        <div className="bg-white border border-slate-200 p-2.5 rounded-xl flex items-center shadow-sm">
          <span className="px-3 font-bold text-slate-500 uppercase tracking-widest text-[10px]">📅 Seleccionar Fecha:</span>
          <input type="date" value={fechaSeleccionada} onChange={e => setFechaSeleccionada(e.target.value)} className="border-none outline-none font-black text-[#0466C8] bg-blue-50 px-3 py-1.5 rounded-lg cursor-pointer" />
        </div>
      </div>

      <div className="saas-card overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-[11px] uppercase tracking-widest text-[#64748B] font-bold">
              <th className="px-6 py-5">Hora</th><th className="px-6 py-5">Curso y Profesor</th><th className="px-6 py-5 text-center">Inscritos</th><th className="px-6 py-5 text-center">Estado Sesión</th><th className="px-6 py-5 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 bg-white">
            {isLoading ? <tr><td colSpan={5} className="p-8 text-center text-slate-500 font-medium">Buscando bloques de clases...</td></tr> : 
             clasesDelDia.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-slate-500 font-medium">No hay clases configuradas para este día de la semana.</td></tr> :
             clasesDelDia.map(c => (
              <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-5 font-black text-xl text-[#0B132D]">{c.hora_inicio?.substring(0,5)}</td>
                <td className="px-6 py-5">
                  <p className="font-bold text-sm text-[#0B132D]">{c.disciplinas?.nombre} <span className="text-[10px] text-slate-500 uppercase border border-slate-200 px-1.5 py-0.5 rounded ml-1 bg-slate-100">{c.modalidad}</span></p>
                  <p className="text-[11px] text-[#0466C8] font-bold mt-1">Prof: {c.profesor}</p>
                </td>
                <td className="px-6 py-5 text-center font-black text-slate-600">{c.alumnos?.length || 0}</td>
                <td className="px-6 py-5 text-center">
                  <span className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-widest ${c.estado_sesion === 'Realizada' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                    {c.estado_sesion}
                  </span>
                </td>
                <td className="px-6 py-5 text-right">
                  <button onClick={() => abrirPaseDeLista(c)} className={`px-6 py-2.5 rounded-xl text-xs font-bold shadow-md hover:-translate-y-0.5 transition-transform ${c.estado_sesion === 'Realizada' ? 'bg-slate-100 text-slate-600 border border-slate-200' : 'bg-[#0B132D] text-white'}`}>
                    {c.estado_sesion === 'Realizada' ? 'Editar Lista' : 'Pasar Lista'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL PASE DE LISTA */}
      {isModalOpen && claseActiva && (
        <div className="fixed inset-0 bg-[#0B132D]/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-2xl border-t-8 border-[#0466C8] overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-xl font-bold text-[#0B132D]">{claseActiva.disciplinas?.nombre} ({claseActiva.modalidad})</h2>
                <p className="text-sm text-slate-500 font-medium mt-1">Pase de lista del <span className="font-bold text-[#0466C8]">{fechaSeleccionada}</span> | {claseActiva.hora_inicio?.substring(0,5)} hrs</p>
              </div>
              <div className="text-right">
                <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Profesor</span>
                <span className="font-bold text-sm bg-white border border-slate-200 px-3 py-1 rounded-lg">{claseActiva.profesor}</span>
              </div>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar bg-white">
              {claseActiva.alumnos?.length === 0 ? <p className="text-center text-slate-500 py-8 font-medium">No hay alumnos activos inscritos en este bloque.</p> : (
                <div className="space-y-3">
                  {claseActiva.alumnos.map((a: any) => {
                    const student = a.students;
                    const estadoActual = asistenciasForm[student.id];
                    return (
                      <div key={student.id} className="flex flex-col md:flex-row md:items-center justify-between bg-slate-50 border border-slate-200 p-4 rounded-xl shadow-sm hover:border-blue-300 transition-colors">
                        <span className="font-bold text-sm text-[#0B132D] mb-3 md:mb-0">{student.name}</span>
                        <div className="flex gap-2">
                          {["Asistió", "Faltó", "Justificó", "Recuperó"].map(op => (
                            <button 
                              key={op} 
                              onClick={() => setAsistenciasForm({...asistenciasForm, [student.id]: op})}
                              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${
                                estadoActual === op 
                                ? (op === 'Asistió' || op === 'Recuperó' ? 'bg-green-500 text-white border-green-600 shadow-inner' : op === 'Faltó' ? 'bg-red-500 text-white border-red-600 shadow-inner' : 'bg-orange-500 text-white border-orange-600 shadow-inner')
                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100 hover:text-slate-700'
                              }`}
                            >
                              {op}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="p-5 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-colors">Cancelar</button>
              <button onClick={guardarAsistencia} className="bg-[#0466C8] text-white px-8 py-2.5 rounded-xl font-bold shadow-lg hover:-translate-y-0.5 transition-transform">Guardar Asistencia</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}