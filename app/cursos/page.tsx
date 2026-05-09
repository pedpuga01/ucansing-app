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
  
  // Formulario Nueva Clase
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
    
    // 1. Cargar Disciplinas
    const { data: dataDisciplinas } = await supabase.from("disciplinas").select("*").order("nombre");
    if (dataDisciplinas) { setDisciplinas(dataDisciplinas); if (dataDisciplinas.length > 0) setDisciplinaId(dataDisciplinas[0].id); }

    // 2. Cargar Profesores Activos
    const { data: dataProfesores } = await supabase.from("profesores").select("*").eq("estado", "Activo").order("nombre");
    if (dataProfesores) setProfesoresList(dataProfesores);

    // 3. CONSULTA MAESTRA MULTICURSO: Lee desde inscripciones
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
        // Extraer los alumnos activos que están inscritos en esta clase
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
    if (!disciplinaId || !horaInicio || !profesor) return alert("Faltan datos obligatorios (Disciplina, Hora y Profesor).");
    
    const { error } = await supabase.from("clases").insert([{
      disciplina_id: disciplinaId, 
      modalidad: modalidad, 
      dia_semana: diaSemana, 
      hora_inicio: horaInicio, 
      profesor: profesor, 
      sala: sala, 
      capacidad_max: Number(capacidad) 
    }]);

    if (!error) {
      setIsModalOpen(false); 
      setHoraInicio(""); setProfesor(""); setCapacidad(modalidad === 'Individual' ? 1 : 6); 
      cargarDatos();
    } else alert("Error al crear clase: " + error.message);
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
          <div className="relative flex-1 md:w-64">
            <span className="absolute left-3 top-2.5 text-[#64748B]">🔍</span>
            <input type="text" placeholder="Buscar curso o profe..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 outline-none focus:border-[#0466C8] shadow-sm text-sm"/>
          </div>
          <button onClick={() => setIsModalOpen(true)} className="bg-[#0B132D] text-white px-6 py-2.5 rounded-xl font-bold shadow-md hover:-translate-y-0.5 transition-transform flex items-center gap-2">
            <span>+</span> Nueva Clase
          </button>
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
            {isLoading ? <tr><td colSpan={5} className="p-8 text-center text-[#64748B] font-medium">Cargando malla... ⏳</td></tr> : 
             clasesFiltradas.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-[#64748B] font-medium">No hay clases registradas.</td></tr> :
             clasesFiltradas.map((c) => {
              const capReal = c.capacidad_max || 1; 
              const pct = Math.min((c.ocupacion / capReal) * 100, 100);
              const lleno = c.ocupacion >= capReal;
              return (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-5">
                    <p className="font-bold text-[#0B132D] text-sm">{c.disciplinas?.nombre}</p>
                    <span className="inline-block px-2 py-0.5 mt-1 bg-slate-100 text-slate-500 text-[10px] font-bold rounded uppercase border border-slate-200">{c.modalidad}</span>
                  </td>
                  <td className="px-6 py-5">
                    <p className="font-bold text-[#0B132D] text-sm">{c.dia_semana}</p>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">{c.hora_inicio?.substring(0, 5)} hrs</p>
                  </td>
                  <td className="px-6 py-5">
                    <p className="font-bold text-[#0B132D] text-sm">{c.profesor}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{c.sala}</p>
                  </td>
                  <td className="px-6 py-5">
                    <div className="w-full max-w-[160px]">
                      <div className="flex justify-between text-[10px] font-bold mb-1.5">
                        <span className={lleno ? "text-[#D20505]" : "text-slate-500"}>{c.ocupacion} / {capReal} Alumnos</span>
                        <span className={lleno ? "text-[#D20505]" : "text-[#0466C8]"}>{Math.round(pct)}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden shadow-inner">
                        <div className={`h-full rounded-full transition-all duration-500 ${lleno ? 'bg-[#D20505]' : 'bg-[#0466C8]'}`} style={{width: `${pct}%`}}></div>
                      </div>
                      {lleno && <p className="text-[9px] text-[#D20505] font-bold mt-1.5 uppercase tracking-widest">Clase Llena</p>}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <button onClick={() => {setClaseSeleccionada(c); setIsAlumnosModalOpen(true);}} className="text-[11px] font-bold text-[#0466C8] bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg transition-colors border border-blue-100 shadow-sm">Ver Alumnos</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* MODAL CREAR CLASE MANUAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#0B132D]/40 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-[24px] shadow-2xl w-full max-w-lg border-t-8 border-[#0B132D]">
            <h2 className="text-2xl font-bold mb-6 text-[#0B132D]">Nueva Clase Manual</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#64748B] uppercase mb-1.5">Disciplina *</label>
                  <select value={disciplinaId} onChange={e=>setDisciplinaId(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none font-bold text-[#0B132D] shadow-sm">
                    {disciplinas.map(d=><option key={d.id} value={d.id}>{d.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#64748B] uppercase mb-1.5">Modalidad *</label>
                  <select value={modalidad} onChange={e=>handleModalidadChange(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none font-bold text-[#0B132D] shadow-sm">
                    <option value="Individual">Individual</option><option value="Duo">Dúo</option><option value="Grupal">Grupal</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#64748B] uppercase mb-1.5">Día de Semana *</label>
                  <select value={diaSemana} onChange={e=>setDiaSemana(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none font-bold text-[#0B132D] shadow-sm">
                    {diasSemana.map(d=><option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#64748B] uppercase mb-1.5">Hora Inicio *</label>
                  <input type="time" value={horaInicio} onChange={e=>setHoraInicio(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none font-bold text-[#0B132D] shadow-sm" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase mb-1.5">Profesor Titular *</label>
                <select value={profesor} onChange={e=>setProfesor(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none bg-slate-50 font-bold text-[#0B132D] shadow-sm">
                  <option value="">Seleccionar Profesor...</option>
                  {profesoresList.map(p=><option key={p.id} value={p.nombre}>{p.nombre}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#64748B] uppercase mb-1.5">Sala</label>
                  <input type="text" value={sala} onChange={e=>setSala(e.target.value)} placeholder="Ej: Sala 1" className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none text-[#0B132D] shadow-sm" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#64748B] uppercase mb-1.5">Cupo Máximo</label>
                  <input type="number" min="1" value={capacidad} onChange={e=>setCapacidad(Number(e.target.value))} className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none font-bold text-[#0B132D] shadow-sm" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button onClick={()=>setIsModalOpen(false)} className="px-5 py-2 font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors">Cancelar</button>
                <button onClick={guardarClase} className="bg-[#0B132D] text-white px-6 py-2 rounded-xl font-bold shadow-lg hover:-translate-y-0.5 transition-transform">Crear Clase</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL VER ALUMNOS */}
      {isAlumnosModalOpen && claseSeleccionada && (
        <div className="fixed inset-0 bg-[#0B132D]/40 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-[24px] shadow-2xl w-full max-w-sm border-t-8 border-[#0466C8]">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-bold text-[#0B132D]">Alumnos Inscritos</h2>
                <p className="text-sm text-slate-500 font-medium mt-1">{claseSeleccionada.disciplinas?.nombre} | {claseSeleccionada.dia_semana} {claseSeleccionada.hora_inicio?.substring(0,5)}</p>
              </div>
              <span className="bg-blue-50 text-[#0466C8] font-black text-sm px-3 py-1 rounded-lg border border-blue-100">{claseSeleccionada.ocupacion} / {claseSeleccionada.capacidad_max || 1}</span>
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
              {claseSeleccionada.listaAlumnos?.length > 0 ? claseSeleccionada.listaAlumnos.map((a:any) => (
                <div key={a.id} className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl hover:border-slate-300 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-[#0B132D] text-white flex items-center justify-center font-bold text-xs shadow-sm">{a.name.charAt(0).toUpperCase()}</div>
                  <span className="font-bold text-sm text-[#0B132D]">{a.name}</span>
                </div>
              )) : <div className="text-center py-6 bg-slate-50 rounded-xl border border-slate-100 text-slate-500 text-sm font-medium">No hay alumnos activos inscritos.</div>}
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
              <button onClick={()=>setIsAlumnosModalOpen(false)} className="bg-slate-100 text-slate-600 px-6 py-2.5 rounded-xl font-bold hover:bg-slate-200 transition-colors">Cerrar Panel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}