import {
  analyzeDocumentStructure,
  placeFieldInDocument,
  type DocumentStructure,
  type TextRegion,
} from './documentStructure';
import {
  FIELD_PRESETS,
  type CardTemplateDefinition,
  type TemplateBackground,
  type TemplateField,
  type TemplateFieldPreset,
  type TemplateSide,
} from './types';

export interface DetectionProgress {
  status: string;
  progress: number;
}

export interface DetectionResult {
  fields: TemplateField[];
  recognizedText: Partial<Record<TemplateSide, string>>;
  structureConfidence: Partial<Record<TemplateSide, number>>;
  warnings: string[];
}

interface OcrLine extends TextRegion {
  text: string;
  normalized: string;
  confidence: number;
}

interface DetectionRule {
  key: string;
  side: TemplateSide;
  aliases: string[];
  forbidden?: string[];
}

const id = () => crypto.randomUUID();
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(value * 100) / 100;

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

const RULES: DetectionRule[] = [
  { key: 'beneficiary.birth_date', side: 'front', aliases: ['data de nascimento', 'nascimento', 'data nasc', 'dt nasc'] },
  { key: 'beneficiary.sex', side: 'front', aliases: ['sexo', 'genero'], forbidden: ['responsavel'] },
  { key: 'parentage.0.full_name', side: 'front', aliases: ['filiacao 1', 'filiacao i', 'nome da mae', 'mae'] },
  { key: 'parentage.1.full_name', side: 'front', aliases: ['filiacao 2', 'filiacao ii', 'nome do pai', 'pai'] },
  { key: 'card.number', side: 'front', aliases: ['numero da ciptea', 'n da ciptea', 'ciptea numero', 'ciptea'] },
  { key: 'beneficiary.sus_number', side: 'front', aliases: ['cartao sus', 'numero sus', 'n sus', 'sus'] },
  { key: 'card.issued_at', side: 'front', aliases: ['data de expedicao', 'expedicao', 'data de emissao', 'emissao'] },
  { key: 'beneficiary.cid', side: 'front', aliases: ['codigo cid', 'cid'] },
  { key: 'beneficiary.support_level', side: 'front', aliases: ['nivel de suporte', 'grau de suporte', 'nivel suporte'] },
  { key: 'beneficiary.photo', side: 'front', aliases: ['fotografia 3x4', 'foto 3x4', 'fotografia', 'foto'] },
  { key: 'beneficiary.full_name', side: 'front', aliases: ['nome completo', 'nome do beneficiario', 'beneficiario', 'nome'], forbidden: ['responsavel', 'cuidador', 'mae', 'pai', 'filiacao'] },
  { key: 'caregiver.phone', side: 'back', aliases: ['telefone do responsavel', 'telefone', 'celular', 'fone', 'contato'] },
  { key: 'caregiver.relationship', side: 'back', aliases: ['grau de parentesco', 'parentesco', 'vinculo'] },
  { key: 'caregiver.full_name', side: 'back', aliases: ['nome do responsavel', 'responsavel legal', 'responsavel', 'cuidador'] },
  { key: 'emergency.blood_type', side: 'back', aliases: ['tipo sanguineo', 'grupo sanguineo', 'sangue'] },
  { key: 'emergency.allergies', side: 'back', aliases: ['alergias', 'alergia'] },
  { key: 'emergency.other_information', side: 'back', aliases: ['outras informacoes', 'informacoes de emergencia', 'observacoes', 'observacao'] },
  { key: 'card.issued_at', side: 'back', aliases: ['data de emissao', 'emissao', 'data de expedicao', 'expedicao'] },
  { key: 'card.qr_code', side: 'back', aliases: ['qr code', 'codigo qr', 'autenticidade', 'verificacao'] },
];

