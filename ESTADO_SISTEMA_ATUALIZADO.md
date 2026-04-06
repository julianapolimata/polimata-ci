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
## IMPLEMENTADO: WORKFLOW DE ATUALIZAÇÃO ✅
## ═══════════════════════════════════════════════════════════════════════════════

### Componente: src/components/ModalAtualizar.jsx
### Dependência: ExcelJS (`npm install exceljs`)
### Props: row, onClose, onSaved, areas, projeto (objeto completo com clientes.nome)

### Fluxo: Step 1 (Risco) → Step 2 (Controle + 6 premissas) → Step 3 (Ficha)
### Evitado/Transferido: encerra no Step 1
### Salvar: erro tratado com alert + retorno boolean
### Status: em_analise (com ficha) / teste_pendente (sem ficha)

---

## ═══════════════════════════════════════════════════════════════════════════════
## IMPLEMENTADO: FICHA DE RISCO EXCEL ✅
## ═══════════════════════════════════════════════════════════════════════════════

### Versão: v5 — deployment pendente confirmação
### Gerada via ExcelJS no browser, download direto .xlsx

### Estrutura aprovada:

**HEADER:** Logo (fetch /logotipo-2cores.png) + "Polímata · Consultoria em GRC" + "FICHA DE RISCO — EXECUÇÃO DO TESTE" (sem subtítulo)

**BLOCO 1 — PROJETO (grid 3 colunas, labels navy bold):**
| Label | Valor | Origem |
|---|---|---|
| CLIENTE | Brascabos | projeto.clientes.nome |
| NATUREZA DO PROJETO | Controles Internos 2025 | projeto.nome |
| FASE EM CURSO | F2-E1 — Plano de Ação | getProximaFase() |
| EXECUTOR | Juliana | perfil.nome |
| DATA E HORÁRIO | 03/04/2026 · 14:32 | new Date() |
| DOWNLOAD POR | juliana@polimatagrc.com.br | perfil.email |
| REVISOR | (editável) | profissional preenche |
| DATA DA REVISÃO | (editável) | profissional preenche |

**IDENTIFICAÇÃO (pré-preenchido, fundo #F8F6F2 + borda dourada):**
- Área, Subprocesso, Ref.Risco, Ref.Controle, Gerência (mrc.ger), Resp.Subprocesso (mrc.resp_sub), Desc.Risco, Desc.Controle

**ATRIBUTOS (pré-preenchido):** Categoria, Frequência, Natureza, Característica, Sistema, Controle Chave?

**1. PREMISSAS (6 campos, TODOS editáveis pelo profissional):**
- Quem, Quando, Por Quê, Como, Onde, Qual o Resultado

**2. PASSOS DE TESTE (10 linhas):** Atividade/Passo + ✓/✗ + Observação

**3. RESULTADO (4 campos):** Resultado (destaque) + Inconsistência + Melhoria? + Desc.Melhoria

**4. EVIDÊNCIAS:** Área livre

**FOOTER:** Polímata + data/hora/email

### Regras visuais:
- Fundo BRANCO, sem linhas de grade
- Pré-preenchido: #F8F6F2 + borda esquerda #CC915E
- Editável: branco + borda cinza
- Coluna A = 3 (medida Excel)
- SEM itálico, labels navy bold
- Paisagem, fit to page

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

## 📋 PRÓXIMAS AÇÕES (CRÍTICO)

1. **Debugar Dashboard.jsx:**
   - Arquivo original: 769 linhas
   - Problema: Provavelmente erro de sintaxe ou import na integração de ModalRevisaoCriticidadeF3
   - Solução: Recriar manualmente linha por linha ou usar patch conservador

2. **Debugar ModalAtualizar.jsx:**
   - Arquivo original: 1124 linhas
   - Problema: Provavelmente erro de sintaxe na integração de ModalRegressaoControle ou função detectarRegressao
   - Solução: Validar sintaxe JSX antes de push

3. **Estratégia de fix:**
   - Implementar APENAS Crítico #1 (cache) — já está pronto e funcionando
   - Implementar Crítico #2 (F3) — com validação de sintaxe
   - Implementar Crítico #3 (Regressão) — com validação de sintaxe
   - Fazer push incrementalmente, testando build entre cada um

---

## Pendências Restantes

### Críticos (URGENTE)
1. ⏳ Arrumar e reimplementar Crítico #2 (F3)
2. ⏳ Arrumar e reimplementar Crítico #3 (Regressão)

### Médio prazo
3. Propagação gerente via Configurações (Configuracoes.jsx)
4. Propagação resp_sub condicional (ModalAtualizar.jsx)
5. Incluir METODOLOGIA.md como seção/página no sistema
6. Configurar domínio polimatagrc.com.br no Vercel
7. Tema escuro — avaliar telas além do Dashboard
8. PWA offline — funcionamento sem internet + sincronização
9. Upload e leitura de ficha preenchida
10. Export Excel/PDF da MRC
11. Integrar engine na MRC (peso real no modal)
12. Workflow aprovação (rascunho → em_revisao → aprovado)
13. Access control suspensos
14. Flow "Novo Projeto"

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

