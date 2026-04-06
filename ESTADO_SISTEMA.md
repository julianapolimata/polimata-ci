# ESTADO DO SISTEMA — CI Polímata
> Atualizado em: 03/04/2026 (sessão 3 — Dashboard + Export Excel + Import MRC)
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

### 4. Importar MRC (rota `/importar-mrc`) — ✅ IMPLEMENTADO (sessão 3)
- **Admin only** (admin_polimata)
- Item "📥 Importar MRC" na sidebar, seção Administração
- Fluxo: selecionar área → upload .xlsx → preview → confirmar → importar
- **Apaga todos os controles da área e insere os do arquivo**
- Atualiza `gerente` na tabela `areas` com o valor `ger` do Excel
- Lê header na linha 11, dados a partir da linha 12
- Preview mostra até 20 controles (ref, processo, resultado, impacto, criticidade)
- Inserção em batches de 50
- Callback `onImported` recarrega dados no Dashboard

### Outras telas
- Login, Config Clientes/Usuários, Perfil

---

## ═══════════════════════════════════════════════
## IMPLEMENTADO: IMPORTAR MRC ✅ (sessão 3)
## ═══════════════════════════════════════════════

### Arquivo: src/components/ImportarMRC.jsx
### Dependência: ExcelJS (já instalado)
### Props: projetoId, areas, onImported

### Mapeamento Excel → Supabase (header linha 11, dados linha 12+):
| Col idx (0-based) | Header Excel | Campo Supabase |
|---|---|---|
| 1 | Última Atualização | dt_ult |
| 3 | Gerência | ger |
| 4 | Responsável Subprocesso | resp_sub |
| 5 | Processo | area |
| 6 | Subprocesso | sub |
| 7 | Ref. Risco | rr |
| 8 | Descrição do Risco | dr |
| 9 | Ref. Controle | rc |
| 10 | Descrição do Controle | dc |
| 11 | Categoria de Controle | cat |
| 12 | Frequência | freq |
| 13 | Natureza | nat |
| 14 | Característica | car |
| 15 | Sistema | sis |
| 16 | Controle Chave? | chave |
| 17 | Passos de Teste | passos_f1 |
| 18 | Resultado | r1 |
| 19 | Inconsistência | incons |
| 20 | Recomendação | rec |
| 21 | Impacto | imp |
| 22 | Probabilidade | prob |
| 23 | Criticidade | crit_label + crit (integer) |
| 29 | Demanda PA? | dem_pa |
| 30 | Responsável PA | resp_pa |
| 31 | Data Limite PA | dt_pa |
| 33 | Status PA | st_pa |
| 34 | Histórico PA | coment_pa |
| 35 | Data Teste Aderência | dt_teste |
| 36 | Nova Descrição Controle | dc_novo |
| 44 | Resultado Aderência | r_ader |
| 45 | Melhoria? | melhoria |
| 46 | Inconsistência Aderência | incons_ader |
| 47 | Comentários Aderência | coment_ader |
| 50 | Status Risco | status_risco |
| 56 | Resultado F3 | r3 |
| 57 | Inconsistência F3 | incons_f3 |
| 58 | Recomendação F3 | rec_f3 |

### Limpeza de dados:
- N/A, n/a, vazio, "—" → null
- Criticidade texto → integer (1-4)
- Impacto/Probabilidade normalizados (Crítico, Alto, Moderado, Baixo / Extrema, Alta, Média, Baixa)
- Datas → ISO string
- RichText ExcelJS → string plana

---

## ═══════════════════════════════════════════════
## IMPLEMENTADO: EXPORT EXCEL MRC ✅ APROVADO
## ═══════════════════════════════════════════════

### Arquivo: src/lib/exportMRC.js
### Função: `exportarMRCExcel(controles, nomeArquivo, tituloAba, clienteNome, projetoNome)`

### Excel (2 abas) — especificação aprovada:

**Aba 1: "Mapa de Calor"**
- `views: [{ showGridLines: false }]`
- Fundo creme #F3EEE4
- Coluna A=4, B=4.09, C-H=18
- Header navy merge B1:G1, B2:G2, B3:G3 (A não entra no merge)
- Ícone icon.png 36×36
- Grid 4×4 (linhas 5-8, altura 49.5): todas coloridas (inclusive zeros)
- Bordas cor creme (invisíveis)
- Legenda linha 12: ■ coloridos, sem bordas
- Resumo linhas 16-18: cards fundo branco, **centralizados sem merge**
- Linha 17 height=39.5, font sz=26
- Footer linha 20 height=15: merge B20:E20, border-top medium dourado

**Aba 2: dados MRC**
- `views: [{ state: 'frozen', ySplit: 4, xSplit: 1, showGridLines: false }]`
- Coluna A=4 (margem creme), dados coluna B+
- 23 colunas, auto-filter, linhas alternadas

---

## ═══════════════════════════════════════════════
## IMPLEMENTADO: WORKFLOW DE ATUALIZAÇÃO ✅
## ═══════════════════════════════════════════════

### Componente: src/components/ModalAtualizar.jsx
### Fluxo: Step 1 (Risco) → Step 2 (Controle + 6 premissas) → Step 3 (Ficha)
### Status: em_analise (com ficha) / teste_pendente (sem ficha)

