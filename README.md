# Polímata · App Operacional (GRC)

Sistema operacional de Governança, Risco e Conformidade da [Polímata Consultoria em GRC](https://polimatagrc.com.br).
Roda em produção em https://app.polimatagrc.com.br.

## Stack

- **Frontend:** Vite + React 18 + React Router 6
- **Backend:** Supabase (Postgres + Auth + Edge Functions)
- **Hospedagem:** Vercel (auto-deploy via push na `main`)
- **CI:** GitHub Actions (ESLint + Vite build em cada PR)

## Estrutura do repo

```
.
├── src/
│   ├── pages/              Telas principais (Dashboard, Relatórios, PorArea, etc)
│   │   └── dashboard/      Componentes do dashboard, incl. PorArea + filhos
│   ├── components/         Componentes reutilizáveis (Modais, etc)
│   │   └── modal*/         Filhos extraídos dos modais grandes (step/secao pattern)
│   ├── lib/                Lógica de negócio + helpers
│   │   ├── fases.js        Cálculo de fases do MRC
│   │   ├── maturidade/     Cálculo de maturidade por área
│   │   ├── relatorio/      Geração do Excel de relatório executivo
│   │   ├── exportMrc/      Geração do Excel de MRC completo
│   │   └── statusWorkflow.js  Estados e transições de controles
│   ├── contexts/           AuthContext, etc
│   └── assets/             Imagens e ícones usados via import
├── public/                 Assets estáticos servidos diretamente (favicons, logos)
├── supabase/functions/     Edge functions versionadas
├── sql/                    Migrations SQL
├── referencia/             Mockups e referências históricas
├── Polímata_Sistema Operacional/   Documentação, checklists e mockups internos
└── .github/workflows/      CI (lint + build em PRs)
```

## Como rodar localmente

```bash
npm install
npm run dev      # roda em http://localhost:5173
npm run build    # build de produção
npm run preview  # preview do build de produção
npm run lint     # roda ESLint (não bloqueia warnings)
npm run lint:strict  # roda ESLint bloqueando warnings também
```

Pré-requisitos: Node 20+.

## Variáveis de ambiente

Arquivo `.env.local` (não versionado):

```
VITE_SUPABASE_URL=https://<seu-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<sua-anon-key>
```

Em produção (Vercel), as mesmas variáveis estão configuradas no dashboard.

## Deploy

Automático: push pra `main` dispara build na Vercel.
PRs geram preview URL antes do merge.

A pipeline do GitHub Actions (`.github/workflows/ci.yml`) bloqueia o merge se:
- ESLint detectar erro (`no-undef`, hooks chamados condicionalmente, etc)
- `npm run build` falhar

## Domínios

- **Produção:** https://app.polimatagrc.com.br (Vercel project `polimata-app`, branch `main`)
- **Dev (parado):** https://polimatadev.vercel.app (Vercel project `polimatadev`, branch `master`)

## Convenções de código

- **ESLint flat config** em `eslint.config.js`. Regras críticas: `no-undef`, `react-hooks/rules-of-hooks`.
- **Imports não usados** são removidos via `eslint-plugin-unused-imports` (auto-fix com `npx eslint --fix`).
- **Code-splitting** configurado em `vite.config.js`: chunks separados pra `react-vendor`, `supabase` e `excel`.

## Banco

Schema completo em `sql/`. Tabelas principais:

- `clientes`, `projetos`, `sistemas`, `areas`, `subprocessos`
- `mrc` (controles), `controle_passos_teste`, `controle_comentarios`
- `audit_log`, `solicitacoes`, `revisoes`, `notificacoes`
- `perfis`, `perfis_projetos`, `permissoes_area`
- `regua_maturidade`, `criticidade_config`, `matriz_calor_config`, `fases_config`, `cores_config`, `constantes_negocio`

Edge functions: `clientes-webhook` (sync com gestão financeira), `send-monthly-report`, `send-email`, `create-user`, `manage-user`.
