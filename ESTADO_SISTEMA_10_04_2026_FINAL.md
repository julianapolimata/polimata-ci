# ESTADO DO SISTEMA — CI Polímata
> Atualizado em: 10/04/2026 (fim da sessão)
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

### 3. Por Área (rota `/area/:areaId`) — ✅ COMPLETO
- 5 KPIs + Filtros + tabela MRC 23 colunas
- Botão **"➕ Novo Risco"** (dourado, acima da tabela) ✅ NOVO
- Botão "Ver" → ModalDetalhe
- Botão "Atualizar" (dourado, só admin/consultor) → ModalAtualizar ✅
- Botão **"Resultado"** (novo nome, era "Registrar") → ModalRegistrarResultado ✅ NOVO
- Badges "EM ANÁLISE" e "TESTE PENDENTE" ✅
- Badge **"FICHA GERADA"** (novo) ✅

### Outras telas
- Login, MRC Completa, Config Clientes/Usuários, Perfil

---

## IMPLEMENTAÇÕES DESTA SESSÃO (10/04/2026)

### ✅ ModalNovoRisco.jsx (1.392 linhas, 54 KB)
**Status:** COMPLETO E DEPLOYADO
- 3 Passos: Identificação → Características+Premissas → Gerar Ficha
- Auto-geração de referências (R.PREFIXO.XX, C.PREFIXO.XX)
- Criticidade dinâmica (Impacto × Probabilidade)
- Lógica: Automatizado desabilita "Quem faz?"
- Alerta ao mudar resultado (limpa inconsistência)
- Carrega **responsáveis de tabela `responsaveis`** ✅ NOVO
- Status: `ficha_gerada` após salvar
- Gera Excel automaticamente (reutiliza função ModalAtualizar)

### ✅ ModalRegistrarResultado.jsx (705 linhas, 27 KB)
**Status:** COMPLETO E DEPLOYADO
- 1 tela única (pós-teste)
- Resultado (Efetivo/Inefetivo/GAP) com alerta de perda
- Inconsistência condicional
- Melhoria + descrição
- Criticidade + Plano de Ação
- Status: `em_analise` ao salvar
- **Botão renomeado de "Registrar" → "Resultado"** ✅ NOVO

### ✅ Dashboard.jsx (MODIFICADO)
**Status:** COMPLETO E DEPLOYADO
- Imports: ModalNovoRisco + ModalRegistrarResultado
- States: modalNovoRisco, rowRegistrarResultado
- Botão **"➕ Novo Risco"** (dourado, acima da tabela) ✅ NOVO
- Botão "Resultado" (renomeado) ✅
- Badge "Ficha Gerada" (novo status visual) ✅
- Callbacks para recarregar dados
- Integração completa na função PorArea()

### ✅ Tabela `responsaveis` (NOVA)
**Status:** CRIADA NO SUPABASE
- Estrutura:
  ```sql
  CREATE TABLE responsaveis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    projeto_id UUID NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    email TEXT,
    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMP DEFAULT now(),
    atualizado_em TIMESTAMP DEFAULT now()
  );
  ```
- RLS Policies: SELECT, INSERT, UPDATE, DELETE (usando meu_cliente_id())
- **51 responsáveis já cadastrados** para projeto Brascabos ✅

---

## Campos Supabase — tabela `mrc` (SEM MUDANÇAS)
`id`, `projeto_id`, `area_id`, `rr`, `rc`, `sub`, `ger`, `resp_sub`, `dt_ult`, `dr`, `dc`, `imp`, `prob`, `crit` (INTEGER 1-4), `crit_label`, `cat`, `freq`, `nat`, `car`, `sis`, `chave`, `passos_f1`, `r1`, `incons`, `rec`, `dem_pa`, `resp_pa`, `dt_pa`, `st_pa`, `coment_pa`, `dt_teste`, `dc_novo`, `r_ader`, `melhoria`, `incons_ader`, `coment_ader`, `st_f3`, `r3`, `incons_f3`, `rec_f3`, `area`, `status_workflow`, `criado_em`, `atualizado_em`, `criado_por`, `atualizado_por`, `status_risco`, `motivo_inativacao`, `ativo`, `transferido_de`, `ref_anterior`, `premissa_porque`, `premissa_quando`, `premissa_onde`, `premissa_quem`, `premissa_como`, `premissa_resultado`

### Constraint status_workflow:
CHECK (status_workflow = ANY (ARRAY['rascunho','em_revisao','aprovado','reprovado','em_analise','teste_pendente','ficha_gerada']))

### Tabela `mrc_audit_log`:
- id, mrc_id, campo, valor_anterior, valor_novo, usuario_id, criado_em

---

## PENDÊNCIAS PARA PRÓXIMA SESSÃO (11/04/2026+)

### 🔴 ALTA PRIORIDADE

**1. ClientesConfig.jsx — NOVA ABA "Responsáveis por Subprocesso"**
- Adicionar aba em DetalheCliente
- Interface: lista de subprocessos únicos por projeto
- Para cada subprocesso: input texto do responsável
- Botão "Salvar" → atualiza TODOS os riscos/controles com esse subprocesso
- Sincronização: quando salva um responsável de subprocesso, atualiza campo `resp_sub` em toda a tabela `mrc` onde `sub` = esse subprocesso
- Objetivo: evitar dropdown gigante (51 nomes) — usar gerenciamento por configuração

