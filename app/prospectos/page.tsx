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
  const [disciplinas, setDisciplinas] = useState<any[]>([]);
  const [profesoresList, setProfesoresList] = useState<any[]>([]);
  const [cuentasExistentes, setCuentasExistentes] = useState<any[]>([]);
  const [valorMatriculaBase, setValorMatriculaBase] = useState(30000);

  const cursosDisponibles = ["Canto Individual", "Canto Grupal", "Piano Individual", "Piano Grupal", "Guitarra Individual", "Guitarra Grupal"];
  const diasSemana = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAgendaModalOpen, setIsAgendaModalOpen] = useState(false);
  const [isMatriculaModalOpen, setIsMatriculaModalOpen] = useState(false);
  const [prospectoSeleccionado, setProspectoSeleccionado] = useState<any>(null);

  const [nombre, setNombre] = useState(""); const [fechaNac, setFechaNac] = useState(""); 
  const [apoderado, setApoderado] = useState(""); const [email, setEmail] = useState(""); 
  const [telefono, setTelefono] = useState(""); const [interes, setInteres] = useState("");
  const [clasePrueba, setClasePrueba] = useState(""); const [fechaPrueba, setFechaPrueba] = useState(""); 
  const [horaPrueba, setHoraPrueba] = useState(""); const [profesorPrueba, setProfesorPrueba] = useState(""); 
  const [costoPrueba, setCostoPrueba] = useState(0);
  
  const [busquedaCuenta, setBusquedaCuenta] = useState("");
  const [cuentaSeleccionadaId, setCuentaSeleccionadaId] = useState<string | null>(null);
  const [titularNombre, setTitularNombre] = useState("");
  const [titularRut, setTitularRut] = useState("");
  const [titularEmail, setTitularEmail] = useState("");
  const [titularTelefono, setTitularTelefono] = useState("");

  const [fechaInicio, setFechaInicio] = useState("");
  const [cobrarMatricula, setCobrarMatricula] = useState(true);
  const [descuentoTotal, setDescuentoTotal] = useState(0);
  const [cursosAInscribir, setCursosAInscribir] = useState<any[]>([]);
  
  const [modoClase, setModoClase] = useState("existente");
  const [claseExistenteId, setClaseExistenteId] = useState("");
  
  const [addServicioId, setAddServicioId] = useState("");
  const [addModalidad, setAddModalidad] = useState("Individual"); // NUEVO: Selector de Modalidad
  const [addProfesor, setAddProfesor] = useState("");
  const [addDia, setAddDia] = useState("Lunes");
  const [addHora, setAddHora] = useState("");
  const [addClasesRestantes, setAddClasesRestantes] = useState(4);

  useEffect(() => { cargarDatos(); }, []);

  async function cargarDatos() {
    setIsLoading(true);
    const { data: leads } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
    if (leads) setProspectos(leads);
    
    const { data: profes } = await supabase.from("profesores").select("*").eq("estado", "Activo").order("nombre");
    if (profes) setProfesoresList(profes);
    
    const { data: dData } = await supabase.from("disciplinas").select("*").order("nombre");
    if (dData) setDisciplinas(dData);

    const { data: cData } = await supabase.from("clases").select("*, disciplinas(nombre), inscripciones(count)");
    if (cData) setClasesCatalogo(cData);

    const { data: cuentas } = await supabase.from("cuentas_familiares").select("*");
    if (cuentas) setCuentasExistentes(cuentas);

    const { data: conf } = await supabase.from("configuracion").select("*").eq("llave", "valor_matricula").single();
    if (conf) setValorMatriculaBase(conf.valor || 30000);
    
    setIsLoading(false);
  }

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
      await supabase.from("transacciones").insert([{ student_id: null, tipo_pago: "Ingreso Extra", metodo_pago: "Transferencia", mes_imputado: mesActualStr, monto: p.costo_prueba, detalle: `Pago clase de prueba - Prospecto: ${p.name}` }]);
      cargarDatos(); alert("¡Pago registrado con éxito!");
    } else alert("Error: " + errLead.message);
  }

  function abrirMatricula(p: any) {
    setProspectoSeleccionado(p); setCursosAInscribir([]); setDescuentoTotal(0); setCobrarMatricula(true); 
    setFechaInicio(new Date().toISOString().split('T')[0]);
    
    setCuentaSeleccionadaId(null); setBusquedaCuenta("");
    setTitularNombre(p.nombre_apoderado || p.name); 
    setTitularEmail(p.email); 
    setTitularTelefono(p.phone);
    setTitularRut("");

    setIsMatriculaModalOpen(true);
  }

  function seleccionarCuentaExistente(cuenta: any) {
    setCuentaSeleccionadaId(cuenta.id);
    setTitularNombre(cuenta.titular_nombre);
    setTitularRut(cuenta.titular_rut || "");
    setTitularEmail(cuenta.email_contacto);
    setTitularTelefono(cuenta.telefono || "");
    setBusquedaCuenta("");
  }

  function resetCuenta() {
    setCuentaSeleccionadaId(null);
    setTitularNombre(prospectoSeleccionado.nombre_apoderado || prospectoSeleccionado.name);
    setTitularEmail(prospectoSeleccionado.email);
    setTitularTelefono(prospectoSeleccionado.phone);
    setTitularRut("");
  }

  const isProfesorOcupado = () => {
    if (!addProfesor || !addDia || !addHora) return false;
    return clasesCatalogo.some(c => c.profesor === addProfesor && c.dia_semana === addDia && c.hora_inicio.startsWith(addHora));
  };

  function agregarCursoAlCarrito() {
    if (modoClase === "existente") {
      if (!claseExistenteId) return alert("Selecciona un grupo existente.");
      const claseSelect = clasesCatalogo.find(c => c.id === claseExistenteId);
      setCursosAInscribir([...cursosAInscribir, {
        id: Date.now(),
        tipo: 'existente',
        claseId: claseExistenteId,
        servicioNombre: claseSelect.disciplinas?.nombre,
        modalidad: claseSelect.modalidad,
        profesor: claseSelect.profesor,
        dia: claseSelect.dia_semana,
        hora: claseSelect.hora_inicio.substring(0,5),
        clasesRestantes: addClasesRestantes,
        precioBase: disciplinas.find(d => d.nombre === claseSelect.disciplinas?.nombre)?.precio_base || 82000
      }]);
      setClaseExistenteId("");
    } else {
      if (!addServicioId || !addModalidad || !addProfesor || !addHora) return alert("Faltan datos para crear la clase.");
      if (isProfesorOcupado()) return alert("El profesor ya tiene una clase asignada en ese horario.");

      const servicio = disciplinas.find(d => d.id === addServicioId);
      setCursosAInscribir([...cursosAInscribir, {
        id: Date.now(),
        tipo: 'nueva',
        disciplinaId: addServicioId,
        servicioNombre: servicio?.nombre,
        modalidad: addModalidad,
        profesor: addProfesor,
        dia: addDia,
        hora: addHora,
        clasesRestantes: addClasesRestantes,
        precioBase: servicio?.precio_base || 82000
      }]);
      setAddHora("");
    }
    setAddClasesRestantes(4);
  }

  function eliminarCursoDelCarrito(id: number) {
    setCursosAInscribir(cursosAInscribir.filter(c => c.id !== id));
  }

  const sumaMensualidadBase = cursosAInscribir.reduce((acc, c) => acc + c.precioBase, 0);
  const mensualidadFinal = Math.max(sumaMensualidadBase - descuentoTotal, 0);
  
  const sumaProrrateoBruto = Math.round(cursosAInscribir.reduce((acc, c) => acc + (c.precioBase / 4) * c.clasesRestantes, 0));
  const proporcionProrrateo = sumaMensualidadBase > 0 ? (sumaProrrateoBruto / sumaMensualidadBase) : 0;
  const montoProrrateoFinal = Math.round(proporcionProrrateo * mensualidadFinal);

  const montoIncorporacion = cobrarMatricula ? valorMatriculaBase : 0;
  const totalACobrarHoy = montoIncorporacion + montoProrrateoFinal;

  async function ejecutarMatricula() {
    if (cursosAInscribir.length === 0) return alert("Debes añadir al menos 1 curso.");
    if (!titularNombre || !titularEmail) return alert("Faltan datos del Titular.");
    setIsLoading(true);
    
    try {
      let cId = cuentaSeleccionadaId;
      if (!cId) {
        const { data: nC, error: errCuenta } = await supabase.from("cuentas_familiares").insert([{
          titular_nombre: titularNombre, titular_rut: titularRut || null, email_contacto: titularEmail, telefono: titularTelefono
        }]).select().single();
        if (errCuenta) throw errCuenta;
        cId = nC.id;
      } else {
        await supabase.from("cuentas_familiares").update({ titular_nombre: titularNombre, titular_rut: titularRut, telefono: titularTelefono }).eq("id", cId);
      }

      const { data: alumno, error: errorAlumno } = await supabase.from("students").insert([{
        cuenta_id: cId, name: prospectoSeleccionado.name, email: prospectoSeleccionado.email, phone: prospectoSeleccionado.phone,
        fecha_nacimiento: prospectoSeleccionado.fecha_nacimiento, fecha_ingreso: fechaInicio, precio_base: sumaMensualidadBase, 
        descuento_aplicado: descuentoTotal, mensualidad_final: mensualidadFinal, status: 'Activo'
      }]).select().single();

      if (errorAlumno) throw errorAlumno;

      for (const curso of cursosAInscribir) {
        let claseFinalId = curso.claseId;
        
        if (curso.tipo === 'nueva') {
          const mod = curso.modalidad || "Individual";
          let claseSala = mod === "Individual" 
            ? `Clase de ${prospectoSeleccionado.name}` 
            : `${curso.servicioNombre} ${curso.dia} ${curso.hora}`;

          const { data: nC } = await supabase.from("clases").insert([{
            disciplina_id: curso.disciplinaId, modalidad: mod, dia_semana: curso.dia,
            hora_inicio: curso.hora, profesor: curso.profesor, sala: claseSala,
            capacidad_max: mod === "Grupal" ? 6 : (mod === "Duo" ? 2 : 1)
          }]).select().single();
          claseFinalId = nC?.id;
        }

        if (claseFinalId) {
          await supabase.from("inscripciones").insert([{ student_id: alumno.id, clase_id: claseFinalId }]);
        }
      }

      const mesActualStr = new Date().toISOString().slice(0, 7);
      const transaccionesAInsertar = [];
      if (cobrarMatricula) transaccionesAInsertar.push({ student_id: alumno.id, tipo_pago: "Incorporación", metodo_pago: "Transferencia", mes_imputado: mesActualStr, monto: montoIncorporacion, detalle: "Pago Matrícula Inicial" });
      if (montoProrrateoFinal > 0) transaccionesAInsertar.push({ student_id: alumno.id, tipo_pago: "Proporcional 1er Mes", metodo_pago: "Transferencia", mes_imputado: mesActualStr, monto: montoProrrateoFinal, detalle: `Prorrateo Exacto de ${cursosAInscribir.length} cursos.` });
      
      if (transaccionesAInsertar.length > 0) await supabase.from("transacciones").insert(transaccionesAInsertar);
      
      await supabase.from("leads").update({ status: "Matriculado" }).eq("id", prospectoSeleccionado.id);
      
      setIsMatriculaModalOpen(false); 
      alert(`¡Matrícula Exitosa!\n\nAlumno: ${prospectoSeleccionado.name}\nTotal a cobrar hoy: $${totalACobrarHoy.toLocaleString('es-CL')}`); 
      cargarDatos();
    } catch (err: any) {
      alert("Error Crítico: " + err.message);
    }
    setIsLoading(false);
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
          <h1 className="text-3xl font-bold text-[#0B132D] tracking-tight">Embudo de Ventas</h1>
          <p className="text-[#64748B] mt-1 font-medium">Gestiona contactos y oficializa matrículas inteligentes.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-[#FC6827] text-white px-6 py-2.5 rounded-xl font-bold shadow-lg hover:-translate-y-0.5 transition-transform">
          + Nuevo Contacto
        </button>
      </div>

      <div className="saas-card overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-[11px] uppercase tracking-widest text-[#64748B] font-bold">
              <th className="p-5">Prospecto</th><th className="p-5">Clase de Prueba</th><th className="p-5">Estado</th><th className="p-5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {isLoading ? <tr><td colSpan={4} className="p-8 text-center text-[#64748B]">Cargando embudo...</td></tr> : 
             prospectos.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="p-5"><p className="font-bold text-[#0B132D] text-sm">{p.name}</p><p className="text-xs text-[#64748B] mt-0.5">{p.email}</p></td>
                <td className="p-5">
                  {p.status === "Nuevo Contacto" ? <span className="text-xs text-[#64748B] italic">Interés: {p.clase_interes || "-"}</span> : (
                    <div><p className="font-bold text-[#0466C8] text-sm">{p.clase_prueba_asignada}</p><p className="text-xs font-medium mt-0.5">📅 {p.fecha_prueba} a las {p.hora_prueba}</p></div>
                  )}
                </td>
                <td className="p-5"><span className="px-3 py-1.5 text-[11px] font-bold rounded-full bg-slate-100 text-slate-600 border border-slate-200">{p.status}</span></td>
                <td className="p-5 text-right space-x-2">
                  {p.status !== "Matriculado" && (
                    <div className="flex justify-end gap-2">
                      <button onClick={() => abrirAgendamiento(p)} className="text-[#0466C8] bg-blue-50 px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-100">📅 Prueba</button>
                      {p.status === "Prueba Agendada" && p.costo_prueba > 0 && !p.prueba_pagada && (
                        <button onClick={() => confirmarPago(p)} className="text-green-700 bg-green-50 px-4 py-2 rounded-xl text-xs font-bold border border-green-200">✅ Pagar</button>
                      )}
                      <button onClick={() => abrirMatricula(p)} className="text-white bg-[#0B132D] px-5 py-2 rounded-xl text-xs font-bold shadow-md hover:-translate-y-0.5">✨ Matricular</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isMatriculaModalOpen && (
        <div className="fixed inset-0 bg-[#0B132D]/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-[24px] shadow-2xl w-full max-w-5xl border-t-8 border-[#FC6827] max-h-[95vh] overflow-y-auto custom-scrollbar">
            
            <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-2xl font-bold text-[#0B132D]">Matrícula Oficial</h2>
                <p className="text-sm text-[#64748B] mt-1">Configura la cuenta y el catálogo de cursos para <span className="text-[#FC6827] font-bold">{prospectoSeleccionado?.name}</span></p>
              </div>
              <div className="text-right">
                <label className="block text-[10px] font-bold uppercase mb-1 text-slate-400">Fecha Ingreso</label>
                <input type="date" value={fechaInicio} onChange={e=>setFechaInicio(e.target.value)} className="border border-slate-200 p-2 rounded-lg text-sm font-bold text-[#0466C8] outline-none"/>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              <div className="space-y-6">
                
                <div className="bg-orange-50 p-6 rounded-2xl border border-orange-200 relative overflow-hidden">
                  <h3 className="text-xs font-black uppercase tracking-widest mb-4 text-[#FC6827]">1. Cuenta Titular de Pago</h3>
                  
                  {!cuentaSeleccionadaId && (
                    <div className="mb-4 relative">
                      <input 
                        type="text" placeholder="🔍 Buscar Apoderado Existente..." 
                        value={busquedaCuenta} onChange={e=>setBusquedaCuenta(e.target.value)}
                        className="w-full border border-orange-300 p-2.5 rounded-xl text-sm outline-none bg-white shadow-sm"
                      />
                      {busquedaCuenta && (
                        <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-xl mt-1 shadow-xl z-20 max-h-40 overflow-y-auto">
                          {cuentasExistentes.filter(c => c.titular_nombre?.toLowerCase().includes(busquedaCuenta.toLowerCase()) || c.email_contacto?.toLowerCase().includes(busquedaCuenta.toLowerCase())).map(c => (
                            <div key={c.id} onClick={() => seleccionarCuentaExistente(c)} className="p-3 border-b hover:bg-slate-50 cursor-pointer">
                              <p className="font-bold text-sm">{c.titular_nombre}</p>
                              <p className="text-[10px] text-slate-500">{c.email_contacto}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {cuentaSeleccionadaId && (
                    <div className="bg-white p-3 rounded-xl border border-orange-300 mb-4 flex justify-between items-center">
                      <div>
                        <span className="text-[10px] font-bold text-green-600 uppercase">Cuenta Vinculada</span>
                        <p className="font-bold text-sm text-[#0B132D]">{titularNombre}</p>
                      </div>
                      <button onClick={resetCuenta} className="text-[10px] text-slate-400 hover:text-red-500 underline font-bold">Cambiar / Nuevo</button>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 relative z-10">
                    <div className="col-span-2"><label className="block text-[10px] font-bold mb-1 text-slate-600">Nombre Titular</label><input type="text" value={titularNombre} onChange={e=>setTitularNombre(e.target.value)} className="w-full border border-orange-200 p-2.5 rounded-xl text-sm outline-none bg-white"/></div>
                    <div><label className="block text-[10px] font-bold mb-1 text-slate-600">RUT (Opcional)</label><input type="text" value={titularRut} onChange={e=>setTitularRut(e.target.value)} className="w-full border border-orange-200 p-2.5 rounded-xl text-sm outline-none bg-white"/></div>
                    <div><label className="block text-[10px] font-bold mb-1 text-slate-600">Teléfono</label><input type="text" value={titularTelefono} onChange={e=>setTitularTelefono(e.target.value)} className="w-full border border-orange-200 p-2.5 rounded-xl text-sm outline-none bg-white"/></div>
                    <div className="col-span-2"><label className="block text-[10px] font-bold mb-1 text-slate-600">Email Facturación</label><input type="email" value={titularEmail} onChange={e=>setTitularEmail(e.target.value)} className="w-full border border-orange-200 p-2.5 rounded-xl text-sm outline-none bg-white"/></div>
                  </div>
                </div>

                <div className="bg-[#0B132D] p-6 rounded-2xl text-white shadow-lg">
                  <h3 className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-4">2. Liquidación Financiera</h3>
                  
                  <div className="flex justify-between text-sm mb-2"><span className="text-slate-400">Suma Tarifas Base:</span><span>${sumaMensualidadBase.toLocaleString('es-CL')}</span></div>
                  <div className="flex justify-between items-center text-sm mb-4 pb-4 border-b border-white/10">
                    <span className="text-slate-400">Beca / Descuento Mensual:</span>
                    <input type="number" value={descuentoTotal} onChange={e=>setDescuentoTotal(Number(e.target.value))} className="w-24 bg-white/10 border border-white/20 text-white rounded-lg p-1 text-right outline-none focus:border-[#FC6827]" placeholder="$0"/>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-[#FC6827] mb-6"><span>MENSUALIDAD FIJA:</span><span className="text-xl">${mensualidadFinal.toLocaleString('es-CL')}</span></div>

                  <div className="bg-black/30 p-4 rounded-xl border border-white/5">
                    <p className="text-[10px] text-slate-400 uppercase font-bold mb-3 border-b border-white/10 pb-1">Cálculo de 1er Pago (Proporcional)</p>
                    <div className="flex justify-between items-center text-xs mb-2">
                      <span className="text-slate-400">Prorrateo Exacto ({cursosAInscribir.length} cursos):</span>
                      <span className="font-bold">${montoProrrateoFinal.toLocaleString('es-CL')}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs pb-3 border-b border-white/10">
                      <span className="text-slate-400">Cobro Incorporación:</span>
                      <div className="flex items-center gap-2"><input type="checkbox" checked={cobrarMatricula} onChange={(e)=>setCobrarMatricula(e.target.checked)} className="accent-[#FC6827]"/><span className={cobrarMatricula ? '' : 'line-through text-slate-500'}>${valorMatriculaBase.toLocaleString('es-CL')}</span></div>
                    </div>
                    <div className="flex justify-between items-end pt-2">
                      <span className="text-[10px] font-bold text-white uppercase tracking-widest">Total a pagar HOY</span>
                      <span className="font-black text-3xl text-green-400">${totalACobrarHoy.toLocaleString('es-CL')}</span>
                    </div>
                  </div>
                </div>

              </div>

              <div className="space-y-6">
                
                <div className="bg-blue-50 p-6 rounded-2xl border border-blue-200">
                  <h3 className="text-xs font-black uppercase tracking-widest mb-4 text-[#0466C8]">3. Asignación a Malla Logística</h3>
                  
                  <div className="flex bg-white rounded-lg p-1 border border-blue-100 mb-4">
                    <button onClick={() => setModoClase("existente")} className={`flex-1 py-1.5 text-xs font-bold rounded ${modoClase==='existente'?'bg-blue-100 text-[#0466C8]':'text-slate-500'}`}>Asignar a Grupo</button>
                    <button onClick={() => setModoClase("nueva")} className={`flex-1 py-1.5 text-xs font-bold rounded ${modoClase==='nueva'?'bg-blue-100 text-[#0466C8]':'text-slate-500'}`}>Crear Clase Nueva</button>
                  </div>

                  <div className="space-y-3">
                    {modoClase === "existente" ? (
                      <select value={claseExistenteId} onChange={e=>setClaseExistenteId(e.target.value)} className="w-full border border-blue-200 p-2.5 rounded-xl text-sm outline-none bg-white">
                        <option value="">Seleccionar grupo disponible...</option>
                        {clasesCatalogo.filter(c => c.modalidad !== "Individual" || c.inscripciones[0]?.count === 0).map(c => (
                          <option key={c.id} value={c.id}>{c.disciplinas?.nombre} ({c.modalidad}) - {c.dia_semana} {c.hora_inicio.substring(0,5)} | Prof: {c.profesor}</option>
                        ))}
                      </select>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <select value={addServicioId} onChange={e=>setAddServicioId(e.target.value)} className="col-span-2 border border-blue-200 p-2.5 rounded-xl text-sm font-bold outline-none bg-white">
                            <option value="">Seleccionar Disciplina...</option>
                            {disciplinas.map(d => <option key={d.id} value={d.id}>{d.nombre} (${d.precio_base?.toLocaleString('es-CL')})</option>)}
                          </select>
                          <select value={addModalidad} onChange={e=>setAddModalidad(e.target.value)} className="col-span-2 border border-blue-200 p-2.5 rounded-xl text-sm font-bold outline-none bg-white text-[#0B132D]">
                            <option value="Individual">Modalidad: Individual (1 cupo)</option>
                            <option value="Duo">Modalidad: Dúo (2 cupos)</option>
                            <option value="Grupal">Modalidad: Grupal (6 cupos)</option>
                          </select>
                          <select value={addDia} onChange={e=>setAddDia(e.target.value)} className="border border-blue-200 p-2.5 rounded-xl text-sm outline-none bg-white">{diasSemana.map(d=><option key={d} value={d}>{d}</option>)}</select>
                          <select value={addHora} onChange={e=>setAddHora(e.target.value)} className="border border-blue-200 p-2.5 rounded-xl text-sm outline-none bg-white"><option value="">Hora (24h)</option>{generarOpcionesHora()}</select>
                          <select value={addProfesor} onChange={e=>setAddProfesor(e.target.value)} className="col-span-2 border border-blue-200 p-2.5 rounded-xl text-sm outline-none bg-white">
                            <option value="">Asignar Profesor...</option>
                            {profesoresList.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
                          </select>
                        </div>
                        {isProfesorOcupado() && <p className="text-[10px] text-red-500 font-bold mt-1 uppercase">⚠️ Profesor ya tiene clase en este bloque.</p>}
                      </>
                    )}
                    
                    <div className="flex gap-2 items-center mt-2 border-t border-blue-100 pt-3">
                      <label className="text-[10px] font-bold uppercase text-slate-500 w-1/2">¿Cuántas clases quedan este mes?</label>
                      <select value={addClasesRestantes} onChange={e=>setAddClasesRestantes(Number(e.target.value))} className="w-1/2 border border-blue-200 p-2 rounded-xl text-sm outline-none font-bold bg-white text-center">
                        <option value={4}>4 Clases</option><option value={3}>Quedan 3</option><option value={2}>Quedan 2</option><option value={1}>Queda 1</option>
                      </select>
                    </div>

                    <button onClick={agregarCursoAlCarrito} disabled={modoClase === "nueva" && isProfesorOcupado()} className="w-full mt-2 bg-[#0466C8] text-white py-2.5 rounded-xl text-xs font-bold shadow-md hover:-translate-y-0.5 transition-transform disabled:opacity-50 disabled:cursor-not-allowed">
                      + Añadir al Carrito
                    </button>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200">
                  <h3 className="text-[10px] font-black uppercase tracking-widest mb-3 text-slate-500 border-b pb-2">Cursos a Inscribir ({cursosAInscribir.length})</h3>
                  {cursosAInscribir.length === 0 ? <p className="text-xs text-slate-400 text-center py-4 italic">No has añadido cursos.</p> : (
                    <div className="space-y-2">
                      {cursosAInscribir.map(c => (
                        <div key={c.id} className="flex justify-between items-center bg-slate-50 border border-slate-100 p-3 rounded-xl">
                          <div>
                            <p className="font-bold text-sm text-[#0B132D]">{c.servicioNombre} <span className="text-[9px] uppercase bg-slate-200 text-slate-500 px-1 rounded ml-1">{c.modalidad}</span></p>
                            <p className="text-[10px] font-bold text-[#0466C8]">{c.dia} {c.hora} | Prof: {c.profesor}</p>
                            <p className="text-[10px] text-slate-500">Prorrateo: {c.clasesRestantes}/4 clases</p>
                          </div>
                          <button onClick={() => eliminarCursoDelCarrito(c.id)} className="text-red-500 bg-red-50 w-8 h-8 rounded-full font-bold hover:scale-110 transition-transform flex items-center justify-center">×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button onClick={()=>setIsMatriculaModalOpen(false)} className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl">Cancelar</button>
                  <button onClick={ejecutarMatricula} disabled={isLoading || cursosAInscribir.length === 0} className="bg-[#FC6827] text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-[#FC6827]/20 hover:-translate-y-0.5 transition-transform disabled:opacity-50">
                    {isLoading ? "Oficializando..." : "Oficializar Matrícula"}
                  </button>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-[#0B132D]/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-[24px] w-full max-w-md border-t-8 border-[#0466C8]">
            <h2 className="text-2xl font-bold mb-6">Nuevo Prospecto</h2>
            <div className="space-y-4">
              <input placeholder="Nombre Alumno *" value={nombre} onChange={e=>setNombre(e.target.value)} className="w-full border p-3 rounded-xl text-sm outline-none"/>
              <input type="date" value={fechaNac} onChange={e=>setFechaNac(e.target.value)} className="w-full border p-3 rounded-xl text-sm outline-none"/>
              <input placeholder="Apoderado (Opcional)" value={apoderado} onChange={e=>setApoderado(e.target.value)} className="w-full border p-3 rounded-xl text-sm outline-none"/>
              <input placeholder="Email *" value={email} onChange={e=>setEmail(e.target.value)} className="w-full border p-3 rounded-xl text-sm outline-none"/>
              <input placeholder="Teléfono" value={telefono} onChange={e=>setTelefono(e.target.value)} className="w-full border p-3 rounded-xl text-sm outline-none"/>
              <select value={interes} onChange={e=>setInteres(e.target.value)} className="w-full border p-3 rounded-xl text-sm outline-none">
                <option value="">Clase de Interés...</option>
                {cursosDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="flex justify-end gap-3 mt-4"><button onClick={()=>setIsModalOpen(false)} className="text-slate-500 font-bold">Cancelar</button><button onClick={guardarProspecto} className="bg-[#0466C8] text-white px-6 py-2 rounded-xl font-bold">Guardar</button></div>
            </div>
          </div>
        </div>
      )}
      
      {isAgendaModalOpen && (
        <div className="fixed inset-0 bg-[#0B132D]/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-[24px] shadow-2xl w-full max-w-md border-t-8 border-[#0466C8]">
            <h2 className="text-xl font-bold mb-1">Agendar Clase de Prueba</h2>
            <p className="text-sm text-[#64748B] mb-6">Prospecto: {prospectoSeleccionado?.name}</p>
            <div className="space-y-4">
              <select value={clasePrueba} onChange={e => setClasePrueba(e.target.value)} className="w-full border p-3 rounded-xl text-sm outline-none"><option value="">Seleccionar Clase...</option>{cursosDisponibles.map(c => <option key={c} value={c}>{c}</option>)}</select>
              <div className="flex gap-3">
                <input type="date" value={fechaPrueba} onChange={e => setFechaPrueba(e.target.value)} className="w-1/2 border p-3 rounded-xl text-sm outline-none"/>
                <select value={horaPrueba} onChange={e => setHoraPrueba(e.target.value)} className="w-1/2 border p-3 rounded-xl text-sm outline-none"><option value="">Hora</option>{generarOpcionesHora()}</select>
              </div>
              <select value={profesorPrueba} onChange={e => setProfesorPrueba(e.target.value)} className="w-full border p-3 rounded-xl text-sm outline-none"><option value="">Seleccionar Profesor...</option>{profesoresList.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}</select>
              <input type="number" value={costoPrueba} onChange={e => setCostoPrueba(Number(e.target.value))} className="w-full border p-3 rounded-xl text-sm outline-none" placeholder="Costo Prueba ($)"/>
              <div className="flex justify-end gap-3 pt-4"><button onClick={() => setIsAgendaModalOpen(false)} className="px-5 py-2 text-slate-500 font-bold">Cancelar</button><button onClick={confirmarAgendaPrueba} className="bg-[#0466C8] text-white px-6 py-2 rounded-xl font-bold">Agendar</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}