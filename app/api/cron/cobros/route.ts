import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Usamos el SERVICE_ROLE_KEY porque esto se ejecuta en el servidor (backend)
// y necesita permisos absolutos para saltarse las reglas de seguridad de usuario normal.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // ¡Importante tener esta variable en tu .env!
);

export async function GET(request: Request) {
  try {
    // 1. Verificación de Seguridad (Opcional pero recomendada)
    // Para asegurarnos de que solo Vercel/Cron pueda llamar a esta ruta y no un usuario curioso
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    console.log("Iniciando Facturación Automática Mensual...");

    // 2. Traer a las Familias y sus Inscripciones Activas
    const { data: cuentas, error } = await supabase
      .from("cuentas_familiares")
      .select(`
        id,
        alumnos ( 
          inscripciones ( estado, precio_final_con_descuento )
        )
      `);

    if (error) throw error;

    const mesActualStr = new Date().toLocaleString('es-ES', { month: 'long', year: 'numeric' });
    let cobrosGenerados = 0;

    // 3. Procesar cada cuenta
    for (const cuenta of cuentas || []) {
      let proyeccion = 0;
      cuenta.alumnos.forEach((a: any) => {
        a.inscripciones.filter((i: any) => i.estado === 'ACTIVO').forEach((i: any) => {
          proyeccion += Number(i.precio_final_con_descuento);
        });
      });

      if (proyeccion > 0) {
        // Verificar si ya existe un cobro este mes para evitar duplicados críticos
        const primerDiaMes = new Date();
        primerDiaMes.setDate(1);
        primerDiaMes.setHours(0, 0, 0, 0);

        const { data: cobroExistente } = await supabase
          .from("transacciones")
          .select("id")
          .eq("cuenta_familiar_id", cuenta.id)
          .eq("tipo", "CARGO")
          .gte("fecha", primerDiaMes.toISOString())
          .limit(1);

        if (!cobroExistente || cobroExistente.length === 0) {
          // Si no hay cobro, lo insertamos
          await supabase.from("transacciones").insert([{
            cuenta_familiar_id: cuenta.id,
            tipo: 'CARGO',
            monto: proyeccion,
            metodo_pago: 'SISTEMA',
            notas: `Mensualidad Automática ${mesActualStr}`
          }]);
          cobrosGenerados++;
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      mensaje: `Proceso completado. Se generaron ${cobrosGenerados} nuevos cobros.` 
    });

  } catch (err: any) {
    console.error("Error en CronJob de Cobros:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}