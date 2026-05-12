"use client";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

// Inicializamos Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type ErrorMigracion = {
  fila: number;
  alumno: string;
  mensajeTecnico: string;
  causaSugerida: string;
};

export default function MigracionSaaSPage() {
  const [archivoBase, setArchivoBase] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  
  const [listaErrores, setListaErrores] = useState<ErrorMigracion[]>([]);
  const [mostrarModalErrores, setMostrarModalErrores] = useState(false);

  const agregarLog = (m: string) => setLogs(prev => [m, ...prev]);
  const cleanDinero = (val: string) => val ? Number(val.replace(/[^0-9]/g, '')) || 0 : 0;

  // Evita el error "Invalid time value"
  const parsearFechaSegura = (fechaStr: string) => {
    if (!fechaStr || fechaStr.trim() === "") return null;
    const d = new Date(fechaStr);
    if (isNaN(d.getTime())) return null; 
    return d.toISOString();
  };

  // Determinar Tipo de Curso
  const determinarTipoCurso = (nombre: string) => {
    const n = nombre.toLowerCase();
    if (n.includes("individual")) return "INDIVIDUAL";
    if (n.includes("dúo") || n.includes("duo")) return "DUO";
    return "GRUPAL";
  };

  async function limpiarBaseDeDatos() {
    if (!confirm("⚠️ ¿Estás seguro? Esto borrará TODAS las cuentas, alumnos y clases actuales para volver a migrar.")) return;
    setIsProcessing(true);
    setLogs(["🧹 Iniciando limpieza de base de datos..."]);
    await supabase.from("academias").delete().neq("id", "00000000-0000-0000-0000-000000000000"); 
    agregarLog("✅ Base de datos limpia. Lista para nueva migración.");
    setIsProcessing(false);
  }

  async function asegurarClase(academiaId: string, row: any, num: number) {
    const nombreClase = row[`Curso ${num}`] || row["Curso"];
    const profesor = row[`Profesor ${num}`] || row["Profesor"];
    
    if (!nombreClase || !profesor) return null;

    let { data: existente } = await supabase
      .from("clases")
      .select("id")
      .eq("academia_id", academiaId)
      .ilike("nombre", nombreClase)
      .ilike("profesor", profesor)
      .limit(1);

    if (existente?.[0]?.id) return existente[0].id;

    const { data: nueva, error } = await supabase
      .from("clases")
      .insert([{
        academia_id: academiaId,
        nombre: nombreClase,
        profesor: profesor,
        tipo: determinarTipoCurso(nombreClase),
        tarifa_base: cleanDinero(row["Mensualidad Base ($)"])
      }])
      .select()
      .single();

    if (error) throw new Error(`Error creando curso ${nombreClase}: ${error.message}`);
    return nueva?.id;
  }

  async function iniciarMigracion() {
    if (!archivoBase) return;
    setIsProcessing(true); 
    setLogs(["🚀 Iniciando migración SaaS (Modo Forzado & Asociativo)..."]);
    setListaErrores([]); 

    let { data: academia } = await supabase.from("academias").select("id").limit(1).single();
    let academiaId = academia?.id;

    if (!academiaId) {
      const { data: nuevaAcademia } = await supabase.from("academias").insert([{ nombre: "UCANSING Central", subdominio: "central" }]).select().single();
      academiaId = nuevaAcademia?.id;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const lines = (e.target?.result as string).split(/\r?\n/).filter(l => l.trim());
      const sep = lines[0].includes(';') ? ';' : ',';
      const headers = lines[0].split(sep).map(h => h.trim());
      
      const erroresTemporales: ErrorMigracion[] = [];

      for (let i = 1; i < lines.length; i++) {
        const row: any = {};
        const currentLine = lines[i].split(new RegExp(`${sep}(?=(?:(?:[^"]*"){2})*[^"]*$)`));
        currentLine.forEach((v, idx) => { row[headers[idx]] = v.replace(/^"|"$/g, '').trim(); });

        try {
          const email = row["Email Contacto"] || "";
          const nombreAlumno = row["Nombre Alumno"] || `Desconocido (Fila ${i})`;
          const rutReal = row["RUT Apoderado"] || row["RUT"] || `RUT-MIG-${i}`;

          // 1. Cuenta Familiar
          let cId = null;
          let { data: cuentaExRut } = await supabase.from("cuentas_familiares").select("id").eq("rut", rutReal).limit(1);
          if (cuentaExRut?.[0]?.id) cId = cuentaExRut[0].id;
          else if (email) {
            let { data: cuentaExEmail } = await supabase.from("cuentas_familiares").select("id").eq("email_contacto", email).limit(1);
            if (cuentaExEmail?.[0]?.id) cId = cuentaExEmail[0].id;
          }
          
          if (!cId) {
            const { data, error: errC } = await supabase.from("cuentas_familiares").insert([{
              academia_id: academiaId,
              titular_nombre: row["Nombre Apoderado"] || row["Nombre Alumno"] || `Titular Fila ${i}`,
              rut: rutReal,
              email_contacto: email || `sin-email-${i}@ucansing.cl`,
              telefono: row["Teléfono"] || ""
            }]).select().single();
            if (errC) throw new Error(`Error en Cuenta: ${errC.message}`);
            cId = data?.id;
          }

          // 2. Alumno
          const { data: al, error: errA } = await supabase.from("alumnos").insert([{
            cuenta_familiar_id: cId,
            nombre: nombreAlumno,
            fecha_nacimiento: parsearFechaSegura(row["Fecha Nacimiento"]),
          }]).select().single();
          if (errA) throw new Error(`Error en Alumno: ${errA.message}`);

          // 3. Inscripciones a Cursos
          for (let n = 1; n <= 2; n++) {
            const cursoId = await asegurarClase(academiaId!, row, n);
            if (cursoId) {
              await supabase.from("inscripciones").insert([{
                alumno_id: al.id,
                clase_id: cursoId,
                precio_final_con_descuento: cleanDinero(row["Mensualidad Final ($)"]) || cleanDinero(row["Mensualidad Base ($)"]),
                dia_semana: row[`Día Clase ${n}`] || row["Día Clase"] || "Sin asignar",
                hora_inicio: row[`Hora Clase ${n}`] || row["Hora Clase"] || null,
                estado: row["Estado Alumno"] === "Activo" ? "ACTIVO" : "RETIRADO"
              }]);
            }
          }

          agregarLog(`✅ Migrado exitosamente: ${nombreAlumno}`);
        } catch(err:any) { 
          const msg = err.message || "Error desconocido";
          agregarLog(`❌ Error fila ${i}: ${msg}`);
          erroresTemporales.push({ fila: i + 1, alumno: row["Nombre Alumno"] || "Fila sin nombre", mensajeTecnico: msg, causaSugerida: "Revisar datos o formato en Excel." });
        }
      }
      
      agregarLog("🎉 PROCESAMIENTO COMPLETADO");
      setIsProcessing(false);

      if (erroresTemporales.length > 0) {
        setListaErrores(erroresTemporales);
        setMostrarModalErrores(true);
      }
    };
    reader.readAsText(archivoBase);
  }

  return (
    <div className="p-10 space-y-8 min-h-screen bg-gray-50 relative">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-800">Inyector de Datos SaaS</h1>
        <button onClick={limpiarBaseDeDatos} disabled={isProcessing} className="bg-red-100 text-red-600 px-4 py-2 rounded-lg font-semibold hover:bg-red-200 transition">
          🗑️ Limpiar Base de Datos
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <p className="text-slate-500 mb-6">Sube el archivo <b>Gestion UCS - 2026 - Alumnos Activos.csv</b>.</p>
        <input type="file" accept=".csv" onChange={e => setArchivoBase(e.target.files?.[0] || null)} className="mb-6 block w-full text-sm text-slate-500 file:mr-4 file:py-3 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-600 hover:file:bg-orange-100" />
        <button onClick={iniciarMigracion} disabled={isProcessing || !archivoBase} className={`px-6 py-3 rounded-xl font-bold w-full transition ${isProcessing || !archivoBase ? "bg-slate-300 text-slate-500" : "bg-orange-600 text-white hover:bg-orange-700"}`}>
          {isProcessing ? "Procesando Migración..." : "Inyectar Datos desde CSV"}
        </button>

        {listaErrores.length > 0 && (
          <button onClick={() => setMostrarModalErrores(true)} className="mt-4 text-red-600 font-semibold text-sm underline w-full text-center hover:text-red-800">
            ⚠️ Ver {listaErrores.length} errores detectados
          </button>
        )}
      </div>

      <div className="bg-slate-900 text-green-400 p-6 rounded-2xl font-mono text-sm h-80 overflow-y-auto shadow-inner">
        <div className="sticky top-0 bg-slate-900 pb-2 border-b border-slate-700 mb-2 font-bold text-white">Terminal de Migración</div>
        {logs.map((l, i) => <p key={i} className="mb-1">{l}</p>)}
      </div>

      {mostrarModalErrores && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="bg-red-50 p-6 flex justify-between items-center border-b border-red-100">
              <h2 className="text-2xl font-bold text-red-700">⚠️ Reporte de Conflictos</h2>
              <button onClick={() => setMostrarModalErrores(false)} className="bg-red-100 hover:bg-red-200 text-red-700 p-2 rounded-full font-bold">✕</button>
            </div>
            <div className="overflow-y-auto p-6 bg-slate-50 flex-1 space-y-4">
              {listaErrores.map((err, idx) => (
                <div key={idx} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between mb-3">
                    <span className="bg-orange-100 text-orange-800 text-xs font-bold px-3 py-1 rounded-full">Fila {err.fila}</span>
                    <span className="font-semibold">{err.alumno}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-red-50 p-3 rounded-lg"><p className="text-xs text-red-400 font-bold mb-1">Sugerencia</p><p className="text-sm text-red-700">{err.causaSugerida}</p></div>
                    <div className="bg-slate-900 p-3 rounded-lg"><p className="text-xs text-slate-400 font-bold mb-1">Log Técnico</p><p className="text-xs text-green-400 font-mono break-words">{err.mensajeTecnico}</p></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}