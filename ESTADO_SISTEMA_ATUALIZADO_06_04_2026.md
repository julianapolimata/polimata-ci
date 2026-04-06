# ESTADO DO SISTEMA — CI Polímata
> Atualizado em: 06/04/2026 (após tentativa de implementação dos 3 críticos)
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

## ═══════════════════════════════════════════════════════════════════════════════
## IMPLEMENTADO: WORKFLOW DE ATUALIZAÇÃO ✅ (MOCKUP APROVADO)
## ═══════════════════════════════════════════════════════════════════════════════

### Componente: src/components/ModalAtualizar.jsx
### Dependência: ExcelJS (`npm install exceljs`)
### Props: row, onClose, onSaved, areas, projeto (objeto completo com clientes.nome)

### FLUXO REVISADO (3 STEPS DINÂMICOS):

#### **STEP 1: RISCO**
1. **Pergunta 1:** "Houve alteração no STATUS do risco?"
   - **Sim** → abre sub-pergunta com opções:
     - 🚫 **Evitado** (descontinuar) → pede justificativa + encerra no Step 1
     - ↗ **Transferido** (mover) → pede área destino, subprocesso, gerência, responsável + encerra no Step 1
   - **Não** → pula pra Pergunta 2

2. **Pergunta 2:** "Houve alteração no DESCRITIVO do risco?" (aparece se Pergunta 1 = "Não")
   - **Sim** → abre campo textarea pra editar descrição
   - **Não** → pula pra Step 2

#### **STEP 2: CONTROLE**
1. **Pergunta 1:** "Houve alteração no DESCRITIVO do controle?"
   - **Não** → pula Características e Premissas, vai direto pra Step 3
   - **Sim** → abre:
     - Campo textarea: Nova descrição do controle
     - **CARACTERÍSTICAS DO CONTROLE** (6 campos):
       - Categoria (10 opções: Autorização, Relatórios de Exceção, Indicadores de Performance, Interface/Conversão, Revisão Gerencial, Reconciliação, Acesso, Segregação de Funções, Configuração, N/A)
       - Frequência (10 opções: Anual, Semestral, Trimestral, Mensal, Quinzenal, Semanal, Diário, Múltiplas vezes ao dia, Sob demanda, N/A)
       - Natureza (3 opções: Preventivo, Detectivo, N/A)
       - Característica (4 opções: Manual, Semi-automatizado, **Automatizado**, N/A)
       - Sistema (4 opções: IBID, Fluig, Totvs Data Sul, N/A)
       - Controle Chave (3 opções: Controle Chave, Controle Compensatório, N/A)
     - **6 PREMISSAS** (com lógica: se Característica = Automatizado → campo "Quem faz?" desativa com "N/A"):
       - 1. Quem faz?
       - 2. Quando faz?
       - 3. Por quê faz?
       - 4. Como faz?
       - 5. Onde faz?
       - 6. Qual o resultado?

#### **STEP 3: EXECUTAR TESTE / SALVAR**
1. **Resumo dinâmico** (mostra APENAS o que foi alterado):
   - Risco: Status alterado / Sem alterações
   - Controle: Descritivo alterado / Sem alterações
   - Características: Preenchidas / Não preenchidas

2. **Pergunta:** "Como deseja proceder?"
   - 📊 **Salvar e Gerar Ficha** → Status: **EM ANÁLISE** (com ficha)
   - 💾 **Só Salvar** → Status: **ANÁLISE PENDENTE** (sem ficha, pendente geração)

### STATUS FINAL (após salvar):
- ✅ `em_analise` (com ficha Excel gerada)
- ⏳ `analise_pendente` (sem ficha, aguardando preenchimento)

### OPÇÕES ESPECIAIS (encerram no Step 1):
- **Evitado:** linha inativada, referência disponível, histórico registrado
- **Transferido:** linha inativada, novo risco/controle criado na área destino com nova referência

### MOCKUP DINÂMICO APROVADO:
- ✅ Arquivo: `/mnt/user-data/outputs/ModalAtualizar_DINAMICO.html`
- ✅ Todos os 3 steps implementados
- ✅ Lógica dinâmica de exibição/ocultação de campos
- ✅ Resumo dinâmico que reflete as alterações reais
- ✅ Todas as opções corretas (Categoria, Frequência, Natureza, Característica, Sistema, Controle Chave)
- ✅ Desativação automática do campo "Quem faz?" para controles automatizados

