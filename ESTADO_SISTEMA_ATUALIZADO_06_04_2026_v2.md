# ESTADO DO SISTEMA — CI Polímata
> Atualizado em: 06/04/2026 (ModalAtualizar completo + deploy Vercel ✅)
> Cole no início de cada novo chat para retomar sem perda de contexto.

---

## Stack & Infra
- **Frontend:** React + Vite
- **Backend:** Supabase (PostgreSQL, Auth, Storage, RLS)
- **Deploy:** Vercel (auto-deploy do master) → polimata-ci.vercel.app ✅
- **Repo:** github.com/julianapolimata/polimata-ci (público, branch master)
- **Supabase project:** iqtkpyrpwxypwcwrhulx
- **Local:** C:\projetos\polimata-fresh\polimata-ci
- **Admin:** juliana@polimatagrc.com.br
- **Git push:** sempre usar `--force`
- **Domínio próprio:** polimatagrc.com.br (pendente configuração no Vercel)

---

## Identidade Visual (obrigatório)
- **Cores Navy:** #00112C / #00203E / #1D3B5C
- **Cores Dourado:** #CC915E / #A6512F / #6C2D10
- **Creme:** #F3EEE4
- **Fonte:** Montserrat para TUDO (sem exceções)
- **Cores fases:** F1=#00203E, F2=#1D3B5C, F3=#660033, F4=#660066, F5=#A6512F
- **Regra:** estrutural = marca; semântico = cores universais. NUNCA usar roxo.
- **Logo:** logotipo-2cores.png na pasta public/
- **Brandbook:** Apresentacao.pdf (referência oficial)
- **NUNCA usar itálico** em documentos gerados pelo sistema

---

## Telas Implementadas

### Sidebar
- Dashboards: Dashboard Maturidade | Visão Geral
- Por Área: 14 áreas colapsáveis (navega por UUID)
- Operação: MRC Completa (badge total)
- Administração: Configurações (admin only)

### 1. Dashboard Maturidade (rota `/`) — TEMA ESCURO
- Fundo navy com cards escuros
- Gauge + Visão Empresa + Visão Área + KPIs + Ranking

### 2. Visão Geral (rota `/visao-geral`)
- 4 cards: Total | Efetivo | Inefetivo | GAP (breakdown 4 criticidades)
- Tabela Resumo por Área + linha TOTAL

### 3. Por Área (rota `/area/:areaId`)
- 5 KPIs + Filtros + tabela MRC 23 colunas
- Botão "Ver" → ModalDetalhe
- Botão "Atualizar" (dourado, só admin/consultor) → ModalAtualizar ✅
- Badges "EM ANÁLISE" e "TESTE PENDENTE" ✅

### Outras telas
- Login, MRC Completa, Config Clientes/Usuários, Perfil

---

## Campos Supabase — tabela `mrc`
`id`, `projeto_id`, `area_id`, `rr`, `rc`, `sub`, `ger`, `resp_sub`, `dt_ult`, `dr`, `dc`, `imp`, `prob`, `crit` (INTEGER 1-4), `crit_label`, `cat`, `freq`, `nat`, `car`, `sis`, `chave`, `passos_f1`, `r1`, `incons`, `rec`, `dem_pa`, `resp_pa`, `dt_pa`, `st_pa`, `coment_pa`, `dt_teste`, `dc_novo`, `r_ader`, `melhoria`, `incons_ader`, `coment_ader`, `st_f3`, `r3`, `incons_f3`, `rec_f3`, `area`, `status_workflow`, `criado_em`, `atualizado_em`, `criado_por`, `atualizado_por`

### Campos adicionados (migração 01/04/2026):
- `status_risco` text DEFAULT 'existente'
- `motivo_inativacao` text
- `ativo` boolean DEFAULT true
- `transferido_de` UUID FK
- `ref_anterior` text
- `premissa_porque`, `premissa_quando`, `premissa_onde`, `premissa_quem`, `premissa_como`, `premissa_resultado`

### Constraint status_workflow:
CHECK (status_workflow = ANY (ARRAY['rascunho','em_revisao','aprovado','reprovado','em_analise','teste_pendente']))

### Tabela `mrc_audit_log`:
- id, mrc_id, campo, valor_anterior, valor_novo, usuario_id, criado_em

### Query loadDados:
- Filtra `.neq('ativo', false)`

---

## Engine de Cálculo
- src/lib/calculoMaturidade.js — validado
- State elevado no shell Dashboard

---

## ═══════════════════════════════════════════════
## ✅ IMPLEMENTADO: MODAL ATUALIZAR (COMPLETO)
## ═══════════════════════════════════════════════

### Componente: src/components/ModalAtualizar.jsx
### Deploy: 06/04/2026 no Vercel ✅

### Fluxo: 3 Steps Integrados

#### STEP 1: RISCO (Risk Status)
**Pergunta 1:** "Houve alteração no STATUS do risco?"
- **Não** → avança para Pergunta 2 (descritivo)
- **Sim** → abre opções:
  - 🚫 **Evitado** → justificativa obrigatória → inativa linha + RC + ref reutilizável → **encerra fluxo (salva direto)**
  - ↗ **Transferido** → seleciona área destino + subprocesso dinâmico → cria novo risco/controle → inativa original → **encerra fluxo (salva direto)**

