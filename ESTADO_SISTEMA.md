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

---

## Telas em Produção
| Tela | Arquivo |
|---|---|
| Login | src/pages/Login.jsx |
| Sidebar (recolhível) | Dashboard.jsx |
| Dashboard Maturidade | src/pages/Dashboard.jsx (v4) |
| MRC Completa | src/components/MRCCompleta.jsx (522 ctrl) |
| Config Clientes/Usuários | src/pages/Configuracoes.jsx |
| Perfil | src/pages/Perfil.jsx |

---

## Mockup v5 APROVADO — Implementar na próxima sessão

### 1. Dashboard Maturidade (ajustes)
- Gauge engrossada (6→12px)
- "Última atualização: DD/MM/AAAA" no header

### 2. Visão Geral (nova rota)
- Régua N1-N5 topo
- Tabela "Índice por Área": # | Área | Peso | Controles | % Maturidade | Nível | Barra
- Clique na área → navega "Por Área"

### 3. Por Área (nova rota + subitens sidebar)
- Ref: v17 imagens 2-7, tema claro (creme)
- ← VOLTAR + nome área + "X controles · Peso empresa: Y%"
- 4 KPIs: Maturidade(%+badge) | Efetivos | Inefetivos | GAPs·Críticos
- Régua N1-N5 com nível destacado
- Busca + filtros (criticidades, impactos, resultados)
- Tabela MRC filtrada (23 colunas + botão "Ver" → modal MRCCompleta)
- Sidebar lista 14 áreas; também acessível via Ranking e Visão Geral

### Sidebar atualizada
- Visão Geral: Dashboard Maturidade | Visão Geral
- Por Área: Todas as Áreas | Compras | ... | Vendas
- Operação: MRC Completa (522)
- Administração: Configurações

---

## Engine de Cálculo
- src/lib/calculoMaturidade.js — validado (Compras → 37.78% → N3)
- Exporta: calcularPercentualArea, calcularIndiceEmpresa, getNivelMaturidade, PESO_FASE

---

## Dados Supabase
- 522 controles (mrc), 14 áreas (Compras=0001 a Vendas=0014)
- Campos: r1, crit, imp, prob, st_pa, r_ader, r3, area_id (UUID FK)

---

## Pendências após mockup v5
1. Export Excel/PDF da MRC
2. Integrar engine na MRC (peso real no modal)
3. Workflow aprovação
4. Access control suspensos
5. Flow "Novo Projeto" (sistemas do cliente)

---

## Notas Técnicas
- GitHub bloqueado no Claude → upload direto de arquivos
- Verificar extensões antes de commit (.css.css bug)
- Workflow: mockup HTML → aprovação → JSX
- Layout: viewport completo, sem scroll/assimetria
- Excel: ExcelJS (não SheetJS)
- Ref legacy: referencia/CI_Polimata_v17_1.html
