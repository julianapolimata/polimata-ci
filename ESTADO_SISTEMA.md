# ESTADO DO SISTEMA — CI Polímata
> Atualizado em: 01/04/2026
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
- **Regra:** estrutural = marca; semântico = cores universais. NUNCA usar roxo.

---

## Telas Implementadas

### Sidebar
- Dashboards: Dashboard Maturidade | Visão Geral
- Por Área: 14 áreas colapsáveis (navega por UUID)
- Operação: MRC Completa (badge total)
- Administração: Configurações (admin only)

### 1. Dashboard Maturidade (rota `/`)
- Gauge 12px + "Última atualização" no header
- Visão Empresa compacta + Visão Área com KPIs + Ranking

### 2. Visão Geral (rota `/visao-geral`)
- 4 cards: Total | Efetivo | Inefetivo | GAP (breakdown 4 criticidades: Crít/Sign/Mod/Baixo)
- Tabela Resumo por Área com Efetivo×4 | Inefetivo×4 | GAP×4 + linha TOTAL

### 3. Por Área (rota `/area/:areaId`)
- ← VOLTAR + nome + meta
- 5 KPIs: Maturidade | Efetivos | Inefetivos | GAPs | Planos de Ação (dourado)
- Filtros + tabela MRC 23 colunas + badges coloridos Imp/Prob/Crit
- Botão "Ver" → abre ModalDetalhe (exportado do MRCCompleta)
- Botão "Atualizar" → abre ModalAtualizar (workflow multi-step) ← EM IMPLEMENTAÇÃO

### Outras telas
- Login, MRC Completa, Config Clientes/Usuários, Perfil

---

## Campos Supabase — tabela `mrc`
`id`, `projeto_id`, `area_id`, `rr`, `rc`, `sub`, `ger`, `resp_sub`, `dt_ult`, `dr`, `dc`, `imp`, `prob`, `crit` (INTEGER 1-4), `crit_label`, `cat`, `freq`, `nat`, `car`, `sis`, `chave`, `passos_f1`, `r1`, `incons`, `rec`, `dem_pa`, `resp_pa`, `dt_pa`, `st_pa`, `coment_pa`, `dt_teste`, `dc_novo`, `r_ader`, `melhoria`, `incons_ader`, `coment_ader`, `st_f3`, `r3`, `incons_f3`, `rec_f3`, `area` (text/processo), `status_workflow`, `criado_em`, `atualizado_em`, `criado_por`, `atualizado_por`

### Campos novos a criar (tabela mrc):
- `status_risco` text DEFAULT 'existente' — valores: existente, evitado, transferido
- `motivo_inativacao` text — justificativa quando evitado
- `ativo` boolean DEFAULT true — false quando evitado ou transferido (origem)
- `transferido_de` UUID — FK para o registro original (quando é cópia no destino)
- `ref_anterior` text — guardar referência original antes de liberar
- `premissa_porque` text — premissa "Por quê?"
- `premissa_quando` text — premissa "Quando?"
- `premissa_onde` text — premissa "Onde?"
- `premissa_quem` text — premissa "Quem?" (vazio se automatizado)
- `premissa_como` text — premissa "Como?"
- `premissa_resultado` text — premissa "Qual o resultado?"

### Tabela nova: `mrc_audit_log`
- `id` UUID PK
- `mrc_id` UUID FK → mrc.id
- `campo` text — nome do campo alterado
- `valor_anterior` text
- `valor_novo` text
- `usuario_id` UUID FK → perfis.id
- `criado_em` timestamptz DEFAULT now()

---

## Engine de Cálculo
- src/lib/calculoMaturidade.js — validado
- State elevado no shell Dashboard: areasCalc + todosControles compartilhados

---

## ═══════════════════════════════════════════════════════
## EM IMPLEMENTAÇÃO: WORKFLOW DE ATUALIZAÇÃO DE CONTROLES
## ═══════════════════════════════════════════════════════

### Status: MOCKUP v2 APROVADO → Codificação JSX em andamento

### Mockup aprovado: mockup-atualizar-v2.html

### Visão geral do fluxo
Botão "Atualizar" aparece APENAS na tela Por Área, visível APENAS para admin_polimata e consultor_polimata (cliente não vê). Aparece na tabela (abaixo do "Ver") E dentro do modal Ver.