function parseTsv(tsv: string): OcrLine[] {
  const rows = tsv.split(/\r?\n/).slice(1);
  const groups = new Map<string, Array<{ text: string; left: number; top: number; width: number; height: number; confidence: number }>>();

  for (const row of rows) {
    const columns = row.split('\t');
    if (columns.length < 12) continue;
    const [level, page, block, paragraph, line, word, left, top, width, height, confidence, ...textParts] = columns;
    if (Number(level) !== 5 || Number(word) < 1) continue;
    const text = textParts.join('\t').trim();
    const parsedConfidence = Number(confidence);
    if (!text || !Number.isFinite(parsedConfidence) || parsedConfidence < 20) continue;
    const key = `${page}:${block}:${paragraph}:${line}`;
    const current = groups.get(key) || [];
    current.push({
      text,
      left: Number(left),
      top: Number(top),
      width: Number(width),
      height: Number(height),
      confidence: parsedConfidence,
    });
    groups.set(key, current);
  }

  return Array.from(groups.values()).map((words) => {
    const sorted = [...words].sort((a, b) => a.left - b.left);
    const left = Math.min(...sorted.map((word) => word.left));
    const top = Math.min(...sorted.map((word) => word.top));
    const right = Math.max(...sorted.map((word) => word.left + word.width));
    const bottom = Math.max(...sorted.map((word) => word.top + word.height));
    const text = sorted.map((word) => word.text).join(' ');
    return {
      text,
      normalized: normalize(text),
      left,
      top,
      right,
      bottom,
      confidence: sorted.reduce((total, word) => total + word.confidence, 0) / sorted.length,
    };
  }).filter((line) => line.normalized.length > 1);
}

function ruleScore(rule: DetectionRule, line: OcrLine) {
  if (rule.forbidden?.some((term) => line.normalized.includes(normalize(term)))) return -1;
  let best = -1;
  for (const alias of rule.aliases) {
    const normalizedAlias = normalize(alias);
    if (!line.normalized.includes(normalizedAlias)) continue;
    const specificity = normalizedAlias.length / Math.max(normalizedAlias.length, line.normalized.length);
    best = Math.max(best, specificity * 70 + line.confidence * 0.3 + normalizedAlias.length * 0.2);
  }
  return best;
}

function findPreset(key: string, side: TemplateSide): TemplateFieldPreset | undefined {
  return FIELD_PRESETS.find((preset) => preset.key === key && preset.side === side)
    || FIELD_PRESETS.find((preset) => preset.key === key);
}

function suggestedFontSize(preset: TemplateFieldPreset, width: number, height: number) {
  if (preset.type !== 'text' && preset.type !== 'fixed_text') return { maximum: 2.1, minimum: 0.8 };
  const expectedLength = Math.max(4, Math.min(preset.maxLength ?? preset.placeholder.length, Math.max(preset.placeholder.length, 36)));
  const widthLimit = clamp((width * 2.5) / Math.sqrt(expectedLength), 1.25, 3.1);
  const heightLimit = clamp(height * (preset.multiline ? 0.24 : 0.48), 1.2, 3.2);
  const maximum = round(Math.min(widthLimit, heightLimit, preset.multiline ? 2.15 : 3.05));
  const minimum = round(clamp(maximum * (preset.multiline ? 0.34 : 0.38), 0.55, 1.05));
  return { maximum, minimum };
}

function createDetectedField(
  rule: DetectionRule,
  line: OcrLine,
  structure: DocumentStructure,
  allLines: OcrLine[],
): TemplateField | null {
  const preset = findPreset(rule.key, rule.side);
  if (!preset) return null;
  const placement = placeFieldInDocument(line, preset, structure, allLines);
  const font = suggestedFontSize(preset, placement.width, placement.height);
  return {
    id: id(),
    key: preset.key,
    label: preset.label,
    side: rule.side,
    type: preset.type,
    x: placement.x,
    y: placement.y,
    width: placement.width,
    height: placement.height,
    fontSize: font.maximum,
    minFontSize: font.minimum,
    autoFit: true,
    fontWeight: 700,
    color: '#07347a',
    align: 'left',
    uppercase: preset.uppercase ?? true,
    multiline: preset.multiline ?? false,
    visible: true,
    required: preset.required ?? false,
    maxLength: preset.maxLength,
    format: preset.format ?? 'plain',
    autoDetected: true,
    detectionConfidence: round(line.confidence * 0.68 + placement.confidence * 0.32),
    structureConfidence: placement.confidence,
    placementStrategy: placement.strategy,
    detectedLabel: line.text,
    placeholder: preset.placeholder,
  };
}

