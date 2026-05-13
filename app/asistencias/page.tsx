"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Tipo para estructurar la línea de tiempo
type BloqueAgenda = {
  hora: string;
  clases: {
    claseId: string;
    nombre: string;
    tipo: string;
    alumnos: any[];
  }[];
};

export default function AsistenciasPage() {
  const [profesores, setProfesores] = useState<string[]>([]);
  const [profeSeleccionado, setProfeSeleccionado] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  
  const [agenda, setAgenda] = useState<BloqueAgenda[]>([]);
  const [loading, setLoading] = useState(false);

  // Controlar qué grupos están desplegados (Abiertos)
  const [gruposExpandidos, setGruposExpandidos] = useState<Record<string, boolean>>({});

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
    
    // Calcular el día de la semana
    const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
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

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    // =========================================================
    // LÓGICA DE AGRUPAMIENTO POR HORARIO Y TIPO DE CLASE
    // =========================================================
    const timelineObj: Record<string, any[]> = {};

    data?.forEach(clase => {
      // 1. Filtrar solo los alumnos activos a los que les toca HOY
      const inscritosHoy = clase.inscripciones.filter((ins: any) => 
        ins.estado === "ACTIVO" && 
        ins.dia_semana?.toLowerCase() === diaNombre.toLowerCase()
      );

      if (inscritosHoy.length > 0) {
        // 2. Agrupar a esos alumnos por su Hora de Inicio
        const alumnosPorHora: Record<string, any[]> = {};
        inscritosHoy.forEach((ins: any) => {
          const h = ins.hora_inicio || "Sin Horario";
          if (!alumnosPorHora[h]) alumnosPorHora[h] = [];
          alumnosPorHora[h].push(ins);
        });

        // 3. Empaquetar la clase dentro del bloque horario correspondiente
        Object.keys(alumnosPorHora).forEach(hora => {
          if (!timelineObj[hora]) timelineObj[hora] = [];
          timelineObj[hora].push({
            claseId: clase.id,
            nombre: clase.nombre,
            tipo: clase.tipo,
            alumnos: alumnosPorHora[hora]
          });
        });
      }
    });

    // 4. Convertir el objeto a un Array ordenado de más temprano a más tarde
    const agendaOrdenada = Object.keys(timelineObj).sort().map(hora => ({
      hora,
      clases: timelineObj[hora]
    }));

    setAgenda(agendaOrdenada);
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

    alert(`✅ Asistencia guardada: ${estado}`);
  }

  const toggleGrupo = (grupoId: string) => {
    setGruposExpandidos(prev => ({ ...prev, [grupoId]: !prev[grupoId] }));
  };

  const abrirBitacora = (tipo: string, nombre: string) => {
    alert(`Próxima Implementación: Abriendo Bitácora ${tipo} para ${nombre}. Aquí el profesor dejará registro de tareas y evolución.`);
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-[#0B132D] mb-2" style={{fontFamily: 'var(--font-poppins)'}}>Pase de Lista y Bitácoras</h1>
      <p className="text-[#64748B] mb-8">Visualización de agenda diaria y control de evolución académica.</p>

      {/* PANEL DE FILTROS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Fecha de Clase</label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-[#0466C8]" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Profesor a Cargo</label>
          <select value={profeSeleccionado} onChange={e => setProfeSeleccionado(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-[#0466C8] font-semibold text-[#0B132D]">
            <option value="">Seleccionar Profesor...</option>
            {profesores.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <button onClick={buscarClases} className="w-full bg-[#0B132D] text-white py-3 rounded-xl font-bold hover:-translate-y-0.5 transition shadow-lg shadow-navy/20">
            {loading ? "Buscando..." : "Cargar Timeline"}
          </button>
        </div>
      </div>

      {/* LÍNEA DE TIEMPO (TIMELINE) */}
      <div className="space-y-8 max-w-4xl">
        {agenda.length === 0 && !loading && profeSeleccionado && (
           <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-slate-200">
             <p className="text-slate-400 font-medium">No hay alumnos agendados para este día.</p>
           </div>
        )}

        {agenda.map((bloque) => (
          <div key={bloque.hora} className="relative pl-6 md:pl-0">
            {/* Indicador visual de la hora (Eje de la línea de tiempo) */}
            <div className="md:absolute left-0 top-0 md:w-24 md:text-right md:pr-6 md:py-4 mb-4 md:mb-0">
              <span className="bg-[#0466C8] text-white px-3 py-1.5 rounded-lg font-black text-sm shadow-md">
                {bloque.hora}
              </span>
            </div>

            <div className="md:ml-24 space-y-4">
              {bloque.clases.map((clase, idx) => {
                const isGrupal = clase.tipo === 'GRUPAL';
                const groupId = `${bloque.hora}-${clase.claseId}`;
                const isExpanded = gruposExpandidos[groupId];

                return (
                  <div key={idx} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    
                    {/* CABECERA DE LA CLASE */}
                    <div 
                      className={`p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition ${isGrupal ? 'cursor-pointer hover:bg-slate-50' : 'bg-slate-50 border-b border-slate-100'}`}
                      onClick={() => isGrupal && toggleGrupo(groupId)}
                    >
                      <div>
                        <h3 className="font-bold text-[#0B132D] text-lg">{clase.nombre}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase border ${isGrupal ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                            {clase.tipo}
                          </span>
                          {isGrupal && <span className="text-xs font-semibold text-slate-500">{clase.alumnos.length} Alumnos</span>}
                        </div>
                      </div>

                      <div className="flex gap-2 w-full md:w-auto" onClick={(e) => e.stopPropagation()}>
                        {isGrupal && (
                          <button onClick={() => abrirBitacora('Grupal', clase.nombre)} className="flex-1 md:flex-none border border-slate-200 text-slate-600 bg-white hover:bg-slate-100 px-3 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1">
                            <span>📝</span> Bitácora Grupo
                          </button>
                        )}
                        {isGrupal && (
                          <div className="text-slate-400 ml-2 self-center">
                            {isExpanded ? '▲' : '▼'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* LISTA DE ALUMNOS (Desplegable si es grupal, fijo si es individual) */}
                    {(!isGrupal || isExpanded) && (
                      <div className="p-2 bg-white">
                        {clase.alumnos.map((ins: any) => (
                          <div key={ins.alumnos.id} className="flex flex-col lg:flex-row lg:justify-between lg:items-center p-3 border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition rounded-xl gap-4">
                            
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 bg-slate-200 rounded-full flex items-center justify-center text-slate-500 font-bold">
                                {ins.alumnos.nombre.substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-bold text-[#0B132D]">{ins.alumnos.nombre}</p>
                                <button onClick={() => abrirBitacora('Individual', ins.alumnos.nombre)} className="text-[10px] text-[#0466C8] hover:underline font-semibold flex items-center gap-1 mt-0.5">
                                  <span>📝</span> Evolución Alumno
                                </button>
                              </div>
                            </div>

                            <div className="flex gap-2 ml-12 lg:ml-0">
                              <button onClick={() => registrarAsistencia(ins.alumnos.id, clase.claseId, 'PRESENTE')} className="flex-1 lg:flex-none bg-white border border-slate-200 text-slate-600 hover:border-green-500 hover:text-green-600 hover:bg-green-50 px-4 py-2 rounded-lg text-[10px] font-black transition">
                                PRESENTE
                              </button>
                              <button onClick={() => registrarAsistencia(ins.alumnos.id, clase.claseId, 'AUSENTE')} className="flex-1 lg:flex-none bg-white border border-slate-200 text-slate-600 hover:border-red-500 hover:text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-[10px] font-black transition">
                                AUSENTE
                              </button>
                              <button onClick={() => registrarAsistencia(ins.alumnos.id, clase.claseId, 'JUSTIFICADO')} className="flex-1 lg:flex-none bg-white border border-slate-200 text-slate-600 hover:border-orange-500 hover:text-orange-600 hover:bg-orange-50 px-4 py-2 rounded-lg text-[10px] font-black transition">
                                JUSTIFICA
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}