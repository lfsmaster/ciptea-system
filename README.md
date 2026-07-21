# Sistema CIPTEA

Aplicação web para cadastro, análise, aprovação, emissão, impressão, entrega e autenticação pública de carteirinhas CIPTEA. O frontend é React + TypeScript + Vite e pode ser hospedado no GitHub Pages; o backend, autenticação, banco, arquivos privados e funções críticas ficam no Supabase.

## Estado desta entrega

A base executável inclui autenticação, RBAC, cadastro de beneficiários, recorte de foto 3x4, solicitações, transição de status, separação de funções, fila de emissão, prévia frente/verso baseada no modelo anexado, emissão oficial por Edge Function, PDF versionado, QR Code com token aleatório, consulta pública minimizada, revogação, RLS, buckets privados, auditoria estrutural, testes e publicação automática.

O uso com dados reais depende de homologação jurídica, administrativa, de segurança e de acessibilidade. Revise também os textos legais e a dimensão física oficial da carteirinha.

## Requisitos

- Node.js 22+
- Conta GitHub
- Projeto Supabase
- Supabase CLI para migrations e Edge Functions

## Instalação local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Preencha `.env.local`:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=SUA_CHAVE_PUBLICAVEL
VITE_GITHUB_REPOSITORY_NAME=ciptea-system
VITE_PUBLIC_APP_URL=http://localhost:5173/
```

Nunca use `service_role` no frontend.

## Supabase

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase db push
supabase functions deploy verify-card
supabase functions deploy issue-card
supabase functions deploy revoke-card
```

Configure os segredos das Edge Functions:

```bash
supabase secrets set PUBLIC_APP_URL=https://SEU_USUARIO.github.io/SEU_REPOSITORIO/
```

O Supabase já fornece `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` no ambiente das funções.

## Primeiro administrador

1. Crie o primeiro usuário pelo Supabase Auth.
2. Execute o `supabase/seed.sql`.
3. Atualize a unidade do perfil e conceda a função `administrator` usando os comandos comentados no seed.
4. Ative MFA para administradores e aprovadores no painel do Supabase Auth.

## Modelo da carteirinha

Os fundos de frente e verso estão em `public/assets/templates`. Eles foram recortados do modelo fornecido e usados na prévia. Para emissão oficial final, envie versões de alta resolução ao bucket privado `card-templates` e adapte a Edge Function para usá-las como fundo do PDF, mantendo o versionamento.

## Testes e qualidade

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:e2e
```

## GitHub Pages

Crie os secrets do repositório:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Depois ative **Settings > Pages > Source: GitHub Actions**. O workflow configura automaticamente o `base` do Vite para o nome do repositório e usa `HashRouter`.

```bash
git init
git add .
git commit -m "feat: versão inicial do sistema CIPTEA"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git push -u origin main
```

## Segurança

- RLS habilitado em todas as tabelas expostas.
- Buckets privados e URLs assinadas.
- Numeração gerada transacionalmente no PostgreSQL.
- Token público aleatório, armazenado como SHA-256.
- QR Code sem CPF, SUS, CID ou informações médicas.
- Consulta pública via Edge Function, sem acesso direto a `beneficiaries`.
- Service role restrita às Edge Functions.
- Auditoria sem política de alteração ou exclusão para usuários comuns.
- Dados médicos não devem ser registrados em logs operacionais.
- Seeds e testes usam apenas dados fictícios.

## Próximos incrementos previstos na mesma arquitetura

- Editor visual completo com Konva e versionamento de campos.
- Formulário em etapas para filiação, cuidador, emergência e documentos.
- Relatórios PDF/CSV por período e unidade.
- Registro de impressão e entrega com recibo.
- Interface administrativa de usuários, permissões e unidades.
- Testes SQL automatizados de RLS em CI.
- Rate limiting externo ou controle por tabela para a consulta pública.

## Dados institucionais pendentes

Substitua os valores de demonstração pelos dados oficiais do órgão emissor, formato final da numeração, prazo de validade, textos legais, logotipos, regras de aprovação e conteúdo permitido na consulta pública. Não invente informações legais ou institucionais.
