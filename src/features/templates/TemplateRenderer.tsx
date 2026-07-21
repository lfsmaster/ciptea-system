import { QRCodeSVG } from 'qrcode.react';
import type { CSSProperties } from 'react';
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
  onPointerDown?: (event: React.PointerEvent<HTMLElement>, field: TemplateField, action: 'move' | 'resize') => void;
}

function fieldText(field: TemplateField, values: Record<string, string | undefined>) {
  const raw = field.type === 'fixed_text' ? field.fixedText : values[field.key];
  const value = raw || field.placeholder || '—';
  return field.uppercase ? value.toUpperCase() : value;
}

function textStyle(field: TemplateField): CSSProperties {
  return {
    color: field.color,
    fontSize: `${field.fontSize}cqw`,
    fontWeight: field.fontWeight,
    textAlign: field.align,
    lineHeight: field.multiline ? 1.12 : 1,
    whiteSpace: field.multiline ? 'normal' : 'nowrap',
    overflow: 'hidden',
    textOverflow: field.multiline ? 'clip' : 'ellipsis',
    wordBreak: field.multiline ? 'break-word' : 'normal',
  };
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
        const commonClass = `absolute flex min-w-0 items-center ${editMode ? 'cursor-move select-none' : ''} ${selected ? 'z-20 ring-2 ring-sky-500 ring-offset-1' : editMode ? 'z-10 ring-1 ring-sky-400/80' : ''}`;

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
              <div className="w-full" style={textStyle(field)}>
                {fieldText(field, values)}
              </div>
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
