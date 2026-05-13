"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const COLUMNAS_KANBAN = [
  { id: 'NUEVO', titulo: 'Nuevos Leads', color: 'border-blue-500', bg: 'bg-blue-50' },
  { id: 'PRUEBA_AGENDADA', titulo: 'Prueba Agendada', color: 'border-orange-500', bg: 'bg-orange-50' },
  { id: 'EVALUADO', titulo: 'Evaluados (En seguimiento)', color: 'border-purple-500', bg: 'bg-purple-50' },
  { id: 'CONVERTIDO', titulo: 'Matriculados 🎉', color: 'border-green-500', bg: 'bg-green-50' }
];

const CODIGOS_PAISES = [
  { code: '+56', flag: '🇨🇱', name: 'Chile' },
  { code: '+54', flag: '🇦🇷', name: 'Argentina' },
  { code: '+51', flag: '🇵🇪', name: 'Perú' },
  { code: '+57', flag: '🇨🇴', name: 'Colombia' },
  { code: '+52', flag: '🇲🇽', name: 'México' },
];

export default function ProspectosPage() {
  const [prospectos, setProspectos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal Nuevo Lead (Captura Inicial)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [codigoPais, setCodigoPais] = useState("+56");
  const [nuevoLead, setNuevoLead] = useState({ 
    nombre: "", nombre_apoderado: "", fecha_nacimiento: "", email: "", telefono: "", curso_interes: "" 
  });

  // Modal de Matrícula (Cierre)
  const [isMatriculaModalOpen, setIsMatriculaModalOpen] = useState(false);
  const [prospectoAMatricular, setProspectoAMatricular] = useState<any>(null);
  const [datosMatricula, setDatosMatricula] = useState({
    rut_alumno: "", rut_apoderado: "", direccion: ""
  });

  useEffect(() => {
    cargarProspectos();
  }, []);

  async function cargarProspectos() {
    setLoading(true);
    const { data, error } = await supabase
      .from("prospectos")
      .select("*")
      .neq("estado", "INACTIVO")
      .order("fecha_registro", { ascending: false });

    if (error) console.error("Error cargando prospectos:", error);
    else setProspectos(data || []);
    setLoading(false);
  }

  // =========================================================================
  // CREACIÓN DE PROSPECTO (CAPTURA INICIAL)
  // =========================================================================
  async function crearProspecto(e: React.FormEvent) {
    e.preventDefault();
    let { data: academia } = await supabase.from("academias").select("id").limit(1).single();

    const telefonoCompleto = `${codigoPais} ${nuevoLead.telefono}`;

    const { error } = await supabase.from("prospectos").insert([{
      academia_id: academia?.id,
      nombre: nuevoLead.nombre,
      nombre_apoderado: nuevoLead.nombre_apoderado || null,
      fecha_nacimiento: nuevoLead.fecha_nacimiento || null,
      email: nuevoLead.email,
      telefono: telefonoCompleto,
      curso_interes: nuevoLead.curso_interes,
      estado: 'NUEVO'
    }]);

    if (error) alert("Error: " + error.message);
    else {
      setIsModalOpen(false);
      setNuevoLead({ nombre: "", nombre_apoderado: "", fecha_nacimiento: "", email: "", telefono: "", curso_interes: "" });
      cargarProspectos();
    }
  }

  // =========================================================================
  // MOTOR KANBAN: CAMBIOS DE ESTADO
  // =========================================================================
  async function cambiarEstado(prospecto: any, nuevoEstado: string) {
    // Si intenta matricular, interceptamos y pedimos los datos faltantes
    if (nuevoEstado === 'CONVERTIDO') {
      setProspectoAMatricular(prospecto);
      setDatosMatricula({ rut_alumno: "", rut_apoderado: "", direccion: "" });
      setIsMatriculaModalOpen(true);
      return;
    }

    // Actualizamos UI y DB para estados intermedios
    setProspectos(prev => prev.map(p => p.id === prospecto.id ? { ...p, estado: nuevoEstado } : p));
    const { error } = await supabase.from("prospectos").update({ estado: nuevoEstado }).eq("id", prospecto.id);
    
    if (error) {
      alert("Error al actualizar: " + error.message);
      cargarProspectos(); 
    }
  }

  // =========================================================================
  // CIERRE DE MATRÍCULA Y DISPARO DE AUTOMATIZACIÓN
  // =========================================================================
  async function confirmarMatricula(e: React.FormEvent) {
    e.preventDefault();
    if (!prospectoAMatricular) return;

    // Actualizamos los datos DUROS + pasamos a CONVERTIDO
    // Esto disparará el Trigger en PostgreSQL automáticamente
    const { error } = await supabase
      .from("prospectos")
      .update({
        estado: 'CONVERTIDO',
        rut_alumno: datosMatricula.rut_alumno,
        rut_apoderado: datosMatricula.rut_apoderado,
        direccion: datosMatricula.direccion
      })
      .eq("id", prospectoAMatricular.id);

    if (error) {
      alert("Error procesando matrícula: " + error.message);
    } else {
      alert("🎉 ¡Matrícula exitosa! Cuenta Familiar y Alumno creados en el sistema.");
      setIsMatriculaModalOpen(false);
      cargarProspectos();
      // NOTA FUTURA: Aquí conectaremos el envío de correo de Términos y Condiciones
    }
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#0B132D]" style={{fontFamily: 'var(--font-poppins)'}}>Embudo de Ventas (CRM)</h1>
          <p className="text-[#64748B]">Gestiona el ciclo de vida antes de la matrícula.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-[#0466C8] text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-200"
        >
          + Nuevo Prospecto
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0466C8]"></div></div>
      ) : (
        <div className="flex gap-6 overflow-x-auto pb-4 custom-scrollbar">
          {COLUMNAS_KANBAN.map(col => (
            <div key={col.id} className={`min-w-[320px] max-w-[320px] bg-slate-100/50 rounded-2xl border-t-4 ${col.color} flex flex-col`}>
              <div className={`p-4 ${col.bg} rounded-t-xl border-b border-slate-200 flex justify-between items-center`}>
                <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wider">{col.titulo}</h3>
                <span className="bg-white text-slate-600 text-xs font-bold px-2 py-1 rounded-full shadow-sm">
                  {prospectos.filter(p => p.estado === col.id).length}
                </span>
              </div>
              
              <div className="p-4 flex-1 space-y-4 overflow-y-auto max-h-[65vh] custom-scrollbar">
                {prospectos.filter(p => p.estado === col.id).map(p => (
                  <div key={p.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-[#0466C8] transition group relative">
                    <h4 className="font-bold text-[#0B132D] text-sm mb-1">{p.nombre}</h4>
                    {p.nombre_apoderado && <p className="text-[10px] text-[#64748B] font-bold uppercase mb-2">Resp: {p.nombre_apoderado}</p>}
                    <p className="text-xs text-[#64748B] mb-1">📧 {p.email}</p>
                    <p className="text-xs text-[#64748B] mb-3">📱 {p.telefono}</p>
                    
                    <div className="bg-slate-50 text-[10px] text-slate-500 px-2 py-1 rounded-md uppercase font-bold inline-block mb-4 border border-slate-100">
                      {p.curso_interes || 'Curso sin definir'}
                    </div>

                    <div className="flex gap-2 mt-auto pt-3 border-t border-slate-100">
                      {col.id !== 'PRUEBA_AGENDADA' && col.id !== 'CONVERTIDO' && (
                        <button onClick={() => cambiarEstado(p, 'PRUEBA_AGENDADA')} className="flex-1 bg-orange-50 text-orange-600 text-[10px] font-bold py-1.5 rounded-lg hover:bg-orange-100">Agendar Prueba</button>
                      )}
                      {col.id === 'PRUEBA_AGENDADA' && (
                        <button onClick={() => cambiarEstado(p, 'EVALUADO')} className="flex-1 bg-purple-50 text-purple-600 text-[10px] font-bold py-1.5 rounded-lg hover:bg-purple-100">Marcar Evaluado</button>
                      )}
                      {col.id !== 'CONVERTIDO' && (
                        <button onClick={() => cambiarEstado(p, 'CONVERTIDO')} className="flex-1 bg-green-50 text-green-600 text-[10px] font-bold py-1.5 rounded-lg hover:bg-green-100 transition-colors border border-green-200">Matricular</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL 1: CAPTURA INICIAL (NUEVO LEAD) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#0B132D]/40 flex items-center justify-center z-50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white p-8 rounded-[24px] shadow-2xl w-full max-w-lg my-8">
            <h2 className="text-2xl font-bold text-[#0B132D] mb-1">Nuevo Prospecto</h2>
            <p className="text-sm text-[#64748B] mb-6 font-medium">Información preliminar para agendar pruebas.</p>
            
            <form onSubmit={crearProspecto} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#64748B] uppercase mb-1">Nombre Alumno *</label>
                <input required type="text" value={nuevoLead.nombre} onChange={e => setNuevoLead({...nuevoLead, nombre: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-[#0466C8] font-medium" placeholder="Ej: Valentina Puga"/>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#64748B] uppercase mb-1">Fecha Nacimiento</label>
                  <input type="date" value={nuevoLead.fecha_nacimiento} onChange={e => setNuevoLead({...nuevoLead, fecha_nacimiento: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-[#0466C8] text-sm"/>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#64748B] uppercase mb-1">Apoderado (Si es menor de edad)</label>
                  <input type="text" value={nuevoLead.nombre_apoderado} onChange={e => setNuevoLead({...nuevoLead, nombre_apoderado: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-[#0466C8] text-sm" placeholder="Opcional"/>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#64748B] uppercase mb-1">Correo Electrónico (Contacto) *</label>
                <input required type="email" value={nuevoLead.email} onChange={e => setNuevoLead({...nuevoLead, email: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-[#0466C8]" placeholder="correo@ejemplo.com"/>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#64748B] uppercase mb-1">Teléfono</label>
                <div className="flex gap-2">
                  <select value={codigoPais} onChange={e => setCodigoPais(e.target.value)} className="p-3 border border-slate-200 rounded-xl outline-none focus:border-[#0466C8] bg-slate-50 w-32">
                    {CODIGOS_PAISES.map(pais => (
                      <option key={pais.code} value={pais.code}>{pais.flag} {pais.code}</option>
                    ))}
                  </select>
                  <input type="text" value={nuevoLead.telefono} onChange={e => setNuevoLead({...nuevoLead, telefono: e.target.value})} className="flex-1 p-3 border border-slate-200 rounded-xl outline-none focus:border-[#0466C8]" placeholder="9 1234 5678"/>
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-[#64748B] uppercase mb-1">Curso de Interés</label>
                <input type="text" placeholder="Ej: Canto Grupal" value={nuevoLead.curso_interes} onChange={e => setNuevoLead({...nuevoLead, curso_interes: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-[#0466C8]" />
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 bg-slate-100 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-200 transition">Cancelar</button>
                <button type="submit" className="flex-1 bg-[#0466C8] text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition">Guardar Prospecto</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CIERRE DE MATRÍCULA (RUTS Y DIRECCIÓN) */}
      {isMatriculaModalOpen && prospectoAMatricular && (
        <div className="fixed inset-0 bg-green-900/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white p-8 rounded-[24px] shadow-2xl w-full max-w-lg border-t-8 border-green-500 my-8">
            <h2 className="text-2xl font-bold text-green-700 mb-1">Completar Matrícula</h2>
            <p className="text-sm text-[#64748B] mb-6 font-medium">Requerido para generar contrato e iniciar cobranza.</p>
            
            <form onSubmit={confirmarMatricula} className="space-y-5">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-2">
                <p className="text-sm font-bold text-[#0B132D]">{prospectoAMatricular.nombre}</p>
                <p className="text-xs text-[#64748B]">{prospectoAMatricular.email}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#64748B] uppercase mb-1">RUT Alumno *</label>
                  <input required type="text" value={datosMatricula.rut_alumno} onChange={e => setDatosMatricula({...datosMatricula, rut_alumno: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-green-500" placeholder="12.345.678-9"/>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#64748B] uppercase mb-1">RUT Apoderado (Si aplica)</label>
                  <input type="text" value={datosMatricula.rut_apoderado} onChange={e => setDatosMatricula({...datosMatricula, rut_apoderado: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-green-500" placeholder="Si es menor de edad"/>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#64748B] uppercase mb-1">Dirección / Domicilio *</label>
                <textarea required rows={2} value={datosMatricula.direccion} onChange={e => setDatosMatricula({...datosMatricula, direccion: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-green-500 resize-none" placeholder="Av. Siempre Viva 123, Comuna"/>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsMatriculaModalOpen(false)} className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition">Atrás</button>
                <button type="submit" className="flex-1 bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition shadow-lg shadow-green-200">Confirmar y Matricular</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}