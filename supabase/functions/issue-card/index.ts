import { createClient } from 'npm:@supabase/supabase-js@2';
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import QRCode from 'npm:qrcode@1.5.4';
import { corsHeaders } from '../_shared/cors.ts';

const encoder = new TextEncoder();

async function sha256Bytes(value: Uint8Array) {
  const hash = await crypto.subtle.digest('SHA-256', value);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256Text(value: string) {
  return sha256Bytes(encoder.encode(value));
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authorization = req.headers.get('Authorization') || '';
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authorization } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return Response.json({ message: 'Não autenticado' }, { status: 401, headers: corsHeaders });

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { application_id } = await req.json();
    const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', user.id).in('role', ['issuer', 'administrator']);
    if (!roles?.length) return Response.json({ message: 'Sem permissão de emissão' }, { status: 403, headers: corsHeaders });

    const { data: application, error } = await admin
      .from('applications')
      .select('*, beneficiary:beneficiaries(*, caregivers(*), emergency_information(*)), unit:administrative_units(*)')
      .eq('id', application_id)
      .single();
    if (error) throw error;
    if (application.status !== 'approved') {
      return Response.json({ message: 'A solicitação precisa estar aprovada' }, { status: 409, headers: corsHeaders });
    }

    const { data: cardNumber, error: numberError } = await userClient.rpc('generate_card_number', { p_unit_id: application.unit_id });
    if (numberError) throw numberError;

    const issued = new Date();
    const expires = new Date(issued);
    expires.setFullYear(expires.getFullYear() + 5);
    const issuedDate = issued.toISOString().slice(0, 10);
    const expiresDate = expires.toISOString().slice(0, 10);
    const token = randomToken();
    const tokenHash = await sha256Text(token);
    const publicCode = crypto.randomUUID().slice(0, 8).toUpperCase();
    const verificationUrl = `${Deno.env.get('PUBLIC_APP_URL')}#/verificar/${token}`;

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.HelveticaBold);
    const navy = rgb(0.02, 0.17, 0.42);
    const width = 243;
    const height = 376;

    const front = pdf.addPage([width, height]);
    front.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.92, 0.97, 1) });
    front.drawRectangle({ x: 0, y: 299, width, height: 77, color: navy });
    front.drawText('SEMAS', { x: 18, y: 334, size: 28, font, color: rgb(1,1,1) });
    front.drawText('SECRETARIA MUNICIPAL DE ASSISTENCIA SOCIAL', { x: 18, y: 317, size: 6, font, color: rgb(1,1,1) });
    front.drawText('CIPTEA', { x: 84, y: 280, size: 25, font, color: navy });
    front.drawText('CARTEIRA DE IDENTIFICACAO DA PESSOA COM', { x: 35, y: 264, size: 8, font, color: navy });
    front.drawText('TRANSTORNO DO ESPECTRO AUTISTA', { x: 48, y: 252, size: 8, font, color: navy });
    front.drawRectangle({ x: 82, y: 163, width: 77, height: 108, borderColor: rgb(.15,.2,.25), borderWidth: 1, color: rgb(1,1,1) });
    front.drawText('FOTO 3X4', { x: 102, y: 214, size: 10, font, color: rgb(.15,.15,.15) });
    const line = (x:number,y:number,w:number) => front.drawRectangle({ x, y, width:w, height:12, color:rgb(1,1,1), borderColor:rgb(.15,.25,.35), borderWidth:.6 });
    line(48,116,183); line(106,103,55); line(187,103,44); line(14,88,217); line(14,73,217); line(61,53,73); line(166,53,65); line(63,39,69); line(153,39,78); line(96,25,135);
    front.drawText('VALIDO POR 5 ANOS', { x: 82, y: 8, size: 8, font, color: navy });
    const drawFront = (text: string, x: number, y: number, size = 6, maxWidth?: number) =>
      front.drawText((text || '-').toUpperCase(), { x, y, size, font, color: navy, maxWidth });

    drawFront(application.beneficiary.full_name, 44, 120, 6.6, 188);
    drawFront(application.beneficiary.birth_date, 106, 108, 6);
    drawFront((application.beneficiary.sex || '').slice(0, 1), 202, 108, 6);
    const parentages = await admin.from('parentages').select('full_name').eq('beneficiary_id', application.beneficiary_id).order('created_at');
    drawFront(parentages.data?.[0]?.full_name || '-', 35, 87, 5.7, 198);
    drawFront(parentages.data?.[1]?.full_name || '-', 35, 73, 5.7, 198);
    drawFront(cardNumber, 68, 56, 5.4, 66);
    drawFront(application.beneficiary.sus_number, 168, 56, 5.4, 67);
    drawFront(issued.toLocaleDateString('pt-BR'), 75, 43, 5.4);
    drawFront(application.beneficiary.cid, 166, 43, 5.4, 70);
    drawFront(`NIVEL ${application.beneficiary.support_level}`, 98, 29, 5.4, 135);

    if (application.beneficiary.photo_path) {
      const { data: photo } = await admin.storage.from('beneficiary-photos').download(application.beneficiary.photo_path);
      if (photo) {
        const photoBytes = new Uint8Array(await photo.arrayBuffer());
        try {
          const image = application.beneficiary.photo_path.toLowerCase().endsWith('.png')
            ? await pdf.embedPng(photoBytes)
            : await pdf.embedJpg(photoBytes);
          front.drawImage(image, { x: 82.5, y: 163.5, width: 76.5, height: 108.3 });
        } catch (photoError) {
          console.warn('Não foi possível incorporar a fotografia', photoError);
        }
      }
    }

    const back = pdf.addPage([width, height]);
    back.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.92, 0.97, 1) });
    back.drawText("PREFEITURA MUNICIPAL MACHADINHO D'OESTE", { x: 48, y: 354, size: 7, font, color: navy });
    back.drawRectangle({ x: 18, y: 247, width: 207, height: 83, borderColor: rgb(.05,.3,.65), borderWidth: 1.2 });
    back.drawRectangle({ x: 18, y: 312, width: 207, height: 18, color: navy });
    back.drawText('RESPONSAVEL LEGAL / CUIDADOR', { x: 48, y: 318, size: 8, font, color: rgb(1,1,1) });
    back.drawRectangle({ x: 18, y: 157, width: 207, height: 80, borderColor: rgb(.05,.3,.65), borderWidth: 1.2 });
    back.drawRectangle({ x: 18, y: 219, width: 207, height: 18, color: rgb(.88,0,.09) });
    back.drawText('INFORMACOES DE EMERGENCIA', { x: 54, y: 225, size: 8, font, color: rgb(1,1,1) });
    back.drawText('EMISSAO:', { x: 146, y: 136, size: 8, font, color: navy });
    back.drawRectangle({ x: 145, y: 119, width: 58, height: 14, color: rgb(1,1,1), borderColor: rgb(.05,.3,.65), borderWidth: 1 });
    back.drawRectangle({ x: 128, y: 24, width: 102, height: 82, color: rgb(1,1,1), borderColor: rgb(.05,.3,.65), borderWidth: 1.2 });
    back.drawText('LEIA O QR CODE PARA AUTENTICACAO', { x: 132, y: 96, size: 4, font, color: navy });
    const drawBack = (text: string, x: number, y: number, size = 6, maxWidth?: number) =>
      back.drawText((text || '-').toUpperCase(), { x, y, size, font, color: navy, maxWidth });
    const caregiver = application.beneficiary.caregivers?.[0];
    const emergency = application.beneficiary.emergency_information?.[0];
    drawBack(caregiver?.full_name || '-', 44, 286, 6.2, 180);
    drawBack(caregiver?.phone || '-', 54, 269, 6.2, 170);
    drawBack(caregiver?.relationship || '-', 61, 253, 6.2, 164);
    drawBack(emergency?.blood_type || '-', 67, 211, 6);
    drawBack((emergency?.allergies || 'NAO INFORMADO').slice(0, 50), 96, 195, 5.2, 132);
    drawBack((emergency?.other_information || '-').slice(0, 55), 88, 179, 5.2, 140);
    drawBack(issued.toLocaleDateString('pt-BR'), 155, 139, 5.8, 48);

    const qrDataUrl = await QRCode.toDataURL(verificationUrl, { errorCorrectionLevel: 'H', margin: 1, width: 500 });
    const qrBytes = Uint8Array.from(atob(qrDataUrl.split(',')[1]), (char) => char.charCodeAt(0));
    const qrImage = await pdf.embedPng(qrBytes);
    back.drawImage(qrImage, { x: 132, y: 38, width: 94, height: 82 });

    const pdfBytes = await pdf.save();
    const fileHash = await sha256Bytes(pdfBytes);
    const pdfPath = `${application.unit_id}/${cardNumber}/v1.pdf`;
    const { error: uploadError } = await admin.storage.from('issued-cards').upload(pdfPath, pdfBytes, { contentType: 'application/pdf', upsert: false });
    if (uploadError) throw uploadError;

    const snapshot = {
      beneficiary: application.beneficiary,
      caregiver,
      emergency,
      card_number: cardNumber,
      issued_at: issuedDate,
      expires_at: expiresDate,
    };

    const { data: card, error: cardError } = await admin.from('cards').insert({
      application_id: application.id,
      beneficiary_id: application.beneficiary_id,
      unit_id: application.unit_id,
      card_number: cardNumber,
      issued_at: issuedDate,
      expires_at: expiresDate,
      created_by: user.id,
    }).select().single();
    if (cardError) throw cardError;

    await admin.from('card_versions').insert({ card_id: card.id, version: 1, snapshot, pdf_path: pdfPath, pdf_sha256: fileHash, created_by: user.id });
    await admin.from('verification_credentials').insert({ card_id: card.id, token_hash: tokenHash, public_code: publicCode });
    await admin.from('applications').update({ status: 'issued', card_number: cardNumber, issued_at: issuedDate, expires_at: expiresDate }).eq('id', application.id);
    await admin.from('application_status_history').insert({ application_id: application.id, old_status: 'approved', new_status: 'issued', reason: 'Emissão oficial', changed_by: user.id });

    return Response.json({ card_id: card.id, card_number: cardNumber, pdf_path: pdfPath, verification_url: verificationUrl }, { headers: corsHeaders });
  } catch (error) {
    console.error(error);
    return Response.json({ message: error instanceof Error ? error.message : 'Falha na emissão' }, { status: 500, headers: corsHeaders });
  }
});
