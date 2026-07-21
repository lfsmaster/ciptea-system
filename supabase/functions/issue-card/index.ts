import { createClient } from 'npm:@supabase/supabase-js@2';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'npm:pdf-lib@1.17.1';
import QRCode from 'npm:qrcode@1.5.4';
import { corsHeaders } from '../_shared/cors.ts';

const encoder = new TextEncoder();
const MM_TO_POINTS = 72 / 25.4;

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

function formatDate(value?: string | Date | null) {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(`${String(value).slice(0, 10)}T12:00:00Z`);
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(date);
}

function parseColor(value?: string) {
  const normalized = String(value || '#07347a').replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return rgb(0.02, 0.17, 0.42);
  return rgb(
    Number.parseInt(normalized.slice(0, 2), 16) / 255,
    Number.parseInt(normalized.slice(2, 4), 16) / 255,
    Number.parseInt(normalized.slice(4, 6), 16) / 255,
  );
}

function resolveValue(key: string, context: Record<string, unknown>) {
  const map: Record<string, unknown> = {
    'beneficiary.full_name': context.beneficiary_full_name,
    'beneficiary.birth_date': context.beneficiary_birth_date,
    'beneficiary.sex': context.beneficiary_sex,
    'parentage.0.full_name': context.parentage_0,
    'parentage.1.full_name': context.parentage_1,
    'card.number': context.card_number,
    'beneficiary.sus_number': context.beneficiary_sus_number,
    'card.issued_at': context.card_issued_at,
    'beneficiary.cid': context.beneficiary_cid,
    'beneficiary.support_level': context.beneficiary_support_level,
    'caregiver.full_name': context.caregiver_full_name,
    'caregiver.phone': context.caregiver_phone,
    'caregiver.relationship': context.caregiver_relationship,
    'emergency.blood_type': context.emergency_blood_type,
    'emergency.allergies': context.emergency_allergies,
    'emergency.other_information': context.emergency_other_information,
  };
  return String(map[key] ?? '-');
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return ['-'];
  const lines: string[] = [];
  let line = words[0];
  for (const word of words.slice(1)) {
    const candidate = `${line} ${word}`;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  lines.push(line);
  return lines;
}

function fitTextToBox(options: {
  text: string;
  font: PDFFont;
  preferredSize: number;
  minimumSize: number;
  maxWidth: number;
  maxHeight: number;
  multiline: boolean;
  autoFit: boolean;
}) {
  const { text, font, preferredSize, minimumSize, maxWidth, maxHeight, multiline, autoFit } = options;
  const preferred = Math.max(3, preferredSize);
  const minimum = Math.max(2.5, Math.min(minimumSize, preferred));

  const calculate = (fontSize: number) => {
    const lines = multiline ? wrapText(text, font, fontSize, maxWidth) : [text];
    const lineHeight = fontSize * 1.12;
    const widthFits = lines.every((line) => font.widthOfTextAtSize(line, fontSize) <= maxWidth + 0.5);
    const heightFits = lines.length * lineHeight <= maxHeight + 0.5;
    return { lines, lineHeight, fits: widthFits && heightFits };
  };

  if (!autoFit) {
    const calculated = calculate(preferred);
    return { fontSize: preferred, lines: calculated.lines, lineHeight: calculated.lineHeight };
  }

  let low = minimum;
  let high = preferred;
  let best = minimum;
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const current = (low + high) / 2;
    if (calculate(current).fits) {
      best = current;
      low = current;
    } else {
      high = current;
    }
  }
  const final = calculate(best);
  return { fontSize: best, lines: final.lines, lineHeight: final.lineHeight };
}

async function embedRaster(pdf: PDFDocument, bytes: Uint8Array, path = '') {
  if (/\.jpe?g$/i.test(path)) return pdf.embedJpg(bytes);
  try {
    return await pdf.embedPng(bytes);
  } catch {
    return pdf.embedJpg(bytes);
  }
}

