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
  
  // Modal de Pase de Lista
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [claseActiva, setClaseActiva] = useState<any>(null);
  const [asistenciasForm, setAsistenciasForm] = useState<Record<string, string>>({});

  useEffect(() => { cargarClasesDelDia(); }, [fechaSeleccionada]);

  async function cargarClasesDelDia() {
    setIsLoading(true);
    // Calcular día de la semana (Lunes, Martes...)
    const diasStr = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    const d = new Date(fechaSeleccionada + "T12:00:00Z"); // Fix timezone
    const diaSemanaStr = diasStr[d.getDay() === 0 ? 6 : d.getDay() - 1]; // Ajuste Lunes=0

    // 1. Traer Clases que se dictan ese día de la semana
    const { data: clasesBase } = await supabase
      .from("clases").select(`*, disciplinas(nombre), inscripciones(students(id, name))`)
      .eq("dia_semana", diaSemanaStr).order("hora_inicio");

    // 2. Traer las "Sesiones" ya guardadas en esa fecha exacta
    const { data: sesionesHoy } = await supabase
      .from("sesiones_clase").select(`id, clase_id, estado`).eq("fecha", fechaSeleccionada);

    if (clasesBase) {
      const clasesConSesion = clasesBase.map(c => {
        const sesion = sesionesHoy?.find(s => s.clase_id === c.id);
        return { ...c, sesion_id: sesion?.id, estado_sesion: sesion?.estado || "Pendiente" };
      });
      setClasesDelDia(clasesConSesion);
    }
    setIsLoading(false);
  }

  async function abrirPaseDeLista(clase: any) {
    setClaseActiva(clase);
    let formInicial: Record<string, string> = {};
    
    // Si ya existe la sesión, cargamos las asistencias previas
    if (clase.sesion_id) {
      const { data: asistGuardadas } = await supabase.from("asistencias").select("student_id, estado_asistencia").eq("sesion_id", clase.sesion_id);
      if (asistGuardadas) asistGuardadas.forEach(a => formInicial[a.student_id] = a.estado_asistencia);
    }
    
    setAsistenciasForm(formInicial);
    setIsModalOpen(true);
  }

  async function guardarAsistencia() {
    let sesionId = claseActiva.sesion_id;

    // 1. Si la clase no tiene sesión hoy, la creamos
    if (!sesionId) {
      const { data: nuevaSesion, error: errS } = await supabase.from("sesiones_clase").insert([{
        clase_id: claseActiva.id, fecha: fechaSeleccionada, estado: "Realizada"
      }]).select().single();
      if (errS) return alert("Error creando sesión: " + errS.message);
      sesionId = nuevaSesion.id;
    }

    // 2. Guardar las asistencias de cada alumno
    const insertData = Object.entries(asistenciasForm).map(([student_id, estado]) => ({
      sesion_id: sesionId, student_id, estado_asistencia: estado
    }));

    if (insertData.length > 0) {
      await supabase.from("asistencias").upsert(insertData, { onConflict: 'sesion_id,student_id' });
    }

    setIsModalOpen(false);
    cargarClasesDelDia();
  }

  const opcionesAsistencia = ["Asistió", "Faltó", "Justificó", "Recuperó"];

  return (
    <div className="p-10 space-y-8 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0B132D] tracking-tight">Pase de Lista (Admin)</h1>
          <p className="text-[#64748B] mt-1 font-medium">Motor de Asistencias V2.0 - Gestión diaria.</p>
        </div>
        <div className="bg-white border border-slate-200 p-2 rounded-xl flex items-center shadow-sm">
          <span className="px-3 font-bold text-slate-400">📅 Fecha:</span>
          <input type="date" value={fechaSeleccionada} onChange={e => setFechaSeleccionada(e.target.value)} className="border-none outline-none font-bold text-[#0466C8] bg-blue-50 px-3 py-1 rounded-lg cursor-pointer" />
        </div>
      </div>

      <div className="saas-card overflow-hidden">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-[11px] uppercase tracking-widest text-[#64748B] font-bold">
              <th className="px-6 py-5">Hora</th><th className="px-6 py-5">Curso y Profesor</th><th className="px-6 py-5 text-center">Inscritos</th><th className="px-6 py-5 text-center">Estado Clase</th><th className="px-6 py-5 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 bg-white">
            {isLoading ? <tr><td colSpan={5} className="p-8 text-center text-slate-500">Buscando clases del día...</td></tr> : 
             clasesDelDia.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-slate-500">No hay clases programadas para este día.</td></tr> :
             clasesDelDia.map(c => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-black text-xl text-[#0B132D]">{c.hora_inicio.substring(0,5)}</td>
                <td className="px-6 py-4">
                  <p className="font-bold text-sm text-[#0B132D]">{c.disciplinas?.nombre} ({c.modalidad})</p>
                  <p className="text-[11px] text-[#0466C8] font-bold mt-0.5">Prof: {c.profesor}</p>
                </td>
                <td className="px-6 py-4 text-center font-bold text-slate-600">{c.inscripciones?.length || 0}</td>
                <td className="px-6 py-4 text-center">
                  <span className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase ${c.estado_sesion === 'Realizada' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                    {c.estado_sesion}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => abrirPaseDeLista(c)} className={`${c.estado_sesion === 'Realizada' ? 'bg-slate-100 text-slate-600' : 'bg-[#0B132D] text-white'} px-6 py-2.5 rounded-xl text-xs font-bold shadow-md hover:-translate-y-0.5 transition-transform`}>
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
          <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-2xl border-t-8 border-[#0466C8] overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50">
              <h2 className="text-xl font-bold text-[#0B132D]">Pase de Lista</h2>
              <p className="text-sm text-slate-500">{claseActiva.disciplinas?.nombre} | Prof: {claseActiva.profesor} | {claseActiva.hora_inicio.substring(0,5)} hrs</p>
            </div>
            
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {claseActiva.inscripciones?.length === 0 ? <p className="text-center text-slate-500 py-8">No hay alumnos inscritos en esta clase.</p> : (
                <div className="space-y-3">
                  {claseActiva.inscripciones.map((ins: any) => {
                    const student = ins.students;
                    const estadoActual = asistenciasForm[student.id];
                    return (
                      <div key={student.id} className="flex flex-col md:flex-row md:items-center justify-between bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
                        <span className="font-bold text-sm text-[#0B132D] mb-3 md:mb-0">{student.name}</span>
                        <div className="flex gap-2">
                          {opcionesAsistencia.map(op => (
                            <button 
                              key={op} 
                              onClick={() => setAsistenciasForm({...asistenciasForm, [student.id]: op})}
                              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all border ${
                                estadoActual === op 
                                ? (op === 'Asistió' ? 'bg-green-500 text-white border-green-600' : op === 'Faltó' ? 'bg-red-500 text-white border-red-600' : 'bg-orange-400 text-white border-orange-500')
                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
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

            <div className="p-5 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-200 rounded-xl">Cancelar</button>
              <button onClick={guardarAsistencia} className="bg-[#0466C8] text-white px-8 py-2.5 rounded-xl font-bold shadow-lg">Guardar Asistencia</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}