import { describe, expect, it } from 'vitest';
import { placeFieldInDocument, type DocumentStructure } from '../src/features/templates/documentStructure';
import type { TemplateFieldPreset } from '../src/features/templates/types';

const textPreset: TemplateFieldPreset = {
  key: 'beneficiary.full_name',
  label: 'Nome completo',
  side: 'front',
  type: 'text',
  placeholder: 'PESSOA DE DEMONSTRAÇÃO',
  required: true,
  maxLength: 120,
  format: 'plain',
};

function structure(overrides: Partial<DocumentStructure> = {}): DocumentStructure {
  return {
    width: 1000,
    height: 1400,
    horizontalLines: [],
    verticalLines: [],
    cells: [{ left: 50, top: 100, right: 950, bottom: 300, confidence: 82 }],
    contentBounds: { left: 40, top: 50, right: 960, bottom: 1350 },
    confidence: 78,
    ...overrides,
  };
}

describe('placeFieldInDocument', () => {
  it('usa uma linha de preenchimento detectada como limite real do campo', () => {
    const document = structure({
      horizontalLines: [{ position: 180, start: 360, end: 900, confidence: 88 }],
    });
    const label = { left: 100, top: 140, right: 340, bottom: 175 };
    const placement = placeFieldInDocument(label, textPreset, document, [label]);
    expect(placement.strategy).toBe('underline');
    expect(placement.x).toBeGreaterThanOrEqual(34);
    expect(placement.x + placement.width).toBeLessThanOrEqual(91);
  });

  it('encaixa o texto à direita do rótulo dentro da célula detectada', () => {
    const document = structure();
    const label = { left: 100, top: 150, right: 280, bottom: 185 };
    const placement = placeFieldInDocument(label, textPreset, document, [label]);
    expect(placement.strategy).toBe('cell-right');
    expect(placement.x).toBeGreaterThan(28);
    expect(placement.x + placement.width).toBeLessThanOrEqual(95);
  });

  it('reserva uma célula vazia próxima para fotografia', () => {
    const photoPreset: TemplateFieldPreset = {
      key: 'beneficiary.photo',
      label: 'Fotografia 3x4',
      side: 'front',
      type: 'image',
      placeholder: 'FOTO 3X4',
      required: true,
      format: 'plain',
    };
    const document = structure({
      cells: [
        { left: 50, top: 100, right: 560, bottom: 300, confidence: 76 },
        { left: 600, top: 80, right: 930, bottom: 570, confidence: 91 },
      ],
    });
    const label = { left: 100, top: 150, right: 280, bottom: 185 };
    const placement = placeFieldInDocument(label, photoPreset, document, [label]);
    expect(placement.strategy).toBe('nearby-cell');
    expect(placement.x).toBeGreaterThanOrEqual(60);
    expect(placement.height).toBeGreaterThan(20);
  });
});
