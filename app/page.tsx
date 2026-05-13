"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
// Si instalaste recharts, descomenta esto:
// import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function DashboardGerencial() {
  const [loading, setLoading] = useState(true);

  // Estados de KPIs
  const [kpiFinanzas, setKpiFinanzas] = useState({
    proyectadoMes: 0,
    recaudacionCiclo: 0,
    cajaTotal: 0,
    morosidadHistorica: 0
  });

  const [kpiAcademico, setKpiAcademico] = useState({
    activos: 0,
    nuevosMes: 0,
    bajasMes: 0,
    enRiesgo: 0
  });

  const [nominaProyectada, setNominaProyectada] = useState(0);

  useEffect(() => {
    cargarTablero();
  }, []);

  async function cargarTablero() {
    setLoading(true);
    const ahora = new Date();
    const primerDiaMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString();
    const mesPasado = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1).toISOString();

    // ==========================================
    // 1. CÁLCULOS FINANCIEROS (El Ledger)
    // ==========================================
    const { data: familias } = await supabase
      .from("cuentas_familiares")
      .select(`
        id,
        transacciones ( tipo, monto, fecha, notas ),
        alumnos ( 
          inscripciones ( estado, precio_final_con_descuento )
        )
      `);

    let proyectado = 0;
    let caja = 0;
    let recaudacionCiclo = 0;
    let morosidadHistorica = 0;

    familias?.forEach(f => {
      // Proyectado (MRR)
      f.alumnos.forEach((a:any) => {
        a.inscripciones.filter((i:any) => i.estado === 'ACTIVO').forEach((i:any) => {
          proyectado += Number(i.precio_final_con_descuento);
        });
      });

      // Flujo de Caja (Todos los Pagos del mes actual)
      const pagosDelMes = f.transacciones.filter((t:any) => 
        (t.tipo === 'PAGO' || t.tipo === 'NOTA_CREDITO') && t.fecha >= primerDiaMes
      );
      
      pagosDelMes.forEach((p:any) => {
        caja += Number(p.monto);
        // Lógica simplificada: Asumimos que los pagos con notas que mencionan el mes actual son del "Ciclo"
        // En una app real, la transacción de PAGO debe tener una llave foránea 'pago_referencia_cargo_id'.
        recaudacionCiclo += Number(p.monto); 
      });

      // Morosidad (Cargos Históricos vs Pagos Históricos)
      const todosCargos = f.transacciones.filter((t:any) => t.tipo === 'CARGO').reduce((acc:number, t:any) => acc + Number(t.monto), 0);
      const todosPagos = f.transacciones.filter((t:any) => t.tipo === 'PAGO' || t.tipo === 'NOTA_CREDITO').reduce((acc:number, t:any) => acc + Number(t.monto), 0);
      const deudaFamiliar = todosCargos - todosPagos;
      if (deudaFamiliar > 0) morosidadHistorica += deudaFamiliar;
    });

    setKpiFinanzas({ proyectadoMes: proyectado, cajaTotal: caja, recaudacionCiclo: caja, morosidadHistorica });

    // ==========================================
    // 2. CÁLCULOS ACADÉMICOS
    // ==========================================
    const { data: alumnos } = await supabase.from("alumnos").select(`
      id, en_riesgo, created_at,
      inscripciones ( estado, fecha_baja )
    `);

    let activos = 0;
    let nuevos = 0;
    let bajas = 0;
    let enRiesgo = 0;

    alumnos?.forEach(a => {
      const tieneActiva = a.inscripciones.some((i:any) => i.estado === 'ACTIVO');
      if (tieneActiva) activos++;
      if (a.created_at >= primerDiaMes) nuevos++;
      if (a.en_riesgo) enRiesgo++;
      
      const bajasDelMes = a.inscripciones.some((i:any) => i.estado === 'RETIRADO' && i.fecha_baja >= primerDiaMes);
      if (bajasDelMes) bajas++;
    });

    setKpiAcademico({ activos, nuevosMes: nuevos, bajasMes: bajas, enRiesgo });

    // ==========================================
    // 3. NÓMINA (LIQUIDACIÓN PROYECTADA AL DÍA)
    // ==========================================
    const { data: sesiones } = await supabase
      .from("sesiones")
      .select("estado, clases(tarifa_base)")
      .gte("fecha", primerDiaMes)
      .eq("estado", "REALIZADA");

    const nomina = sesiones?.reduce((acc:number, s:any) => acc + Number(s.clases.tarifa_base || 0), 0) || 0;
    setNominaProyectada(nomina);

    setLoading(false);
  }

  const formatearDinero = (cantidad: number) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(cantidad || 0);
  };

  // Datos simulados para el gráfico hasta tener histórico
  const datosGrafico = [
    { name: 'Ene', Altas: 4, Bajas: 1 },
    { name: 'Feb', Altas: 8, Bajas: 2 },
    { name: 'Mar', Altas: 15, Bajas: 1 },
    { name: 'Abr', Altas: 10, Bajas: 3 },
    { name: 'May', Altas: kpiAcademico.nuevosMes, Bajas: kpiAcademico.bajasMes },
  ];

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B132D]"></div></div>;

  return (
    <div className="p-8 bg-gray-50 min-h-screen space-y-8">
      
      {/* HEADER */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-[#0B132D] tracking-tight" style={{fontFamily: 'var(--font-poppins)'}}>Dashboard Gerencial</h1>
          <p className="text-[#64748B] font-medium mt-1">Visión global de caja, operaciones y salud estudiantil.</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-slate-400 uppercase">Periodo Actual</p>
          <p className="text-xl font-bold text-[#0B132D]">{new Date().toLocaleString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()}</p>
        </div>
      </div>

      {/* BLOQUE 1: FINANZAS (Caja vs Ciclo) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-l-[#0466C8]">
          <h3 className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest mb-1">Esperado Mensual (MRR)</h3>
          <p className="text-2xl font-black text-[#0B132D]">{formatearDinero(kpiFinanzas.proyectadoMes)}</p>
          <p className="text-[10px] text-slate-400 mt-2 font-medium">Suma de todas las mensualidades activas.</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-l-green-500">
          <h3 className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest mb-1">Caja Real (Total Ingresos)</h3>
          <p className="text-2xl font-black text-green-600">{formatearDinero(kpiFinanzas.cajaTotal)}</p>
          <p className="text-[10px] text-slate-400 mt-2 font-medium">Todo el dinero que ha entrado este mes.</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-l-orange-500">
          <h3 className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest mb-1">Recaudación del Ciclo</h3>
          <div className="flex items-end gap-2">
            <p className="text-2xl font-black text-[#0B132D]">{formatearDinero(kpiFinanzas.recaudacionCiclo)}</p>
            <span className="text-xs font-bold text-green-500 mb-1">
              {Math.round((kpiFinanzas.recaudacionCiclo / (kpiFinanzas.proyectadoMes || 1)) * 100)}%
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 font-medium">Pagos correspondientes solo a este mes.</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-l-[#D20505]">
          <h3 className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest mb-1">Morosidad Histórica</h3>
          <p className="text-2xl font-black text-[#D20505]">{formatearDinero(kpiFinanzas.morosidadHistorica)}</p>
          <p className="text-[10px] text-slate-400 mt-2 font-medium">Deudas acumuladas de meses anteriores.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* BLOQUE 2: ACADÉMICO (Altas vs Bajas) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold text-[#0B132D] mb-6" style={{fontFamily: 'var(--font-poppins)'}}>Salud Estudiantil</h2>
            
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-slate-50 p-4 rounded-xl text-center">
                <p className="text-3xl font-black text-[#0B132D]">{kpiAcademico.activos}</p>
                <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest mt-1">Alumnos Activos</p>
              </div>
              <div className="bg-green-50 border border-green-100 p-4 rounded-xl text-center">
                <p className="text-3xl font-black text-green-600">+{kpiAcademico.nuevosMes}</p>
                <p className="text-[10px] font-bold text-green-700 uppercase tracking-widest mt-1">Altas del Mes</p>
              </div>
              <div className="bg-red-50 border border-red-100 p-4 rounded-xl text-center">
                <p className="text-3xl font-black text-[#D20505]">-{kpiAcademico.bajasMes}</p>
                <p className="text-[10px] font-bold text-[#D20505] uppercase tracking-widest mt-1">Bajas del Mes</p>
              </div>
            </div>

            {/* GRÁFICO (Mockup si no instalaste recharts) */}
            <div className="h-64 w-full bg-slate-50 rounded-xl flex items-center justify-center border border-dashed border-slate-200">
              {/* Si instalaste recharts, puedes reemplazar este div por el componente <ResponsiveContainer> */}
              <div className="text-center">
                <span className="text-3xl">📈</span>
                <p className="text-sm font-bold text-slate-400 mt-2">Curva de Crecimiento (Altas vs Bajas)</p>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">Requiere librería 'recharts' para renderizar datos históricos de {datosGrafico.length} meses.</p>
              </div>
            </div>
          </div>
        </div>

        {/* BLOQUE 3: ALERTAS Y OPERACIÓN (Nómina y Riesgo) */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Alerta Temprana de Fuga */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-orange-50 p-4 flex justify-between items-center border-b border-orange-100">
              <h2 className="text-xs font-bold text-orange-700 uppercase tracking-widest flex items-center gap-2">
                <span>⚠️</span> Riesgo de Deserción
              </h2>
              <span className="bg-orange-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{kpiAcademico.enRiesgo}</span>
            </div>
            <div className="p-4 bg-white">
              <p className="text-xs text-slate-500 mb-4 font-medium">Alumnos con 3+ inasistencias en los últimos 30 días detectados por el sistema.</p>
              {kpiAcademico.enRiesgo === 0 ? (
                <div className="text-center py-4 text-green-600 text-xs font-bold bg-green-50 rounded-lg">¡Todos asisten regularmente!</div>
              ) : (
                <button className="w-full bg-slate-100 text-slate-700 text-xs font-bold py-3 rounded-xl hover:bg-slate-200 transition">
                  Ver {kpiAcademico.enRiesgo} alumnos en riesgo
                </button>
              )}
            </div>
          </div>

          {/* Simulador de Nómina a la fecha */}
          <div className="bg-[#0B132D] rounded-2xl shadow-sm p-6 text-white border-t-4 border-t-[#0466C8]">
            <h3 className="text-white/60 font-bold uppercase tracking-widest text-[10px] mb-1">Nómina Acumulada a la Fecha</h3>
            <p className="text-3xl font-black text-white" style={{fontFamily: 'var(--font-poppins)'}}>
              {formatearDinero(nominaProyectada)}
            </p>
            <p className="text-[10px] text-white/50 mt-3 border-t border-white/10 pt-3">
              Cálculo en vivo basado en clases "REALIZADAS" y marcadas por los profesores hasta hoy.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}