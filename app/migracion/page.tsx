"use client";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function MigracionPage() {
  const [tipoMigracion, setTipoMigracion] = useState("alumnos");
  const [archivoBase, setArchivoBase] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [progreso, setProgreso] = useState({ actual: 0, total: 0 });

  function agregarLog(mensaje: string) { setLogs(prev => [mensaje, ...prev]); }

  const limpiarDinero = (val: string) => val ? Number(val.toString().replace(/[^0-9]/g, '')) || 0 : 0;
  
  const formatearFecha = (fechaStr: string) => {
    if (!fechaStr) return null;
    const parts = fechaStr.toString().split(/[\/\-]/);
    if (parts.length === 3) {
      let d = parts[0], m = parts[1], y = parts[2];
      if (y.length === 2) y = "20" + y;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return fechaStr;
  };

  async function asegurarClase(curso: string, profe: string, dia: string, hora: string, nombreAlumno: string) {
    if (!curso || !profe || !dia || !hora) return null;
    let hr = hora.toString().trim(); if(hr.length === 4) hr = "0" + hr;
    
    let modalidad = "Individual";
    if (curso.toLowerCase().includes("grupal")) modalidad = "Grupal";
    else if (curso.toLowerCase().includes("duo") || curso.toLowerCase().includes("dúo")) modalidad = "Duo";
    
    let disc = curso.replace(/individual|grupal|duo|dúo/i, "").trim();
    
    // 1. Disciplina
    let { data: dD } = await supabase.from("disciplinas").select("id").ilike("nombre", disc).limit(1);
    let dId = dD?.[0]?.id;
    if(!dId) { const {data} = await supabase.from("disciplinas").insert([{nombre: disc, precio_base: 82000}]).select().single(); dId = data?.id; }
    
    // 2. Profesor
    let { data: pD } = await supabase.from("profesores").select("id").ilike("nombre", profe).limit(1);
    if(!pD?.length) await supabase.from("profesores").insert([{nombre: profe, estado: 'Activo'}]);
    
    // 3. Clase
    if (modalidad !== "Individual") {
      let { data: cD } = await supabase.from("clases").select("id").eq("disciplina_id", dId).eq("dia_semana", dia).eq("hora_inicio", hr).ilike("profesor", profe).limit(1);
      if(cD?.[0]?.id) return cD[0].id;
    }
    
    // Si no existe el grupo o es Individual, la creamos
    let claseSala = modalidad === "Individual" ? `Clase de ${nombreAlumno}` : "Sala Automática";
    let cap = modalidad === "Grupal" ? 6 : (modalidad === "Duo" ? 2 : 1);
    const { data: nC } = await supabase.from("clases").insert([{
      disciplina_id: dId, modalidad: modalidad, dia_semana: dia, hora_inicio: hr, profesor: profe, sala: claseSala, capacidad_max: cap
    }]).select().single();
    
    return nC?.id;
  }

  function parseCSVLine(line: string, delimiter: string) {
    let inQuotes = false, val = '', parsed = [];
    for (let i = 0; i < line.length; i++) {
      let char = line[i];
      if (char === '"') inQuotes = !inQuotes;
      else if (char === delimiter && !inQuotes) { parsed.push(val.trim()); val = ''; } 
      else val += char;
    }
    parsed.push(val.trim());
    return parsed;
  }

  async function iniciarMigracion() {
    if (!archivoBase) return alert("Selecciona un archivo.");
    setIsProcessing(true); setLogs([]);
    agregarLog("🚀 Iniciando Motor de Migración V4 (Multicurso)...");

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
        const delimiter = lines[0].includes(';') ? ';' : ',';
        const headers = parseCSVLine(lines[0], delimiter).map(h => h.trim());
        
        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i], delimiter);
          const row: any = {};
          headers.forEach((h, idx) => { row[h] = values[idx]; });

          try {
            if (tipoMigracion === "prospectos") {
              const isPagada = row["Prueba Pagada"]?.toLowerCase() === 'sí' || row["Prueba Pagada"]?.toLowerCase() === 'si' || row["Prueba Pagada"]?.toLowerCase() === 'true';
              await supabase.from("leads").insert([{
                name: row["Nombre Alumno"], fecha_nacimiento: formatearFecha(row["Fecha Nacimiento"]),
                nombre_apoderado: row["Nombre Apoderado"], email: row["Email Contacto"], phone: row["Teléfono"],
                clase_interes: row["Clase de Interés"], clase_prueba_asignada: row["Clase de Prueba Asignada"],
                fecha_prueba: formatearFecha(row["Fecha Prueba"]), hora_prueba: row["Hora Prueba"],
                profesor_prueba: row["Profesor Prueba"], costo_prueba: limpiarDinero(row["Costo Prueba ($)"]),
                prueba_pagada: isPagada, status: row["Estado"] || "Nuevo Contacto"
              }]);
            } else {
              // 1. Cuenta
              const email = row["Email Contacto"];
              if (!email || !row["Nombre Alumno"]) throw new Error("Fila inválida (Falta nombre o email)");
              let { data: cEx } = await supabase.from("cuentas_familiares").select("id").eq("email_contacto", email).limit(1);
              let cId = cEx?.[0]?.id;
              if(!cId) {
                const { data: nC } = await supabase.from("cuentas_familiares").insert([{
                  titular_nombre: row["Nombre Apoderado"] || row["Nombre Alumno"], titular_rut: row["RUT Apoderado"] || row["RUT"],
                  email_contacto: email, telefono: row["Teléfono"], direccion_calle: row["Calle"], direccion_comuna: row["Comuna"]
                }]).select().single();
                cId = nC?.id;
              }

              // 2. Alumno (Sin clase_id)
              const { data: al, error: errAl } = await supabase.from("students").insert([{
                cuenta_id: cId, name: row["Nombre Alumno"], email: email, phone: row["Teléfono"],
                fecha_nacimiento: formatearFecha(row["Fecha Nacimiento"]), fecha_ingreso: formatearFecha(row["Fecha de Ingreso"]),
                status: row["Estado Alumno"] || "Activo",
                precio_base: limpiarDinero(row["Mensualidad Base ($)"]), descuento_aplicado: limpiarDinero(row["Descuento Aplicado ($)"]),
                mensualidad_final: limpiarDinero(row["Mensualidad Final ($)"]) || limpiarDinero(row["Prorrateo Curso ($)"])
              }]).select().single();

              if (errAl) throw errAl;

              // 3. Inscripciones Múltiples
              const c1 = await asegurarClase(row["Curso 1"] || row["Curso"], row["Profesor 1"] || row["Profesor"], row["Día Clase 1"] || row["Día Clase"] || row["Dia Clase 1"], row["Hora Clase 1"] || row["Hora Clase"], row["Nombre Alumno"]);
              if(c1) await supabase.from("inscripciones").insert([{student_id: al.id, clase_id: c1}]);
              
              const c2 = await asegurarClase(row["Curso 2"], row["Profesor 2"], row["Día Clase 2"] || row["Dìa Clase 2"], row["Hora Clase 2"], row["Nombre Alumno"]);
              if(c2) await supabase.from("inscripciones").insert([{student_id: al.id, clase_id: c2}]);
            }
            agregarLog(`✅ Migrado exitosamente: ${row["Nombre Alumno"]}`);
          } catch(err:any) { agregarLog(`❌ Fila ${i} (${row["Nombre Alumno"]}): ${err.message}`); }
          setProgreso({ actual: i, total: lines.length - 1 });
        }
        agregarLog(`✨ PROCESO FINALIZADO.`);
      } catch(err:any) { agregarLog(`❌ ERROR FATAL: ${err.message}`); }
      setIsProcessing(false);
    };
    reader.readAsText(archivoBase);
  }

  return (
    <div className="p-10 space-y-8 min-h-screen">
      <div>
        <h1 className="text-3xl font-bold text-[#0B132D] tracking-tight">Gestor de Datos (CSV)</h1>
        <p className="text-[#64748B] mt-1 font-medium">Motor de inyección directa a la base de datos multicurso.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="saas-card p-8 border-t-4 border-t-[#FC6827]">
            <div className="flex bg-slate-100 rounded-xl p-1 mb-6">
              <button onClick={() => setTipoMigracion("prospectos")} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${tipoMigracion === 'prospectos' ? 'bg-white shadow-sm text-[#0B132D]' : 'text-slate-500'}`}>1. Prospectos</button>
              <button onClick={() => setTipoMigracion("alumnos")} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${tipoMigracion === 'alumnos' ? 'bg-white shadow-sm text-[#0B132D]' : 'text-slate-500'}`}>2. Alumnos Activos</button>
            </div>
            
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center hover:bg-slate-50 transition-colors">
              <div className="text-4xl mb-3 grayscale opacity-50">📁</div>
              <label className="cursor-pointer">
                <span className="bg-[#0B132D] text-white px-6 py-2.5 rounded-xl font-bold shadow-sm inline-block mb-3">Seleccionar CSV</span>
                <input type="file" accept=".csv" onChange={e => setArchivoBase(e.target.files?.[0] || null)} className="hidden" disabled={isProcessing} />
              </label>
              <p className="text-xs text-slate-500 font-medium">{archivoBase ? <span className="text-[#0466C8] font-bold">{archivoBase.name}</span> : "Selecciona tu archivo exportado."}</p>
            </div>

            <button onClick={iniciarMigracion} disabled={isProcessing || !archivoBase} className="w-full mt-6 bg-[#FC6827] text-white py-3.5 rounded-xl font-bold shadow-lg hover:-translate-y-0.5 transition-transform disabled:opacity-50">
              {isProcessing ? "Procesando..." : `Inyectar ${tipoMigracion.toUpperCase()}`}
            </button>
          </div>
        </div>

        <div className="saas-card p-0 overflow-hidden bg-[#0B132D] flex flex-col h-[550px]">
          <div className="p-5 border-b border-white/10 flex justify-between items-center bg-black/20">
            <h2 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Terminal Logística</h2>
            {isProcessing && <span className="text-xs text-[#FC6827] font-black">{progreso.total > 0 ? Math.round((progreso.actual / progreso.total) * 100) : 0}%</span>}
          </div>
          <div className="p-5 flex-1 overflow-y-auto font-mono text-[10px] space-y-2 custom-scrollbar">
            {logs.map((log, index) => (
              <p key={index} className={`${log.includes('ERROR') ? 'text-red-400 font-bold' : log.includes('FINALIZADO') ? 'text-green-400 font-black' : 'text-slate-300'}`}>
                <span className="opacity-40 mr-2">[{new Date().toLocaleTimeString()}]</span> {log}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}