async function drawDynamicSide(options: {
  pdf: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  backgroundBytes: Uint8Array;
  backgroundPath: string;
  fields: Array<Record<string, any>>;
  side: 'front' | 'back';
  width: number;
  height: number;
  context: Record<string, unknown>;
  photoBytes?: Uint8Array;
  photoPath?: string;
  qrBytes: Uint8Array;
}) {
  const { pdf, page, font, backgroundBytes, backgroundPath, fields, side, width, height, context, photoBytes, photoPath, qrBytes } = options;
  const background = await embedRaster(pdf, backgroundBytes, backgroundPath);
  page.drawImage(background, { x: 0, y: 0, width, height });
  const qrImage = await pdf.embedPng(qrBytes);
  const photoImage = photoBytes ? await embedRaster(pdf, photoBytes, photoPath) : undefined;

  for (const field of fields.filter((item) => item.side === side && item.visible !== false)) {
    const x = width * (Number(field.x) / 100);
    const boxWidth = width * (Number(field.width) / 100);
    const boxHeight = height * (Number(field.height) / 100);
    const y = height - height * (Number(field.y) / 100) - boxHeight;
    const style = field.style || {};
    const validation = field.validation || {};

    if (field.field_type === 'image') {
      if (photoImage && field.technical_name === 'beneficiary.photo') {
        page.drawImage(photoImage, { x, y, width: boxWidth, height: boxHeight });
      }
      continue;
    }

    if (field.field_type === 'qrcode') {
      page.drawImage(qrImage, { x, y, width: boxWidth, height: boxHeight });
      continue;
    }

    let text = field.field_type === 'fixed_text'
      ? String(style.fixedText || style.placeholder || '-')
      : resolveValue(field.technical_name, context);
    const maxLength = Number(validation.maxLength || 0);
    if (maxLength > 0 && text.length > maxLength) text = text.slice(0, maxLength);
    if (style.uppercase !== false) text = text.toUpperCase();

    const preferredSize = Math.max(3.5, Math.min(28, width * (Number(style.fontSize || 2.1) / 100)));
    const minimumSize = Math.max(2.5, Math.min(preferredSize, width * (Number(style.minFontSize || 0.8) / 100)));
    const fitted = fitTextToBox({
      text,
      font,
      preferredSize,
      minimumSize,
      maxWidth: boxWidth,
      maxHeight: boxHeight,
      multiline: style.multiline === true,
      autoFit: style.autoFit !== false,
    });
    const color = parseColor(style.color);
    const maxLines = Math.max(1, Math.floor(boxHeight / fitted.lineHeight));
    const visibleLines = fitted.lines.slice(0, maxLines);
    const totalHeight = visibleLines.length * fitted.lineHeight;
    const firstBaseline = y + Math.max(fitted.fontSize, (boxHeight + totalHeight) / 2 - fitted.fontSize * 0.15);

    visibleLines.forEach((line, index) => {
      const textWidth = font.widthOfTextAtSize(line, fitted.fontSize);
      let textX = x;
      if (style.align === 'center') textX = x + Math.max(0, (boxWidth - textWidth) / 2);
      if (style.align === 'right') textX = x + Math.max(0, boxWidth - textWidth);
      const textY = firstBaseline - fitted.fontSize - index * fitted.lineHeight;
      page.drawText(line, { x: textX, y: textY, size: fitted.fontSize, font, color, maxWidth: boxWidth });
    });
  }
}

