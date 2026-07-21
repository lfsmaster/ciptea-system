import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { TemplateBackground } from './types';

GlobalWorkerOptions.workerSrc = pdfWorker;

export type SourceSplitMode = 'automatic' | 'full' | 'vertical' | 'horizontal';

interface RenderedPage {
  dataUrl: string;
  width: number;
  height: number;
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Não foi possível ler o arquivo.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Não foi possível abrir a imagem enviada.'));
    image.src = dataUrl;
  });
}

async function normalizeImage(dataUrl: string, sourceName: string): Promise<TemplateBackground> {
  const image = await loadImage(dataUrl);
  return { dataUrl, width: image.naturalWidth, height: image.naturalHeight, sourceName };
}

function canvasToBackground(canvas: HTMLCanvasElement, sourceName: string): TemplateBackground {
  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: canvas.width,
    height: canvas.height,
    sourceName,
  };
}

async function cropBackground(
  page: RenderedPage,
  sourceName: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const image = await loadImage(page.dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('O navegador não conseguiu preparar o recorte do modelo.');
  context.drawImage(image, x, y, width, height, 0, 0, canvas.width, canvas.height);
  return canvasToBackground(canvas, sourceName);
}

async function renderPdf(file: File): Promise<RenderedPage[]> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdfDocument = await getDocument({ data: bytes }).promise;
  const pages: RenderedPage[] = [];
  const count = Math.min(pdfDocument.numPages, 2);

  for (let pageNumber = 1; pageNumber <= count; pageNumber += 1) {
    const page = await pdfDocument.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(2.5, 1800 / Math.max(baseViewport.width, baseViewport.height));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('O navegador não conseguiu renderizar o PDF.');
    await page.render({ canvasContext: context, viewport }).promise;
    pages.push({ dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height });
  }

  return pages;
}

function detectMode(page: RenderedPage, pageCount: number): SourceSplitMode {
  if (pageCount > 1) return 'full';
  if (page.width > page.height * 1.25) return 'vertical';
  if (page.height > page.width * 1.8) return 'horizontal';
  return 'full';
}

export async function processTemplateFile(file: File, requestedMode: SourceSplitMode = 'automatic') {
  const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
  if (!allowed.includes(file.type)) {
    throw new Error('Envie um arquivo PDF, PNG, JPG ou WEBP.');
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error('O arquivo deve ter no máximo 15 MB.');
  }

  const pages = file.type === 'application/pdf'
    ? await renderPdf(file)
    : [await normalizeImage(await readAsDataUrl(file), file.name)];

  const first = pages[0];
  const mode = requestedMode === 'automatic' ? detectMode(first, pages.length) : requestedMode;

  if (pages.length >= 2 && mode !== 'vertical' && mode !== 'horizontal') {
    return {
      front: { ...pages[0], sourceName: `${file.name} — página 1` } as TemplateBackground,
      back: { ...pages[1], sourceName: `${file.name} — página 2` } as TemplateBackground,
      appliedMode: 'full' as SourceSplitMode,
    };
  }

  if (mode === 'vertical') {
    const half = first.width / 2;
    return {
      front: await cropBackground(first, `${file.name} — lado esquerdo`, 0, 0, half, first.height),
      back: await cropBackground(first, `${file.name} — lado direito`, half, 0, first.width - half, first.height),
      appliedMode: mode,
    };
  }

  if (mode === 'horizontal') {
    const half = first.height / 2;
    return {
      front: await cropBackground(first, `${file.name} — parte superior`, 0, 0, first.width, half),
      back: await cropBackground(first, `${file.name} — parte inferior`, 0, half, first.width, first.height - half),
      appliedMode: mode,
    };
  }

  return {
    front: { ...first, sourceName: file.name } as TemplateBackground,
    back: undefined,
    appliedMode: 'full' as SourceSplitMode,
  };
}

export async function processSingleFaceImage(file: File) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('Para uma face isolada, envie PNG, JPG ou WEBP.');
  }
  if (file.size > 15 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 15 MB.');
  return normalizeImage(await readAsDataUrl(file), file.name);
}
