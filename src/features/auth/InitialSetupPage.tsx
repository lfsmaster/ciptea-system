import { Database, ShieldCheck } from 'lucide-react';
import { Card } from '../../components/ui';
import { TemplateEditor } from '../templates/TemplateEditor';

export function InitialSetupPage() {
  return (
    <main className="min-h-screen bg-slate-100 p-4 sm:p-8">
      <div className="mx-auto max-w-[1700px] space-y-6">
        <header className="rounded-2xl bg-brand-900 px-6 py-7 text-white shadow-card">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-200">Configuração inicial</p>
          <h1 className="mt-2 text-3xl font-black">Configure o arquivo original e os campos da CIPTEA</h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-blue-100">
            Primeiro envie a arte original. Depois escolha quais dados serão preenchidos, posicione cada campo e salve o modelo.
            O sistema mantém o arquivo enviado como fundo e acrescenta somente a camada de informações.
          </p>
        </header>

        <TemplateEditor initialSetup />

        <div className="grid gap-6 lg:grid-cols-2">
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

          <Card>
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 text-emerald-700" />
              <div>
                <h2 className="text-lg font-bold">Regras de segurança</h2>
                <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
                  <li>• Nunca use a chave <code>service_role</code> no navegador.</li>
                  <li>• A arte original e os campos ficam separados.</li>
                  <li>• O QR Code não deve conter dados pessoais ou médicos diretamente.</li>
                  <li>• A emissão oficial dependerá de usuário autorizado e solicitação aprovada.</li>
                </ul>
                <a className="mt-5 inline-block font-semibold text-brand-700 hover:underline" href="#/demonstracao">
                  Abrir demonstração com o modelo salvo
                </a>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