**Pergunta 2 (se Não):** "Houve alteração no DESCRITIVO do risco?"
- **Não** → avança para Step 2
- **Sim** → abre textarea para editar descrição → avança para Step 2

#### STEP 2: CONTROLE (Control Fields + 6 Premissas)
**Pergunta 1:** "Houve alteração no DESCRITIVO do controle?"
- **Não** → botão "Próximo" direto pra Step 3 (sem características)
- **Sim** → abre:
  - Textarea: nova descrição
  - **CARACTERÍSTICAS (6 campos dropdown):**
    - Categoria: Autorização, Relatórios de Exceção, Indicadores de Performance, Interface/Conversão, Revisão Gerencial, Reconciliação, Acesso, Segregação de Funções, Configuração, N/A
    - Frequência: Sob demanda, Diário, Múltiplas vezes ao dia, Semanal, Quinzenal, Mensal, Trimestral, Semestral, Anual, N/A
    - Natureza: Preventivo, Detectivo, N/A
    - Característica: Manual, Semi-Automatizado, Automatizado, N/A
    - Sistema: IBID, Fluig, Totvs Data Sul, N/A
    - Controle Chave: Controle Chave, Controle Compensatório, N/A
  - **6 PREMISSAS (6 textareas):**
    1. Quem faz? (desativado se Automatizado → "N/A")
    2. Quando faz?
    3. Por quê faz?
    4. Como faz?
    5. Onde faz?
    6. Qual o resultado?

#### STEP 3: EXECUTAR TESTE (Ficha de Risco + Status)
**Resumo dos dados coletados:**
- Risco (descrição original ou alterada)
- Controle (descrição original ou alterada)
- Características (cat, freq, nat, car, sis, chave)
- Premissas (6 campos)

**2 Opções de salvamento:**
1. 📊 **Salvar e Baixar Ficha de Risco** (azul-navy)
   - Status: `em_analise`
   - Gera e baixa Ficha Excel v5 pré-preenchida
   - TODO: implementar geração ExcelJS

2. 💾 **Salvar sem gerar ficha** (cinza-escuro)
   - Status: `teste_pendente`
   - Apenas salva alterações
   - Badge "TESTE PENDENTE" aparece na tabela

**Info notice (amarelo):**
- "Ao salvar com ficha → status EM ANÁLISE até resultado ser registrado"
- "Ao salvar sem ficha → status TESTE PENDENTE"

### UI/UX Melhorias (06/04):
- ✅ Contraste aumentado em TODOS os botões (background #fafbfc quando inativos)
- ✅ Fonte maior (13px fontWeight 700) nos rótulos de botões
- ✅ Caixa "Salvar sem ficha" com background #e5e7eb + texto escuro
- ✅ Subprocessos carregam dinamicamente quando seleciona área no Transferido
- ✅ Border 2px nos botões selecionados vs 1px nos inativos

### Fluxo de dados:
1. Step 1+2: Edita risco/controle
2. Step 3: Visualiza resumo + salva com/sem ficha
3. Supabase: update status_workflow + campos de risco/controle
4. Audit log: registra todas as alterações

---

## Pendências (próximo chat)

### Imediato:
1. **[TODO]** Geração de Ficha Excel v5 via ExcelJS no Step 3
2. **[TODO]** Upload/leitura de ficha preenchida
3. **[TODO]** Webhook pra sincronizar status na tabela após salvar

### Crítico:
4. **[PENDING]** ModalRevisaoCriticidadeF3.jsx (integrar em Dashboard.jsx)
5. **[PENDING]** ModalRegressaoControle.jsx (integrar em ModalAtualizar.jsx)
6. **[PENDING]** Propagação de gerente via Configurações

### Médio Prazo:
7. Configurar domínio polimatagrc.com.br no Vercel
8. PWA offline
9. Export Excel/PDF da MRC
10. Workflow aprovação (rascunho → em_revisao → aprovado)
11. Fix cache/service worker (browser tab fecha/reabre após deploy)
12. Dark theme em outras telas (além Dashboard)

---

## Notas Técnicas
- `crit` é INTEGER — sempre usar String() ao comparar
- ModalAtualizar recebe props: `row, onClose, onSaved, areas, projeto` (objeto completo)
- Dashboard.jsx passa `projeto` (objeto completo) pro ModalAtualizar
- Premissas: ferramenta metodológica, NÃO alimentam o Excel diretamente (preenchimento manual na ficha)
- Status workflow válidos: rascunho, em_revisao, aprovado, reprovado, em_analise, teste_pendente
- ExcelJS instalado via npm (pronto pra usar)
- Identidade visual: Navy #00203E, Dourado #CC915E, Fonte Montserrat, SEM itálico
- GitHub bloqueado no Claude → upload direto de arquivos é método confiável
- Workflow com Claude: mockup HTML → aprovação → código React → teste local → push Vercel

---

## Próximas Sessões
- Continuar com geração de Ficha Excel
- Integrar modais F3 e Regressão
- Testes end-to-end do workflow completo
- Otimizações de performance (tabela MRC com 500+ linhas)