**2. Renomear gerência no ModalNovoRisco**
- Atualmente: dropdown com 8 gerentes (da tabela `areas`)
- Issue: lista está grande
- Solução: similar a responsáveis — add campo em ClientesConfig para gerenciar por área
- Ou: deixar dropdown como está (menos importante que responsáveis)

**3. Testar fluxo completo (Novo Risco → Resultado)**
- ✅ Novo Risco com 3 passos
- ✅ Gera Ficha Excel
- ✅ Status: ficha_gerada
- ⏳ Registrar Resultado (após teste)
- ⏳ Status: em_analise
- ⏳ Validar dados no Supabase

**4. F3 Criticidade Review & Regression**
- Não implementado ainda
- Quando status = F3: permitir revisão de criticidade com evidências
- Quando há regressão (Efetivo → Inefetivo): reverter criticidade para F2-E1

### 🟡 MÉDIA PRIORIDADE

**5. Propagação de mudanças**
- Mudança de `gerente` em área → reflete em todos `mrc.ger` dessa área
- Mudança de `resp_sub` por subprocesso → reflete em todos `mrc.resp_sub` daquele subprocesso

**6. Excel Export com novo status `ficha_gerada`**
- Adicionar coluna ou indicador visual na MRC exportada

**7. Dark theme audit/consistency pass**
- Revisar todas as telas quanto ao tema escuro
- Verificar contraste, legibilidade

**8. PWA / offline capability**
- Explorar funcionalidade offline
- Sincronização ao retornar online

**9. Custom domain polimatagrc.com.br**
- Configuração no Vercel pendente

### 🟢 BAIXA PRIORIDADE

**10. ModalNovoRisco full flow validation**
   - Testar todas as branches (automatizado, resultado diferente, PA sim/não, etc)
   
**11. "Novo Projeto" flow**
   - Ao criar novo projeto, perguntar quais sistemas/ferramentas são usados
   - Pré-configurar dropdown "Sistema" no ModalNovoRisco

**12. Cache/browser refresh issue**
   - Mitigado com Cache-Control headers
   - Continuar monitorando após deploys

---

## Dados Supabase — Estado Atual

### Tabela `responsaveis` (NOVA 10/04)
✅ **51 responsáveis inseridos para projeto Brascabos**
- Nomes extraídos de `mrc.resp_sub` distintos
- Incluem nomes simples e combinados (ex: "Gustavo Pontes / Victor Ormundo")
- Campo `email` vazio (pode ser preenchido depois)
- Todos com `ativo=true`

### Tabela `areas`
✅ Campo `gerente` já preenchido com 8 nomes:
- Luciano Vassoler
- Daniel Defina
- Ricardo Moi
- Marco Módulo
- (+ 4 outros)

### Tabela `sistemas`
✅ Já preenchida com sistemas por cliente

---

## GIT & DEPLOYMENT

### Deploy 10/04/2026
```
FEAT: Integração ModalNovoRisco + ModalRegistrarResultado em Dashboard
FEAT: Adiciona botão Novo Risco e renomeia Registrar para Resultado
FEAT: ModalNovoRisco com carregamento de responsáveis da tabela
```

**Status:** ✅ TODOS DEPLOYADOS EM PRODUÇÃO (polimata-ci.vercel.app)

---

## Notas Técnicas

- GitHub bloqueado no Claude → upload direto de arquivos
- Workflow com Claude: mockup → aprovação → código → deploy
- Excel: ExcelJS (instalado via npm)
- `crit` é INTEGER — sempre usar String() ao comparar
- Navegação Por Área usa area.id (UUID)
- ModalNovoRisco: fundo branco (contraste com tema escuro)
- Dashboard.jsx passa `projeto` (objeto completo) pro ModalNovoRisco
- `responsaveis` carregado dinamicamente no init do ModalNovoRisco
- Dropdown `resp_sub` usa `responsaveis.map(r => <option value={r.nome}>{r.nome}</option>)`

---

## Checklist Visual — O que Funciona Agora

| Feature | Status | Nota |
|---------|--------|------|
| Dashboard Maturidade | ✅ | Tema escuro, completo |
| Por Área | ✅ | MRC 23 colunas + filtros |
| Botão "Novo Risco" | ✅ | Dourado, acima da tabela |
| ModalNovoRisco 3 passos | ✅ | Passo 3 gera Excel |
| ModalRegistrarResultado | ✅ | Pós-teste, salva resultado |
| Responsáveis dropdown | ✅ | 51 opções carregadas |
| Badge "Ficha Gerada" | ✅ | Visual no status |
| Badge "Em Análise" | ✅ | Visual no status |
| Criticidade dinâmica | ✅ | Impacto × Probabilidade |
| Ficha Excel v5 | ✅ | Completa, sem logo |
| Tabela `responsaveis` | ✅ | 51 registros |
| RLS `responsaveis` | ✅ | Policies configuradas |

---

## Próximas Ações (11/04 em diante)

1. **CRIAR:** ClientesConfig nova aba "Responsáveis por Subprocesso"
2. **TESTAR:** Fluxo completo Novo Risco → Gerar Ficha → Registrar Resultado
3. **IMPLEMENTAR:** Propagação de mudanças (gerente, responsável)
4. **EXPLORAR:** F3 criticidade review + regression rules
5. **DARK THEME:** Audit completo

---

**SESSÃO 10/04/2026 ENCERRADA.**
**Próximo chat: começar com este ESTADO_SISTEMA_10_04_2026_FINAL.md**

