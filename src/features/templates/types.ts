export type TemplateSide = 'front' | 'back';
export type TemplateFieldType = 'text' | 'image' | 'qrcode' | 'fixed_text';
export type TemplateTextAlign = 'left' | 'center' | 'right';
export type TemplateFieldFormat = 'plain' | 'date' | 'phone' | 'sus' | 'cid' | 'single_character' | 'card_number' | 'support_level';

export interface TemplateBackground {
  dataUrl: string;
  width: number;
  height: number;
  sourceName: string;
}

export interface TemplateField {
  id: string;
  key: string;
  label: string;
  side: TemplateSide;
  type: TemplateFieldType;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  minFontSize?: number;
  autoFit?: boolean;
  fontWeight: 400 | 600 | 700 | 800;
  color: string;
  align: TemplateTextAlign;
  uppercase: boolean;
  multiline: boolean;
  visible: boolean;
  required?: boolean;
  maxLength?: number;
  format?: TemplateFieldFormat;
  autoDetected?: boolean;
  detectionConfidence?: number;
  detectedLabel?: string;
  fixedText?: string;
  placeholder?: string;
}

export interface CardTemplateDefinition {
  id: string;
  name: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  front?: TemplateBackground;
  back?: TemplateBackground;
  fields: TemplateField[];
}

export interface TemplateFieldPreset {
  key: string;
  label: string;
  side: TemplateSide;
  type: TemplateFieldType;
  placeholder: string;
  required?: boolean;
  maxLength?: number;
  format?: TemplateFieldFormat;
  multiline?: boolean;
  uppercase?: boolean;
}

export const FIELD_PRESETS: TemplateFieldPreset[] = [
  { key: 'beneficiary.full_name', label: 'Nome completo', side: 'front', type: 'text', placeholder: 'PESSOA DE DEMONSTRAÇÃO', required: true, maxLength: 120, format: 'plain' },
  { key: 'beneficiary.birth_date', label: 'Data de nascimento', side: 'front', type: 'text', placeholder: '15/06/2014', required: true, maxLength: 10, format: 'date' },
  { key: 'beneficiary.sex', label: 'Sexo', side: 'front', type: 'text', placeholder: 'F', required: true, maxLength: 1, format: 'single_character' },
  { key: 'parentage.0.full_name', label: 'Filiação 1', side: 'front', type: 'text', placeholder: 'NOME DA FILIAÇÃO', required: true, maxLength: 120, format: 'plain' },
  { key: 'parentage.1.full_name', label: 'Filiação 2', side: 'front', type: 'text', placeholder: 'NOME DA FILIAÇÃO', maxLength: 120, format: 'plain' },
  { key: 'card.number', label: 'Número da CIPTEA', side: 'front', type: 'text', placeholder: 'CIPTEA-MDO-2026-000001', required: true, maxLength: 40, format: 'card_number' },
  { key: 'beneficiary.sus_number', label: 'Número do SUS', side: 'front', type: 'text', placeholder: '000 0000 0000 0000', required: true, maxLength: 18, format: 'sus' },
  { key: 'card.issued_at', label: 'Data de expedição', side: 'front', type: 'text', placeholder: '21/07/2026', required: true, maxLength: 10, format: 'date' },
  { key: 'beneficiary.cid', label: 'CID', side: 'front', type: 'text', placeholder: 'F84.0', required: true, maxLength: 20, format: 'cid' },
  { key: 'beneficiary.support_level', label: 'Nível de suporte', side: 'front', type: 'text', placeholder: 'NÍVEL 2', required: true, maxLength: 20, format: 'support_level' },
  { key: 'beneficiary.photo', label: 'Fotografia 3x4', side: 'front', type: 'image', placeholder: 'FOTO 3X4', required: true, format: 'plain' },
  { key: 'caregiver.full_name', label: 'Responsável/Cuidador', side: 'back', type: 'text', placeholder: 'RESPONSÁVEL DE DEMONSTRAÇÃO', required: true, maxLength: 120, format: 'plain' },
  { key: 'caregiver.phone', label: 'Telefone do responsável', side: 'back', type: 'text', placeholder: '(69) 90000-0000', required: true, maxLength: 20, format: 'phone' },
  { key: 'caregiver.relationship', label: 'Parentesco', side: 'back', type: 'text', placeholder: 'RESPONSÁVEL LEGAL', required: true, maxLength: 60, format: 'plain' },
  { key: 'emergency.blood_type', label: 'Tipo sanguíneo', side: 'back', type: 'text', placeholder: 'O+', maxLength: 4, format: 'plain' },
  { key: 'emergency.allergies', label: 'Alergias', side: 'back', type: 'text', placeholder: 'NÃO INFORMADO', maxLength: 180, format: 'plain', multiline: true },
  { key: 'emergency.other_information', label: 'Outras informações', side: 'back', type: 'text', placeholder: 'DADOS DE EMERGÊNCIA', maxLength: 240, format: 'plain', multiline: true },
  { key: 'card.issued_at', label: 'Data de emissão', side: 'back', type: 'text', placeholder: '21/07/2026', required: true, maxLength: 10, format: 'date' },
  { key: 'card.qr_code', label: 'QR Code de autenticação', side: 'back', type: 'qrcode', placeholder: 'QR CODE', required: true, format: 'plain' },
  { key: 'fixed.text', label: 'Texto fixo', side: 'front', type: 'fixed_text', placeholder: 'TEXTO FIXO', maxLength: 240, format: 'plain' },
];

export const SAMPLE_TEMPLATE_VALUES: Record<string, string> = Object.fromEntries(
  FIELD_PRESETS.map((preset) => [preset.key, preset.placeholder]),
);