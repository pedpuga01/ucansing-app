"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function FinanzasPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [procesandoCobros, setProcesandoCobros] = useState(false);
  
  // Datos Base
  const [cuentas, setCuentas] = useState<any[]>([]);
  const [transacciones, setTransacciones] = useState<any[]>([]);
  
  // Métricas Inteligentes
  const [metricas, setMetricas] = useState({
    pactadoMensual: 0,
    recaudadoMensualidades: 0,
    totalCajaReal: 0, 
    morosidad: 0
  });
  
  // Morosidad
  const [morosos, setMorosos] = useState<any[]>([]);

  // Modal Registrar Pago
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cuentaId, setCuentaId] = useState("");
  const [conceptoPago, setConceptoPago] = useState("Mensualidad Regular");
  const [metodoPago, setMetodoPago] = useState("Transferencia");
  
  const mesActualStr = new Date().toISOString().slice(0, 7);
  const [mesImputado, setMesImputado] = useState(mesActualStr);
  const [monto, setMonto] = useState("");
  const [detalle, setDetalle] = useState("");

  useEffect(() => {
    cargarDatos();
  }, []);

  // =========================================================================
  // 1. CARGAR DATOS Y CALCULAR LIBRO MAYOR
  // =========================================================================
  async function cargarDatos() {
    setIsLoading(true);

    const { data: familias, error } = await supabase
      .from("cuentas_familiares")
      .select(`
        id, titular_nombre, rut, telefono,
        alumnos ( nombre, inscripciones ( estado, precio_final_con_descuento ) ),
        transacciones ( id, tipo, monto, fecha, metodo_pago, notas )
      `)
      .order("titular_nombre");

    if (error) {
      console.error(error);
      setIsLoading(false);
      return;
    }

    let pactado = 0;
    let caja = 0;
    let recaudado = 0;
    let morosidad = 0;
    let listaMorosos: any[] = [];
    let allTx: any[] = [];

    const mesActual = new Date().getMonth();
    const añoActual = new Date().getFullYear();

    familias?.forEach(f => {
      // 1. Calcular Proyección Mensual (Lo Pactado)
      let proyeccion = 0;
      f.alumnos.forEach((a:any) => {
        a.inscripciones.filter((i:any) => i.estado === 'ACTIVO').forEach((i:any) => {
          proyeccion += Number(i.precio_final_con_descuento);
        });
      });
      pactado += proyeccion;

      // 2. Calcular Deuda Histórica (CARGOS vs PAGOS)
      let cargos = 0;
      let pagos = 0;

      f.transacciones.forEach((t:any) => {
        allTx.push({ ...t, titular: f.titular_nombre }); // Preparar para tabla Ledger
        const fechaT = new Date(t.fecha);
        const esMesActual = fechaT.getMonth() === mesActual && fechaT.getFullYear() === añoActual;

        if (t.tipo === 'CARGO') cargos += Number(t.monto);
        if (t.tipo === 'PAGO' || t.tipo === 'NOTA_CREDITO') {
          pagos += Number(t.monto);
          // Si es un pago recibido este mes, entra a la métrica de CAJA
          if (t.tipo === 'PAGO' && esMesActual) caja += Number(t.monto);
        }
      });

      const deudaActual = cargos - pagos;

      // 3. Separar Morosos vs Al Día
      if (deudaActual > 0) {
        morosidad += deudaActual;
        listaMorosos.push({ ...f, deudaActual, proyeccion });
      } else {
        if (proyeccion > 0) recaudado += proyeccion;
      }
    });

    setCuentas(familias || []);
    setMorosos(listaMorosos);
    setTransacciones(allTx.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()));
    
    setMetricas({
      pactadoMensual: pactado,
      recaudadoMensualidades: recaudado,
      totalCajaReal: caja,
      morosidad: morosidad
    });

    setIsLoading(false);
  }

  // =========================================================================
  // 2. GENERADOR DE COBROS (Simula el Cronjob Automático)
  // =========================================================================
  async function generarCobrosDelMes() {
    if (!confirm("⚠️ ¿Emitir facturación del mes para todos los alumnos activos?")) return;
    setProcesandoCobros(true);

    const mesStr = new Date().toLocaleString('es-ES', { month: 'long', year: 'numeric' });

    for (const cuenta of cuentas) {
      let proyeccion = 0;
      cuenta.alumnos.forEach((a:any) => {
        a.inscripciones.filter((i:any) => i.estado === 'ACTIVO').forEach((i:any) => {
          proyeccion += Number(i.precio_final_con_descuento);
        });
      });

      if (proyeccion > 0) {
        const yaCobrado = cuenta.transacciones.some((t:any) => t.tipo === 'CARGO' && new Date(t.fecha).getMonth() === new Date().getMonth());
        
        if (!yaCobrado) {
          await supabase.from("transacciones").insert([{
            cuenta_familiar_id: cuenta.id,
            tipo: 'CARGO',
            monto: proyeccion,
            metodo_pago: 'SISTEMA',
            notas: `Mensualidad ${mesStr}`
          }]);
        }
      }
    }
    
    alert("✅ Emisión de cobros completada.");
    setProcesandoCobros(false);
    cargarDatos();
  }

  // =========================================================================
  // 3. REGISTRO DE PAGOS (Manual)
  // =========================================================================
  function handleCuentaChange(id: string) {
    setCuentaId(id);
    const cuenta = morosos.find(c => c.id === id);
    if (cuenta) setMonto(cuenta.deudaActual.toString());
    else setMonto("");
  }

  async function registrarPago() {
    if (!monto || Number(monto) <= 0) return alert("Ingresa un monto válido");
    if (!cuentaId) return alert("Selecciona una cuenta familiar.");
    
    // Convertimos el "Concepto" y "Mes Imputado" en una nota contable estructurada
    const notaContable = `[${conceptoPago} - ${mesImputado}] ${detalle}`;

    const { error } = await supabase.from("transacciones").insert([{
      cuenta_familiar_id: cuentaId, 
      tipo: 'PAGO', 
      metodo_pago: metodoPago, 
      monto: Number(monto), 
      notas: notaContable
    }]);

    if (!error) {
      setIsModalOpen(false); 
      setCuentaId(""); setMonto(""); setDetalle(""); 
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
          <p className="text-[#64748B] mt-1 font-medium">Libro mayor inmutable, metas de recaudación y morosidad.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={generarCobrosDelMes} 
            disabled={procesandoCobros || isLoading}
            className="bg-white border-2 border-[#0B132D] text-[#0B132D] px-6 py-2.5 rounded-xl font-bold shadow-sm hover:bg-slate-50 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {procesandoCobros ? "⏳ Generando..." : "🧾 Emitir Cobros del Mes"}
          </button>
          <button 
            onClick={() => setIsModalOpen(true)} 
            className="bg-[#0B132D] text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-navy/20 hover:-translate-y-0.5 transition-transform flex items-center gap-2"
          >
            <span>💰</span> Registrar Ingreso
          </button>
        </div>
      </div>

      {/* DASHBOARD CONTABLE (PACTADO VS RECAUDADO) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Recaudado Mensualidades */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border-b-4 border-b-[#0466C8]">
          <h3 className="text-[#64748B] font-bold uppercase tracking-widest text-[10px] mb-2">Mensualidades (Proyectado)</h3>
          <div className="flex items-end gap-3 mb-3">
            <p className="text-4xl font-bold text-[#0B132D]" style={{fontFamily: 'var(--font-poppins)'}}>
              {isLoading ? "..." : formatearDinero(metricas.recaudadoMensualidades)}
            </p>
            <p className="text-sm font-bold text-slate-400 mb-1">/ {formatearDinero(metricas.pactadoMensual)}</p>
          </div>
          
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-[#0466C8] h-full rounded-full transition-all duration-1000" 
              style={{ width: `${calcularPorcentajeAvance()}%` }}
            ></div>
          </div>
          <p className="text-[10px] text-right font-bold text-[#0466C8] mt-1.5">{calcularPorcentajeAvance()}% Cuentas al Día</p>
        </div>

        {/* Morosidad */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border-b-4 border-b-[#D20505]">
          <h3 className="text-[#64748B] font-bold uppercase tracking-widest text-[10px] mb-2">Cuentas por Cobrar (Morosidad)</h3>
          <p className="text-4xl font-bold text-[#D20505]" style={{fontFamily: 'var(--font-poppins)'}}>
            {isLoading ? "..." : formatearDinero(metricas.morosidad)}
          </p>
          <p className="text-xs text-[#64748B] font-medium mt-2">
            <span className="font-bold text-[#D20505]">{morosos.length} familias</span> con deuda pendiente.
          </p>
        </div>

        {/* Caja Real (Todo sumado) */}
        <div className="bg-[#0B132D] rounded-2xl shadow-sm p-6 text-white border-b-4 border-b-white/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-bl-full -mr-8 -mt-8"></div>
          <h3 className="text-white/50 font-bold uppercase tracking-widest text-[10px] mb-2 relative z-10">Ingresos Totales en Caja (Este Mes)</h3>
          <p className="text-4xl font-bold text-white relative z-10" style={{fontFamily: 'var(--font-poppins)'}}>
            {isLoading ? "..." : formatearDinero(metricas.totalCajaReal)}
          </p>
          <p className="text-[10px] text-white/70 font-medium mt-3 relative z-10 border-t border-white/10 pt-2">
            Suma de todos los pagos registrados en el periodo.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* COLUMNA IZQ: LISTA DE MOROSOS */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-[#D20505]/20">
            <div className="bg-red-50 p-4 flex items-center gap-2 border-b border-red-100">
              <span className="text-lg">🚨</span>
              <h2 className="text-xs font-bold text-[#D20505] uppercase tracking-widest">Requiere Cobranza</h2>
            </div>
            <div className="p-4 max-h-[500px] overflow-y-auto custom-scrollbar bg-white">
              {isLoading ? <p className="text-center text-xs text-slate-400 py-4">Calculando...</p> : morosos.length === 0 ? (
                <div className="text-center py-6">
                  <span className="text-3xl block mb-2">🎉</span>
                  <p className="text-xs font-bold text-green-600 uppercase">0 Morosidad</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {morosos.map(m => (
                    <li key={m.id} className="flex justify-between items-center bg-slate-50 border border-slate-100 p-3 rounded-xl hover:border-red-200 transition">
                      <div>
                        <p className="font-bold text-[#0B132D] text-xs">{m.titular_nombre}</p>
                        <p className="text-[9px] text-[#64748B] uppercase">{m.telefono || 'Sin número'}</p>
                      </div>
                      <span className="font-black text-[#D20505] text-xs">{formatearDinero(m.deudaActual)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* COLUMNA DER: LIBRO MAYOR (LEDGER) */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-full">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-[#0B132D]" style={{fontFamily: 'var(--font-poppins)'}}>Libro Mayor: Transacciones</h2>
            </div>
            <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[#64748B] text-[10px] uppercase tracking-widest font-bold sticky top-0">
                    <th className="px-6 py-4">Fecha</th>
                    <th className="px-6 py-4">Titular / Cuenta</th>
                    <th className="px-6 py-4 text-center">Tipo</th>
                    <th className="px-6 py-4 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {isLoading ? <tr><td colSpan={4} className="p-8 text-center text-[#64748B]">Cargando libro mayor... ⏳</td></tr> : 
                   transacciones.length === 0 ? <tr><td colSpan={4} className="p-8 text-center text-[#64748B]">No hay movimientos registrados.</td></tr> : 
                   transacciones.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-xs font-bold text-[#0B132D]">{new Date(t.fecha).toLocaleDateString('es-CL', {day:'2-digit', month:'short', year:'numeric'})}</p>
                        <p className="text-[10px] text-[#64748B] font-medium mt-0.5">{t.metodo_pago}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-[#0B132D] text-sm">{t.titular}</p>
                        <p className="text-[10px] text-slate-500 max-w-xs truncate">{t.notas}</p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase border ${
                          t.tipo === 'CARGO' ? 'bg-red-50 text-red-600 border-red-100' : 
                          t.tipo === 'PAGO' ? 'bg-green-50 text-green-600 border-green-100' : 
                          'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {t.tipo}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`font-black text-sm ${t.tipo === 'CARGO' ? 'text-red-600' : 'text-green-600'}`}>
                          {t.tipo === 'CARGO' ? '-' : '+'}{formatearDinero(t.monto)}
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
            <p className="text-sm text-[#64748B] mb-6 font-medium">Añade un pago al libro mayor y descuenta la deuda.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-widest mb-1.5">Cuenta Familiar (Morosos) *</label>
                <select value={cuentaId} onChange={e => handleCuentaChange(e.target.value)} className="w-full border border-slate-200 bg-white rounded-xl p-3 outline-none focus:border-[#0466C8] text-sm font-bold text-[#0B132D] shadow-sm">
                  <option value="">Selecciona cuenta...</option>
                  {morosos.map(m => <option key={m.id} value={m.id}>{m.titular_nombre} (Debe {formatearDinero(m.deudaActual)})</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-widest mb-1.5">Concepto</label>
                  <select value={conceptoPago} onChange={e => setConceptoPago(e.target.value)} className="w-full border border-slate-200 rounded-xl p-3 outline-none focus:border-[#0466C8] text-sm font-bold text-[#0B132D] bg-slate-50 shadow-sm">
                    <option value="Mensualidad Regular">Mensualidad Regular</option>
                    <option value="Incorporación">Incorporación</option>
                    <option value="Ingreso Extra">Ingreso Extra</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-widest mb-1.5">Método</label>
                  <select value={metodoPago} onChange={e => setMetodoPago(e.target.value)} className="w-full border border-slate-200 rounded-xl p-3 outline-none focus:border-[#0466C8] text-sm font-bold text-[#0B132D] shadow-sm">
                    <option value="TRANSFERENCIA">Transferencia</option>
                    <option value="WEBPAY">WebPay / Tarjeta</option>
                    <option value="EFECTIVO">Efectivo</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-widest mb-1.5">Mes Imputado</label>
                  <input type="month" value={mesImputado} onChange={e => setMesImputado(e.target.value)} className="w-full border border-slate-200 rounded-xl p-3 outline-none focus:border-[#0466C8] text-sm font-bold text-[#0B132D] shadow-sm"/>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1.5">Monto a Abonar ($)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-3 text-green-700 font-bold">$</span>
                    <input type="number" min="0" value={monto} onChange={e => setMonto(e.target.value)} className="w-full border-2 border-green-200 bg-green-50 rounded-xl p-3 pl-8 outline-none focus:border-green-500 font-black text-green-700 text-lg shadow-sm" placeholder="0"/>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-widest mb-1.5">Detalle (Opcional)</label>
                <input type="text" value={detalle} onChange={e => setDetalle(e.target.value)} className="w-full border border-slate-200 rounded-xl p-3 outline-none focus:border-[#0466C8] text-sm shadow-sm" placeholder="Ej: Número de comprobante..."/>
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