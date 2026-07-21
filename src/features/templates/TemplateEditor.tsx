import { CloudUpload, Download, FileJson, Plus, Save, Trash2, Upload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Button, Card, Field, Input, Select, Textarea } from '../../components/ui';
import { useAuth } from '../auth/AuthProvider';
import { processSingleFaceImage, processTemplateFile, type SourceSplitMode } from './fileProcessing';
import { TemplateRenderer } from './TemplateRenderer';
import { FIELD_PRESETS, SAMPLE_TEMPLATE_VALUES, type CardTemplateDefinition, type TemplateField, type TemplateFieldPreset, type TemplateSide } from './types';
import { clearActiveTemplate, downloadTemplateJson, importTemplateJson, loadActiveTemplate, saveActiveTemplate } from './templateStore';
import { publishTemplateToSupabase } from './templatePublishing';

const id = () => crypto.randomUUID();
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function emptyTemplate(): CardTemplateDefinition {
  const now = new Date().toISOString();
  return { id: id(), name: 'Modelo CIPTEA personalizado', version: 1, createdAt: now, updatedAt: now, fields: [] };
}

function fromPreset(preset: TemplateFieldPreset, side: TemplateSide): TemplateField {
  return {
    id: id(), key: preset.key, label: preset.label, side, type: preset.type,
    x: 8, y: 8, width: preset.type === 'qrcode' ? 28 : preset.type === 'image' ? 27 : 52,
    height: preset.type === 'qrcode' ? 23 : preset.type === 'image' ? 30 : 5,
    fontSize: 2.1, fontWeight: 700, color: '#07347a', align: 'left', uppercase: true,
    multiline: false, visible: true, fixedText: preset.type === 'fixed_text' ? preset.placeholder : undefined,
    placeholder: preset.placeholder,
  };
}

