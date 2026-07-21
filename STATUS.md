# Status da implementação

## Implementado nesta versão

- React, TypeScript, Vite, Tailwind CSS e HashRouter.
- Configuração de publicação no GitHub Pages por GitHub Actions.
- Supabase Auth, recuperação de senha e sessão persistente.
- Perfis administrativos e controle por funções.
- Cadastro, edição, listagem e detalhes de beneficiários.
- Upload e recorte de fotografia 3x4.
- Solicitações, histórico de status e separação entre operador e aprovador.
- Fila e tela de emissão.
- Prévia fiel de frente e verso baseada no PDF fornecido.
- Emissão oficial em Edge Function com PDF, hash, armazenamento privado e versionamento.
- QR Code com URL e token aleatório armazenado como SHA-256.
- Consulta pública controlada por Edge Function.
- Suspensão/cancelamento estrutural com revogação do token.
- Banco PostgreSQL, índices, constraints, funções e RLS.
- Buckets privados e políticas de Storage.
- Auditoria com remoção de campos sensíveis do log de beneficiários.
- Testes unitários e teste E2E preparado.
- Página pública de demonstração com dados fictícios em `#/demonstracao`.

## Validações executadas

- `npm run typecheck`: aprovado.
- `npm run lint`: aprovado.
- `npm run test`: 3 testes aprovados.
- `npm run build`: aprovado.
- O teste E2E está incluído, mas a execução com Chromium foi bloqueada pelo ambiente isolado desta sessão.

## Dependências de implantação

A execução completa depende de um projeto Supabase, aplicação das migrations, publicação das Edge Functions, criação do primeiro administrador e configuração dos secrets do GitHub. Dados reais somente após homologação jurídica, administrativa e de segurança.
