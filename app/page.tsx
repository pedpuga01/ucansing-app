"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function DashboardPage() {
  const [metricas, setMetricas] = useState({ prospectos: 0, alumnos: 0, ingresos: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function cargarMetricas() {
      setIsLoading(true);
      
      const { count: countLeads } = await supabase.from("leads").select("*", { count: "exact", head: true });
      const { count: countStudents } = await supabase.from("students").select("*", { count: "exact", head: true }).eq("status", "Activo");
      const { data: transacciones } = await supabase.from("transacciones").select("fecha, monto");
      
      const mesActual = new Date().getMonth();
      const añoActual = new Date().getFullYear();
      let totalIngresosMes = 0;
      
      if (transacciones) {
        totalIngresosMes = transacciones.reduce((acc, obj) => {
          const fechaTransaccion = new Date(obj.fecha);
          if (fechaTransaccion.getMonth() === mesActual && fechaTransaccion.getFullYear() === añoActual) {
            return acc + Number(obj.monto);
          }
          return acc;
        }, 0);
      }

      setMetricas({
        prospectos: countLeads || 0,
        alumnos: countStudents || 0,
        ingresos: totalIngresosMes
      });
      setIsLoading(false);
    }
    cargarMetricas();
  }, []);

  const formatearDinero = (cantidad: number) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(cantidad);
  };

  return (
    <div className="p-10 space-y-10">
      
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-bold text-[#0B132D] tracking-tight" style={{fontFamily: 'var(--font-poppins)'}}>
            Visión General
          </h1>
          <p className="text-[#64748B] mt-2 font-medium">Bienvenido al panel de control de Ucansing 2026.</p>
        </div>
        <div className="hidden md:block">
          <p className="text-xs text-[#64748B] font-bold uppercase tracking-widest bg-white px-5 py-2.5 rounded-xl shadow-sm border border-slate-100">
            {new Date().toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })}
          </p>
        </div>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        <div className="saas-card p-8 border-b-4 border-b-[#0466C8]">
          <div className="flex justify-between items-start mb-6">
            <h3 className="text-[#64748B] font-bold tracking-widest uppercase text-xs">Alumnos Activos</h3>
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-[#0466C8] text-xl border border-blue-100">🎓</div>
          </div>
          <p className="text-5xl font-bold text-[#0B132D]" style={{fontFamily: 'var(--font-poppins)'}}>
            {isLoading ? "..." : metricas.alumnos}
          </p>
        </div>

        <div className="saas-card p-8 border-b-4 border-b-[#FC6827]">
          <div className="flex justify-between items-start mb-6">
            <h3 className="text-[#64748B] font-bold tracking-widest uppercase text-xs">Embudo (Leads)</h3>
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-[#FC6827] text-xl border border-orange-100">👥</div>
          </div>
          <p className="text-5xl font-bold text-[#0B132D]" style={{fontFamily: 'var(--font-poppins)'}}>
            {isLoading ? "..." : metricas.prospectos}
          </p>
        </div>

        <div className="saas-card p-8 border-b-4 border-b-[#D20505] bg-[#0B132D] text-white">
          <div className="flex justify-between items-start mb-6">
            <h3 className="text-white/60 font-bold tracking-widest uppercase text-xs">Ingresos del Mes</h3>
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white text-xl border border-white/20">💰</div>
          </div>
          <p className="text-4xl font-bold tracking-tight" style={{fontFamily: 'var(--font-poppins)'}}>
            {isLoading ? "..." : formatearDinero(metricas.ingresos)}
          </p>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="saas-card p-8 min-h-[250px] flex flex-col items-center justify-center text-center border-dashed border-2 border-slate-200 shadow-none bg-transparent">
           <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center text-2xl mb-4 grayscale opacity-50">📅</div>
           <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest" style={{fontFamily: 'var(--font-poppins)'}}>Módulo de Asistencias</h4>
           <p className="text-slate-400 text-xs mt-2 max-w-xs">Gráficos de retención y pases de lista históricos en desarrollo.</p>
        </div>
        <div className="saas-card p-8 min-h-[250px] flex flex-col items-center justify-center text-center border-dashed border-2 border-slate-200 shadow-none bg-transparent">
           <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center text-2xl mb-4 grayscale opacity-50">⚠️</div>
           <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest" style={{fontFamily: 'var(--font-poppins)'}}>Alertas del Sistema</h4>
           <p className="text-slate-400 text-xs mt-2 max-w-xs">Panel de notificaciones y morosidad general en desarrollo.</p>
        </div>
      </div>

    </div>
  );
}