# ESTADO DO SISTEMA — CI Polímata
> Atualizado em: 03/04/2026 (sessão 4 final)
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
- **Ícone:** icon.png na pasta public/ (só o P dourado, para uso em Excel headers)
- **Brandbook:** Apresentacao.pdf (referência oficial)
- **NUNCA usar itálico** em documentos gerados pelo sistema

### Cores régua maturidade (VIVAS):
- N1=#DC2626 (0–10%), N2=#EA580C (11–25%), N3=#EAB308 (26–50%), N4=#16A34A (51–80%), N5=#15803D (81–100%)

### Cores semânticas resultado:
- **Efetivo = verde vivo (#22C55E)**
- **Inefetivo = amarelo (#FACC15)**
- **GAP = vermelho (#EF4444)**

### Cores criticidade:
- Crítico=#EF4444, Significativo=#F97316, Moderado=#EAB308, Baixo=#22C55E

### Barras de maturidade:
- Degradê contínuo: #DC2626 → #EF4444 → #EA580C → #F97316 → #EAB308 → #84CC16 → #22C55E → #15803D
- Função `getBarGradient(pct100)` no Dashboard.jsx

---

## Documentação da Metodologia
- **METODOLOGIA.md** — documento completo da metodologia de avaliação de maturidade (redigido sessão 4)
- Cobre: MRC, criticidade dinâmica, trilha F1-F5, progressão/regressão, planos de ação, cálculo, ficha de risco, perfis/workflow
- **Revisão de criticidade** ocorre em 3 momentos: F1 (classificação inicial), Regressão (obrigatória ao retornar para PA), F3 (revisão com base em evidências)
- Pendente incluir como seção/página no sistema

---

## Telas Implementadas

### Sidebar
- Dashboards: Dashboard
- ~~Visão Geral~~ — **REMOVIDA**
- Por Área: 14 áreas colapsáveis (navega por UUID)
- Operação: MRC Completa (badge total)
- Administração: Configurações (admin only) | **Importar MRC** (admin only)

### 1. Dashboard (rota `/`) — TEMA ESCURO ✅
- Fundo navy (#00112C)
- Header + última atualização global (card discreto, canto superior direito)
- 6 KPI Cards (Maturidade, Total, Efetivos, Inefetivos, GAP, Planos de Ação)
- Maturidade por Área: clique navega para `/area/:areaId`
- Zona inferior: Heatmap 4×4 + Tabela Área × Criticidade

### 2. Por Área (rota `/area/:areaId`) — TEMA ESCURO ✅
- Header fixo + última atualização da área
- Heatmap 4×4 (esquerda) + Grid 3×2 KPIs (direita)
- Filtros + botão Excel export (dourado)
- Tabela MRC 23 colunas (larguras fixas, scroll horizontal)

### 3. MRC Completa (rota `/mrc`) ✅
- Heatmap + Régua + Filtros + Tabela
- Botão Excel funcional

### 4. Importar MRC (rota `/importar-mrc`) — ✅ COMPLETO
- **Admin only** (admin_polimata)
- Fluxo: selecionar área → upload .xlsx → preview → confirmar → importar
- Apaga todos os controles da área e insere os do arquivo ✅
- Atualiza `areas.gerente` com o valor `ger` do primeiro controle
- **Cores tema escuro** ✅ | **Aviso amarelo** ✅ | **Pop-up confirmação** ✅

### Outras telas
- Login, Config Clientes/Usuários, Perfil

---

## ═══════════════════════════════════════════════
## IMPLEMENTADO: IMPORTAR MRC ✅
## ═══════════════════════════════════════════════

### Arquivo: src/components/ImportarMRC.jsx
### Dependência: ExcelJS (já instalado)
### Props: projetoId, areas, onImported

### Formato do Excel esperado:
- Header na **linha 11**, dados a partir da **linha 12**
- Linhas 1-10 ignoradas (título, totais, agrupamentos)
- Linha só é importada se tiver Ref. Risco (col H / índice 7) preenchido
- Juliana separa por área antes de importar (cada upload = 1 área)

### Mapeamento Excel → Supabase (col idx 0-based):
| Col | Header | Campo |
|---|---|---|
| 1 | Última Atualização | dt_ult |
| 3 | Gerência | ger |
| 4 | Resp. Subprocesso | resp_sub |
| 5 | Processo | *(só preview, NÃO vai pro Supabase)* |
| 6 | Subprocesso | sub |
| 7 | Ref. Risco | rr |
| 8 | Desc. Risco | dr |
| 9 | Ref. Controle | rc |
| 10 | Desc. Controle | dc |
| 11 | Categoria | cat |
| 12 | Frequência | freq |
| 13 | Natureza | nat |
| 14 | Característica | car |
| 15 | Sistema | sis |
| 16 | Ctrl Chave? | chave |
| 17 | Passos Teste | passos_f1 |
| 18 | Resultado | r1 |
| 19 | Inconsistência | incons |
| 20 | Recomendação | rec |
| 21 | Impacto | imp |
| 22 | Probabilidade | prob |
| 23 | Criticidade | crit_label + crit (int) |
| 29 | Demanda PA? | dem_pa |
| 30 | Resp. PA | resp_pa |
| 31 | Data Limite PA | dt_pa |
| 33 | Status PA | st_pa |
| 34 | Histórico PA | coment_pa |
| 35 | Data Teste Aderência | dt_teste |
| 36 | Nova Desc. Controle | dc_novo |
| 44 | Resultado Aderência | r_ader |
| 45 | Melhoria? | melhoria |
| 46 | Incons. Aderência | incons_ader |
| 47 | Coment. Aderência | coment_ader |
| 50 | Status Risco | status_risco |
| 56 | Resultado F3 | r3 |
| 57 | Incons. F3 | incons_f3 |
| 58 | Recomendação F3 | rec_f3 |

### Limpeza: N/A→null, crit texto→int, imp/prob normalizados, datas→ISO, richText→string

### Bugs corrigidos sessão 4:
- Campo `area` removido do insert — coluna não existe na tabela `mrc`
- Policy DELETE criada na tabela `mrc` (faltava, causava duplicação silenciosa)
- Cores ajustadas para tema escuro

---

## ═══════════════════════════════════════════════
## IMPLEMENTADO: EXPORT EXCEL MRC ✅ APROVADO
## ═══════════════════════════════════════════════

### Arquivo: src/lib/exportMRC.js
### Função: `exportarMRCExcel(controles, nomeArquivo, tituloAba, clienteNome, projetoNome)`

### Excel (2 abas):

**Aba 1: "Mapa de Calor"**
- `views: [{ showGridLines: false }]`
- Fundo creme #F3EEE4, col A=4, B=4.09, C-H=18
- Header navy merge B (não A), ícone icon.png 36×36
- Grid 4×4 (linhas 5-8, h=49.5): todas coloridas inclusive zeros, bordas creme
- Legenda linha 12, resumo linhas 16-18 centralizados sem merge
- Footer linha 20 h=15, merge B20:E20, border-top medium dourado

**Aba 2: dados MRC**
- `views: [{ frozen ySplit=4, xSplit=1, showGridLines: false }]`
- Col A=4 creme, dados col B+, 23 colunas, auto-filter

---

## ═══════════════════════════════════════════════
## IMPLEMENTADO: WORKFLOW DE ATUALIZAÇÃO ✅
## ═══════════════════════════════════════════════

### Componente: src/components/ModalAtualizar.jsx
### Fluxo: Step 1 (Risco) → Step 2 (Controle + 6 premissas) → Step 3 (Ficha)

---

## ═══════════════════════════════════════════════
## IMPLEMENTADO: FICHA DE RISCO EXCEL v5 ✅
## ═══════════════════════════════════════════════

### 2 abas, ExcelJS browser, layout A=3, paisagem, Montserrat 10pt

---

## Campos Supabase — tabela `mrc`
`id`, `projeto_id`, `area_id`, `rr`, `rc`, `sub`, `ger`, `resp_sub`, `dt_ult`, `dr`, `dc`, `imp`, `prob`, `crit` (INTEGER 1-4), `crit_label`, `cat`, `freq`, `nat`, `car`, `sis`, `chave`, `passos_f1`, `r1`, `incons`, `rec`, `dem_pa`, `resp_pa`, `dt_pa`, `st_pa`, `coment_pa`, `dt_teste`, `dc_novo`, `r_ader`, `melhoria`, `incons_ader`, `coment_ader`, `st_f3`, `r3`, `incons_f3`, `rec_f3`, `status_workflow`, `criado_em`, `atualizado_em`, `criado_por`, `atualizado_por`, `status_risco`, `motivo_inativacao`, `ativo`, `transferido_de`, `ref_anterior`, `premissa_porque`, `premissa_quando`, `premissa_onde`, `premissa_quem`, `premissa_como`, `premissa_resultado`

**NOTA:** campo `area` (texto) NÃO existe na tabela `mrc` — usar `area_id` (FK para tabela `areas`)

### RLS Policies tabela `mrc`:
- mrc_select (SELECT), mrc_insert (INSERT), mrc_update (UPDATE), **mrc_delete (DELETE)** ← criada sessão 4
- Todas: PERMISSIVE, public, USING(true)

### Tabela `areas`:
- id, projeto_id, nome, prefixo, peso, **gerente**, ordem

### Tabela `mrc_audit_log`:
- id, mrc_id, campo, valor_anterior, valor_novo, usuario_id, criado_em

---

## Engine de Cálculo
- src/lib/calculoMaturidade.js — validado
- State elevado no shell Dashboard

---

## ═══════════════════════════════════════════════
## REGRAS DE PROPAGAÇÃO (aprovadas)
## ═══════════════════════════════════════════════

### 1. Importação MRC → atualizar gerente ✅ IMPLEMENTADO
- `ger` do primeiro controle → `areas.gerente`

### 2. Configurações → gerente replica para MRC — PENDENTE
- Mudar `areas.gerente` → atualizar `mrc.ger` em todos controles da area_id

### 3. Responsável subprocesso → propagação condicional — PENDENTE
- Alterar `mrc.resp_sub` → perguntar "Aplicar a todos os subprocessos com mesmo nome?"

---

## Pendências (próximo chat)
1. **Continuar importação** das matrizes atualizadas por área
2. **Bug tela branca após deploy** — precisa fechar/abrir aba após atualização. Investigar cache Vercel ou service worker.
3. **Revisão de criticidade na F3** — sistema não implementa reavaliação de Impacto/Probabilidade/Criticidade na Fase 3. Precisa de campos ou etapa no fluxo F3.
4. **Revisão de criticidade na regressão** — quando controle volta para PA (Inefetivo), sistema deve solicitar revisão da criticidade. Precisa de trigger no workflow de regressão.
5. **Incluir METODOLOGIA.md como seção/página no sistema** — tela "Sobre a Metodologia" ou documento acessível
6. **Propagação gerente** via Configurações (precisa Configuracoes.jsx)
7. **Propagação resp_sub** condicional (precisa ModalAtualizar.jsx)
8. **Configurar domínio** polimatagrc.com.br no Vercel
9. **PWA offline**
10. Upload e leitura de ficha preenchida
11. Integrar engine na MRC (peso real no modal)
12. Workflow aprovação (rascunho → em_revisao → aprovado)
13. Access control suspensos
14. Flow "Novo Projeto"
15. Export PDF da MRC

---

## Notas Técnicas
- GitHub bloqueado no Claude → Juliana salva downloads direto na pasta do projeto
- Workflow com Claude: mockup HTML → aprovação → código JSX/ExcelJS
- Excel: ExcelJS (instalado via npm)
- `crit` é INTEGER — sempre usar String() ao comparar
- Navegação Por Área usa area.id (UUID)
- Gerência e Responsável: DROPDOWN cadastrados (não texto livre)
- Dashboard.jsx: ~770 linhas
- Componentes removidos: FasesBoxes, GaugeBar, KpisTable, ReguaN1N5, VisaoGeral
- Card "Planos de Ação": div absoluto com gradiente (borderImage anula borderRadius)
- Estilos separados: `dashStyles`, `paStyles`, `S` (legado MRC)
- Export Excel: `src/lib/exportMRC.js` — 2 abas, icon.png, showGridLines dentro de views[]
- Importação MRC: header linha 11, dados linha 12+, 97 colunas possíveis (F1-F5)
- Importação: limpa N/A, normaliza imp/prob, parseia crit texto→int, batches de 50
- Importação: col 5 (Processo) só aparece no preview, NÃO é inserida no Supabase
- Áreas devem existir antes da importação
- Arquivos Excel da Brascabos podem vir criptografados — pedir versão sem senha
- Tela Importar MRC: tema escuro com cores corrigidas (sessão 4), aviso amarelo, pop-up confirmação
- Criticidade é dinâmica: revisada em F1, na regressão e na F3 (apenas F1 implementada no sistema)
