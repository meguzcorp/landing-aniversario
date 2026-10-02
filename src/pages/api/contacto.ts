import type { APIRoute } from 'astro';
import nodemailer from 'nodemailer';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.formData();

    // Mapeo de campos del formulario
    const nombre = (data.get('nombre_completo') || data.get('nombre'))?.toString().trim();
    const correo = data.get('correo')?.toString().trim();
    const telefono = data.get('telefono')?.toString().trim();
    const nivel = data.get('nivel_interes')?.toString().trim() || null;
    const mensaje = data.get('mensaje')?.toString().trim() || 'Solicitud de visita vía Landing 25 Aniversario';

    // Campus y origen (vienen en hidden del form o con fallback)
    const origen = data.get('origen')?.toString().trim() || 'landing_25_aniversario';
    const id_campus = Number(data.get('id_campus')) || 1; // 1: Playa del Carmen

    // Campos opcionales de atribución
    const utm_source = data.get('utm_source')?.toString().trim() || null;
    const utm_medium = data.get('utm_medium')?.toString().trim() || null;
    const utm_campaign = data.get('utm_campaign')?.toString().trim() || null;

    // Validación básica en servidor
    if (!nombre || !correo || !telefono) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Nombre, correo y teléfono son campos obligatorios.' 
        }), 
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1. REGISTRO EN EL CRM MEGUZDOCS
    const apiUrl = import.meta.env.MEGUZDOCS_API_URL;
    const apiKey = import.meta.env.MEGUZDOCS_API_KEY;
    let crmResult: any = null;

    if (apiUrl && apiKey) {
      try {
        const payloadCrm = {
          id_campus: id_campus,
          origen: origen,
          nombre_completo: nombre,
          correo: correo,
          telefono: telefono,
          nivel_interes: nivel,
          mensaje: mensaje,
          utm_source: utm_source,
          utm_medium: utm_medium,
          utm_campaign: utm_campaign,
        };

        const crmResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': apiKey,
          },
          body: JSON.stringify(payloadCrm),
        });

        crmResult = await crmResponse.json().catch(() => null);

        if (!crmResponse.ok || !crmResult?.success) {
          console.error('Error al registrar en Meguzdocs:', crmResult);
        }
      } catch (crmErr) {
        console.error('Excepción al conectar con Meguzdocs:', crmErr);
      }
    }

    // 2. ENVÍO DE CORREO DE NOTIFICACIÓN (Nodemailer)
    const smtpUser = import.meta.env.SMTP_USER;
    const smtpPass = import.meta.env.SMTP_PASS;

    if (smtpUser && smtpPass) {
      try {
        const transporter = nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: 587,
          secure: false,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
          tls: {
            rejectUnauthorized: false,
          },
        });

        const emailHtml = `
          <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <div style="background-color: #0B1536; padding: 24px; text-align: center; color: white;">
              <h2 style="margin: 0; font-size: 20px;">Nuevo Lead - Landing 25 Aniversario</h2>
              <p style="margin: 4px 0 0; font-size: 14px; opacity: 0.85;">Colegio Inglés Playa del Carmen</p>
            </div>
            <div style="padding: 24px; background-color: #ffffff;">
              <p style="margin: 0 0 16px; font-size: 15px;"><strong>ID Lead CRM:</strong> ${crmResult?.lead_id || 'Pendiente / N/A'}</p>
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-weight: bold; width: 40%;">Nombre Completo:</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;">${nombre}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-weight: bold;">Correo:</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;"><a href="mailto:${correo}" style="color: #00A3E0;">${correo}</a></td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-weight: bold;">Teléfono / WhatsApp:</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;"><a href="https://wa.me/52${telefono.replace(/\D/g, '')}" style="color: #25D366; font-weight: bold;">${telefono}</a></td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-weight: bold;">Nivel de Interés:</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; text-transform: capitalize;">${nivel || 'No especificado'}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; font-weight: bold;">Origen:</td>
                  <td style="padding: 10px 0;">Landing 25 Aniversario</td>
                </tr>
              </table>
            </div>
          </div>
        `;

        await transporter.sendMail({
          from: '"Colegio Inglés Notificaciones" <webmaster@educacionmeguz.com>',
          to: 'antonio_caamal@colegioinglesplaya.com',
          cc: ['programadorweb@colegioinglesplaya.com'],
          subject: `Nuevo Prospecto 25 Aniv: ${nombre} (${nivel || 'General'})`,
          html: emailHtml,
        });
      } catch (mailError) {
        console.error('Error secundario de Nodemailer:', mailError);
      }
    }

    // 3. RESPUESTA AL FRONTEND
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: '¡Registro exitoso! En breve nos pondremos en contacto contigo.' 
      }), 
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error general en endpoint contacto.ts:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'Ocurrió un error inesperado al procesar la solicitud.' 
      }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};