function intersectionRatio(a: TemplateField, b: TemplateField) {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  const intersection = width * height;
  return intersection / Math.max(1, Math.min(a.width * a.height, b.width * b.height));
}

function removeAccidentalOverlaps(fields: TemplateField[]) {
  const result: TemplateField[] = [];
  for (const source of [...fields].sort((a, b) => a.y - b.y || a.x - b.x)) {
    let field = { ...source };
    for (const previous of result.filter((candidate) => candidate.side === field.side)) {
      if (intersectionRatio(previous, field) < 0.22) continue;
      const previousBottom = previous.y + previous.height;
      const canMoveDown = previousBottom + 0.7 + field.height <= 99;
      if (canMoveDown && Math.abs(previous.x - field.x) < Math.max(previous.width, field.width) * 0.55) {
        field = { ...field, y: round(previousBottom + 0.7), structureConfidence: Math.max(10, (field.structureConfidence ?? 50) - 8) };
      } else if (previous.x < field.x) {
        const newWidth = field.x - previous.x - 0.7;
        if (newWidth >= 5) result[result.indexOf(previous)] = { ...previous, width: round(newWidth) };
      }
    }
    result.push(field);
  }
  return result;
}

function detectFromLines(lines: OcrLine[], side: TemplateSide, structure: DocumentStructure) {
  const candidates: Array<{ field: TemplateField; score: number }> = [];
  const sideRules = RULES.filter((rule) => rule.side === side);

  for (const line of lines) {
    let selected: { rule: DetectionRule; score: number } | undefined;
    for (const rule of sideRules) {
      const score = ruleScore(rule, line);
      if (score < 0 || (selected && selected.score >= score)) continue;
      selected = { rule, score };
    }
    if (!selected || selected.score < 35) continue;
    const field = createDetectedField(selected.rule, line, structure, lines);
    if (field) candidates.push({ field, score: selected.score + (field.structureConfidence ?? 0) * 0.12 });
  }

  const selectedFields = new Map<string, { field: TemplateField; score: number }>();
  for (const candidate of candidates.sort((a, b) => b.score - a.score)) {
    const uniqueKey = `${candidate.field.side}:${candidate.field.key}`;
    if (!selectedFields.has(uniqueKey)) selectedFields.set(uniqueKey, candidate);
  }

  const genericFiliation = lines
    .filter((line) => line.normalized.includes('filiacao'))
    .sort((a, b) => a.top - b.top);
  const parentageKeys = ['parentage.0.full_name', 'parentage.1.full_name'];
  genericFiliation.slice(0, 2).forEach((line, index) => {
    const key = parentageKeys[index];
    const uniqueKey = `front:${key}`;
    if (side !== 'front' || selectedFields.has(uniqueKey)) return;
    const rule: DetectionRule = { key, side: 'front', aliases: ['filiacao'] };
    const field = createDetectedField(rule, line, structure, lines);
    if (field) selectedFields.set(uniqueKey, { field, score: 40 + line.confidence * 0.2 + (field.structureConfidence ?? 0) * 0.1 });
  });

  return removeAccidentalOverlaps(Array.from(selectedFields.values()).map((item) => item.field));
}

