import { requireSupabase } from '../../lib/supabase';
import type { CardTemplateDefinition, TemplateBackground } from './types';

function dataUrlToBlob(dataUrl: string) {
  const [metadata, payload] = dataUrl.split(',');
  const mime = metadata.match(/data:([^;]+)/)?.[1] || 'image/png';
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mime });
}

function extension(background: TemplateBackground) {
  return background.dataUrl.startsWith('data:image/jpeg') ? 'jpg' : 'png';
}

export async function publishTemplateToSupabase(template: CardTemplateDefinition) {
  if (!template.front || !template.back) {
    throw new Error('Envie a frente e o verso antes de publicar o modelo.');
  }

  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) throw new Error('Entre com uma conta administradora para publicar o modelo.');

  const { error: deactivateError } = await client
    .from('card_templates')
    .update({ active: false })
    .eq('active', true);
  if (deactivateError) throw deactivateError;

  const { data: existingTemplate, error: templateLookupError } = await client
    .from('card_templates')
    .select('id')
    .eq('id', template.id)
    .maybeSingle();
  if (templateLookupError) throw templateLookupError;

  if (existingTemplate) {
    const { error } = await client.from('card_templates').update({ name: template.name, active: true }).eq('id', template.id);
    if (error) throw error;
  } else {
    const { error } = await client.from('card_templates').insert({ id: template.id, name: template.name, active: true });
    if (error) throw error;
  }

  const { data: latestVersion, error: versionLookupError } = await client
    .from('card_template_versions')
    .select('version')
    .eq('template_id', template.id)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (versionLookupError) throw versionLookupError;
  const version = (latestVersion?.version ?? 0) + 1;
  const basePath = `${auth.user.id}/${template.id}/v${version}`;
  const frontPath = `${basePath}/front.${extension(template.front)}`;
  const backPath = `${basePath}/back.${extension(template.back)}`;

  const [frontUpload, backUpload] = await Promise.all([
    client.storage.from('card-templates').upload(frontPath, dataUrlToBlob(template.front.dataUrl), { upsert: false }),
    client.storage.from('card-templates').upload(backPath, dataUrlToBlob(template.back.dataUrl), { upsert: false }),
  ]);
  if (frontUpload.error) throw frontUpload.error;
  if (backUpload.error) throw backUpload.error;

  const { data: versionRow, error: versionError } = await client
    .from('card_template_versions')
    .insert({
      template_id: template.id,
      version,
      front_path: frontPath,
      back_path: backPath,
      width_mm: 85.6,
      height_mm: 132.5,
      config: {
        engine: 'overlay-v1',
        source_names: { front: template.front.sourceName, back: template.back.sourceName },
      },
      published_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (versionError) throw versionError;

  const rows = template.fields.map((field) => ({
    template_version_id: versionRow.id,
    technical_name: field.key,
    label: field.label,
    side: field.side,
    field_type: field.type,
    x: field.x,
    y: field.y,
    width: field.width,
    height: field.height,
    style: {
      fontSize: field.fontSize,
      fontWeight: field.fontWeight,
      color: field.color,
      align: field.align,
      uppercase: field.uppercase,
      multiline: field.multiline,
      fixedText: field.fixedText,
      placeholder: field.placeholder,
    },
    validation: {},
    required: false,
    visible: field.visible,
  }));
  if (rows.length) {
    const { error: fieldsError } = await client.from('template_fields').insert(rows);
    if (fieldsError) throw fieldsError;
  }

  return { version, templateVersionId: versionRow.id };
}
