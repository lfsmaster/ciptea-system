import type { TemplateBackground, TemplateFieldPreset } from './types';

export interface StructureLine {
  position: number;
  start: number;
  end: number;
  confidence: number;
}

export interface StructureCell {
  left: number;
  top: number;
  right: number;
  bottom: number;
  confidence: number;
}

export interface DocumentStructure {
  width: number;
  height: number;
  horizontalLines: StructureLine[];
  verticalLines: StructureLine[];
  cells: StructureCell[];
  contentBounds: { left: number; top: number; right: number; bottom: number };
  confidence: number;
}

export interface TextRegion {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface StructurePlacement {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  strategy: 'underline' | 'cell-right' | 'cell-below' | 'nearby-cell' | 'free-space';
}

interface PixelMask {
  width: number;
  height: number;
  scale: number;
  dark: Uint8Array;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(value * 100) / 100;

function median(values: number[]) {
  if (!values.length) return 255;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

async function createPixelMask(background: TemplateBackground): Promise<PixelMask> {
  const image = new Image();
  image.src = background.dataUrl;
  await image.decode();

  const maximumWidth = 1600;
  const scale = Math.min(1, maximumWidth / image.naturalWidth);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Não foi possível analisar a estrutura gráfica do documento.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, width, height);

  const pixels = context.getImageData(0, 0, width, height).data;
  const borderR: number[] = [];
  const borderG: number[] = [];
  const borderB: number[] = [];
  const sampleStep = Math.max(1, Math.floor(Math.min(width, height) / 180));
  for (let x = 0; x < width; x += sampleStep) {
    for (const y of [0, Math.min(height - 1, 2), Math.max(0, height - 3), height - 1]) {
      const index = (y * width + x) * 4;
      borderR.push(pixels[index]); borderG.push(pixels[index + 1]); borderB.push(pixels[index + 2]);
    }
  }
  for (let y = 0; y < height; y += sampleStep) {
    for (const x of [0, Math.min(width - 1, 2), Math.max(0, width - 3), width - 1]) {
      const index = (y * width + x) * 4;
      borderR.push(pixels[index]); borderG.push(pixels[index + 1]); borderB.push(pixels[index + 2]);
    }
  }

  const backgroundR = median(borderR);
  const backgroundG = median(borderG);
  const backgroundB = median(borderB);
  const backgroundLuma = backgroundR * 0.299 + backgroundG * 0.587 + backgroundB * 0.114;
  const dark = new Uint8Array(width * height);

  for (let index = 0; index < width * height; index += 1) {
    const pixel = index * 4;
    const r = pixels[pixel];
    const g = pixels[pixel + 1];
    const b = pixels[pixel + 2];
    const luma = r * 0.299 + g * 0.587 + b * 0.114;
    const colorDistance = Math.abs(r - backgroundR) + Math.abs(g - backgroundG) + Math.abs(b - backgroundB);
    const sufficientlyDark = luma < clamp(backgroundLuma - 32, 95, 225);
    const coloredStructure = colorDistance > 115 && luma < 242;
    dark[index] = sufficientlyDark || coloredStructure ? 1 : 0;
  }

  return { width, height, scale, dark };
}

function longestRun(mask: Uint8Array, offset: number, step: number, length: number) {
  let bestStart = 0;
  let bestEnd = 0;
  let currentStart = 0;
  let currentLength = 0;
  let darkCount = 0;
  for (let index = 0; index < length; index += 1) {
    const value = mask[offset + index * step];
    darkCount += value;
    if (value) {
      if (!currentLength) currentStart = index;
      currentLength += 1;
      if (currentLength > bestEnd - bestStart) {
        bestStart = currentStart;
        bestEnd = index + 1;
      }
    } else {
      currentLength = 0;
    }
  }
  return { start: bestStart, end: bestEnd, runRatio: (bestEnd - bestStart) / length, density: darkCount / length };
}

function mergeLineCandidates(candidates: StructureLine[], tolerance: number) {
  if (!candidates.length) return [];
  const sorted = [...candidates].sort((a, b) => a.position - b.position);
  const groups: StructureLine[][] = [];
  for (const candidate of sorted) {
    const group = groups.at(-1);
    if (!group || candidate.position - group.at(-1)!.position > tolerance) groups.push([candidate]);
    else group.push(candidate);
  }
  return groups.map((group) => {
    const strongest = [...group].sort((a, b) => b.confidence - a.confidence)[0];
    const total = group.reduce((sum, item) => sum + item.confidence, 0) || 1;
    return {
      position: group.reduce((sum, item) => sum + item.position * item.confidence, 0) / total,
      start: Math.min(...group.map((item) => item.start)),
      end: Math.max(...group.map((item) => item.end)),
      confidence: strongest.confidence,
    };
  });
}

function detectHorizontalLines(mask: PixelMask) {
  const candidates: StructureLine[] = [];
  for (let y = 0; y < mask.height; y += 1) {
    const run = longestRun(mask.dark, y * mask.width, 1, mask.width);
    if (run.runRatio < 0.17 || run.density < 0.025) continue;
    const confidence = clamp(run.runRatio * 78 + run.density * 22, 0, 100);
    candidates.push({ position: y, start: run.start, end: run.end, confidence });
  }
  return mergeLineCandidates(candidates, Math.max(2, Math.round(mask.height * 0.0018)));
}

function detectVerticalLines(mask: PixelMask) {
  const candidates: StructureLine[] = [];
  for (let x = 0; x < mask.width; x += 1) {
    const run = longestRun(mask.dark, x, mask.width, mask.height);
    if (run.runRatio < 0.17 || run.density < 0.025) continue;
    const confidence = clamp(run.runRatio * 78 + run.density * 22, 0, 100);
    candidates.push({ position: x, start: run.start, end: run.end, confidence });
  }
  return mergeLineCandidates(candidates, Math.max(2, Math.round(mask.width * 0.0018)));
}

function contentBounds(mask: PixelMask) {
  let left = mask.width;
  let top = mask.height;
  let right = 0;
  let bottom = 0;
  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      if (!mask.dark[y * mask.width + x]) continue;
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
  }
  if (right <= left || bottom <= top) return { left: 0, top: 0, right: mask.width, bottom: mask.height };
  const marginX = mask.width * 0.01;
  const marginY = mask.height * 0.01;
  return {
    left: clamp(left - marginX, 0, mask.width),
    top: clamp(top - marginY, 0, mask.height),
    right: clamp(right + marginX, 0, mask.width),
    bottom: clamp(bottom + marginY, 0, mask.height),
  };
}

function structuralPositions(lines: StructureLine[], maximum: number, orthogonalMaximum: number) {
  const longLines = lines
    .filter((line) => (line.end - line.start) / orthogonalMaximum >= 0.42 && line.confidence >= 30)
    .map((line) => line.position);
  const positions = [0, ...longLines, maximum].sort((a, b) => a - b);
  return positions.filter((position, index) => index === 0 || position - positions[index - 1] >= maximum * 0.018);
}

function buildCells(mask: PixelMask, horizontalLines: StructureLine[], verticalLines: StructureLine[]) {
  const xs = structuralPositions(verticalLines, mask.width, mask.height);
  const ys = structuralPositions(horizontalLines, mask.height, mask.width);
  const cells: StructureCell[] = [];
  for (let yi = 0; yi < ys.length - 1; yi += 1) {
    for (let xi = 0; xi < xs.length - 1; xi += 1) {
      const left = xs[xi]; const right = xs[xi + 1]; const top = ys[yi]; const bottom = ys[yi + 1];
      if (right - left < mask.width * 0.035 || bottom - top < mask.height * 0.018) continue;
      const boundaries = [
        verticalLines.find((line) => Math.abs(line.position - left) < mask.width * 0.01)?.confidence ?? 35,
        verticalLines.find((line) => Math.abs(line.position - right) < mask.width * 0.01)?.confidence ?? 35,
        horizontalLines.find((line) => Math.abs(line.position - top) < mask.height * 0.01)?.confidence ?? 35,
        horizontalLines.find((line) => Math.abs(line.position - bottom) < mask.height * 0.01)?.confidence ?? 35,
      ];
      cells.push({ left, top, right, bottom, confidence: boundaries.reduce((sum, value) => sum + value, 0) / boundaries.length });
    }
  }
  return cells;
}

export async function analyzeDocumentStructure(background: TemplateBackground): Promise<DocumentStructure> {
  const mask = await createPixelMask(background);
  const horizontalLines = detectHorizontalLines(mask);
  const verticalLines = detectVerticalLines(mask);
  const cells = buildCells(mask, horizontalLines, verticalLines);
  const bounds = contentBounds(mask);
  const lineEvidence = Math.min(1, (horizontalLines.length + verticalLines.length) / 14);
  const cellEvidence = Math.min(1, cells.length / 12);
  const confidence = round(clamp((lineEvidence * 0.65 + cellEvidence * 0.35) * 100, 12, 98));
  const inverseScale = 1 / mask.scale;
  const scaleLine = (line: StructureLine): StructureLine => ({
    position: line.position * inverseScale,
    start: line.start * inverseScale,
    end: line.end * inverseScale,
    confidence: line.confidence,
  });
  return {
    width: background.width,
    height: background.height,
    horizontalLines: horizontalLines.map(scaleLine),
    verticalLines: verticalLines.map(scaleLine),
    cells: cells.map((cell) => ({
      left: cell.left * inverseScale,
      top: cell.top * inverseScale,
      right: cell.right * inverseScale,
      bottom: cell.bottom * inverseScale,
      confidence: cell.confidence,
    })),
    contentBounds: {
      left: bounds.left * inverseScale,
      top: bounds.top * inverseScale,
      right: bounds.right * inverseScale,
      bottom: bounds.bottom * inverseScale,
    },
    confidence,
  };
}

function overlapRatio(a: TextRegion, b: TextRegion) {
  const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const intersection = width * height;
  const area = Math.max(1, (a.right - a.left) * (a.bottom - a.top));
  return intersection / area;
}

function containingCell(region: TextRegion, structure: DocumentStructure) {
  const centerX = (region.left + region.right) / 2;
  const centerY = (region.top + region.bottom) / 2;
  return structure.cells
    .filter((cell) => centerX >= cell.left - 2 && centerX <= cell.right + 2 && centerY >= cell.top - 2 && centerY <= cell.bottom + 2)
    .sort((a, b) => (a.right - a.left) * (a.bottom - a.top) - (b.right - b.left) * (b.bottom - b.top))[0];
}

function nearestObstacleRight(region: TextRegion, regions: TextRegion[], maximum: number) {
  const centerY = (region.top + region.bottom) / 2;
  return regions
    .filter((candidate) => candidate.left > region.right && centerY >= candidate.top - (region.bottom - region.top) && centerY <= candidate.bottom + (region.bottom - region.top))
    .reduce((nearest, candidate) => Math.min(nearest, candidate.left), maximum);
}

function nearestObstacleBelow(region: TextRegion, regions: TextRegion[], maximum: number) {
  const centerX = (region.left + region.right) / 2;
  return regions
    .filter((candidate) => candidate.top > region.bottom && centerX >= candidate.left - (region.right - region.left) && centerX <= candidate.right + (region.right - region.left))
    .reduce((nearest, candidate) => Math.min(nearest, candidate.top), maximum);
}

function underlinePlacement(region: TextRegion, structure: DocumentStructure, preset: TemplateFieldPreset) {
  if (preset.type === 'image' || preset.type === 'qrcode') return undefined;
  const labelHeight = Math.max(2, region.bottom - region.top);
  const candidates = structure.horizontalLines.filter((line) => {
    const verticalDistance = line.position - region.bottom;
    const usefulStart = Math.max(line.start, region.right - labelHeight * 0.5);
    return verticalDistance >= -labelHeight * 0.35
      && verticalDistance <= labelHeight * 2.4
      && line.end - usefulStart >= structure.width * 0.12;
  });
  const line = candidates.sort((a, b) => Math.abs(a.position - region.bottom) - Math.abs(b.position - region.bottom))[0];
  if (!line) return undefined;
  const left = clamp(Math.max(region.right + labelHeight * 0.25, line.start), 0, structure.width);
  const right = clamp(line.end, left + structure.width * 0.08, structure.width);
  const height = preset.multiline ? labelHeight * 2.8 : labelHeight * 1.55;
  const top = clamp(line.position - height - labelHeight * 0.15, 0, structure.height - height);
  return { left, top, right, bottom: top + height, confidence: clamp(line.confidence + 12, 0, 100), strategy: 'underline' as const };
}

function emptyCellForMedia(region: TextRegion, structure: DocumentStructure, regions: TextRegion[], preset: TemplateFieldPreset) {
  const labelCenterX = (region.left + region.right) / 2;
  const labelCenterY = (region.top + region.bottom) / 2;
  const targetRatio = preset.type === 'image' ? 0.75 : 1;
  const candidates = structure.cells.map((cell) => {
    const width = cell.right - cell.left;
    const height = cell.bottom - cell.top;
    const areaRatio = (width * height) / (structure.width * structure.height);
    const cellRegion = { left: cell.left, top: cell.top, right: cell.right, bottom: cell.bottom };
    const textCoverage = regions.reduce((total, text) => total + overlapRatio(text, cellRegion), 0);
    const centerX = (cell.left + cell.right) / 2;
    const centerY = (cell.top + cell.bottom) / 2;
    const distance = Math.hypot((centerX - labelCenterX) / structure.width, (centerY - labelCenterY) / structure.height);
    const ratioPenalty = Math.abs(width / Math.max(1, height) - targetRatio);
    const score = cell.confidence * 0.35 + areaRatio * 420 - textCoverage * 120 - distance * 45 - ratioPenalty * 24;
    return { cell, score, areaRatio };
  }).filter((candidate) => candidate.areaRatio >= 0.018 && candidate.areaRatio <= 0.28)
    .sort((a, b) => b.score - a.score);
  return candidates[0]?.cell;
}

function toPlacement(rectangle: { left: number; top: number; right: number; bottom: number; confidence: number; strategy: StructurePlacement['strategy'] }, structure: DocumentStructure): StructurePlacement {
  const x = clamp((rectangle.left / structure.width) * 100, 0, 99);
  const y = clamp((rectangle.top / structure.height) * 100, 0, 99);
  const width = clamp(((rectangle.right - rectangle.left) / structure.width) * 100, 2, 100 - x);
  const height = clamp(((rectangle.bottom - rectangle.top) / structure.height) * 100, 2, 100 - y);
  return { x: round(x), y: round(y), width: round(width), height: round(height), confidence: round(rectangle.confidence), strategy: rectangle.strategy };
}

export function placeFieldInDocument(
  label: TextRegion,
  preset: TemplateFieldPreset,
  structure: DocumentStructure,
  textRegions: TextRegion[],
): StructurePlacement {
  const underline = underlinePlacement(label, structure, preset);
  if (underline) return toPlacement(underline, structure);

  const labelHeight = Math.max(2, label.bottom - label.top);
  const paddingX = Math.max(3, structure.width * 0.008);
  const paddingY = Math.max(2, structure.height * 0.004);
  const cell = containingCell(label, structure) ?? {
    ...structure.contentBounds,
    confidence: structure.confidence * 0.55,
  };

  if (preset.type === 'image' || preset.type === 'qrcode') {
    const mediaCell = emptyCellForMedia(label, structure, textRegions, preset);
    if (mediaCell) {
      const insetX = Math.max(3, (mediaCell.right - mediaCell.left) * 0.045);
      const insetY = Math.max(3, (mediaCell.bottom - mediaCell.top) * 0.045);
      return toPlacement({
        left: mediaCell.left + insetX,
        top: mediaCell.top + insetY,
        right: mediaCell.right - insetX,
        bottom: mediaCell.bottom - insetY,
        confidence: clamp(mediaCell.confidence + 8, 0, 100),
        strategy: 'nearby-cell',
      }, structure);
    }
  }

  const rightBoundary = Math.min(cell.right - paddingX, nearestObstacleRight(label, textRegions, cell.right - paddingX));
  const belowBoundary = Math.min(cell.bottom - paddingY, nearestObstacleBelow(label, textRegions, cell.bottom - paddingY));
  const rightLeft = label.right + paddingX;
  const rightWidth = rightBoundary - rightLeft;
  const singleHeight = clamp(labelHeight * 1.75, structure.height * 0.025, structure.height * 0.075);
  const rightTop = clamp(label.top - labelHeight * 0.25, cell.top + paddingY, cell.bottom - singleHeight - paddingY);
  const rightBottom = preset.multiline
    ? clamp(cell.bottom - paddingY, rightTop + singleHeight, rightTop + structure.height * 0.14)
    : rightTop + singleHeight;

  const belowLeft = clamp(Math.max(cell.left + paddingX, label.left), 0, structure.width);
  const belowTop = label.bottom + paddingY;
  const belowRight = cell.right - paddingX;
  const belowBottom = Math.min(belowBoundary, preset.multiline ? belowTop + structure.height * 0.14 : belowTop + singleHeight);

  const rightScore = (rightWidth / structure.width) * 100 + (rightBottom - rightTop) / structure.height * 35;
  const belowScore = ((belowRight - belowLeft) / structure.width) * 85 + (belowBottom - belowTop) / structure.height * 50;
  const minimumWidth = preset.type === 'text' ? structure.width * 0.12 : structure.width * 0.16;

  if (rightWidth >= minimumWidth && rightBottom > rightTop && rightScore >= belowScore * 0.82) {
    return toPlacement({
      left: rightLeft,
      top: rightTop,
      right: rightBoundary,
      bottom: rightBottom,
      confidence: clamp(cell.confidence * 0.65 + structure.confidence * 0.35, 0, 100),
      strategy: 'cell-right',
    }, structure);
  }

  if (belowRight - belowLeft >= minimumWidth && belowBottom > belowTop) {
    return toPlacement({
      left: belowLeft,
      top: belowTop,
      right: belowRight,
      bottom: belowBottom,
      confidence: clamp(cell.confidence * 0.6 + structure.confidence * 0.4, 0, 100),
      strategy: 'cell-below',
    }, structure);
  }

  const fallbackLeft = clamp(label.right + paddingX, structure.contentBounds.left, structure.width * 0.78);
  const fallbackTop = clamp(label.top - labelHeight * 0.2, structure.contentBounds.top, structure.height * 0.94);
  const fallbackWidth = preset.type === 'image' ? structure.width * 0.25 : preset.type === 'qrcode' ? structure.width * 0.23 : structure.width * 0.42;
  const fallbackHeight = preset.type === 'image' ? fallbackWidth * 1.28 : preset.type === 'qrcode' ? fallbackWidth : preset.multiline ? structure.height * 0.09 : singleHeight;
  return toPlacement({
    left: fallbackLeft,
    top: fallbackTop,
    right: Math.min(structure.width * 0.97, fallbackLeft + fallbackWidth),
    bottom: Math.min(structure.height * 0.98, fallbackTop + fallbackHeight),
    confidence: clamp(structure.confidence * 0.45, 10, 70),
    strategy: 'free-space',
  }, structure);
}
