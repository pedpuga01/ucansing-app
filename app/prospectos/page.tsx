"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ProspectosPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [prospectos, setProspectos] = useState<any[]>([]);
  const [clasesCatalogo, setClasesCatalogo] = useState<any[]>([]);
  const [tarifasMaestras, setTarifasMaestras] = useState<any[]>([]); 
  const [profesoresList, setProfesoresList] = useState<any[]>([]);
  const [valorMatriculaBase, setValorMatriculaBase] = useState(0);

  const cursosDisponibles = ["Canto Individual", "Canto Grupal", "Piano", "Guitarra", "Batería"];

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAgendaModalOpen, setIsAgendaModalOpen] = useState(false);
  const [isMatriculaModalOpen, setIsMatriculaModalOpen] = useState(false);
  const [prospectoSeleccionado, setProspectoSeleccionado] = useState<any>(null);

  // Estados Formularios Prospecto
  const [nombre, setNombre] = useState(""); const [fechaNac, setFechaNac] = useState(""); 
  const [apoderado, setApoderado] = useState(""); const [email, setEmail] = useState(""); 
  const [telefono, setTelefono] = useState(""); const [interes, setInteres] = useState("");
  
  // Estados Prueba
  const [clasePrueba, setClasePrueba] = useState(""); const [fechaPrueba, setFechaPrueba] = useState(""); 
  const [horaPrueba, setHoraPrueba] = useState(""); const [profesorPrueba, setProfesorPrueba] = useState(""); 
  const [costoPrueba, setCostoPrueba] = useState(0);
  
  // Estados Matrícula (Motor Financiero V2)
  const [claseMatriculaId, setClaseMatriculaId] = useState(""); 
  const [descuento, setDescuento] = useState(0); 
  const [fechaInicio, setFechaInicio] = useState("");
  const [cobrarMatricula, setCobrarMatricula] = useState(true);
  
  // Datos Titular de la Cuenta Familiar
  const [titularNombre, setTitularNombre] = useState("");
  const [titularRut, setTitularRut] = useState("");
  const [titularEmail, setTitularEmail] = useState("");
  const [titularTelefono, setTitularTelefono] = useState("");

  useEffect(() => { cargarDatos(); }, []);

  async function cargarDatos() {
    setIsLoading(true);
    
    // 1. Cargar Prospectos
    const { data: leads } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
    if (leads) setProspectos(leads);
    
    // 2. Cargar Catálogo Logístico
    const { data: clases } = await supabase.from("clases").select("*, disciplinas(nombre)");
    if (clases) setClasesCatalogo(clases);
    
    // 3. Cargar Profesores
    const { data: profes } = await supabase.from("profesores").select("*").eq("estado", "Activo");
    if (profes) setProfesoresList(profes);
    
    // 4. Cargar Tarifas y Configuraciones Globales
    const { data: tData } = await supabase.from("tarifario").select("*");
    if (tData) setTarifasMaestras(tData);

    const { data: conf } = await supabase.from("configuracion").select("*").eq("llave", "valor_matricula").single();
    if (conf) setValorMatriculaBase(conf.valor);
    
    setIsLoading(false);
  }

  // --- LÓGICA DE PROSPECTOS Y PRUEBAS ---
  async function guardarProspecto() {
    if (!nombre || !email || !fechaNac) return alert("Faltan datos obligatorios.");
    const { error } = await supabase.from("leads").insert([{ name: nombre, email, phone: telefono, fecha_nacimiento: fechaNac, nombre_apoderado: apoderado, clase_interes: interes, status: "Nuevo Contacto" }]);
    if (!error) { setIsModalOpen(false); resetForms(); cargarDatos(); }
  }

  function abrirAgendamiento(p: any) {
    setProspectoSeleccionado(p); setClasePrueba(p.clase_interes || ""); setFechaPrueba(new Date().toISOString().split('T')[0]); setHoraPrueba("18:00"); setProfesorPrueba(""); setCostoPrueba(0); setIsAgendaModalOpen(true);
  }

  async function confirmarAgendaPrueba() {
    const { error } = await supabase.from("leads").update({ status: "Prueba Agendada", clase_prueba_asignada: clasePrueba, fecha_prueba: fechaPrueba, hora_prueba: horaPrueba, profesor_prueba: profesorPrueba, costo_prueba: costoPrueba, prueba_pagada: costoPrueba === 0 }).eq("id", prospectoSeleccionado.id);
    if (!error) { setIsAgendaModalOpen(false); cargarDatos(); }
  }

  async function confirmarPago(p: any) {
    if(!window.confirm(`¿Confirmar recepción de $${p.costo_prueba} por la clase de prueba?`)) return;
    
    const { error: errLead } = await supabase.from("leads").update({ prueba_pagada: true }).eq("id", p.id);
    
    if (!errLead) {
      const mesActualStr = new Date().toISOString().slice(0, 7);
      await supabase.from("transacciones").insert([{
        student_id: null,
        tipo_pago: "Ingreso Extra", // Categorizado correctamente
        metodo_pago: "Transferencia", 
        mes_imputado: mesActualStr,
        monto: p.costo_prueba,
        detalle: `Pago clase de prueba - Prospecto: ${p.name}`
      }]);
      
      cargarDatos();
      alert("¡Pago registrado en el libro mayor con éxito!");
    } else alert("Hubo un error: " + errLead.message);
  }

  function abrirMatricula(p: any) {
    setProspectoSeleccionado(p); 
    setClaseMatriculaId(clasesCatalogo.length > 0 ? clasesCatalogo[0].id : ""); 
    setDescuento(0); 
    setCobrarMatricula(true);
    setFechaInicio(new Date().toISOString().split('T')[0]);
    // Pre-poblar datos de la cuenta con los del prospecto (por si el titular es él mismo)
    setTitularNombre(p.nombre_apoderado || p.name);
    setTitularEmail(p.email);
    setTitularTelefono(p.phone);
    setIsMatriculaModalOpen(true);
  }

  // --- MOTOR FINANCIERO V2 (CÁLCULOS EN TIEMPO REAL) ---
  const claseSeleccionadaObj = clasesCatalogo.find(c => c.id === claseMatriculaId);
  const precioBase = tarifasMaestras.find(t => t.modalidad === claseSeleccionadaObj?.modalidad)?.valor_mensual || 0;
  const precioMensualFinal = precioBase - descuento;

  // Calculadora de Prorrateo Exacto por Días
  let montoProrrateo = 0;
  if (fechaInicio) {
    const dInicio = new Date(fechaInicio);
    const diasEnMes = new Date(dInicio.getFullYear(), dInicio.getMonth() + 1, 0).getDate();
    const diasRestantes = diasEnMes - dInicio.getDate() + 1; // Se cuenta el día de inicio
    // Prorrateo exacto = (Precio Final / Días del Mes) * Días Restantes
    montoProrrateo = Math.round((precioMensualFinal / diasEnMes) * diasRestantes);
  }

  const montoIncorporacion = cobrarMatricula ? valorMatriculaBase : 0;
  const totalACobrarHoy = montoIncorporacion + montoProrrateo;

  async function ejecutarMatricula() {
    if (!claseMatriculaId || !titularNombre || !titularEmail) return alert("Faltan datos obligatorios (Clase, Nombre Titular o Email).");
    
    // 1. Crear o Registrar la Cuenta Familiar (Titular)
    const { data: cuenta, error: errCuenta } = await supabase.from("cuentas_familiares").insert([{
      titular_nombre: titularNombre,
      titular_rut: titularRut || null,
      email_contacto: titularEmail,
      telefono: titularTelefono
    }]).select().single();

    if (errCuenta) return alert("Error al crear la cuenta familiar: " + errCuenta.message);

    // 2. Crear al Alumno y vincularlo a la cuenta
    const { data: alumno, error: errorAlumno } = await supabase.from("students").insert([{
      cuenta_id: cuenta.id,
      name: prospectoSeleccionado.name, 
      email: prospectoSeleccionado.email, 
      phone: prospectoSeleccionado.phone,
      fecha_nacimiento: prospectoSeleccionado.fecha_nacimiento,
      clase_id: claseMatriculaId, 
      instrument: claseSeleccionadaObj?.disciplinas?.nombre, 
      class_schedule: `${claseSeleccionadaObj?.dia_semana} ${claseSeleccionadaObj?.hora_inicio.substring(0,5)}`,
      fecha_ingreso: fechaInicio,
      precio_base: precioBase, 
      descuento_aplicado: descuento, 
      mensualidad_final: precioMensualFinal, 
      status: 'Activo'
    }]).select().single();

    if (errorAlumno) return alert("Error al registrar alumno: " + errorAlumno.message);

    // 3. Registrar Transacciones en el Libro Mayor (Contabilidad Exacta)
    const mesActualStr = new Date().toISOString().slice(0, 7);
    const transaccionesAInsertar = [];

    if (cobrarMatricula) {
      transaccionesAInsertar.push({
        student_id: alumno.id,
        tipo_pago: "Incorporación",
        metodo_pago: "Transferencia",
        mes_imputado: mesActualStr,
        monto: montoIncorporacion,
        detalle: "Pago Matrícula Inicial"
      });
    }

    if (montoProrrateo > 0) {
      transaccionesAInsertar.push({
        student_id: alumno.id,
        tipo_pago: "Proporcional 1er Mes",
        metodo_pago: "Transferencia",
        mes_imputado: mesActualStr,
        monto: montoProrrateo,
        detalle: `Prorrateo desde el día ${new Date(fechaInicio).getDate()}`
      });
    }

    if (transaccionesAInsertar.length > 0) {
      await supabase.from("transacciones").insert(transaccionesAInsertar);
    }

    // 4. Cambiar estado en el embudo
    await supabase.from("leads").update({ status: "Matriculado" }).eq("id", prospectoSeleccionado.id);
    
    setIsMatriculaModalOpen(false); 
    alert(`¡Matrícula Oficializada!\n\nSe creó la cuenta familiar para: ${titularNombre}\nAlumno activado: ${prospectoSeleccionado.name}\nTotal recaudado hoy: $${totalACobrarHoy.toLocaleString('es-CL')}`); 
    cargarDatos();
  }

  function resetForms() { setNombre(""); setEmail(""); setTelefono(""); setFechaNac(""); setApoderado(""); setInteres(""); }

  const generarOpcionesHora = () => {
    let opciones = [];
    for(let h = 8; h <= 21; h++) {
      for(let m = 0; m < 60; m += 30) {
        let horaStr = String(h).padStart(2, '0') + ":" + String(m).padStart(2, '0');
        opciones.push(<option key={horaStr} value={horaStr}>{horaStr}</option>);
      }
    }
    return opciones;
  };

  return (
    <div className="p-10 space-y-8 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0B132D] tracking-tight" style={{fontFamily: 'var(--font-poppins)'}}>Embudo de Ventas</h1>
          <p className="text-[#64748B] mt-1 font-medium">Gestiona contactos, pruebas y matriculaciones oficiales.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-[#FC6827] hover:bg-[#e0591e] text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-[#FC6827]/20 transition-all transform hover:-translate-y-0.5">
          + Nuevo Contacto
        </button>
      </div>

      <div className="saas-card overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-[11px] uppercase tracking-widest text-[#64748B] font-bold">
              <th className="p-5">Prospecto</th>
              <th className="p-5">Clase de Prueba</th>
              <th className="p-5">Estado</th>
              <th className="p-5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {isLoading ? <tr><td colSpan={4} className="p-8 text-center text-[#64748B] font-medium">Cargando embudo... ⏳</td></tr> : 
             prospectos.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="p-5">
                  <p className="font-bold text-[#0B132D] text-sm">{p.name}</p>
                  <p className="text-xs text-[#64748B] mt-0.5">{p.email}</p>
                </td>
                <td className="p-5">
                  {p.status === "Nuevo Contacto" ? <span className="text-xs text-[#64748B] italic">Interés: {p.clase_interes || "-"}</span> : (
                    <div><p className="font-bold text-[#0466C8] text-sm">{p.clase_prueba_asignada}</p><p className="text-xs text-[#64748B] font-medium mt-0.5">📅 {p.fecha_prueba}</p></div>
                  )}
                </td>
                <td className="p-5">
                  <span className={`px-3 py-1.5 text-[11px] font-bold rounded-full inline-block border ${p.status === 'Matriculado' ? 'bg-green-50 text-green-700 border-green-200' : p.status === 'Nuevo Contacto' ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-blue-50 text-[#0466C8] border-blue-200'}`}>
                    {p.status}
                  </span>
                </td>
                <td className="p-5 text-right space-x-2">
                  {p.status !== "Matriculado" && (
                    <div className="flex justify-end gap-2">
                      <button onClick={() => abrirAgendamiento(p)} className="text-[#0466C8] bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-xl text-xs font-bold transition-colors">📅 Prueba</button>
                      
                      {p.status === "Prueba Agendada" && p.costo_prueba > 0 && !p.prueba_pagada && (
                        <button onClick={() => confirmarPago(p)} className="text-green-700 bg-green-50 hover:bg-green-100 px-4 py-2 rounded-xl text-xs font-bold transition-colors border border-green-200 shadow-sm">✅ Pagar</button>
                      )}
                      
                      <button onClick={() => abrirMatricula(p)} className="text-white bg-[#0B132D] hover:bg-[#1a2546] px-5 py-2 rounded-xl text-xs font-bold transition-colors shadow-md">✨ Matricular</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL MATRÍCULA (MOTOR FINANCIERO V2) */}
      {isMatriculaModalOpen && (
        <div className="fixed inset-0 bg-[#0B132D]/40 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-[24px] shadow-2xl w-full max-w-2xl border-t-8 border-[#FC6827] max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h2 className="text-2xl font-bold mb-1 text-[#0B132D]" style={{fontFamily: 'var(--font-poppins)'}}>Oficializar Matrícula</h2>
            <p className="text-sm text-[#64748B] mb-6 font-medium">Alumno a matricular: <span className="text-[#FC6827] font-bold">{prospectoSeleccionado?.name}</span></p>
            
            <div className="space-y-6">
              
              {/* PASO 1: LA CUENTA (TITULAR) */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                <h3 className="text-xs font-black text-[#0B132D] uppercase tracking-widest mb-3 border-b border-slate-200 pb-2">1. Datos del Titular (Facturación)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-[#64748B] uppercase mb-1">Nombre Completo Titular</label>
                    <input type="text" value={titularNombre} onChange={e => setTitularNombre(e.target.value)} className="w-full border border-slate-200 p-2.5 rounded-xl text-sm outline-none focus:border-[#FC6827]"/>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#64748B] uppercase mb-1">RUT (Opcional)</label>
                    <input type="text" value={titularRut} onChange={e => setTitularRut(e.target.value)} className="w-full border border-slate-200 p-2.5 rounded-xl text-sm outline-none focus:border-[#FC6827]" placeholder="12.345.678-9"/>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#64748B] uppercase mb-1">Email Facturación</label>
                    <input type="email" value={titularEmail} onChange={e => setTitularEmail(e.target.value)} className="w-full border border-slate-200 p-2.5 rounded-xl text-sm outline-none focus:border-[#FC6827]"/>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#64748B] uppercase mb-1">Teléfono Fijo/Móvil</label>
                    <input type="text" value={titularTelefono} onChange={e => setTitularTelefono(e.target.value)} className="w-full border border-slate-200 p-2.5 rounded-xl text-sm outline-none focus:border-[#FC6827]"/>
                  </div>
                </div>
              </div>

              {/* PASO 2: LOGÍSTICA ACADÉMICA */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-xs font-black text-[#0B132D] uppercase tracking-widest mb-3 border-b border-slate-100 pb-2">2. Asignación de Clase</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-[#64748B] uppercase mb-1">Grupo/Horario a Inscribir</label>
                    <select value={claseMatriculaId} onChange={e => setClaseMatriculaId(e.target.value)} className="w-full border border-slate-200 p-2.5 rounded-xl bg-slate-50 text-sm font-medium text-[#0B132D] outline-none focus:border-[#FC6827]">
                      <option value="">Seleccionar clase del catálogo...</option>
                      {clasesCatalogo.map(c => <option key={c.id} value={c.id}>{c.disciplinas?.nombre} - {c.dia_semana} {c.hora_inicio.substring(0,5)} ({c.modalidad}) | Prof: {c.profesor}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#64748B] uppercase mb-1">Fecha de Ingreso Oficial</label>
                    <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="w-full border border-slate-200 p-2.5 rounded-xl text-sm font-medium text-[#0B132D] outline-none focus:border-[#FC6827]" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#64748B] uppercase mb-1">Beca / Descuento Mensual ($)</label>
                    <input type="number" min="0" value={descuento} onChange={e => setDescuento(Number(e.target.value))} className="w-full border border-slate-200 p-2.5 rounded-xl text-sm font-medium outline-none focus:border-[#FC6827]" placeholder="Ej: 10000" />
                  </div>
                </div>
              </div>

              {/* PASO 3: LIQUIDACIÓN Y COBROS */}
              <div className="bg-[#0B132D] p-6 rounded-2xl text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#FC6827] opacity-20 rounded-bl-full -mr-4 -mt-4"></div>
                <h3 className="text-xs font-black text-white/50 uppercase tracking-widest mb-4 relative z-10">3. Liquidación Financiera</h3>
                
                <div className="flex justify-between items-center mb-3 text-sm relative z-10">
                  <span className="text-slate-300">Precio Base Mensualidad:</span>
                  <span className="font-medium">${precioBase.toLocaleString('es-CL')}</span>
                </div>
                
                <div className="flex justify-between items-center mb-4 text-sm relative z-10 pb-4 border-b border-white/10">
                  <span className="text-slate-300">Cobro Incorporación (Matrícula):</span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={cobrarMatricula} onChange={(e) => setCobrarMatricula(e.target.checked)} className="accent-[#FC6827] w-4 h-4" />
                      <span className="text-[10px] uppercase font-bold text-slate-400">Cobrar</span>
                    </label>
                    <span className={`font-medium ${cobrarMatricula ? 'text-white' : 'text-slate-500 line-through'}`}>
                      ${valorMatriculaBase.toLocaleString('es-CL')}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-end relative z-10">
                  <div>
                    <span className="block text-[10px] font-bold text-[#FC6827] uppercase tracking-widest">Total a pagar HOY</span>
                    <span className="text-[10px] text-slate-400">Incorporación + Proporción días restantes mes</span>
                  </div>
                  <span className="font-black text-3xl text-white">${totalACobrarHoy.toLocaleString('es-CL')}</span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setIsMatriculaModalOpen(false)} className="px-6 py-2.5 text-slate-500 hover:bg-slate-50 rounded-xl font-bold transition-colors">Cancelar</button>
                <button onClick={ejecutarMatricula} className="bg-[#FC6827] text-white px-8 py-2.5 rounded-xl font-bold shadow-lg shadow-[#FC6827]/20 hover:-translate-y-0.5 transition-transform">Oficializar Matrícula</button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* MODAL CREAR CONTACTO (Oculto si no se usa) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#0B132D]/40 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-[24px] shadow-2xl w-full max-w-md border-t-8 border-[#0466C8]">
            <h2 className="text-2xl font-bold mb-6 text-[#0B132D]" style={{fontFamily: 'var(--font-poppins)'}}>Nuevo Prospecto</h2>
            <div className="space-y-4">
              <input placeholder="Nombre Alumno *" value={nombre} onChange={e => setNombre(e.target.value)} className="w-full border border-slate-200 p-3 rounded-xl outline-none focus:border-[#0466C8] text-sm"/>
              <input type="date" value={fechaNac} onChange={e => setFechaNac(e.target.value)} className="w-full border border-slate-200 p-3 rounded-xl outline-none focus:border-[#0466C8] text-sm" title="Nacimiento"/>
              <input placeholder="Apoderado (Opcional)" value={apoderado} onChange={e => setApoderado(e.target.value)} className="w-full border border-slate-200 p-3 rounded-xl outline-none focus:border-[#0466C8] text-sm"/>
              <input placeholder="Email *" value={email} onChange={e => setEmail(e.target.value)} className="w-full border border-slate-200 p-3 rounded-xl outline-none focus:border-[#0466C8] text-sm"/>
              <input placeholder="Teléfono" value={telefono} onChange={e => setTelefono(e.target.value)} className="w-full border border-slate-200 p-3 rounded-xl outline-none focus:border-[#0466C8] text-sm"/>
              <select value={interes} onChange={e => setInteres(e.target.value)} className="w-full border border-slate-200 p-3 rounded-xl outline-none focus:border-[#0466C8] text-sm">
                <option value="">Clase de Interés...</option>
                {cursosDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="flex justify-end gap-3 pt-4">
                <button onClick={() => setIsModalOpen(false)} className="px-5 py-2 text-slate-500 font-bold">Cancelar</button>
                <button onClick={guardarProspecto} className="bg-[#0466C8] text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-blue-500/20">Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL AGENDAR PRUEBA */}
      {isAgendaModalOpen && (
        <div className="fixed inset-0 bg-[#0B132D]/40 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-[24px] shadow-2xl w-full max-w-md border-t-8 border-[#0466C8]">
            <h2 className="text-xl font-bold mb-1 text-[#0B132D]" style={{fontFamily: 'var(--font-poppins)'}}>Agendar Clase de Prueba</h2>
            <p className="text-sm text-[#64748B] mb-6 font-medium">Prospecto: {prospectoSeleccionado?.name}</p>
            <div className="space-y-4">
              <select value={clasePrueba} onChange={e => setClasePrueba(e.target.value)} className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-[#0466C8]">
                <option value="">Seleccionar Clase...</option>{cursosDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="flex gap-3">
                <input type="date" value={fechaPrueba} onChange={e => setFechaPrueba(e.target.value)} className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-[#0466C8]"/>
                <select value={horaPrueba} onChange={e => setHoraPrueba(e.target.value)} className="w-1/2 border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-[#0466C8]">{generarOpcionesHora()}</select>
              </div>
              
              {/* Leemos profes reales aquí también */}
              <select value={profesorPrueba} onChange={e => setProfesorPrueba(e.target.value)} className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-[#0466C8]">
                <option value="">Seleccionar Profesor...</option>
                {profesoresList.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
              </select>
              
              <input type="number" min="0" value={costoPrueba} onChange={e => setCostoPrueba(Number(e.target.value))} className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-[#0466C8]" placeholder="Costo de Prueba ($)"/>
              <div className="flex justify-end gap-3 pt-4">
                <button onClick={() => setIsAgendaModalOpen(false)} className="px-5 py-2 text-slate-500 font-bold">Cancelar</button>
                <button onClick={confirmarAgendaPrueba} className="bg-[#0466C8] text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-blue-500/20">Agendar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}