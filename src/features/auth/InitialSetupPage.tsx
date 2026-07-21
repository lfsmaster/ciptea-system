import { Database, ScanSearch, ShieldCheck, Sparkles } from 'lucide-react';
import { Card } from '../../components/ui';
import { TemplateEditor } from '../templates/TemplateEditor';

export function InitialSetupPage() {
  return (
    <main className="min-h-screen bg-slate-100 p-4 sm:p-8">
      <div className="mx-auto max-w-[1700px] space-y-6">
        <header className="rounded-2xl bg-brand-900 px-6 py-7 text-white shadow-card">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-200">Configuração inicial inteligente</p>
          <h1 className="mt-2 text-3xl font-black">Envie o arquivo e deixe o sistema identificar os campos</h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-blue-100">
            O sistema preserva a arte original, executa OCR em português, reconhece os rótulos, cria os campos de preenchimento,
            aplica critérios de validação e ativa o ajuste automático das fontes. Depois, basta revisar o resultado e salvar o modelo.
          </p>
        </header>

        <TemplateEditor initialSetup />

        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <div className="flex items-start gap-3">
              <ScanSearch className="mt-0.5 text-brand-700" />
              <div>
                <h2 className="text-lg font-bold">Identificação automática</h2>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  A leitura procura nome, nascimento, sexo, filiação, SUS, CID, nível de suporte, responsável, telefone,
                  dados de emergência, fotografia e QR Code. Campos não reconhecidos podem ser acrescentados manualmente.
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 text-amber-600" />
              <div>
                <h2 className="text-lg font-bold">Fontes adaptáveis</h2>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  O sistema começa no tamanho máximo configurado e reduz a fonte somente quando necessário, respeitando o limite mínimo,
                  a largura, a altura e a quantidade de linhas de cada campo.
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