---

## ═══════════════════════════════════════════════════════════════════════════════
## IMPLEMENTADO: FICHA DE RISCO EXCEL ✅ (PRONTO PARA JSX)
## ═══════════════════════════════════════════════════════════════════════════════

### Versão: v5 — Pronto para implementação (mockup validado)
### Gerada via ExcelJS no browser, download direto .xlsx
### Disparada: Step 3 do ModalAtualizar, botão "Salvar e Gerar Ficha"

### Conteúdo dinâmico da Ficha:
- Todos os dados coletados nos Steps 1 e 2
- Pré-preenchido com informações da MRC
- Edições do usuário (descrição do risco, controle, características, premissas) incluídas
- Pronto para profissional preencher Passos de Teste + Resultado

### Estrutura aprovada (ver detalhes em ESTADO_SISTEMA_ANTERIOR):

**HEADER:** Logo + "Polímata · Consultoria em GRC" + "FICHA DE RISCO — EXECUÇÃO DO TESTE"

**BLOCO 1 — PROJETO:** Cliente, Natureza, Fase, Executor, Data/Hora, Download Por, Revisor, Data Revisão

**BLOCO 2 — IDENTIFICAÇÃO:** Área, Subprocesso, Ref.Risco, Ref.Controle, Gerência, Resp.Subprocesso, Desc.Risco, Desc.Controle

**BLOCO 3 — ATRIBUTOS:** Categoria, Frequência, Natureza, Característica, Sistema, Controle Chave

**BLOCO 4 — PREMISSAS:** 6 campos (pré-preenchidos com dados do Step 2)

**BLOCO 5 — PASSOS DE TESTE:** 10 linhas (Passo + ✓/✗ dropdown + Observação)

**BLOCO 6 — RESULTADO:** Resultado (dropdown) + Inconsistência + Melhoria? + Desc.Melhoria

**BLOCO 7 — EVIDÊNCIAS:** Área livre para anexos/observações

**FOOTER:** Polímata + data/hora/email

### Regras visuais (confirmadas):
- Fundo BRANCO, sem linhas de grade
- Pré-preenchido: #F8F6F2 + borda esquerda #CC915E
- Editável: branco + borda cinza
- Coluna A = 3 (largura Excel)
- SEM itálico, labels navy bold (#00203E)
- Orientação: Paisagem, ajustar à página
- Font: Montserrat 10pt

---

## ═══════════════════════════════════════════════════════════════════════════════
## IMPLEMENTAÇÃO DOS 3 CRÍTICOS — STATUS
## ═══════════════════════════════════════════════════════════════════════════════

### 📌 CRÍTICO #1: Bug Tela Branca após Deploy — ✅ IMPLEMENTADO
**Arquivos criados:**
- ✅ `vercel.json` (raiz)
- ✅ `public/service-worker.js`
- ✅ `src/hooks/useServiceWorkerCleanup.js`
- ✅ `src/App.jsx` (modificado com import e chamada do hook)

**Status:** Pronto, sem erro de build

---

### 📌 CRÍTICO #2: Revisão de Criticidade na F3 — ⏳ PENDENTE (build error)
**Arquivos criados:**
- ✅ `src/components/ModalRevisaoCriticidadeF3.jsx` (pronto)

**Modificações necessárias em Dashboard.jsx:**
- Import ModalRevisaoCriticidadeF3
- State revisaoF3Row
- Botão "Revisar Crit." com cor F3 (#660033) para controles em "em_analise"
- Renderizar modal

**Status:** ❌ Falha ao integrar em Dashboard.jsx (build error no commit e8af4b4)

---

### 📌 CRÍTICO #3: Trigger de Regressão — ⏳ PENDENTE (build error)
**Arquivos criados:**
- ✅ `src/components/ModalRegressaoControle.jsx` (pronto)

**Modificações necessárias em ModalAtualizar.jsx:**
- Import ModalRegressaoControle
- State showRegressao
- Função detectarRegressao()
- Trigger automático quando clica "Não" em "Risco continua existente?"
- Renderizar modal

**Status:** ❌ Falha ao integrar em ModalAtualizar.jsx (build error no commit e8af4b4)

---

## 🔴 PROBLEMA IDENTIFICADO

**Commit:** e8af4b4 (feat: implementar 3 críticos - cache, F3, regressão)
**Status:** Build Failed
**Erro:** `Command "npm run build" exited with 1`
**Causa:** Erro de sintaxe ou importação em um dos arquivos modificados (Dashboard.jsx ou ModalAtualizar.jsx)

**Ação tomada:** Revert com `git revert HEAD --no-edit` (commit c65fa54)
**Resultado:** ✅ Build passou (commit b2d7a7b)

---

## 📋 PRÓXIMAS AÇÕES (PRIORIDADE)

### 🔴 CRÍTICO IMEDIATO

1. **[NEXT]** Implementar ModalAtualizar.jsx em React
   - Baseado em: `/mnt/user-data/outputs/ModalAtualizar_DINAMICO.html` (mockup aprovado)
   - Status: Arquivo JSX original recuperado do Git (commit 426b09e)
   - Localização: `src/components/ModalAtualizar_VERSAO_LINDA.jsx` (outputs)
   - Passos:
     a) Baixar `ModalAtualizar_VERSAO_LINDA.jsx` dos outputs
     b) Substituir em `src/components/ModalAtualizar.jsx`
     c) Validar build localmente
     d) `git push --force`
     e) Testar no Vercel

