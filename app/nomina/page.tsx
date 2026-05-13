"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function NominaPage() {
  const [loading, setLoading] = useState(true);
  const [liquidaciones, setLiquidaciones] = useState<any[]>([]);
  const [mesFiltro, setMesFiltro] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  
  // Modal de Detalle
  const [profesorSeleccionado, setProfesorSeleccionado] = useState<any>(null);

  useEffect(() => {
    calcularNomina();
  }, [mesFiltro]);

  async function calcularNomina() {
    setLoading(true);
    const año = parseInt(mesFiltro.split('-')[0]);
    const mes = parseInt(mesFiltro.split('-')[1]);
    
    // Obtener primer y último día del mes
    const primerDia = new Date(año, mes - 1, 1).toISOString().split('T')[0];
    const ultimoDia = new Date(año, mes, 0).toISOString().split('T')[0];

    // 1. Buscamos todas las sesiones REALIZADAS en este mes
    const { data: sesiones, error } = await supabase
      .from("sesiones")
      .select(`
        id, fecha, estado,
        clases ( nombre, profesor, tipo, tarifa_base ),
        asistencias ( id, estado )
      `)
      .gte("fecha", primerDia)
      .lte("fecha", ultimoDia)
      .eq("estado", "REALIZADA");

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    // 2. Agrupamos por Profesor y calculamos su sueldo
    const nominaMap: Record<string, any> = {};

    sesiones?.forEach((sesion: any) => {
      const profe = sesion.clases.profesor;
      if (!nominaMap[profe]) {
        nominaMap[profe] = {
          profesor: profe,
          totalAPagar: 0,
          clasesRealizadas: 0,
          alumnosPresentes: 0,
          detalleClases: []
        };
      }

      const tarifa = Number(sesion.clases.tarifa_base) || 0;
      const asistentes = sesion.asistencias.filter((a: any) => a.estado === 'PRESENTE').length;

      nominaMap[profe].totalAPagar += tarifa;
      nominaMap[profe].clasesRealizadas += 1;
      nominaMap[profe].alumnosPresentes += asistentes;
      
      nominaMap[profe].detalleClases.push({
        fecha: sesion.fecha,
        curso: sesion.clases.nombre,
        tipo: sesion.clases.tipo,
        tarifa: tarifa,
        asistentes: asistentes
      });
    });

    setLiquidaciones(Object.values(nominaMap).sort((a, b) => b.totalAPagar - a.totalAPagar));
    setLoading(false);
  }

  const formatearDinero = (cantidad: number) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(cantidad || 0);
  };

  const totalNominaMes = liquidaciones.reduce((acc, l) => acc + l.totalAPagar, 0);

  return (
    <div className="p-10 space-y-8 min-h-screen bg-gray-50">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0B132D] tracking-tight" style={{fontFamily: 'var(--font-poppins)'}}>
            Liquidación de Profesores
          </h1>
          <p className="text-[#64748B] mt-1 font-medium">Cálculo automático basado en asistencia y sesiones realizadas.</p>
        </div>
        <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <label className="text-xs font-bold text-slate-400 uppercase pl-2">Periodo:</label>
          <input 
            type="month" 
            value={mesFiltro}
            onChange={(e) => setMesFiltro(e.target.value)}
            className="border-none outline-none font-bold text-[#0B132D] bg-transparent cursor-pointer"
          />
        </div>
      </div>

      {/* KPI PRINCIPAL */}
      <div className="bg-[#0B132D] rounded-2xl shadow-sm p-8 text-white relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-bl-full -mr-16 -mt-16"></div>
        <div className="relative z-10">
          <h3 className="text-white/60 font-bold uppercase tracking-widest text-xs mb-2">Total Nómina a Pagar ({mesFiltro})</h3>
          <p className="text-5xl font-black text-white" style={{fontFamily: 'var(--font-poppins)'}}>
            {loading ? "..." : formatearDinero(totalNominaMes)}
          </p>
        </div>
        <div className="flex gap-8 relative z-10">
          <div className="text-right">
            <p className="text-white/60 text-xs font-bold uppercase mb-1">Profesores Activos</p>
            <p className="text-2xl font-bold">{liquidaciones.length}</p>
          </div>
          <div className="text-right">
            <p className="text-white/60 text-xs font-bold uppercase mb-1">Clases Impartidas</p>
            <p className="text-2xl font-bold">{liquidaciones.reduce((acc, l) => acc + l.clasesRealizadas, 0)}</p>
          </div>
        </div>
      </div>

      {/* TABLA DE LIQUIDACIONES */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50">
          <h2 className="text-lg font-bold text-[#0B132D]" style={{fontFamily: 'var(--font-poppins)'}}>Desglose por Docente</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-slate-100 text-[#64748B] text-[10px] uppercase tracking-widest font-bold">
                <th className="px-6 py-4">Profesor</th>
                <th className="px-6 py-4 text-center">Clases Efectivas</th>
                <th className="px-6 py-4 text-center">Alumnos Atendidos</th>
                <th className="px-6 py-4 text-right">Total a Pagar</th>
                <th className="px-6 py-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? <tr><td colSpan={5} className="p-10 text-center text-slate-400">Calculando nómina... ⏳</td></tr> : 
               liquidaciones.length === 0 ? <tr><td colSpan={5} className="p-10 text-center text-slate-400">No hay sesiones registradas en este mes.</td></tr> : 
               liquidaciones.map((l, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-bold text-[#0B132D] text-sm">{l.profesor}</p>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="bg-blue-50 text-[#0466C8] font-bold px-3 py-1 rounded-full text-xs">
                      {l.clasesRealizadas} sesiones
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center text-sm font-semibold text-slate-600">
                    {l.alumnosPresentes} presentes
                  </td>
                  <td className="px-6 py-4 text-right">
                    <p className="font-black text-lg text-[#0B132D]">{formatearDinero(l.totalAPagar)}</p>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button 
                      onClick={() => setProfesorSeleccionado(l)}
                      className="text-[#0466C8] bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg text-xs font-bold transition"
                    >
                      Ver Detalle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE DETALLE DEL PROFESOR */}
      {profesorSeleccionado && (
        <div className="fixed inset-0 bg-[#0B132D]/40 flex items-center justify-center z-50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-[#0B132D] p-6 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-xl" style={{fontFamily: 'var(--font-poppins)'}}>
                  Detalle: {profesorSeleccionado.profesor}
                </h3>
                <p className="text-white/60 text-xs">Periodo: {mesFiltro} | Total: {formatearDinero(profesorSeleccionado.totalAPagar)}</p>
              </div>
              <button onClick={() => setProfesorSeleccionado(null)} className="text-white/50 hover:text-white bg-white/10 p-2 rounded-full">✕</button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50">
              <table className="w-full text-left border-collapse bg-white rounded-xl shadow-sm border border-slate-100">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-[10px] uppercase font-bold">
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Curso (Tipo)</th>
                    <th className="px-4 py-3 text-center">Asistentes</th>
                    <th className="px-4 py-3 text-right">Tarifa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {profesorSeleccionado.detalleClases.sort((a:any, b:any) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()).map((clase:any, i:number) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-xs font-bold text-slate-700">
                        {new Date(clase.fecha).toLocaleDateString('es-CL')}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-bold text-[#0B132D]">{clase.curso}</p>
                        <p className="text-[9px] text-slate-400 uppercase">{clase.tipo}</p>
                      </td>
                      <td className="px-4 py-3 text-center text-xs font-semibold text-slate-600">
                        {clase.asistentes}
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-black text-[#0B132D]">
                        {formatearDinero(clase.tarifa)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}