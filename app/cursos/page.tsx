"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function CursosPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [clases, setClases] = useState<any[]>([]);
  const [disciplinas, setDisciplinas] = useState<any[]>([]);
  const [profesoresList, setProfesoresList] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAlumnosModalOpen, setIsAlumnosModalOpen] = useState(false);
  const [claseSeleccionada, setClaseSeleccionada] = useState<any>(null);
  const [disciplinaId, setDisciplinaId] = useState("");
  const [modalidad, setModalidad] = useState("Individual");
  const [diaSemana, setDiaSemana] = useState("Lunes");
  const [horaInicio, setHoraInicio] = useState("");
  const [profesor, setProfesor] = useState("");
  const [sala, setSala] = useState("Sala 1");
  const [capacidad, setCapacidad] = useState(1);

  const diasSemana = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

  useEffect(() => { cargarDatos(); }, []);

  async function cargarDatos() {
    setIsLoading(true);
    const { data: dataDisciplinas } = await supabase.from("disciplinas").select("*").order("nombre");
    if (dataDisciplinas) { setDisciplinas(dataDisciplinas); if (dataDisciplinas.length > 0) setDisciplinaId(dataDisciplinas[0].id); }

    const { data: dataProfesores } = await supabase.from("profesores").select("*").eq("estado", "Activo").order("nombre");
    if (dataProfesores) setProfesoresList(dataProfesores);

    // NUEVA CONSULTA: Lee las inscripciones para saber la ocupación real
    const { data: dataClases } = await supabase
      .from("clases")
      .select(`
        *,
        disciplinas (nombre),
        inscripciones (
          students (id, name, status)
        )
      `)
      .order("dia_semana").order("hora_inicio");

    if (dataClases) {
      const clasesFormateadas = dataClases.map((c: any) => {
        const alumnosActivos = c.inscripciones ? c.inscripciones.map((i:any) => i.students).filter((s:any) => s?.status === 'Activo') : [];
        return { ...c, ocupacion: alumnosActivos.length, listaAlumnos: alumnosActivos };
      });
      setClases(clasesFormateadas);
    }
    setIsLoading(false);
  }

  const clasesFiltradas = clases.filter(c => 
    c.disciplinas?.nombre?.toLowerCase().includes(busqueda.toLowerCase()) || 
    c.profesor?.toLowerCase().includes(busqueda.toLowerCase())
  );

  async function guardarClase() {
    if (!disciplinaId || !horaInicio || !profesor) return alert("Faltan datos obligatorios.");
    const { error } = await supabase.from("clases").insert([{
      disciplina_id: disciplinaId, modalidad, dia_semana: diaSemana, hora_inicio: horaInicio, 
      profesor, sala, capacidad_max: Number(capacidad) 
    }]);

    if (!error) {
      setIsModalOpen(false); setHoraInicio(""); setProfesor(""); setCapacidad(modalidad === 'Individual' ? 1 : 6); cargarDatos();
    } else alert("Error: " + error.message);
  }

  function handleModalidadChange(nuevaModalidad: string) {
    setModalidad(nuevaModalidad);
    setCapacidad(nuevaModalidad === "Individual" ? 1 : nuevaModalidad === "Duo" ? 2 : 6);
  }

  return (
    <div className="p-10 space-y-8 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0B132D] tracking-tight">Cursos y Horarios</h1>
          <p className="text-[#64748B] mt-1 font-medium">Malla logística y control de cupos (Multicurso).</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <input type="text" placeholder="Buscar..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-[#0466C8] shadow-sm"/>
          <button onClick={() => setIsModalOpen(true)} className="bg-[#0B132D] text-white px-6 py-2.5 rounded-xl font-bold shadow-md hover:-translate-y-0.5 transition-transform">+ Nueva Clase</button>
        </div>
      </div>

      <div className="saas-card overflow-hidden">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-[11px] uppercase tracking-widest text-[#64748B] font-bold">
              <th className="px-6 py-5">Disciplina / Modalidad</th>
              <th className="px-6 py-5">Día y Hora</th>
              <th className="px-6 py-5">Profesor y Sala</th>
              <th className="px-6 py-5">Ocupación (Cupos)</th>
              <th className="px-6 py-5 text-right">Detalles</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 bg-white">
            {isLoading ? <tr><td colSpan={5} className="p-8 text-center text-[#64748B]">Cargando malla... ⏳</td></tr> : 
             clasesFiltradas.map((c) => {
              const capReal = c.capacidad_max || 1; 
              const pct = Math.min((c.ocupacion / capReal) * 100, 100);
              const lleno = c.ocupacion >= capReal;
              return (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-5 font-bold text-[#0B132D]">{c.disciplinas?.nombre} <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded ml-2 uppercase border border-slate-200">{c.modalidad}</span></td>
                  <td className="px-6 py-5 font-bold">{c.dia_semana} <span className="text-xs text-slate-500 block">{c.hora_inicio.substring(0, 5)} hrs</span></td>
                  <td className="px-6 py-5 font-bold">{c.profesor} <span className="text-xs text-slate-500 block">{c.sala}</span></td>
                  <td className="px-6 py-5">
                    <div className="flex justify-between text-[10px] font-bold mb-1"><span className={lleno ? "text-[#D20505]" : "text-slate-500"}>{c.ocupacion} / {capReal}</span><span>{Math.round(pct)}%</span></div>
                    <div className="w-full bg-slate-100 rounded-full h-2"><div className={`h-full rounded-full ${lleno ? 'bg-[#D20505]' : 'bg-[#0466C8]'}`} style={{width: `${pct}%`}}></div></div>
                  </td>
                  <td className="px-6 py-5 text-right"><button onClick={() => {setClaseSeleccionada(c); setIsAlumnosModalOpen(true);}} className="text-[11px] font-bold text-[#0466C8] bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg">Ver Alumnos</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal Crear Clase */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#0B132D]/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-[24px] shadow-2xl w-full max-w-lg border-t-8 border-[#0B132D]">
            <h2 className="text-2xl font-bold mb-6">Nueva Clase</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <select value={disciplinaId} onChange={e=>setDisciplinaId(e.target.value)} className="p-3 border rounded-xl text-sm outline-none">{disciplinas.map(d=><option key={d.id} value={d.id}>{d.nombre}</option>)}</select>
                <select value={modalidad} onChange={e=>handleModalidadChange(e.target.value)} className="p-3 border rounded-xl text-sm outline-none"><option value="Individual">Individual</option><option value="Duo">Dúo</option><option value="Grupal">Grupal</option></select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <select value={diaSemana} onChange={e=>setDiaSemana(e.target.value)} className="p-3 border rounded-xl text-sm outline-none">{diasSemana.map(d=><option key={d} value={d}>{d}</option>)}</select>
                <input type="time" value={horaInicio} onChange={e=>setHoraInicio(e.target.value)} className="p-3 border rounded-xl text-sm outline-none" />
              </div>
              <select value={profesor} onChange={e=>setProfesor(e.target.value)} className="w-full p-3 border rounded-xl text-sm outline-none bg-slate-50">
                <option value="">Seleccionar Profesor...</option>{profesoresList.map(p=><option key={p.id} value={p.nombre}>{p.nombre}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-4">
                <input type="text" value={sala} onChange={e=>setSala(e.target.value)} placeholder="Sala" className="p-3 border rounded-xl text-sm" />
                <input type="number" min="1" value={capacidad} onChange={e=>setCapacidad(Number(e.target.value))} className="p-3 border rounded-xl text-sm font-bold" />
              </div>
              <div className="flex justify-end gap-3 pt-4"><button onClick={()=>setIsModalOpen(false)} className="px-5 py-2 font-bold text-slate-500">Cancelar</button><button onClick={guardarClase} className="bg-[#0B132D] text-white px-6 py-2 rounded-xl font-bold">Crear</button></div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ver Alumnos */}
      {isAlumnosModalOpen && claseSeleccionada && (
        <div className="fixed inset-0 bg-[#0B132D]/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-[24px] shadow-2xl w-full max-w-sm border-t-8 border-[#0466C8]">
            <h2 className="text-xl font-bold mb-1">Alumnos Inscritos</h2>
            <p className="text-sm text-slate-500 mb-6">{claseSeleccionada.disciplinas?.nombre} - {claseSeleccionada.dia_semana} {claseSeleccionada.hora_inicio.substring(0,5)}</p>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {claseSeleccionada.listaAlumnos?.length > 0 ? claseSeleccionada.listaAlumnos.map((a:any) => (
                <div key={a.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm text-[#0B132D]">{a.name}</div>
              )) : <p className="text-sm text-slate-500 text-center py-4">No hay alumnos activos.</p>}
            </div>
            <button onClick={()=>setIsAlumnosModalOpen(false)} className="mt-6 w-full bg-slate-100 text-slate-600 py-2 rounded-xl font-bold">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}