async function loadPublishedTemplate(admin: ReturnType<typeof createClient>) {
  const { data: template } = await admin
    .from('card_templates')
    .select('id,name')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!template) return null;

  const { data: version } = await admin
    .from('card_template_versions')
    .select('*')
    .eq('template_id', template.id)
    .not('published_at', 'is', null)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!version) return null;

  const { data: fields, error: fieldsError } = await admin
    .from('template_fields')
    .select('*')
    .eq('template_version_id', version.id);
  if (fieldsError) throw fieldsError;

  const [frontDownload, backDownload] = await Promise.all([
    admin.storage.from('card-templates').download(version.front_path),
    admin.storage.from('card-templates').download(version.back_path),
  ]);
  if (frontDownload.error) throw frontDownload.error;
  if (backDownload.error) throw backDownload.error;

  return {
    template,
    version,
    fields: fields || [],
    frontBytes: new Uint8Array(await frontDownload.data.arrayBuffer()),
    backBytes: new Uint8Array(await backDownload.data.arrayBuffer()),
  };
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

    const caregiver = application.beneficiary.caregivers?.[0];
    const emergency = application.beneficiary.emergency_information?.[0];
    const { data: parentages } = await admin
      .from('parentages')
      .select('full_name')
      .eq('beneficiary_id', application.beneficiary_id)
      .order('created_at');

    let photoBytes: Uint8Array | undefined;
    if (application.beneficiary.photo_path) {
      const { data: photo } = await admin.storage.from('beneficiary-photos').download(application.beneficiary.photo_path);
      if (photo) photoBytes = new Uint8Array(await photo.arrayBuffer());
    }

    const qrDataUrl = await QRCode.toDataURL(verificationUrl, { errorCorrectionLevel: 'H', margin: 1, width: 500 });
    const qrBytes = Uint8Array.from(atob(qrDataUrl.split(',')[1]), (char) => char.charCodeAt(0));
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.HelveticaBold);
    const publishedTemplate = await loadPublishedTemplate(admin);
    let templateVersionId: string | null = null;

    if (publishedTemplate) {
      const width = Number(publishedTemplate.version.width_mm || 85.6) * MM_TO_POINTS;
      const height = Number(publishedTemplate.version.height_mm || 132.5) * MM_TO_POINTS;
      const context = {
        beneficiary_full_name: application.beneficiary.full_name,
        beneficiary_birth_date: formatDate(application.beneficiary.birth_date),
        beneficiary_sex: String(application.beneficiary.sex || '').slice(0, 1),
        parentage_0: parentages?.[0]?.full_name || '-',
        parentage_1: parentages?.[1]?.full_name || '-',
        card_number: cardNumber,
        beneficiary_sus_number: application.beneficiary.sus_number,
        card_issued_at: formatDate(issued),
        beneficiary_cid: application.beneficiary.cid,
        beneficiary_support_level: `NÍVEL ${application.beneficiary.support_level}`,
        caregiver_full_name: caregiver?.full_name || '-',
        caregiver_phone: caregiver?.phone || '-',
        caregiver_relationship: caregiver?.relationship || '-',
        emergency_blood_type: emergency?.blood_type || '-',
        emergency_allergies: emergency?.allergies || 'NÃO INFORMADO',
        emergency_other_information: emergency?.other_information || '-',
      };
      const front = pdf.addPage([width, height]);
      const back = pdf.addPage([width, height]);
      await drawDynamicSide({
        pdf, page: front, font, backgroundBytes: publishedTemplate.frontBytes,
        backgroundPath: publishedTemplate.version.front_path, fields: publishedTemplate.fields,
        side: 'front', width, height, context, photoBytes,
        photoPath: application.beneficiary.photo_path, qrBytes,
      });
      await drawDynamicSide({
        pdf, page: back, font, backgroundBytes: publishedTemplate.backBytes,
        backgroundPath: publishedTemplate.version.back_path, fields: publishedTemplate.fields,
        side: 'back', width, height, context, photoBytes,
        photoPath: application.beneficiary.photo_path, qrBytes,
      });
      templateVersionId = publishedTemplate.version.id;
    } else {
      const [frontBytes, backBytes] = await Promise.all([
        Deno.readFile(new URL('./ciptea-front.png', import.meta.url)),
        Deno.readFile(new URL('./ciptea-back.png', import.meta.url)),
      ]);
      const frontBackground = await pdf.embedPng(frontBytes);
      const backBackground = await pdf.embedPng(backBytes);
      const navy = rgb(0.02, 0.17, 0.42);
      const width = 243;
      const height = 376;
      const front = pdf.addPage([width, height]);
      front.drawImage(frontBackground, { x: 0, y: 0, width, height });
      const drawFront = (text: string, x: number, y: number, preferred = 6, maxWidth = 190) => {
        const value = (text || '-').toUpperCase();
        const fitted = fitTextToBox({ text: value, font, preferredSize: preferred, minimumSize: 3.5, maxWidth, maxHeight: preferred * 1.4, multiline: false, autoFit: true });
        front.drawText(value, { x, y, size: fitted.fontSize, font, color: navy, maxWidth });
      };
      drawFront(application.beneficiary.full_name, 44, 120, 6.6, 188);
      drawFront(formatDate(application.beneficiary.birth_date), 106, 108, 6, 70);
      drawFront(String(application.beneficiary.sex || '').slice(0, 1), 202, 108, 6, 20);
      drawFront(parentages?.[0]?.full_name || '-', 35, 87, 5.7, 198);
      drawFront(parentages?.[1]?.full_name || '-', 35, 73, 5.7, 198);
      drawFront(cardNumber, 68, 56, 5.4, 66);
      drawFront(application.beneficiary.sus_number, 168, 56, 5.4, 67);
      drawFront(formatDate(issued), 75, 43, 5.4, 65);
      drawFront(application.beneficiary.cid, 166, 43, 5.4, 70);
      drawFront(`NIVEL ${application.beneficiary.support_level}`, 98, 29, 5.4, 135);
      if (photoBytes) {
        try {
          const image = await embedRaster(pdf, photoBytes, application.beneficiary.photo_path);
          front.drawImage(image, { x: 82.5, y: 163.5, width: 76.5, height: 108.3 });
        } catch (photoError) {
          console.warn('Não foi possível incorporar a fotografia', photoError);
        }
      }
      const back = pdf.addPage([width, height]);
      back.drawImage(backBackground, { x: 0, y: 0, width, height });
      const drawBack = (text: string, x: number, y: number, preferred = 6, maxWidth = 180) => {
        const value = (text || '-').toUpperCase();
        const fitted = fitTextToBox({ text: value, font, preferredSize: preferred, minimumSize: 3.2, maxWidth, maxHeight: preferred * 1.4, multiline: false, autoFit: true });
        back.drawText(value, { x, y, size: fitted.fontSize, font, color: navy, maxWidth });
      };
      drawBack(caregiver?.full_name || '-', 44, 286, 6.2, 180);
      drawBack(caregiver?.phone || '-', 54, 269, 6.2, 170);
      drawBack(caregiver?.relationship || '-', 61, 253, 6.2, 164);
      drawBack(emergency?.blood_type || '-', 67, 211, 6, 70);
      drawBack(emergency?.allergies || 'NAO INFORMADO', 96, 195, 5.2, 132);
      drawBack(emergency?.other_information || '-', 88, 179, 5.2, 140);
      drawBack(formatDate(issued), 155, 139, 5.8, 48);
      const qrImage = await pdf.embedPng(qrBytes);
      back.drawImage(qrImage, { x: 132, y: 38, width: 94, height: 82 });
    }

    const pdfBytes = await pdf.save();
    const fileHash = await sha256Bytes(pdfBytes);
    const pdfPath = `${application.unit_id}/${cardNumber}/v1.pdf`;
    const { error: uploadError } = await admin.storage.from('issued-cards').upload(pdfPath, pdfBytes, { contentType: 'application/pdf', upsert: false });
    if (uploadError) throw uploadError;

    const snapshot = {
      beneficiary: application.beneficiary,
      caregiver,
      emergency,
      parentages,
      card_number: cardNumber,
      issued_at: issuedDate,
      expires_at: expiresDate,
      template_version_id: templateVersionId,
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

    await admin.from('card_versions').insert({
      card_id: card.id,
      version: 1,
      template_version_id: templateVersionId,
      snapshot,
      pdf_path: pdfPath,
      pdf_sha256: fileHash,
      created_by: user.id,
    });
    await admin.from('verification_credentials').insert({ card_id: card.id, token_hash: tokenHash, public_code: publicCode });
    await admin.from('applications').update({ status: 'issued', card_number: cardNumber, issued_at: issuedDate, expires_at: expiresDate }).eq('id', application.id);
    await admin.from('application_status_history').insert({ application_id: application.id, old_status: 'approved', new_status: 'issued', reason: 'Emissão oficial', changed_by: user.id });

    return Response.json({ card_id: card.id, card_number: cardNumber, pdf_path: pdfPath, verification_url: verificationUrl, template_version_id: templateVersionId }, { headers: corsHeaders });
  } catch (error) {
    console.error(error);
    return Response.json({ message: error instanceof Error ? error.message : 'Falha na emissão' }, { status: 500, headers: corsHeaders });
  }
});