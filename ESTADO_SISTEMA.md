# ESTADO DO SISTEMA — CI Polímata
> Atualizado em: 31/03/2026
> Cole no início de cada novo chat para retomar sem perda de contexto.

---

## Stack & Infra
- **Frontend:** React + Vite
- **Backend:** Supabase (PostgreSQL, Auth, Storage, RLS)
- **Deploy:** Vercel (auto-deploy do master) → polimata-ci.vercel.app
- **Repo:** github.com/julianapolimata/polimata-ci (público, branch master)
- **Supabase project:** iqtkpyrpwxypwcwrhulx
- **Local:** C:\projetos\polimata-fresh\polimata-ci
- **Admin:** juliana@polimatagrc.com.br
- **Git push:** sempre usar `--force`

---

## Identidade Visual (obrigatório)
- **Cores Navy:** #00112C / #00203E / #1D3B5C
- **Cores Dourado:** #CC915E / #A6512F / #6C2D10
- **Creme:** #F3EEE4
- **Fonte:** Montserrat para TUDO (sem exceções)
- **Cores fases:** F1=#00203E, F2=#1D3B5C, F3=#660033, F4=#660066, F5=#A6512F
- **Regra de duas camadas:** estrutural = marca; semântico = cores universais
- **NUNCA usar roxo** — Planos de Ação usa dourado (#CC915E)

---

## Telas Implementadas (Dashboard.jsx)

### Sidebar
- "Dashboards": Dashboard Maturidade | Visão Geral
- "Por Área": lista colapsável das 14 áreas (navega por ID)
- "Operação": MRC Completa (badge com total)
- "Administração": Configurações (admin only)

### 1. Dashboard Maturidade (rota `/`)
- Gauge engrossada (12px) + "Última atualização" no header
- Visão Empresa compacta + Visão Área com KPIs + Ranking

### 2. Visão Geral (rota `/visao-geral`)
- 4 cards totais: Total | Efetivo | Inefetivo | GAP (breakdown 4 criticidades)
- Sub-headers: Crít / Sign / Mod / Baixo (texto, não bolinhas)
- Tabela "Resumo por Área" com linha TOTAL; clique navega para Por Área

### 3. Por Área (rota `/area/:areaId`)
- ← VOLTAR + nome área + meta
- 5 KPIs: Maturidade | Efetivos | Inefetivos | GAPs | Planos de Ação (dourado)
- Busca + filtros + tabela MRC filtrada (23 colunas, scroll horizontal)
- Badges coloridos: Resultado, Impacto, Probabilidade, Criticidade
- Botão "Ver" abre ModalDetalhe (exportado do MRCCompleta)

### Outras telas
- Login, MRC Completa (522 ctrl), Config Clientes/Usuários, Perfil

---

## Campos Supabase — tabela `mrc` (DEFINITIVO)
`rr`, `rc`, `sub`, `ger`, `resp_sub`, `dt_ult`, `dr`, `dc`, `cat`, `freq`, `nat`, `car`, `sis`, `chave`, `passos_f1`, `r1`, `incons`, `rec`, `imp` (text), `prob` (text), `crit` (INTEGER 1-4), `crit_label` (text), `area` (text), `st_pa`, `r_ader`, `r3`, `dc_novo`, `area_id` (UUID FK), `dem_pa`, `resp_pa`, `dt_pa`, `coment_pa`, `dt_teste`, `melhoria`, `incons_ader`, `coment_ader`, `st_f3`, `incons_f3`, `rec_f3`, `status_workflow`, `criado_em`, `atualizado_em`

---

## Engine de Cálculo
- src/lib/calculoMaturidade.js — validado (Compras → 37.78% → N3)
- State elevado: areasCalc + todosControles compartilhados entre 3 telas

---

## PRÓXIMO PASSO: Workflow de Atualização de Controles

Juliana quer um botão "Atualizar" em cada controle (na tabela Por Área + dentro do modal Ver). Ao clicar, abre modal de atualização com:

**Fluxo descrito até agora:**
1. Mostra informações atuais do risco/controle + fase atual
2. Pergunta: "Houve alteração no descritivo do risco?"
   - **SIM** → abre opções de status: Existente / Evitado / Transferido
     - Se **Evitado** → caixa de texto para justificativa + inativa o registro (mantém para histórico, libera a referência para reuso)
     - Se **Transferido** → [a definir]
     - Se **Existente** → permite editar o descritivo do risco
   - **NÃO** → informações se mantêm, segue para próximas perguntas

**Perguntas pendentes (aguardando resposta da Juliana):**
1. Quem pode atualizar? (admin + consultor, ou gestor_cliente também?)
2. "Evitado" = "Descontinuado" da metodologia?
3. Referência liberada: R.COM.05 fica disponível ou próximo é sempre sequencial?
4. Após o risco, o fluxo pergunta sobre o controle também?
5. Relaciona com workflow de aprovação (rascunho → em_revisao → aprovado)?
6. Campos novos necessários no Supabase?

---

## Pendências após workflow
1. Export Excel/PDF da MRC
2. Integrar engine na MRC (peso real no modal)
3. Workflow aprovação
4. Access control suspensos
5. Flow "Novo Projeto" (sistemas do cliente)

---

## Notas Técnicas
- GitHub bloqueado no Claude → upload direto de arquivos
- Workflow com Claude: mockup HTML → aprovação → JSX
- `crit` é INTEGER — sempre usar String() ao comparar
- Navegação Por Área usa `area.id` (UUID)
- ModalDetalhe exportado como named export de MRCCompleta.jsx