### Fluxo multi-step (modal):

**STEP 1 — Risco:**
- Card resumo: ref.risco, ref.controle, fase atual, resultado, descrição do risco
- Pergunta: "Houve alteração no descritivo do risco?"
  - **NÃO** → mantém tudo, vai pro STEP 2
  - **SIM** → "Qual o novo status do risco?"
    - **Existente** → permite editar descritivo do risco → vai pro STEP 2
    - **Evitado (Descontinuado)** → alerta vermelho + caixa de justificativa obrigatória → INATIVA a linha (ativo=false), libera a referência. FIM.
    - **Transferido** → seleciona área destino + subprocesso + gerência (DROPDOWN cadastrados) + responsável (DROPDOWN cadastrados) → cria CÓPIA na nova área com nova ref. menor disponível, inativa na origem. FIM.

**STEP 2 — Controle (só se risco é "existente"):**
- Pergunta: "Houve alteração no descritivo do controle?"
  - **NÃO** → mantém tudo, vai pro STEP 3
  - **SIM** → permite editar:
    - Descritivo, Categoria, Frequência, Natureza, Característica, Sistema, Controle Chave
    - **6 Premissas do Controle** (grid 3×2): Por Quê? / Quando? / Onde? / Quem? / Como? / Qual o resultado?
    - Cada premissa tem tooltip ⓘ com explicação
    - Se Característica = "Automatizado" → campo "Quem?" fica desabilitado

**STEP 3 — Executar Teste:**
- Info box: "Risco e controle confirmados. Agora gere a Ficha de Risco para executar o teste do controle."
- Preview table com dados que irão na ficha
- **Próxima Fase** (não fase atual) — calculada automaticamente pela metodologia:
  - F1 Efetivo → F3 (atalho)
  - F1 Inefetivo/GAP → F2-E1 (Plano de Ação)
  - F2-E1 concluído → F2-E2 (Teste de Aderência)
  - F2-E2 Efetivo → F3
  - etc.
- **Botão principal (navy card):** "Salvar e Baixar Ficha de Risco" — salva alterações PRIMEIRO, depois baixa .xlsx. Status → "Em Análise"
- **Botão secundário (dashed card):** "Salvar sem gerar ficha" — salva, marca como "Teste Pendente" com sinalização visual

### Comportamento do botão X (fechar modal):
- Abre mini-modal de confirmação: "Deseja sair? As alterações não salvas serão perdidas."
- Botões: "Continuar editando" / "Sair sem salvar"

### Botão Cancelar no footer:
- Mesmo comportamento do X — abre confirmação

### Status visuais na tabela Por Área:
- **Em Análise** → badge dourado pulsante (após salvar com ficha)
- **Teste Pendente** → badge amarelo (após salvar sem ficha)

### Referência reaproveitada
- Quando risco é evitado/transferido, a referência (ex: R.COM.05) fica livre
- Próximo risco novo na área recebe a MENOR referência disponível
- Só cria sequência nova se todas anteriores estiverem ocupadas

### Permissões:
- Botão "Atualizar" visível apenas para papel admin_polimata ou consultor_polimata
- gestor_cliente e usuario_cliente NÃO veem o botão

---

## Pendências após workflow
1. Upload e leitura de ficha preenchida
2. Export Excel/PDF da MRC
3. Integrar engine na MRC (peso real no modal)
4. Workflow aprovação (rascunho → em_revisao → aprovado)
5. Access control suspensos
6. Flow "Novo Projeto"

---

## Notas Técnicas
- GitHub bloqueado no Claude → upload direto de arquivos
- Workflow com Claude: mockup → aprovação → JSX
- Excel: usar ExcelJS (não SheetJS)
- `crit` é INTEGER — sempre usar String() ao comparar
- Navegação Por Área usa area.id (UUID)
- Ficha de Risco template: Ficha_de_Risco_Polimata_Template.xlsx
- Gerência e Responsável Subprocesso: sempre DROPDOWN com nomes cadastrados (não texto livre)
- 6 premissas do controle: Por Quê / Quando / Onde / Quem / Como / Qual o Resultado
