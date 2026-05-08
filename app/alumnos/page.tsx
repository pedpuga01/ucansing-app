"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AlumnosPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [alumnos, setAlumnos] = useState<any[]>([]);
  const [pagosDelMes, setPagosDelMes] = useState<any[]>([]);
  const [filtroEstado, setFiltroEstado] = useState("Activo");
  const [busqueda, setBusqueda] = useState("");
  const [isFichaOpen, setIsFichaOpen] = useState(false);
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState<any>(null);
  const [historialPagos, setHistorialPagos] = useState<any[]>([]);
  const [tabActiva, setTabActiva] = useState("perfil");

  useEffect(() => { cargarDatos(); }, [filtroEstado]);

  async function cargarDatos() {
    setIsLoading(true);
    let query = supabase.from("students").select(`
        *, cuentas_familiares (*),
        inscripciones ( clases ( dia_semana, hora_inicio, modalidad, profesor, disciplinas (nombre) ) )
      `).order("name");

    if (filtroEstado !== "Todos") query = query.eq("status", filtroEstado);
    const { data } = await query;
    if (data) setAlumnos(data);

    const mesActualStr = new Date().toISOString().slice(0, 7);
    const { data: pagos } = await supabase.from("transacciones").select("student_id").eq("mes_imputado", mesActualStr).eq("tipo_pago", "Mensualidad Regular");
    if (pagos) setPagosDelMes(pagos.map(p => p.student_id));
    setIsLoading(false);
  }

  const alumnosFiltrados = alumnos.filter(a => a.name.toLowerCase().includes(busqueda.toLowerCase()) || a.cuentas_familiares?.titular_nombre?.toLowerCase().includes(busqueda.toLowerCase()));

  async function actualizarEstado(id: string, nuevoEstado: string) {
    if (!window.confirm(`¿Cambiar estado a ${nuevoEstado}?`)) return;
    const { error } = await supabase.from("students").update({ status: nuevoEstado }).eq("id", id);
    if (!error) { cargarDatos(); if(alumnoSeleccionado?.id === id) setAlumnoSeleccionado({...alumnoSeleccionado, status: nuevoEstado}); }
  }

  async function abrirFicha(alumno: any) {
    setAlumnoSeleccionado(alumno); setTabActiva("perfil"); setIsFichaOpen(true);
    const { data } = await supabase.from("transacciones").select("*").eq("student_id", alumno.id).order("fecha", { ascending: false });
    setHistorialPagos(data || []);
  }

  const formatearDinero = (cant: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(cant || 0);

  return (
    <div className="p-10 space-y-8 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0B132D] tracking-tight">Directorio de Alumnos</h1>
          <p className="text-[#64748B] mt-1 font-medium">Gestión integral, cuentas familiares y multicursos.</p>
        </div>
        <div className="flex gap-3">
          <input type="text" placeholder="Buscar alumno..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-[#0466C8]" />
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold">
            <option value="Todos">Todos</option><option value="Activo">Activos</option><option value="Congelado">Congelados</option><option value="Retirado">Retirados</option>
          </select>
        </div>
      </div>

      <div className="saas-card overflow-hidden">
        <table className="w-full text-left border-collapse min-w-[950px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-[11px] uppercase tracking-widest text-[#64748B] font-bold">
              <th className="px-6 py-5">Alumno</th><th className="px-6 py-5">Cursos Asignados</th><th className="px-6 py-5">Titular / Cuenta</th><th className="px-6 py-5 text-center">Estado Financiero</th><th className="px-6 py-5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {isLoading ? <tr><td colSpan={5} className="p-8 text-center text-slate-500">Cargando...</td></tr> :
             alumnosFiltrados.map(a => {
              const isActivo = a.status === "Activo";
              return (
                <tr key={a.id} className={`hover:bg-slate-50 ${!isActivo ? 'opacity-60' : ''}`}>
                  <td className="px-6 py-4 font-bold text-[#0B132D]">{a.name} <span className="block text-[10px] text-slate-500 font-normal uppercase mt-1">{a.status}</span></td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      {a.inscripciones?.length > 0 ? a.inscripciones.map((ins:any, i:number) => (
                        <span key={i} className="bg-blue-50 text-[#0466C8] text-[10px] px-2 py-1 rounded font-bold w-max border border-blue-100">
                          {ins.clases?.disciplinas?.nombre} - {ins.clases?.dia_semana} {ins.clases?.hora_inicio.substring(0,5)}
                        </span>
                      )) : <span className="text-[10px] text-red-500">Sin cursos</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4"><p className="font-bold text-sm">{a.cuentas_familiares?.titular_nombre}</p><p className="text-[10px] text-slate-500">{a.cuentas_familiares?.email_contacto}</p></td>
                  <td className="px-6 py-4 text-center">
                    {!isActivo ? <span className="text-xs text-slate-400">-</span> : pagosDelMes.includes(a.id) ? <span className="text-[10px] font-bold text-green-700 bg-green-50 px-3 py-1 rounded-full">Al Día</span> : <span className="text-[10px] font-bold text-[#D20505] bg-red-50 px-3 py-1 rounded-full">Pendiente</span>}
                    <p className="font-black text-xs mt-1">{formatearDinero(a.mensualidad_final)}</p>
                  </td>
                  <td className="px-6 py-4 text-right"><button onClick={()=>abrirFicha(a)} className="bg-[#0B132D] text-white px-4 py-2 rounded-xl text-xs font-bold">Ver Ficha</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* MODAL FICHA */}
      {isFichaOpen && alumnoSeleccionado && (
        <div className="fixed inset-0 bg-[#0B132D]/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-[#0B132D] p-6 text-white flex justify-between items-center">
              <div><h2 className="text-2xl font-bold">{alumnoSeleccionado.name}</h2></div>
              <select value={alumnoSeleccionado.status} onChange={e=>actualizarEstado(alumnoSeleccionado.id, e.target.value)} className="text-black text-xs font-bold px-3 py-1 rounded">
                <option value="Activo">Activo</option><option value="Congelado">Congelado</option><option value="Retirado">Retirado</option>
              </select>
            </div>
            <div className="flex border-b bg-slate-50">
              <button onClick={()=>setTabActiva("perfil")} className={`flex-1 py-4 text-sm font-bold uppercase ${tabActiva==='perfil'?'text-[#0466C8] bg-white border-b-2 border-blue-600':'text-slate-500'}`}>Perfil Académico</button>
              <button onClick={()=>setTabActiva("cuenta")} className={`flex-1 py-4 text-sm font-bold uppercase ${tabActiva==='cuenta'?'text-[#FC6827] bg-white border-b-2 border-orange-500':'text-slate-500'}`}>Cuenta Familiar</button>
              <button onClick={()=>setTabActiva("finanzas")} className={`flex-1 py-4 text-sm font-bold uppercase ${tabActiva==='finanzas'?'text-red-600 bg-white border-b-2 border-red-600':'text-slate-500'}`}>Finanzas</button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-white">
              {tabActiva === "perfil" && (
                <div className="space-y-4">
                  <h3 className="font-bold text-slate-700">Cursos Inscritos:</h3>
                  {alumnoSeleccionado.inscripciones?.map((ins:any, i:number) => (
                    <div key={i} className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                      <p className="font-bold text-[#0B132D]">{ins.clases?.disciplinas?.nombre} ({ins.clases?.modalidad})</p>
                      <p className="text-sm text-slate-600">Día: {ins.clases?.dia_semana} a las {ins.clases?.hora_inicio.substring(0,5)} | Prof: {ins.clases?.profesor}</p>
                    </div>
                  ))}
                </div>
              )}
              {tabActiva === "cuenta" && (
                <div className="bg-orange-50 p-6 rounded-xl border border-orange-100">
                  <h3 className="font-bold text-xl mb-2">{alumnoSeleccionado.cuentas_familiares?.titular_nombre} (Apoderado)</h3>
                  <p className="text-sm">Email: {alumnoSeleccionado.cuentas_familiares?.email_contacto}</p>
                  <p className="text-sm">RUT: {alumnoSeleccionado.cuentas_familiares?.titular_rut}</p>
                </div>
              )}
              {tabActiva === "finanzas" && (
                <div>
                  <h3 className="font-black text-2xl mb-4">Mensualidad: {formatearDinero(alumnoSeleccionado.mensualidad_final)}</h3>
                  <div className="space-y-2">
                    {historialPagos.map(t=>(
                       <div key={t.id} className="flex justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
                         <span>{t.tipo_pago} ({t.mes_imputado})</span><span className="font-bold text-green-600">+{formatearDinero(t.monto)}</span>
                       </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 bg-slate-50 border-t flex justify-end"><button onClick={()=>setIsFichaOpen(false)} className="px-6 py-2 bg-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-300">Cerrar</button></div>
          </div>
        </div>
      )}
    </div>
  );
}