---

## ═══════════════════════════════════════════════
## IMPLEMENTADO: FICHA DE RISCO EXCEL v5 ✅
## ═══════════════════════════════════════════════

### Gerada via ExcelJS no browser, download direto .xlsx
### 2 abas (Ficha de Risco + Teste/Evidências), layout A=3, paisagem, Montserrat 10pt

---

## Campos Supabase — tabela `mrc`
`id`, `projeto_id`, `area_id`, `rr`, `rc`, `sub`, `ger`, `resp_sub`, `dt_ult`, `dr`, `dc`, `imp`, `prob`, `crit` (INTEGER 1-4), `crit_label`, `cat`, `freq`, `nat`, `car`, `sis`, `chave`, `passos_f1`, `r1`, `incons`, `rec`, `dem_pa`, `resp_pa`, `dt_pa`, `st_pa`, `coment_pa`, `dt_teste`, `dc_novo`, `r_ader`, `melhoria`, `incons_ader`, `coment_ader`, `st_f3`, `r3`, `incons_f3`, `rec_f3`, `area`, `status_workflow`, `criado_em`, `atualizado_em`, `criado_por`, `atualizado_por`

### Campos adicionados (migração 01/04/2026):
- `status_risco`, `motivo_inativacao`, `ativo`, `transferido_de`, `ref_anterior`
- `premissa_porque`, `premissa_quando`, `premissa_onde`, `premissa_quem`, `premissa_como`, `premissa_resultado`

### Tabela `areas`:
- id, projeto_id, nome, prefixo, peso, gerente, ordem

### Tabela `mrc_audit_log`:
- id, mrc_id, campo, valor_anterior, valor_novo, usuario_id, criado_em

---

## Engine de Cálculo
- src/lib/calculoMaturidade.js — validado
- State elevado no shell Dashboard

---

## ═══════════════════════════════════════════════
## REGRAS DE PROPAGAÇÃO (aprovadas, implementação pendente)
## ═══════════════════════════════════════════════

### 1. Importação MRC → atualizar gerente da área
- Ao importar Excel, o campo `ger` do primeiro controle atualiza `areas.gerente`
- **Status: PENDENTE** (implementar no ImportarMRC.jsx)

### 2. Configurações → alterar gerente replica para MRC
- Ao mudar `areas.gerente` em Configurações do Cliente, atualizar `mrc.ger` em todos os controles daquela `area_id`
- **Status: PENDENTE** (precisa do Configuracoes.jsx para implementar)

### 3. Responsável subprocesso → propagação condicional
- Ao alterar `mrc.resp_sub` de um controle, perguntar: "Aplicar a todos os subprocessos com mesmo nome?"
  - Sim → atualiza todos `mrc.resp_sub` onde `sub` = mesmo subprocesso na mesma área
  - Não → atualiza apenas o controle em edição
- **Status: PENDENTE** (precisa do ModalAtualizar.jsx para implementar)

---

## Pendências (próximo chat)
1. **Implementar propagação gerente** na importação (ImportarMRC.jsx)
2. **Implementar propagação gerente** nas configurações (Configuracoes.jsx — precisa do arquivo)
3. **Implementar propagação resp_sub** condicional (ModalAtualizar.jsx — precisa do arquivo)
4. **Testar importação** com arquivo real separado por área
5. **Configurar domínio** polimatagrc.com.br no Vercel
6. **PWA offline**
7. Upload e leitura de ficha preenchida
8. Integrar engine na MRC (peso real no modal)
9. Workflow aprovação (rascunho → em_revisao → aprovado)
10. Access control suspensos
11. Flow "Novo Projeto"
12. Export PDF da MRC

---

## Notas Técnicas
- GitHub bloqueado no Claude → Juliana salva downloads direto na pasta do projeto
- Workflow com Claude: mockup HTML → aprovação → código JSX/ExcelJS
- Excel: ExcelJS (instalado via npm)
- `crit` é INTEGER — sempre usar String() ao comparar
- Navegação Por Área usa area.id (UUID)
- Gerência e Responsável: DROPDOWN cadastrados (não texto livre)
- Dashboard.jsx: ~770 linhas
- Funções helper: impToIdx(), probToIdx(), critToIdx(), getBarGradient(), getUltimaAtualizacao()
- Componentes removidos: FasesBoxes, GaugeBar, KpisTable, ReguaN1N5, VisaoGeral
- Card "Planos de Ação": div absoluto com gradiente (borderImage anula borderRadius)
- Estilos separados: `dashStyles`, `paStyles`, `S` (legado MRC)
- Export Excel: `src/lib/exportMRC.js` — 2 abas, icon.png (NÃO logotipo)
- ExcelJS gridlines: `showGridLines: false` DEVE estar dentro de `views[]`
- Importação MRC: header linha 11, dados linha 12+, arquivo pode ter 97 colunas (F1-F5)
- Importação: limpa N/A, normaliza imp/prob, parseia crit texto→integer
- Áreas devem existir antes da importação (criadas em Configurações)
- Arquivos Excel da Brascabos podem vir criptografados — pedir versão sem senha
