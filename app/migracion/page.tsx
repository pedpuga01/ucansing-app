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

  function agregarLog(m: string) { setLogs(prev => [m, ...prev]); }
  const cleanDinero = (val: string) => val ? Number(val.replace(/[^0-9]/g, '')) || 0 : 0;
  
  async function asegurarClase(curso: string, profe: string, dia: string, hora: string) {
    if (!curso || !profe || !dia || !hora) return null;
    let hr = hora.trim(); if(hr.length === 4) hr = "0" + hr;
    let disc = curso.replace(/individual|grupal|duo|dúo/i, "").trim();
    
    let { data: dD } = await supabase.from("disciplinas").select("id").ilike("nombre", disc).limit(1);
    let dId = dD?.[0]?.id;
    if(!dId) { const {data} = await supabase.from("disciplinas").insert([{nombre: disc}]).select().single(); dId = data?.id; }
    
    let { data: pD } = await supabase.from("profesores").select("id").ilike("nombre", profe).limit(1);
    if(!pD?.length) await supabase.from("profesores").insert([{nombre: profe, estado: 'Activo'}]);
    
    let { data: cD } = await supabase.from("clases").select("id").eq("disciplina_id", dId).eq("dia_semana", dia).eq("hora_inicio", hr).ilike("profesor", profe).limit(1);
    if(cD?.[0]?.id) return cD[0].id;
    
    const { data: nC } = await supabase.from("clases").insert([{disciplina_id: dId, modalidad: curso.toLowerCase().includes("grupal") ? "Grupal" : "Individual", dia_semana: dia, hora_inicio: hr, profesor: profe, capacidad_max: 6}]).select().single();
    return nC?.id;
  }

  async function iniciar() {
    if (!archivoBase) return;
    setIsProcessing(true); setLogs([]);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const lines = (e.target?.result as string).split(/\r?\n/).filter(l => l.trim());
      const sep = lines[0].includes(';') ? ';' : ',';
      const headers = lines[0].split(sep).map(h => h.trim());
      
      for(let i=1; i<lines.length; i++) {
        const row: any = {};
        lines[i].split(sep).forEach((v, idx) => row[headers[idx]] = v);
        try {
          const email = row["Email Contacto"];
          let { data: cEx } = await supabase.from("cuentas_familiares").select("id").eq("email_contacto", email).limit(1);
          let cId = cEx?.[0]?.id;
          if(!cId) {
            const { data } = await supabase.from("cuentas_familiares").insert([{ titular_nombre: row["Nombre Apoderado"]||row["Nombre Alumno"], email_contacto: email, telefono: row["Teléfono"] }]).select().single();
            cId = data?.id;
          }

          const { data: al, error } = await supabase.from("students").insert([{ cuenta_id: cId, name: row["Nombre Alumno"], email, status: "Activo", mensualidad_final: cleanDinero(row["Mensualidad Final ($)"]) || cleanDinero(row["Mensualidad Base ($)"]) }]).select().single();
          if(error) throw error;

          const c1 = await asegurarClase(row["Curso 1"]||row["Curso"], row["Profesor 1"]||row["Profesor"], row["Día Clase 1"]||row["Día Clase"]||row["Dia Clase 1"], row["Hora Clase 1"]||row["Hora Clase"]);
          if(c1) await supabase.from("inscripciones").insert([{student_id: al.id, clase_id: c1}]);
          
          const c2 = await asegurarClase(row["Curso 2"], row["Profesor 2"], row["Día Clase 2"]||row["Dìa Clase 2"], row["Hora Clase 2"]);
          if(c2) await supabase.from("inscripciones").insert([{student_id: al.id, clase_id: c2}]);

          agregarLog(`✅ Migrado: ${row["Nombre Alumno"]}`);
        } catch(err:any) { agregarLog(`❌ Error: ${err.message}`); }
      }
      setIsProcessing(false);
    };
    reader.readAsText(archivoBase);
  }

  return (
    <div className="p-10 space-y-8 min-h-screen">
      <h1 className="text-3xl font-bold">Inyector CSV Multicurso</h1>
      <div className="saas-card p-8 border-t-4 border-orange-500">
        <input type="file" accept=".csv" onChange={e => setArchivoBase(e.target.files?.[0] || null)} className="mb-4 block" />
        <button onClick={iniciar} disabled={isProcessing} className="bg-orange-500 text-white px-6 py-3 rounded-xl font-bold w-full">{isProcessing ? "Procesando..." : "Inyectar Datos"}</button>
      </div>
      <div className="bg-black text-green-400 p-4 rounded-xl font-mono text-xs h-64 overflow-y-auto">{logs.map((l, i) => <p key={i}>{l}</p>)}</div>
    </div>
  );
}