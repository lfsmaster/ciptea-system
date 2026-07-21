import { QRCodeSVG } from 'qrcode.react';
import { useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import type { CardTemplateDefinition, TemplateField, TemplateSide } from './types';

interface TemplateRendererProps {
  template: CardTemplateDefinition;
  side: TemplateSide;
  values: Record<string, string | undefined>;
  photoUrl?: string;
  verificationUrl?: string;
  editMode?: boolean;
  selectedFieldId?: string;
  onSelectField?: (fieldId: string) => void;
  onPointerDown?: (event: ReactPointerEvent<HTMLElement>, field: TemplateField, action: 'move' | 'resize') => void;
}

function fieldText(field: TemplateField, values: Record<string, string | undefined>) {
  const raw = field.type === 'fixed_text' ? field.fixedText : values[field.key];
  const value = raw || field.placeholder || '—';
  return field.uppercase ? value.toUpperCase() : value;
}

function baseTextStyle(field: TemplateField): CSSProperties {
  return {
    color: field.color,
    fontWeight: field.fontWeight,
    textAlign: field.align,
    lineHeight: field.multiline ? 1.12 : 1,
    whiteSpace: field.multiline ? 'normal' : 'nowrap',
    overflow: 'hidden',
    wordBreak: field.multiline ? 'break-word' : 'normal',
  };
}

function AutoFitText({ field, text }: { field: TemplateField; text: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(`${field.fontSize}cqw`);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const content = container?.firstElementChild as HTMLElement | null;
    if (!container || !content) return;
    let animationFrame = 0;

    const fit = () => {
      const template = container.closest('[data-template-side]') as HTMLElement | null;
      const templateWidth = template?.clientWidth || container.clientWidth || 320;
      const preferred = Math.max(4, templateWidth * (Number(field.fontSize || 2.1) / 100));
      const minimum = Math.max(3, templateWidth * (Number(field.minFontSize ?? 0.8) / 100));

      if (field.autoFit === false) {
        const next = `${preferred}px`;
        container.style.fontSize = next;
        setFontSize(next);
        return;
      }

      let low = Math.min(minimum, preferred);
      let high = Math.max(minimum, preferred);
      let best = low;

      for (let attempt = 0; attempt < 14; attempt += 1) {
        const current = (low + high) / 2;
        container.style.fontSize = `${current}px`;
        const fitsWidth = content.scrollWidth <= container.clientWidth + 1;
        const fitsHeight = content.scrollHeight <= container.clientHeight + 1;
        if (fitsWidth && fitsHeight) {
          best = current;
          low = current;
        } else {
          high = current;
        }
      }

      const next = `${Math.max(minimum, best).toFixed(2)}px`;
      container.style.fontSize = next;
      setFontSize(next);
    };

    const scheduleFit = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(fit);
    };

    scheduleFit();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(scheduleFit) : undefined;
    observer?.observe(container);
    const template = container.closest('[data-template-side]');
    if (template instanceof HTMLElement) observer?.observe(template);

    return () => {
      cancelAnimationFrame(animationFrame);
      observer?.disconnect();
    };
  }, [field.autoFit, field.fontSize, field.minFontSize, field.multiline, field.width, field.height, text]);

  return (
    <div ref={containerRef} className="flex h-full w-full items-center" style={{ ...baseTextStyle(field), fontSize }}>
      <span className="block w-full">{text}</span>
    </div>
  );
}

export function TemplateRenderer({
  template,
  side,
  values,
  photoUrl,
  verificationUrl,
  editMode = false,
  selectedFieldId,
  onSelectField,
  onPointerDown,
}: TemplateRendererProps) {
  const background = side === 'front' ? template.front : template.back;
  const fields = template.fields.filter((field) => field.side === side && field.visible);
  const ratio = background ? `${background.width} / ${background.height}` : '85.6 / 132.5';

  return (
    <div
      className="relative w-full overflow-hidden bg-white shadow-sm"
      style={{ aspectRatio: ratio, containerType: 'inline-size', touchAction: editMode ? 'none' : 'auto' }}
      data-template-side={side}
    >
      {background ? (
        <img
          src={background.dataUrl}
          alt={`Arquivo original do ${side === 'front' ? 'anverso' : 'verso'}`}
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-fill"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
          Envie o arquivo original desta face.
        </div>
      )}

      {fields.map((field) => {
        const selected = selectedFieldId === field.id;
        const commonStyle: CSSProperties = {
          left: `${field.x}%`,
          top: `${field.y}%`,
          width: `${field.width}%`,
          height: `${field.height}%`,
        };
        const commonClass = `absolute flex min-w-0 items-center overflow-hidden ${editMode ? 'cursor-move select-none' : ''} ${selected ? 'z-20 ring-2 ring-sky-500 ring-offset-1' : editMode ? 'z-10 ring-1 ring-sky-400/80' : ''}`;

        return (
          <div
            key={field.id}
            className={commonClass}
            style={commonStyle}
            onClick={(event) => {
              if (!editMode) return;
              event.stopPropagation();
              onSelectField?.(field.id);
            }}
            onPointerDown={(event) => {
              if (!editMode) return;
              onPointerDown?.(event, field, 'move');
            }}
            role={editMode ? 'button' : undefined}
            tabIndex={editMode ? 0 : undefined}
            aria-label={editMode ? `Editar campo ${field.label}` : undefined}
            title={field.autoDetected ? `Detectado automaticamente (${Math.round(field.detectionConfidence || 0)}%)` : undefined}
          >
            {field.type === 'image' ? (
              photoUrl ? (
                <img src={photoUrl} alt={field.label} className="pointer-events-none h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center bg-white/80 p-1 text-center text-[2cqw] font-bold text-slate-500">
                  {field.placeholder || 'FOTO'}
                </div>
              )
            ) : field.type === 'qrcode' ? (
              verificationUrl ? (
                <div className="h-full w-full bg-white p-[4%]">
                  <QRCodeSVG value={verificationUrl} className="h-full w-full" level="H" />
                </div>
              ) : (
                <div className="grid h-full w-full place-items-center bg-white/90 text-center text-[1.8cqw] font-bold text-slate-700">
                  QR CODE
                </div>
              )
            ) : (
              <AutoFitText field={field} text={fieldText(field, values)} />
            )}

            {editMode && selected && (
              <button
                type="button"
                className="absolute -bottom-2 -right-2 h-5 w-5 cursor-se-resize rounded-sm border-2 border-white bg-sky-600 shadow"
                aria-label={`Redimensionar ${field.label}`}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  onPointerDown?.(event, field, 'resize');
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}