export function TemplateEditor({ initialSetup = false }: { initialSetup?: boolean }) {
  const { configured, user, roles } = useAuth();
  const [template, setTemplate] = useState<CardTemplateDefinition>(emptyTemplate);
  const [side, setSide] = useState<TemplateSide>('front');
  const [selectedId, setSelectedId] = useState<string>();
  const [mode, setMode] = useState<SourceSplitMode>('automatic');
  const [file, setFile] = useState<File>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const jsonRef = useRef<HTMLInputElement>(null);

  useEffect(() => { void loadActiveTemplate().then((saved) => { if (saved) setTemplate(saved); }); }, []);
  const selected = useMemo(() => template.fields.find((field) => field.id === selectedId), [template.fields, selectedId]);
  const patchTemplate = (patch: Partial<CardTemplateDefinition>) => setTemplate((current) => ({ ...current, ...patch, updatedAt: new Date().toISOString() }));
  const patchField = (fieldId: string, patch: Partial<TemplateField>) => setTemplate((current) => ({
    ...current, updatedAt: new Date().toISOString(),
    fields: current.fields.map((field) => field.id === fieldId ? { ...field, ...patch } : field),
  }));

  async function process(fileToUse = file) {
    if (!fileToUse) return;
    setBusy(true); setMessage('');
    try {
      const result = await processTemplateFile(fileToUse, mode);
      patchTemplate({ front: result.front, back: result.back });
      setMessage(result.back
        ? 'Arquivo original carregado. A arte foi preservada e separada em frente e verso.'
        : 'Arquivo original carregado como frente. Envie o verso separadamente, se necessário.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao processar o arquivo.'); }
    finally { setBusy(false); }
  }

  async function setFace(faceFile: File, face: TemplateSide) {
    setBusy(true); setMessage('');
    try {
      const background = await processSingleFaceImage(faceFile);
      patchTemplate(face === 'front' ? { front: background } : { back: background });
      setMessage(`${face === 'front' ? 'Frente' : 'Verso'} atualizado sem alterar a arte.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao abrir a imagem.'); }
    finally { setBusy(false); }
  }

  function add(preset: TemplateFieldPreset) {
    const field = fromPreset(preset, side);
    setTemplate((current) => ({ ...current, fields: [...current.fields, field], updatedAt: new Date().toISOString() }));
    setSelectedId(field.id);
  }

  function pointerStart(event: ReactPointerEvent<HTMLElement>, field: TemplateField, action: 'move' | 'resize') {
    event.preventDefault(); event.stopPropagation(); setSelectedId(field.id);
    const canvas = event.currentTarget.closest('[data-template-side]') as HTMLElement | null;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const start = { x: event.clientX, y: event.clientY, field: { ...field } };
    const move = (next: PointerEvent) => {
      const dx = ((next.clientX - start.x) / rect.width) * 100;
      const dy = ((next.clientY - start.y) / rect.height) * 100;
      if (action === 'move') patchField(field.id, {
        x: clamp(start.field.x + dx, 0, 100 - start.field.width),
        y: clamp(start.field.y + dy, 0, 100 - start.field.height),
      });
      else patchField(field.id, {
        width: clamp(start.field.width + dx, 2, 100 - start.field.x),
        height: clamp(start.field.height + dy, 2, 100 - start.field.y),
      });
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  async function save() {
    if (!template.front) { setMessage('Envie o arquivo original da frente antes de salvar.'); return; }
    setBusy(true);
    try { await saveActiveTemplate(template); setMessage('Modelo salvo. Os dados serão inseridos somente na camada sobre a arte original.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao salvar.'); }
    finally { setBusy(false); }
  }

  async function publish() {
    setBusy(true); setMessage('');
    try {
      await saveActiveTemplate(template);
      const result = await publishTemplateToSupabase(template);
      const updated = { ...template, version: result.version, updatedAt: new Date().toISOString() };
      setTemplate(updated); await saveActiveTemplate(updated);
      setMessage(`Modelo publicado como versão ${result.version}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao publicar.'); }
    finally { setBusy(false); }
  }

  async function reset() {
    if (!confirm('Remover a configuração local do modelo?')) return;
    await clearActiveTemplate(); setTemplate(emptyTemplate()); setSelectedId(undefined); setMessage('Configuração removida.');
  }

  return <div className="space-y-6">
    <Card>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <h2 className="text-xl font-bold">Motor de inserção de campos</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">O arquivo enviado permanece como fundo imutável. O sistema cria somente campos por cima da arte, sem redesenhar logotipos, textos, fontes ou elementos do documento original.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={jsonRef} hidden type="file" accept="application/json" onChange={(event) => {
            const selectedFile = event.target.files?.[0];
            if (selectedFile) void importTemplateJson(selectedFile).then(async (imported) => { setTemplate(imported); await saveActiveTemplate(imported); setMessage('Configuração importada.'); }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Falha ao importar.'));
            event.currentTarget.value = '';
          }} />
          <Button variant="secondary" onClick={() => jsonRef.current?.click()}><FileJson size={17}/> Importar</Button>
          <Button variant="secondary" disabled={!template.front} onClick={() => downloadTemplateJson(template)}><Download size={17}/> Exportar</Button>
          <Button disabled={busy} onClick={() => void save()}><Save size={17}/> Salvar modelo</Button>
          {configured && user && roles.includes('administrator') && <Button disabled={busy || !template.front || !template.back} onClick={() => void publish()}><CloudUpload size={17}/> Publicar</Button>}
        </div>
      </div>
      {message && <p className="mt-4 rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-900">{message}</p>}
    </Card>

    <div className="grid gap-6 xl:grid-cols-[330px_minmax(0,1fr)_340px]">
      <div className="space-y-6">
        <Card>
          <h3 className="font-bold">1. Arquivo original</h3>
          <Field label="Nome do modelo"><Input value={template.name} onChange={(event) => patchTemplate({ name: event.target.value })}/></Field>
          <div className="mt-4"><Field label="Como separar o arquivo">
            <Select value={mode} onChange={(event) => setMode(event.target.value as SourceSplitMode)}>
              <option value="automatic">Detectar automaticamente</option><option value="vertical">Frente à esquerda e verso à direita</option><option value="horizontal">Frente acima e verso abaixo</option><option value="full">Usar página inteira</option>
            </Select>
          </Field></div>
          <label className="mt-4 grid cursor-pointer place-items-center rounded-xl border-2 border-dashed border-slate-300 p-6 text-center hover:bg-slate-50">
            <Upload size={28} className="text-brand-700"/><span className="mt-2 text-sm font-semibold">Selecionar PDF, PNG, JPG ou WEBP</span><span className="text-xs text-slate-500">Máximo de 15 MB</span>
            <input hidden type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(event) => { const next = event.target.files?.[0]; if (next) { setFile(next); void process(next); } event.currentTarget.value = ''; }}/>
          </label>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(['front','back'] as TemplateSide[]).map((face) => <label key={face} className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-center text-sm font-semibold hover:bg-slate-50">Trocar {face === 'front' ? 'frente' : 'verso'}<input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const next = event.target.files?.[0]; if (next) void setFace(next, face); event.currentTarget.value = ''; }}/></label>)}
          </div>
        </Card>
        <Card>
          <h3 className="font-bold">2. Campos a preencher</h3>
          <p className="mt-1 text-sm text-slate-600">Escolha a face e clique no dado que deseja inserir.</p>
          <div className="mt-3 flex rounded-lg border p-1"><button type="button" className={`flex-1 rounded-md py-2 text-sm font-semibold ${side === 'front' ? 'bg-brand-900 text-white' : ''}`} onClick={() => setSide('front')}>Frente</button><button type="button" className={`flex-1 rounded-md py-2 text-sm font-semibold ${side === 'back' ? 'bg-brand-900 text-white' : ''}`} onClick={() => setSide('back')}>Verso</button></div>
          <div className="mt-3 max-h-[480px] space-y-2 overflow-auto">{FIELD_PRESETS.map((preset, index) => <button type="button" key={`${preset.key}-${index}`} onClick={() => add(preset)} className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm hover:border-sky-400 hover:bg-sky-50"><span>{preset.label}</span><Plus size={16}/></button>)}</div>
        </Card>
      </div>

      <Card className="min-w-0">
        <div className="mb-4"><h3 className="font-bold">3. Posicione os campos</h3><p className="text-sm text-slate-600">Arraste para mover e use o quadrado azul para redimensionar.</p></div>
        <div className="mx-auto max-w-3xl overflow-hidden rounded-xl border bg-slate-100" onClick={() => setSelectedId(undefined)}>
          <TemplateRenderer template={template} side={side} values={SAMPLE_TEMPLATE_VALUES} editMode selectedFieldId={selectedId} onSelectField={setSelectedId} onPointerDown={pointerStart}/>
        </div>
      </Card>

      <div className="space-y-6"><Card>
        <h3 className="font-bold">4. Propriedades do campo</h3>
        {!selected ? <p className="mt-3 text-sm text-slate-600">Selecione um campo na arte.</p> : <div className="mt-4 space-y-4">
          <Field label="Rótulo"><Input value={selected.label} onChange={(event) => patchField(selected.id, { label: event.target.value })}/></Field>
          <Field label="Dado preenchido"><Select value={selected.key} onChange={(event) => { const preset = FIELD_PRESETS.find((item) => item.key === event.target.value); patchField(selected.id, { key: event.target.value, type: preset?.type ?? selected.type, placeholder: preset?.placeholder ?? selected.placeholder }); }}>{FIELD_PRESETS.map((preset,index) => <option key={`${preset.key}-${index}`} value={preset.key}>{preset.label}</option>)}</Select></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Face"><Select value={selected.side} onChange={(event) => patchField(selected.id,{ side:event.target.value as TemplateSide })}><option value="front">Frente</option><option value="back">Verso</option></Select></Field><Field label="Tipo"><Select value={selected.type} onChange={(event) => patchField(selected.id,{ type:event.target.value as TemplateField['type'] })}><option value="text">Texto</option><option value="fixed_text">Texto fixo</option><option value="image">Foto</option><option value="qrcode">QR Code</option></Select></Field></div>
          {selected.type === 'fixed_text' && <Field label="Texto fixo"><Textarea value={selected.fixedText || ''} onChange={(event) => patchField(selected.id,{ fixedText:event.target.value })}/></Field>}
          <div className="grid grid-cols-2 gap-3"><Field label="X (%)"><Input type="number" value={selected.x} onChange={(event) => patchField(selected.id,{x:Number(event.target.value)})}/></Field><Field label="Y (%)"><Input type="number" value={selected.y} onChange={(event) => patchField(selected.id,{y:Number(event.target.value)})}/></Field><Field label="Largura (%)"><Input type="number" value={selected.width} onChange={(event) => patchField(selected.id,{width:Number(event.target.value)})}/></Field><Field label="Altura (%)"><Input type="number" value={selected.height} onChange={(event) => patchField(selected.id,{height:Number(event.target.value)})}/></Field></div>
          {(selected.type === 'text' || selected.type === 'fixed_text') && <><div className="grid grid-cols-2 gap-3"><Field label="Tamanho"><Input type="number" step="0.1" value={selected.fontSize} onChange={(event) => patchField(selected.id,{fontSize:Number(event.target.value)})}/></Field><Field label="Cor"><Input type="color" value={selected.color} onChange={(event) => patchField(selected.id,{color:event.target.value})}/></Field><Field label="Peso"><Select value={selected.fontWeight} onChange={(event) => patchField(selected.id,{fontWeight:Number(event.target.value) as TemplateField['fontWeight']})}><option value="400">Normal</option><option value="600">Seminegrito</option><option value="700">Negrito</option><option value="800">Extra negrito</option></Select></Field><Field label="Alinhamento"><Select value={selected.align} onChange={(event) => patchField(selected.id,{align:event.target.value as TemplateField['align']})}><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></Select></Field></div><label className="flex gap-2 text-sm"><input type="checkbox" checked={selected.uppercase} onChange={(event) => patchField(selected.id,{uppercase:event.target.checked})}/> Maiúsculas</label><label className="flex gap-2 text-sm"><input type="checkbox" checked={selected.multiline} onChange={(event) => patchField(selected.id,{multiline:event.target.checked})}/> Múltiplas linhas</label></>}
          <Button className="w-full" variant="danger" onClick={() => { setTemplate((current) => ({...current, fields:current.fields.filter((field) => field.id !== selected.id)})); setSelectedId(undefined); }}><Trash2 size={17}/> Excluir campo</Button>
        </div>}
      </Card>
      <Card><h3 className="font-bold">Proteção da arte</h3><ul className="mt-3 space-y-2 text-sm text-slate-600"><li>• O fundo original não é editado.</li><li>• Campos e arte ficam separados.</li><li>• Dados pessoais não são gravados no arquivo-base.</li><li>• A configuração pode ser exportada em JSON.</li></ul>{!initialSetup && <Button className="mt-4 w-full" variant="secondary" onClick={() => void reset()}><Trash2 size={17}/> Limpar modelo</Button>}</Card></div>
    </div>
  </div>;
}
