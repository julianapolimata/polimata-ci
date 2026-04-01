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

### Sidebar atualizada
- Grupo "Dashboards": Dashboard Maturidade | Visão Geral
- Grupo "Por Área": lista colapsável das 14 áreas (navega por ID)
- Grupo "Operação": MRC Completa (badge com total)
- Grupo "Administração": Configurações (admin only)

### 1. Dashboard Maturidade (rota `/`)
- Gauge engrossada (12px) + "Última atualização" no header
- Visão Empresa compacta (sem KpisTable) + Visão Área com KPIs
- Ranking por Área com scroll

### 2. Visão Geral (rota `/visao-geral`) — IMPLEMENTADA
- 4 cards totais: Total | Efetivo | Inefetivo | GAP (com breakdown 4 criticidades)
- Labels sub-header: Crít / Sign / Mod / Baixo
- Tabela "Resumo por Área": Área | Última Revisão | Total | Efetivo×4 | Inefetivo×4 | GAP×4
- Linha TOTAL no rodapé; clique na área navega para Por Área

### 3. Por Área (rota `/area/:areaId`) — IMPLEMENTADA
- ← VOLTAR + nome área + "X controles · Peso empresa: Y%"
- 5 KPIs: Maturidade(%+badge) | Efetivos | Inefetivos | GAPs | Planos de Ação (dourado)
- Busca + filtros (criticidades via crit_label, impactos, resultados F1)
- Tabela MRC filtrada (23 colunas), scroll horizontal
- Badges coloridos: Resultado (verde/vermelho/laranja), Impacto, Probabilidade, Criticidade
- Botão "Ver" (modal MRCCompleta a integrar)
- Navegável via sidebar, Ranking, ou Visão Geral

### Outras telas
| Tela | Arquivo |
|---|---|
| Login | src/pages/Login.jsx |
| MRC Completa | src/components/MRCCompleta.jsx (522 ctrl) |
| Config Clientes/Usuários | src/pages/Configuracoes.jsx |
| Perfil | src/pages/Perfil.jsx |

---

## Campos Supabase — tabela `mrc` (DEFINITIVO)
`rr` (Ref.Risco), `rc` (Ref.Controle), `sub` (Subprocesso), `ger` (Gerência), `resp_sub` (Resp.Subprocesso), `dt_ult` (Data Últ.Atualização), `dr` (Desc.Risco), `dc` (Desc.Controle), `cat` (Categoria), `freq` (Frequência), `nat` (Natureza), `car` (Característica), `sis` (Sistema), `chave` (Ctrl Chave), `passos_f1` (Passos Teste), `r1` (Resultado F1), `incons` (Desc.Inconsistência), `rec` (Recomendação), `imp` (Impacto - text), `prob` (Probabilidade - text), `crit` (Criticidade - INTEGER 1-4), `crit_label` (Label criticidade - text), `area` (Processo/Área - text), `st_pa`, `r_ader`, `r3`, `dc_novo`, `area_id` (UUID FK)

---

## Engine de Cálculo
- src/lib/calculoMaturidade.js — validado (Compras → 37.78% → N3)
- State elevado no shell Dashboard: areasCalc + todosControles compartilhados entre 3 telas

---

## Pendências
1. Integrar botão "Ver" do Por Área com modal do MRCCompleta
2. Export Excel/PDF da MRC
3. Integrar engine na MRC (peso real no modal)
4. Workflow aprovação
5. Access control suspensos
6. Flow "Novo Projeto" (sistemas do cliente)

---

## Notas Técnicas
- GitHub bloqueado no Claude → upload direto de arquivos
- Verificar extensões antes de commit (.css.css bug)
- Workflow: mockup HTML → aprovação → JSX
- Layout: viewport completo, sem scroll/assimetria
- Excel: ExcelJS (não SheetJS)
- `crit` é INTEGER no Supabase — sempre usar String() ao comparar
- Navegação Por Área usa `area.id` (UUID), não nome encodado