async function upscaleForOcr(background: TemplateBackground) {
  const image = new Image();
  image.src = background.dataUrl;
  await image.decode();
  const desiredWidth = clamp(background.width < 1400 ? 1800 : background.width, 1400, 2400);
  const scale = desiredWidth / background.width;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(background.width * scale);
  canvas.height = Math.round(background.height * scale);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('O navegador não conseguiu preparar a imagem para leitura automática.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return { dataUrl: canvas.toDataURL('image/png'), scale };
}

export async function detectTemplateFields(
  backgrounds: Pick<CardTemplateDefinition, 'front' | 'back'>,
  onProgress?: (progress: DetectionProgress) => void,
): Promise<DetectionResult> {
  const available = (['front', 'back'] as TemplateSide[]).filter((side) => backgrounds[side]);
  if (!available.length) throw new Error('Envie a arte original antes de detectar os campos.');

  onProgress?.({ status: 'Carregando o mecanismo de leitura...', progress: 0.02 });
  const tesseract = await import('tesseract.js');
  let currentSide: TemplateSide = available[0];
  const worker = await tesseract.createWorker('por', tesseract.OEM.LSTM_ONLY, {
    logger: (event) => {
      const sideIndex = available.indexOf(currentSide);
      const base = sideIndex / available.length;
      const slice = 1 / available.length;
      const progress = clamp(base + (0.18 + Number(event.progress || 0) * 0.65) * slice, 0, 0.96);
      onProgress?.({ status: event.status || 'Lendo textos do documento...', progress });
    },
  });

  const fields: TemplateField[] = [];
  const recognizedText: Partial<Record<TemplateSide, string>> = {};
  const structureConfidence: Partial<Record<TemplateSide, number>> = {};
  const warnings: string[] = [];

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: tesseract.PSM.AUTO,
      preserve_interword_spaces: '1',
      user_defined_dpi: '300',
    });

    for (const side of available) {
      currentSide = side;
      const sideIndex = available.indexOf(side);
      const base = sideIndex / available.length;
      const slice = 1 / available.length;
      const background = backgrounds[side];
      if (!background) continue;

      onProgress?.({
        status: `Mapeando linhas, caixas e áreas ${side === 'front' ? 'da frente' : 'do verso'}...`,
        progress: base + 0.04 * slice,
      });
      const structure = await analyzeDocumentStructure(background);
      structureConfidence[side] = structure.confidence;

      onProgress?.({
        status: `Lendo rótulos ${side === 'front' ? 'da frente' : 'do verso'}...`,
        progress: base + 0.18 * slice,
      });
      const prepared = await upscaleForOcr(background);
      const result = await (worker as unknown as {
        recognize: (image: string, options: Record<string, unknown>, output: Record<string, boolean>) => Promise<{ data: { text?: string; tsv?: string } }>;
      }).recognize(prepared.dataUrl, {}, { text: true, tsv: true });
      recognizedText[side] = result.data.text || '';
      const scaledLines = parseTsv(result.data.tsv || '').map((line) => ({
        ...line,
        left: line.left / prepared.scale,
        top: line.top / prepared.scale,
        right: line.right / prepared.scale,
        bottom: line.bottom / prepared.scale,
      }));

      onProgress?.({
        status: `Encaixando os campos na estrutura ${side === 'front' ? 'da frente' : 'do verso'}...`,
        progress: base + 0.88 * slice,
      });
      const detected = detectFromLines(scaledLines, side, structure);
      fields.push(...detected);
      if (!detected.length) warnings.push(`Nenhum campo conhecido foi identificado ${side === 'front' ? 'na frente' : 'no verso'}.`);
      if (structure.confidence < 35) warnings.push(`A estrutura ${side === 'front' ? 'da frente' : 'do verso'} possui poucos separadores visuais; revise as áreas sugeridas.`);
    }
  } finally {
    await worker.terminate();
  }

  onProgress?.({ status: 'Estrutura e campos analisados.', progress: 1 });
  return { fields, recognizedText, structureConfidence, warnings };
}