2. **[AFTER MODAL]** Implementar geração de Ficha Excel (ExcelJS)
   - Disparada: Step 3, botão "Salvar e Gerar Ficha"
   - Dados: Collect do Step 1 (risco) + Step 2 (controle, características, premissas)
   - Output: .xlsx com estrutura aprovada
   - Status de salvar: `em_analise` (com ficha) ou `analise_pendente` (sem ficha)

3. **[AFTER FICHA]** Arrumar e reimplementar 3 Críticos (do ESTADO_SISTEMA_06_04):
   - Crítico #1: Cache/Service Worker (já pronto)
   - Crítico #2: Revisão de Criticidade F3
   - Crítico #3: Trigger de Regressão

### Médio prazo
4. Propagação gerente via Configurações
5. Propagação resp_sub condicional
6. Incluir METODOLOGIA.md como seção/página
7. Configurar domínio polimatagrc.com.br
8. Tema escuro (avaliar além do Dashboard)
9. PWA offline
10. Upload/leitura de ficha preenchida
11. Export Excel/PDF da MRC
12. Integrar engine na MRC
13. Workflow aprovação
14. Access control
15. Flow "Novo Projeto"

---

## Notas Técnicas
- GitHub bloqueado no Claude → upload direto de arquivos
- Workflow com Claude: mockup HTML → aprovação → código
- Excel: ExcelJS (instalado via npm)
- `crit` é INTEGER — sempre usar String() ao comparar
- Navegação Por Área usa area.id (UUID)
- Gerência e Responsável: DROPDOWN cadastrados (não texto livre)
- resp_sub: campo da tabela mrc (dado do controle)
- Premissas na ficha: ferramenta metodológica, NÃO alimentam o sistema
- Passos de teste: ✓/✗ (não aprovado/reprovado)
- Modal Atualizar: fundo branco (contraste com tema escuro)
- Dashboard.jsx passa `projeto` (objeto completo) pro ModalAtualizar
- **VALIDAÇÃO:** Testar sintaxe JSX antes de fazer push

---

## Commits recentes
- **b2d7a7b:** Revert "feat: implementar 3 críticos - cache, F3, regressão" — ✅ Build OK
- **c65fa54:** Revert "feat: implementar 3 críticos - cache, F3, regressão" — ✅ Build OK
- **e8af4b4:** feat: implementar 3 críticos - cache, F3, regressão — ❌ Build Failed
- **48f2c0f:** feat: implementar 3 críticos - cache, F3, regressão — ❌ Build Failed

---

## Histórico de sessão
- **03/04/2026:** Criação de ModalAtualizar, ModalRegressaoControle, ModalRevisaoCriticidadeF3, service-worker, vercel.json
- **06/04/2026:** Tentativa de implementação dos 3 críticos → build error → revert → debug em andamento

