"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function FinanzasPage() {
  const [isLoading, setIsLoading] = useState(true);
  
  // Datos Base
  const [alumnos, setAlumnos] = useState<any[]>([]);
  const [transacciones, setTransacciones] = useState<any[]>([]);
  const [conceptosBd, setConceptosBd] = useState<any[]>([]);
  
  // Métricas Inteligentes
  const [metricas, setMetricas] = useState({
    pactadoMensual: 0,
    recaudadoMensualidades: 0,
    totalCajaReal: 0, // Suma de TODO (matrículas, extras, etc) este mes
    morosidad: 0
  });
  
  // Desglose Contable
  const [desglose, setDesglose] = useState<Record<string, number>>({});
  
  // Morosidad
  const [morosos, setMorosos] = useState<any[]>([]);

  // Modal Registrar Pago
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [alumnoId, setAlumnoId] = useState("");
  const [tipoPago, setTipoPago] = useState("Mensualidad Regular");
  const [metodoPago, setMetodoPago] = useState("Transferencia");
  
  const mesActualStr = new Date().toISOString().slice(0, 7); // YYYY-MM
  const [mesImputado, setMesImputado] = useState(mesActualStr);
  const [monto, setMonto] = useState("");
  const [detalle, setDetalle] = useState("");

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setIsLoading(true);

    // 1. Cargar Conceptos Financieros Oficiales
    const { data: conceptosData } = await supabase.from("conceptos_financieros").select("*").order("nombre");
    if (conceptosData) setConceptosBd(conceptosData);

    // 2. Cargar Alumnos Activos (Para calcular lo PACTADO)
    const { data: dataAlumnos } = await supabase
      .from("students")
      .select("id, name, mensualidad_final, phone")
      .eq("status", "Activo")
      .order("name");
      
    let totalPactado = 0;
    if (dataAlumnos) {
      setAlumnos(dataAlumnos);
      totalPactado = dataAlumnos.reduce((acc, a) => acc + (Number(a.mensualidad_final) || 0), 0);
    }

    // 3. Cargar Transacciones (Libro Mayor)
    const { data: dataTransacciones } = await supabase
      .from("transacciones")
      .select("*, students(name)")
      .order("fecha", { ascending: false });

    if (dataTransacciones && dataAlumnos) {
      setTransacciones(dataTransacciones);
      
      const mesActual = new Date().getMonth();
      const añoActual = new Date().getFullYear();
      const strMesImputadoTarget = `${añoActual}-${String(mesActual + 1).padStart(2, '0')}`; 
      
      let cajaTotal = 0;
      let mensualidadesRecaudadas = 0;
      let idsPagadosMensualidad: string[] = [];
      let desgloseTemporal: Record<string, number> = {};

      dataTransacciones.forEach(t => {
        const fechaT = new Date(t.fecha);
        const esCajaEsteMes = fechaT.getMonth() === mesActual && fechaT.getFullYear() === añoActual;
        
        // Calcular Ingresos Reales en Caja este mes (Cualquier concepto)
        if (esCajaEsteMes) {
          cajaTotal += Number(t.monto);
          // Armar Desglose por Concepto
          desgloseTemporal[t.tipo_pago] = (desgloseTemporal[t.tipo_pago] || 0) + Number(t.monto);
        }

        // Analizar Mensualidades Pagadas para la meta "Pactado vs Recaudado"
        if (t.tipo_pago === 'Mensualidad Regular' && t.mes_imputado === strMesImputadoTarget) {
          mensualidadesRecaudadas += Number(t.monto);
          if (t.student_id) idsPagadosMensualidad.push(t.student_id);
        }
      });
      
      setDesglose(desgloseTemporal);

      // 4. Calcular Cuentas por Cobrar (Morosos)
      const listaMorosos = dataAlumnos.filter(a => !idsPagadosMensualidad.includes(a.id));
      setMorosos(listaMorosos);
      
      const deudaTotal = listaMorosos.reduce((sum, a) => sum + Number(a.mensualidad_final), 0);
      
      setMetricas({
        pactadoMensual: totalPactado,
        recaudadoMensualidades: mensualidadesRecaudadas,
        totalCajaReal: cajaTotal,
        morosidad: deudaTotal
      });
    }

    setIsLoading(false);
  }

  // Autocompletar monto sugerido si es Mensualidad
  function handleTipoPagoChange(tipo: string) {
    setTipoPago(tipo);
    if (tipo !== "Mensualidad Regular" && tipo !== "Proporcional 1er Mes") {
      setMonto("");
    } else if (alumnoId) {
      const alumno = alumnos.find(a => a.id === alumnoId);
      if (alumno && alumno.mensualidad_final) setMonto(alumno.mensualidad_final.toString());
    }
  }

  function handleAlumnoChange(id: string) {
    setAlumnoId(id);
    if (tipoPago === "Mensualidad Regular") {
      const alumno = alumnos.find(a => a.id === id);
      if (alumno && alumno.mensualidad_final) setMonto(alumno.mensualidad_final.toString());
      else setMonto("");
    }
  }

  async function registrarPago() {
    if (!monto || Number(monto) <= 0) return alert("Ingresa un monto válido");
    if (tipoPago !== "Ingreso Extra" && !alumnoId) return alert("Selecciona un alumno.");
    
    const { error } = await supabase.from("transacciones").insert([{
      student_id: alumnoId || null, 
      tipo_pago: tipoPago, 
      metodo_pago: metodoPago, 
      mes_imputado: mesImputado, 
      monto: Number(monto), 
      detalle: detalle || null
    }]);

    if (!error) {
      setIsModalOpen(false); 
      setAlumnoId(""); setMonto(""); setDetalle(""); setTipoPago("Mensualidad Regular"); 
      cargarDatos();
    } else alert("Error al guardar: " + error.message);
  }

  const formatearDinero = (cantidad: number) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(cantidad || 0);
  };

  const calcularPorcentajeAvance = () => {
    if (metricas.pactadoMensual === 0) return 0;
    return Math.min(Math.round((metricas.recaudadoMensualidades / metricas.pactadoMensual) * 100), 100);
  };

  return (
    <div className="p-10 space-y-8 min-h-screen">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0B132D] tracking-tight" style={{fontFamily: 'var(--font-poppins)'}}>
            Finanzas y Cobranza
          </h1>
          <p className="text-[#64748B] mt-1 font-medium">Libro mayor, metas de recaudación y morosidad.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)} 
          className="bg-[#0B132D] text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-navy/20 hover:-translate-y-0.5 transition-transform flex items-center gap-2"
        >
          <span>💰</span> Registrar Ingreso
        </button>
      </div>

      {/* DASHBOARD CONTABLE (PACTADO VS RECAUDADO) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Recaudado Mensualidades */}
        <div className="saas-card p-6 border-b-4 border-b-[#0466C8]">
          <h3 className="text-[#64748B] font-bold uppercase tracking-widest text-[10px] mb-2">Mensualidades (Mes Actual)</h3>
          <div className="flex items-end gap-3 mb-3">
            <p className="text-4xl font-bold text-[#0B132D]" style={{fontFamily: 'var(--font-poppins)'}}>
              {isLoading ? "..." : formatearDinero(metricas.recaudadoMensualidades)}
            </p>
            <p className="text-sm font-bold text-slate-400 mb-1">/ {formatearDinero(metricas.pactadoMensual)}</p>
          </div>
          
          {/* Barra de Progreso Meta */}
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-[#0466C8] h-full rounded-full transition-all duration-1000" 
              style={{ width: `${calcularPorcentajeAvance()}%` }}
            ></div>
          </div>
          <p className="text-[10px] text-right font-bold text-[#0466C8] mt-1.5">{calcularPorcentajeAvance()}% Recaudado</p>
        </div>

        {/* Morosidad */}
        <div className="saas-card p-6 border-b-4 border-b-[#D20505]">
          <h3 className="text-[#64748B] font-bold uppercase tracking-widest text-[10px] mb-2">Cuentas por Cobrar</h3>
          <p className="text-4xl font-bold text-[#D20505]" style={{fontFamily: 'var(--font-poppins)'}}>
            {isLoading ? "..." : formatearDinero(metricas.morosidad)}
          </p>
          <p className="text-xs text-[#64748B] font-medium mt-2">
            <span className="font-bold text-[#D20505]">{morosos.length} alumnos</span> pendientes.
          </p>
        </div>

        {/* Caja Real (Todo sumado) */}
        <div className="saas-card p-6 bg-[#0B132D] text-white border-b-4 border-b-white/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-bl-full -mr-8 -mt-8"></div>
          <h3 className="text-white/50 font-bold uppercase tracking-widest text-[10px] mb-2 relative z-10">Ingresos Totales en Caja (Este Mes)</h3>
          <p className="text-4xl font-bold text-white relative z-10" style={{fontFamily: 'var(--font-poppins)'}}>
            {isLoading ? "..." : formatearDinero(metricas.totalCajaReal)}
          </p>
          <p className="text-[10px] text-white/70 font-medium mt-3 relative z-10 border-t border-white/10 pt-2">
            Incluye mensualidades, matrículas y otros ingresos.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* COLUMNA IZQ: LISTA DE MOROSOS & DESGLOSE */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Desglose de Conceptos */}
          <div className="saas-card p-6 bg-slate-50 border border-slate-200">
            <h2 className="text-xs font-black text-[#0B132D] uppercase tracking-widest mb-4 border-b border-slate-200 pb-2">Desglose de Ingresos (Caja)</h2>
            <div className="space-y-3">
              {Object.keys(desglose).length === 0 ? (
                <p className="text-xs text-slate-500 italic">No hay ingresos este mes.</p>
              ) : (
                Object.entries(desglose).sort((a,b) => b[1] - a[1]).map(([concepto, monto]) => (
                  <div key={concepto} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                    <span className="text-[11px] font-bold text-slate-600">{concepto}</span>
                    <span className="text-sm font-black text-[#0B132D]">{formatearDinero(monto)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Lista de Morosos */}
          <div className="saas-card overflow-hidden border border-[#D20505]/20">
            <div className="bg-red-50 p-4 flex items-center gap-2 border-b border-red-100">
              <span className="text-lg">🚨</span>
              <h2 className="text-xs font-bold text-[#D20505] uppercase tracking-widest">Requiere Cobranza</h2>
            </div>
            <div className="p-4 max-h-[350px] overflow-y-auto custom-scrollbar bg-white">
              {isLoading ? <p className="text-center text-xs text-slate-400 py-4">Calculando...</p> : morosos.length === 0 ? (
                <div className="text-center py-6">
                  <span className="text-3xl block mb-2">🎉</span>
                  <p className="text-xs font-bold text-green-600 uppercase">100% Recaudado</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {morosos.map(m => (
                    <li key={m.id} className="flex justify-between items-center bg-slate-50 border border-slate-100 p-3 rounded-xl">
                      <div>
                        <p className="font-bold text-[#0B132D] text-xs">{m.name}</p>
                        <p className="text-[9px] text-[#64748B] uppercase">{m.phone || 'Sin número'}</p>
                      </div>
                      <span className="font-black text-[#D20505] text-xs">{formatearDinero(m.mensualidad_final)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* COLUMNA DER: LIBRO MAYOR */}
        <div className="lg:col-span-2">
          <div className="saas-card overflow-hidden h-full">
            <div className="p-6 border-b border-slate-100 bg-white">
              <h2 className="text-lg font-bold text-[#0B132D]" style={{fontFamily: 'var(--font-poppins)'}}>Libro Mayor: Movimientos</h2>
            </div>
            <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[#64748B] text-[10px] uppercase tracking-widest font-bold sticky top-0">
                    <th className="px-6 py-4">Fecha</th>
                    <th className="px-6 py-4">Concepto y Alumno</th>
                    <th className="px-6 py-4 text-center">Imputación</th>
                    <th className="px-6 py-4 text-right">Monto Real</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 bg-white">
                  {isLoading ? <tr><td colSpan={4} className="p-8 text-center text-[#64748B] font-medium">Cargando libro mayor... ⏳</td></tr> : 
                   transacciones.length === 0 ? <tr><td colSpan={4} className="p-8 text-center text-[#64748B] font-medium">No hay ingresos registrados aún.</td></tr> : 
                   transacciones.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-xs font-bold text-[#0B132D]">{new Date(t.fecha).toLocaleDateString('es-CL', {day:'2-digit', month:'short', year:'numeric'})}</p>
                        <p className="text-[10px] text-[#64748B] font-medium mt-0.5">{t.metodo_pago}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-[#0B132D] text-sm">{t.students?.name || "Ingreso No Asignado"}</p>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase mt-1 inline-block border ${
                          t.tipo_pago.includes('Mensualidad') ? 'bg-blue-50 text-[#0466C8] border-blue-100' : 
                          t.tipo_pago.includes('Incorporación') ? 'bg-orange-50 text-[#FC6827] border-orange-100' : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {t.tipo_pago}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-1 rounded-md text-[10px]">
                          Mes: {t.mes_imputado}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-black text-green-600 text-sm">
                          + {formatearDinero(t.monto)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

      {/* MODAL REGISTRAR PAGO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#0B132D]/40 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-[24px] shadow-2xl w-full max-w-lg border-t-8 border-[#0B132D]">
            <h2 className="text-2xl font-bold text-[#0B132D] mb-1" style={{fontFamily: 'var(--font-poppins)'}}>Registrar Ingreso</h2>
            <p className="text-sm text-[#64748B] mb-6 font-medium">Añade un movimiento al libro mayor contable.</p>
            
            <div className="space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-widest mb-1.5">Concepto de Pago *</label>
                  <select value={tipoPago} onChange={e => handleTipoPagoChange(e.target.value)} className="w-full border border-slate-200 rounded-xl p-3 outline-none focus:border-[#0466C8] text-sm font-bold text-[#0B132D] bg-slate-50 shadow-sm">
                    {conceptosBd.length > 0 ? (
                      conceptosBd.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)
                    ) : (
                      <>
                        <option value="Mensualidad Regular">Mensualidad Regular</option>
                        <option value="Incorporación">Incorporación</option>
                        <option value="Proporcional 1er Mes">Proporcional 1er Mes</option>
                        <option value="Ingreso Extra">Ingreso Extra</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-widest mb-1.5">Método *</label>
                  <select value={metodoPago} onChange={e => setMetodoPago(e.target.value)} className="w-full border border-slate-200 rounded-xl p-3 outline-none focus:border-[#0466C8] text-sm font-bold text-[#0B132D] shadow-sm">
                    <option value="Transferencia">Transferencia</option>
                    <option value="WebPay">WebPay / Tarjeta</option>
                    <option value="Efectivo">Efectivo</option>
                  </select>
                </div>
              </div>

              {tipoPago !== "Ingreso Extra" && (
                <div>
                  <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-widest mb-1.5">Alumno Asociado *</label>
                  <select value={alumnoId} onChange={e => handleAlumnoChange(e.target.value)} className="w-full border border-slate-200 bg-white rounded-xl p-3 outline-none focus:border-[#0466C8] text-sm font-bold text-[#0B132D] shadow-sm">
                    <option value="">Selecciona alumno...</option>
                    {alumnos.map(a => <option key={a.id} value={a.id}>{a.name} ({formatearDinero(a.mensualidad_final)})</option>)}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-widest mb-1.5">Mes Imputado</label>
                  <input type="month" value={mesImputado} onChange={e => setMesImputado(e.target.value)} className="w-full border border-slate-200 rounded-xl p-3 outline-none focus:border-[#0466C8] text-sm font-bold text-[#0B132D] shadow-sm"/>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1.5">Monto Recibido ($)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-3 text-green-700 font-bold">$</span>
                    <input type="number" min="0" value={monto} onChange={e => setMonto(e.target.value)} className="w-full border-2 border-green-200 bg-green-50 rounded-xl p-3 pl-8 outline-none focus:border-green-500 font-black text-green-700 text-lg shadow-sm" placeholder="0"/>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-widest mb-1.5">Detalle o Referencia</label>
                <input type="text" value={detalle} onChange={e => setDetalle(e.target.value)} className="w-full border border-slate-200 rounded-xl p-3 outline-none focus:border-[#0466C8] text-sm shadow-sm" placeholder="Opcional. Ej: Número de transferencia..."/>
              </div>

              <div className="flex justify-end gap-3 pt-5 border-t border-slate-100 mt-2">
                <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors">Cancelar</button>
                <button onClick={registrarPago} className="bg-[#0B132D] text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-navy/20 hover:-translate-y-0.5 transition-transform">
                  Guardar Pago
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}