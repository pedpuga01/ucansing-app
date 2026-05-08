"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ConfiguracionPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [tabActiva, setTabActiva] = useState("profesores"); // profesores, servicios, sistema

  // Datos
  const [profesores, setProfesores] = useState<any[]>([]);
  const [disciplinas, setDisciplinas] = useState<any[]>([]);
  const [configGlobal, setConfigGlobal] = useState<any[]>([]);

  // Modales
  const [isProfesorModalOpen, setIsProfesorModalOpen] = useState(false);
  const [isDisciplinaModalOpen, setIsDisciplinaModalOpen] = useState(false);
  const [itemEditando, setItemEditando] = useState<any>(null);

  // Formularios
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setIsLoading(true);

    const { data: profes } = await supabase.from("profesores").select("*").order("nombre");
    if (profes) setProfesores(profes);

    const { data: dData } = await supabase.from("disciplinas").select("*").order("nombre");
    if (dData) setDisciplinas(dData);

    const { data: conf } = await supabase.from("configuracion").select("*").order("llave");
    if (conf) setConfigGlobal(conf);

    setIsLoading(false);
  }

  // --- GESTIÓN DE PROFESORES ---
  function abrirModalProfesor(profesor = null) {
    setItemEditando(profesor);
    if (profesor) {
      setFormData(profesor);
    } else {
      setFormData({ nombre: "", email_profesor: "", rut: "", pin_seguridad: "", tarifa_individual: 15000, tarifa_duo: 17000, tarifa_grupal: 20000, estado: "Activo" });
    }
    setIsProfesorModalOpen(true);
  }

  async function guardarProfesor() {
    if (!formData.nombre) return alert("El nombre es obligatorio");

    if (itemEditando) {
      await supabase.from("profesores").update(formData).eq("id", itemEditando.id);
    } else {
      await supabase.from("profesores").insert([formData]);
    }
    setIsProfesorModalOpen(false);
    cargarDatos();
  }

  // --- GESTIÓN DE SERVICIOS (DISCIPLINAS) ---
  function abrirModalDisciplina(disciplina = null) {
    setItemEditando(disciplina);
    if (disciplina) {
      setFormData(disciplina);
    } else {
      setFormData({ nombre: "", precio_base: 82000, estado: "Activo" });
    }
    setIsDisciplinaModalOpen(true);
  }

  async function guardarDisciplina() {
    if (!formData.nombre) return alert("El nombre es obligatorio");

    if (itemEditando) {
      await supabase.from("disciplinas").update(formData).eq("id", itemEditando.id);
    } else {
      await supabase.from("disciplinas").insert([formData]);
    }
    setIsDisciplinaModalOpen(false);
    cargarDatos();
  }

  // --- GESTIÓN SISTEMA ---
  async function actualizarVariableGlobal(llave: string, nuevoValor: number) {
    const { error } = await supabase.from("configuracion").upsert([{ llave, valor: nuevoValor }]);
    if (!error) cargarDatos();
  }

  const formatearDinero = (cantidad: number) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(cantidad || 0);
  };

  return (
    <div className="p-10 space-y-8 min-h-screen">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0B132D] tracking-tight" style={{fontFamily: 'var(--font-poppins)'}}>
            Configuración Maestra
          </h1>
          <p className="text-[#64748B] mt-1 font-medium">Administra el talento, los precios y las reglas de negocio.</p>
        </div>
      </div>

      {/* PESTAÑAS DE NAVEGACIÓN */}
      <div className="flex space-x-2 bg-slate-200/50 p-1 rounded-xl w-max">
        <button 
          onClick={() => setTabActiva("profesores")} 
          className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${tabActiva === 'profesores' ? 'bg-white text-[#0466C8] shadow-sm' : 'text-slate-500 hover:text-[#0B132D]'}`}
        >
          Staff y Nómina
        </button>
        <button 
          onClick={() => setTabActiva("servicios")} 
          className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${tabActiva === 'servicios' ? 'bg-white text-[#FC6827] shadow-sm' : 'text-slate-500 hover:text-[#0B132D]'}`}
        >
          Servicios y Precios
        </button>
        <button 
          onClick={() => setTabActiva("sistema")} 
          className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${tabActiva === 'sistema' ? 'bg-white text-[#0B132D] shadow-sm' : 'text-slate-500 hover:text-[#0B132D]'}`}
        >
          Reglas del Sistema
        </button>
      </div>

      {/* CONTENIDO DE PESTAÑAS */}
      <div className="bg-white saas-card overflow-hidden min-h-[500px]">
        
        {/* TAB: PROFESORES */}
        {tabActiva === "profesores" && (
          <div>
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-lg font-bold text-[#0B132D]" style={{fontFamily: 'var(--font-poppins)'}}>Directorio de Profesores</h2>
                <p className="text-xs text-[#64748B]">Gestiona sus accesos, correos de Calendar y tarifas de pago.</p>
              </div>
              <button onClick={() => abrirModalProfesor(null)} className="bg-[#0466C8] text-white px-5 py-2 rounded-xl font-bold text-sm shadow-md hover:-translate-y-0.5 transition-transform">+ Nuevo Profesor</button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] uppercase tracking-widest text-[#64748B] font-bold bg-white">
                    <th className="px-6 py-4">Profesor / Contacto</th>
                    <th className="px-6 py-4 text-center">Tarifa Indiv.</th>
                    <th className="px-6 py-4 text-center">Tarifa Dúo</th>
                    <th className="px-6 py-4 text-center">Tarifa Grupal</th>
                    <th className="px-6 py-4 text-center">Seguridad</th>
                    <th className="px-6 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {isLoading ? <tr><td colSpan={6} className="p-8 text-center text-slate-400">Cargando...</td></tr> : 
                   profesores.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4">
                        <p className="font-bold text-[#0B132D] text-sm">{p.nombre}</p>
                        <p className="text-[11px] text-[#0466C8] font-medium">{p.email_profesor || "Sin correo (Calendar Inactivo)"}</p>
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-slate-700 text-sm">{formatearDinero(p.tarifa_individual)}</td>
                      <td className="px-6 py-4 text-center font-bold text-slate-700 text-sm">{formatearDinero(p.tarifa_duo)}</td>
                      <td className="px-6 py-4 text-center font-bold text-slate-700 text-sm">{formatearDinero(p.tarifa_grupal)}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="bg-slate-100 text-slate-500 font-mono text-[10px] px-2 py-1 rounded border border-slate-200 tracking-widest">
                          PIN: {p.pin_seguridad || "****"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => abrirModalProfesor(p)} className="text-[#0466C8] bg-blue-50 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors">Editar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: SERVICIOS */}
        {tabActiva === "servicios" && (
          <div>
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-lg font-bold text-[#0B132D]" style={{fontFamily: 'var(--font-poppins)'}}>Catálogo de Servicios</h2>
                <p className="text-xs text-[#64748B]">Disciplinas y precios sugeridos para nuevas matrículas.</p>
              </div>
              <button onClick={() => abrirModalDisciplina(null)} className="bg-[#FC6827] text-white px-5 py-2 rounded-xl font-bold text-sm shadow-md hover:-translate-y-0.5 transition-transform">+ Nuevo Servicio</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
              {disciplinas.map(d => (
                <div key={d.id} className="border border-slate-200 rounded-2xl p-5 hover:border-[#FC6827] transition-colors bg-white shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-slate-50 rounded-bl-full -mr-4 -mt-4 transition-colors group-hover:bg-orange-50"></div>
                  <div className="relative z-10">
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${d.estado === 'Activo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {d.estado}
                    </span>
                    <h3 className="font-bold text-xl text-[#0B132D] mt-3 mb-1" style={{fontFamily: 'var(--font-poppins)'}}>{d.nombre}</h3>
                    <p className="text-[10px] text-[#64748B] uppercase tracking-widest font-bold mb-1">Precio Base Matrícula</p>
                    <p className="text-2xl font-black text-[#FC6827]">{formatearDinero(d.precio_base)}</p>
                    <button onClick={() => abrirModalDisciplina(d)} className="mt-4 w-full bg-slate-100 text-slate-600 py-2 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors">Configurar Servicio</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: SISTEMA */}
        {tabActiva === "sistema" && (
          <div className="p-8">
            <h2 className="text-xl font-bold text-[#0B132D] mb-6" style={{fontFamily: 'var(--font-poppins)'}}>Reglas Globales del Sistema</h2>
            
            <div className="max-w-2xl space-y-6">
              {configGlobal.map(c => (
                <div key={c.llave} className="flex justify-between items-center p-5 bg-slate-50 border border-slate-200 rounded-2xl">
                  <div>
                    <h3 className="font-bold text-[#0B132D] text-sm uppercase tracking-wider">{c.llave.replace(/_/g, ' ')}</h3>
                    <p className="text-xs text-[#64748B] mt-1">
                      {c.llave === 'valor_matricula' ? 'Costo por defecto cobrado como Incorporación.' : 'Variable global utilizada en el Motor SaaS.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 font-bold">$</span>
                    <input 
                      type="number" 
                      value={c.valor}
                      onChange={(e) => {
                        const newConfig = [...configGlobal];
                        const index = newConfig.findIndex(item => item.llave === c.llave);
                        newConfig[index].valor = Number(e.target.value);
                        setConfigGlobal(newConfig);
                      }}
                      onBlur={(e) => actualizarVariableGlobal(c.llave, Number(e.target.value))}
                      className="border border-slate-300 rounded-xl px-4 py-2 w-32 outline-none focus:border-[#0B132D] text-center font-bold text-[#0B132D]"
                    />
                  </div>
                </div>
              ))}

              {/* Módulo Especial de Recuperaciones (Próximamente) */}
              <div className="p-5 bg-blue-50 border border-blue-200 rounded-2xl opacity-70">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-[#0466C8] text-sm uppercase tracking-wider">Bolsa de Recuperaciones</h3>
                    <p className="text-xs text-blue-600 mt-1">Automatiza los saldos de clases para justificaciones {'>'} 24hrs.</p>
                  </div>
                  <span className="bg-blue-100 text-[#0466C8] px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">En Desarrollo</span>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>

      {/* MODAL PROFESOR */}
      {isProfesorModalOpen && (
        <div className="fixed inset-0 bg-[#0B132D]/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
          <div className="bg-white p-8 rounded-[24px] shadow-2xl w-full max-w-xl border-t-8 border-[#0466C8]">
            <h2 className="text-xl font-bold mb-6 text-[#0B132D]" style={{fontFamily: 'var(--font-poppins)'}}>{itemEditando ? "Editar" : "Nuevo"} Profesor</h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#64748B] uppercase mb-1">Nombre Completo *</label>
                  <input type="text" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-[#0466C8]"/>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#64748B] uppercase mb-1">RUT</label>
                  <input type="text" value={formData.rut} onChange={e => setFormData({...formData, rut: e.target.value})} className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-[#0466C8]" placeholder="12.345.678-9"/>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#0466C8] uppercase mb-1">Email Google Calendar</label>
                  <input type="email" value={formData.email_profesor} onChange={e => setFormData({...formData, email_profesor: e.target.value})} className="w-full border border-blue-200 bg-blue-50 p-3 rounded-xl text-sm outline-none focus:border-[#0466C8]"/>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#D20505] uppercase mb-1">PIN Login App</label>
                  <input type="text" value={formData.pin_seguridad} onChange={e => setFormData({...formData, pin_seguridad: e.target.value})} className="w-full border border-red-200 bg-red-50 p-3 rounded-xl text-sm outline-none focus:border-[#D20505] font-mono tracking-widest" maxLength={4} placeholder="Ej: 1165"/>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-4">
                <h3 className="text-[10px] font-black text-[#0B132D] uppercase tracking-widest mb-3 border-b border-slate-200 pb-2">Tarifas de Nómina (Por Clase)</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-[#64748B] mb-1">Clase Individual</label>
                    <input type="number" value={formData.tarifa_individual} onChange={e => setFormData({...formData, tarifa_individual: Number(e.target.value)})} className="w-full border border-slate-200 p-2 rounded-lg text-sm font-bold text-center outline-none focus:border-[#0466C8]"/>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#64748B] mb-1">Clase Dúo</label>
                    <input type="number" value={formData.tarifa_duo} onChange={e => setFormData({...formData, tarifa_duo: Number(e.target.value)})} className="w-full border border-slate-200 p-2 rounded-lg text-sm font-bold text-center outline-none focus:border-[#0466C8]"/>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#64748B] mb-1">Clase Grupal</label>
                    <input type="number" value={formData.tarifa_grupal} onChange={e => setFormData({...formData, tarifa_grupal: Number(e.target.value)})} className="w-full border border-slate-200 p-2 rounded-lg text-sm font-bold text-center outline-none focus:border-[#0466C8]"/>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 mt-2">
                <button onClick={() => setIsProfesorModalOpen(false)} className="px-5 py-2 text-slate-500 font-bold hover:bg-slate-50 rounded-xl">Cancelar</button>
                <button onClick={guardarProfesor} className="bg-[#0466C8] text-white px-8 py-2.5 rounded-xl font-bold shadow-lg hover:-translate-y-0.5 transition-transform">Guardar Cambios</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SERVICIO (DISCIPLINA) */}
      {isDisciplinaModalOpen && (
        <div className="fixed inset-0 bg-[#0B132D]/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
          <div className="bg-white p-8 rounded-[24px] shadow-2xl w-full max-w-sm border-t-8 border-[#FC6827]">
            <h2 className="text-xl font-bold mb-6 text-[#0B132D]" style={{fontFamily: 'var(--font-poppins)'}}>{itemEditando ? "Editar" : "Nuevo"} Servicio</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase mb-1">Nombre (Ej: Canto, Piano)</label>
                <input type="text" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-[#FC6827] font-bold"/>
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase mb-1">Precio Base Referencial</label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-[#FC6827] font-bold">$</span>
                  <input type="number" value={formData.precio_base} onChange={e => setFormData({...formData, precio_base: Number(e.target.value)})} className="w-full border border-orange-200 bg-orange-50 p-3 pl-8 rounded-xl text-lg font-black text-[#FC6827] outline-none focus:border-[#FC6827]"/>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase mb-1">Estado</label>
                <select value={formData.estado} onChange={e => setFormData({...formData, estado: e.target.value})} className="w-full border border-slate-200 p-3 rounded-xl text-sm font-bold outline-none cursor-pointer">
                  <option value="Activo">Activo (Visible en Matrícula)</option>
                  <option value="Inactivo">Inactivo (Oculto)</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-6">
                <button onClick={() => setIsDisciplinaModalOpen(false)} className="px-5 py-2 text-slate-500 font-bold hover:bg-slate-50 rounded-xl">Cancelar</button>
                <button onClick={guardarDisciplina} className="bg-[#FC6827] text-white px-6 py-2.5 rounded-xl font-bold shadow-lg hover:-translate-y-0.5 transition-transform">Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}