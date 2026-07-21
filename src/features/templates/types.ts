export type TemplateSide = 'front' | 'back';
export type TemplateFieldType = 'text' | 'image' | 'qrcode' | 'fixed_text';
export type TemplateTextAlign = 'left' | 'center' | 'right';

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
  fontWeight: 400 | 600 | 700 | 800;
  color: string;
  align: TemplateTextAlign;
  uppercase: boolean;
  multiline: boolean;
  visible: boolean;
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
}

export const FIELD_PRESETS: TemplateFieldPreset[] = [
  { key: 'beneficiary.full_name', label: 'Nome completo', side: 'front', type: 'text', placeholder: 'PESSOA DE DEMONSTRAÇÃO' },
  { key: 'beneficiary.birth_date', label: 'Data de nascimento', side: 'front', type: 'text', placeholder: '15/06/2014' },
  { key: 'beneficiary.sex', label: 'Sexo', side: 'front', type: 'text', placeholder: 'F' },
  { key: 'parentage.0.full_name', label: 'Filiação 1', side: 'front', type: 'text', placeholder: 'NOME DA FILIAÇÃO' },
  { key: 'parentage.1.full_name', label: 'Filiação 2', side: 'front', type: 'text', placeholder: 'NOME DA FILIAÇÃO' },
  { key: 'card.number', label: 'Número da CIPTEA', side: 'front', type: 'text', placeholder: 'CIPTEA-MDO-2026-000001' },
  { key: 'beneficiary.sus_number', label: 'Número do SUS', side: 'front', type: 'text', placeholder: '000 0000 0000 0000' },
  { key: 'card.issued_at', label: 'Data de expedição', side: 'front', type: 'text', placeholder: '21/07/2026' },
  { key: 'beneficiary.cid', label: 'CID', side: 'front', type: 'text', placeholder: 'F84.0' },
  { key: 'beneficiary.support_level', label: 'Nível de suporte', side: 'front', type: 'text', placeholder: 'NÍVEL 2' },
  { key: 'beneficiary.photo', label: 'Fotografia 3x4', side: 'front', type: 'image', placeholder: 'FOTO 3X4' },
  { key: 'caregiver.full_name', label: 'Responsável/Cuidador', side: 'back', type: 'text', placeholder: 'RESPONSÁVEL DE DEMONSTRAÇÃO' },
  { key: 'caregiver.phone', label: 'Telefone do responsável', side: 'back', type: 'text', placeholder: '(69) 90000-0000' },
  { key: 'caregiver.relationship', label: 'Parentesco', side: 'back', type: 'text', placeholder: 'RESPONSÁVEL LEGAL' },
  { key: 'emergency.blood_type', label: 'Tipo sanguíneo', side: 'back', type: 'text', placeholder: 'O+' },
  { key: 'emergency.allergies', label: 'Alergias', side: 'back', type: 'text', placeholder: 'NÃO INFORMADO' },
  { key: 'emergency.other_information', label: 'Outras informações', side: 'back', type: 'text', placeholder: 'DADOS DE EMERGÊNCIA' },
  { key: 'card.issued_at', label: 'Data de emissão', side: 'back', type: 'text', placeholder: '21/07/2026' },
  { key: 'card.qr_code', label: 'QR Code de autenticação', side: 'back', type: 'qrcode', placeholder: 'QR CODE' },
  { key: 'fixed.text', label: 'Texto fixo', side: 'front', type: 'fixed_text', placeholder: 'TEXTO FIXO' },
];

export const SAMPLE_TEMPLATE_VALUES: Record<string, string> = Object.fromEntries(
  FIELD_PRESETS.map((preset) => [preset.key, preset.placeholder]),
);
