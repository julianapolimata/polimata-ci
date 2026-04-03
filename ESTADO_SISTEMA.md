# ESTADO DO SISTEMA — CI Polímata
> Atualizado em: 03/04/2026 (fim da sessão — ficha confirmada)
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

## ═══════════════════════════════════════════════
## IMPLEMENTADO: WORKFLOW DE ATUALIZAÇÃO ✅
## ═══════════════════════════════════════════════

### Componente: src/components/ModalAtualizar.jsx
### Dependência: ExcelJS (`npm install exceljs`)
### Props: row, onClose, onSaved, areas, projeto (objeto completo com clientes.nome)

### Fluxo: Step 1 (Risco) → Step 2 (Controle + 6 premissas) → Step 3 (Ficha)
### Evitado/Transferido: encerra no Step 1
### Salvar: erro tratado com alert + retorno boolean
### Status: em_analise (com ficha) / teste_pendente (sem ficha)

---

## ═══════════════════════════════════════════════
## IMPLEMENTADO: FICHA DE RISCO EXCEL v5 ✅ CONFIRMADO EM PRODUÇÃO
## ═══════════════════════════════════════════════

### Versão: v5 — push realizado e confirmado (03/04/2026)
### Gerada via ExcelJS no browser, download direto .xlsx
### Exemplo confirmado: Ficha_de_Risco_C_COM_07.xlsx

### Estrutura real (2 abas):

**Aba 1: "📋 Ficha de Risco" (61 linhas × 9 colunas, paisagem)**

**Layout de colunas:**
- Col A = 3 (margem)
- Col B = 34 (labels)
- Col C-G = 20-22 (valores, merged)
- Col H = 10 (✓/✗)
- Col I = 28 (observação)

**HEADER (rows 1-2):**
- Logo (logotipo-2cores.png) inserida como imagem na célula A1
- B1: "Polímata · Consultoria em GRC" — Montserrat bold 10pt, creme (#F3EEE4), fundo navy (#00203E)
- B2: "FICHA DE RISCO — EXECUÇÃO DO TESTE" — mesmo estilo, merged B2:I2

**SEÇÃO 1 — DADOS DO PROJETO (rows 4-12):**
- Título row 4: "1. DADOS DO PROJETO" — dourado (#CC915E) bold sobre navy (#00203E), merged
- Labels col B: Montserrat bold 10pt navy (#00203E), fundo branco
- Valores col C: Montserrat regular 10pt #333333, fundo creme (#F8F6F2)
- Campos: CLIENTE, NATUREZA DO PROJETO, FASE EM CURSO, EXECUTOR, DATA E HORÁRIO, DOWNLOAD POR, REVISOR (editável), DATA DA REVISÃO (editável)
- Valores merged C:I em cada row

**SEÇÃO 2 — IDENTIFICAÇÃO DO RISCO E CONTROLE (rows 14-22):**
- Título row 14: "2. IDENTIFICAÇÃO DO RISCO E CONTROLE" — dourado sobre navy
- Campos pré-preenchidos: ÁREA/PROCESSO, SUBPROCESSO, REF.RISCO, REF.CONTROLE, GERÊNCIA, RESP.SUBPROCESSO, DESC.RISCO, DESC.CONTROLE
- Valores: fundo #F8F6F2 + borda esquerda medium #CC915E (dourada)

**SEÇÃO 3 — ATRIBUTOS DO CONTROLE (rows 24-30):**
- Título row 24: "3. ATRIBUTOS DO CONTROLE"
- Campos: CATEGORIA, FREQUÊNCIA, NATUREZA, CARACTERÍSTICA, SISTEMA, CONTROLE CHAVE?
- Mesmo estilo pré-preenchido (creme + borda dourada)

**SEÇÃO 4 — PREMISSAS (rows 32-38):**
- Título row 32: "4. AS 6 PREMISSAS DO CONTROLE — VALIDAÇÃO METODOLÓGICA"
- 6 campos editáveis: QUEM FAZ, QUANDO FAZ, POR QUÊ FAZ, COMO FAZ, ONDE FAZ, QUAL O RESULTADO
- Valores: fundo #F8F6F2 + borda dourada (mesmo estilo dos pré-preenchidos)

**SEÇÃO 5 — PASSOS DE TESTE (rows 40-52):**
- Título row 40: "5. PASSOS DE TESTE"
- Header row 41: "Atividade / Passo" (B, merged B:G) | "✓ / ✗" (H) | "Observação" (I)
- Row 42: legenda "✓ = Teste realizado com sucesso · ✗ = Não foi possível realizar o teste"
- Rows 43-52: Passo 1 a Passo 10 (editáveis)

**SEÇÃO 6 — RESULTADO (rows 55-59):**
- Título row 55: "6. RESULTADO"
- Campos: RESULTADO, INCONSISTÊNCIA IDENTIFICADA, MELHORIA IDENTIFICADA?, DESCRIÇÃO DA MELHORIA
- Row 60: nota "↑ Preencher apenas quando 'Melhoria Identificada?' = Sim"

**FOOTER (row 61):**
- B61: "Polímata Consultoria em GRC · Ficha de Risco"
- F61: "Gerado em: DD/MM/AAAA · HH:MM · Por: email@..."

**Aba 2: "Teste" (área livre)**
- Row 2, col B: "7. EXECUÇÃO DO TESTE E EVIDÊNCIAS"
- Espaço aberto para o profissional colar evidências

### Regras visuais confirmadas:
- Fundo BRANCO geral, sem linhas de grade
- Títulos de seção: dourado (#CC915E) sobre navy (#00203E), bold
- Labels: navy (#00203E) bold sobre branco
- Valores pré-preenchidos: #333333 regular sobre #F8F6F2, borda esquerda medium #CC915E
- Campos editáveis: branco + borda cinza
- Coluna A = 3 (margem estreita)
- Fonte Montserrat 10pt em tudo, SEM itálico
- Orientação paisagem
- 1 imagem (logo) incorporada

---

## Pendências (próximo chat)
1. ~~Confirmar build/deploy da ficha Excel v5~~ ✅ FEITO
2. **Testar ficha no browser** — verificar que logo carrega, dados corretos em produção
3. **Configurar domínio** polimatagrc.com.br no Vercel
4. **Tema escuro** do sistema (avaliar telas além do Dashboard)
5. **PWA offline** — funcionamento sem internet + sincronização
6. Upload e leitura de ficha preenchida (re-importar dados do Excel de volta pro sistema)
7. Export Excel/PDF da MRC
8. Integrar engine na MRC (peso real no modal)
9. Workflow aprovação (rascunho → em_revisao → aprovado)
10. Access control suspensos
11. Flow "Novo Projeto"

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
- CUIDADO: ao montar arquivos por partes, verificar duplicação de blocos (causou build fail 03/04)
