import { Database, ScanSearch, ShieldCheck, Sparkles } from 'lucide-react';
import { Card } from '../../components/ui';
import { TemplateEditor } from '../templates/TemplateEditor';

export function InitialSetupPage() {
  return (
    <main className="min-h-screen bg-slate-100 p-4 sm:p-8">
      <div className="mx-auto max-w-[1700px] space-y-6">
        <header className="rounded-2xl bg-brand-900 px-6 py-7 text-white shadow-card">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-200">Configuração inicial inteligente</p>
          <h1 className="mt-2 text-3xl font-black">Envie o documento e deixe o sistema reconstruir sua estrutura de preenchimento</h1>
          <p className="mt-3 max-w-5xl text-sm leading-6 text-blue-100">
            O sistema preserva a arte original, identifica linhas, caixas, divisões, áreas vazias e limites de cada seção, executa OCR em português,
            reconhece os rótulos e encaixa os campos na área real disponível. Os critérios de validação e os tamanhos das fontes também são calculados automaticamente.
          </p>
        </header>

        <TemplateEditor initialSetup />

        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <div className="flex items-start gap-3">
              <ScanSearch className="mt-0.5 text-brand-700" />
              <div>
                <h2 className="text-lg font-bold">Leitura da estrutura real</h2>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  O mecanismo procura bordas, linhas horizontais e verticais, células, subáreas, espaços de fotografia, QR Code e regiões livres.
                  Cada campo é limitado pelos separadores encontrados para não invadir outras partes da arte.
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 text-amber-600" />
              <div>
                <h2 className="text-lg font-bold">Área e fonte adaptáveis</h2>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  O sistema decide se o conteúdo deve ficar à direita, abaixo, sobre uma linha de preenchimento ou dentro de uma célula específica.
                  Depois calcula o maior tamanho de fonte que cabe integralmente na largura e na altura disponíveis.
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-start gap-3">
              <Database className="mt-0.5 text-brand-700" />
              <div>
                <h2 className="text-lg font-bold">Conectar o Supabase</h2>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  O modelo visual pode ser configurado antes do backend. Para liberar login, cadastros, emissão oficial e autenticação,
                  configure no repositório a URL e a chave publicável do projeto Supabase.
                </p>
                <pre className="mt-4 overflow-auto rounded-xl bg-slate-950 p-4 text-sm text-slate-100">
                  VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co{`\n`}
                  VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
                </pre>
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 text-emerald-700" />
            <div>
              <h2 className="text-lg font-bold">Regras de segurança</h2>
              <ul className="mt-2 grid gap-2 text-sm leading-6 text-slate-700 md:grid-cols-2">
                <li>• Nunca use a chave <code>service_role</code> no navegador.</li>
                <li>• A arte original e os campos ficam separados.</li>
                <li>• O QR Code não contém dados pessoais ou médicos diretamente.</li>
                <li>• A emissão oficial exige usuário autorizado e solicitação aprovada.</li>
              </ul>
              <a className="mt-5 inline-block font-semibold text-brand-700 hover:underline" href="#/demonstracao">
                Abrir demonstração com o modelo salvo
              </a>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
