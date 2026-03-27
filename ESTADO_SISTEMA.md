# ESTADO DO SISTEMA — CI Polímata
> Última atualização: 26/03/2026 — metodologia validada + diagnóstico de aderência

---

## Stack Técnica
| Camada | Tecnologia |
|---|---|
| Frontend | React + Vite |
| Backend / Banco | Supabase (PostgreSQL + RLS + Auth) |
| Deploy | Vercel (auto-deploy via GitHub) |
| Repositório | github.com/julianapolimata/polimata-ci |
| URL pública | polimata-ci.vercel.app |

**Supabase:** `iqtkpyrpwxypwcwrhulx.supabase.co`  
**Admin:** `juliana@polimatagrc.com.br` / papel: `admin_polimata`  
**Projeto local:** `C:\projetos\polimata-fresh\polimata-ci`

---

## Documentação de Referência

| Arquivo | Descrição |
|---|---|
| `ESTADO_SISTEMA.md` | Este arquivo — estado técnico do sistema |
| `METODOLOGIA_CALCULO.md` | Especificação completa da engine de cálculo (validada em 26/03/2026) |

---

## Regra de Cores

| Camada | O que usa | Exemplos |
|---|---|---|
| **Estrutura** | Cores da marca (on-brand) | Sidebar, backgrounds, cards, KPIs, bordas, tipografia |
| **Indicadores** | Cores semânticas universais | Efetivo=#22D4A0, Inefetivo=#F05656, GAP=#F5B942, Criticidade, Impacto, Probabilidade |

**Regra:** Nunca usar cores da marca para indicadores (fica ilegível). Nunca usar cores universais para estrutura (perde identidade).

---

## Banco de Dados — 12 Tabelas
clientes, perfis, projetos, areas, sistemas, mrc, biblioteca_riscos, biblioteca_controles, workflow, permissoes_area, notificacoes, perfis_projetos.

RLS ativo, multi-cliente. Brascabos: 14 áreas (pesos somam 100%), 4 sistemas, 522 controles.

---

## Telas Prontas

### MRC Completa (`/mrc`) — Idêntica ao V17
- Heatmap com E:x I:x G:x + legenda criticidade
- Régua 3 níveis: Inefetivo | GAP | Efetivo
- 23 colunas na ordem v17, todas visíveis por padrão
- Limite 200 linhas + aviso
- Expandir Tudo / Recolher Tudo
- Painel colunas toggle, botões Excel/PDF (visuais)
- Cabeçalho opaco, criticidade nowrap
- Fase Atual estilo v17 (nome + barra colorida + badge)
- Modal 5 abas: Identificação (mini heatmap), F1, F2-E1, F2-E2, F3

### Dashboard (`/`)
- KPIs, Ranking, Mapa Calor, Criticidade

### Config Clientes + Usuários (`/configuracoes`)
### Perfil (`/perfil`)
### Login

---

## Metodologia — Resumo (ver METODOLOGIA_CALCULO.md para detalhes)

**Trilha:** F1(10%) → F2-E1(12,5%) → F2-E2(12,5%) → F3(25%) → F4-C1(15%) → F4-C2(15%) → F5(10%)

**Régua:** N1(0-10%) → N2(11-25%) → N3(26-50%) → N4(51-80%) → N5(81-100%)

**F1 é binária por área** — 10% fixo quando diagnóstico concluído, resultado não afeta %.

**F2+ calculado por controle** — peso proporcional por criticidade (0.40/0.30/0.20/0.10), denominador único ponderado.

**Regressão:** inefetivo em qualquer fase volta pra F2-E1, perde tudo F2+, mantém 10% F1.

**Consolidado empresa:** média ponderada das áreas (pesos somam 100%).

---

## Diagnóstico de Aderência — O que precisa ser corrigido

| Item | Estado atual | Correto (metodologia) | Status |
|---|---|---|---|
| F1 | Calcula por controle com peso por resultado (+1/−0.75/−1) | F1 é fixa 10% por área, resultado não afeta % | ❌ ERRADO |
| Peso do controle | Usa PESO_CRIT direto sem denominador único | peso_controle = multiplicador / soma_ponderada_area | ❌ ERRADO |
| Progressão por fase | Não acumula F1+F2E1+F2E2+F3 | Deve acumular: 10% + Σ(peso_controle × peso_fase) | ❌ NÃO IMPLEMENTADO |
| Regressão | Não existe | Inefetivo volta pra F2-E1, perde tudo F2+ | ❌ NÃO IMPLEMENTADO |
| Régua N1-N5 | Conta Efetivo/Inefetivo/GAP | Deve posicionar pela % acumulada na trilha | ❌ ERRADO |
| F3 só efetivos | Não implementado | Só controles efetivos em F2-E2 avançam | ❌ NÃO IMPLEMENTADO |
| F4 dois ciclos | Não implementado | 2 ciclos × 15%, controles divididos | ❌ NÃO IMPLEMENTADO |
| Índice consolidado | Fórmula simplificada | Média ponderada dos % das áreas × pesos | ⚠️ PARCIAL |

---

## Estrutura de Arquivos

```
src/
  pages/
    Dashboard.jsx        ← layout + HomeDash
    Login.jsx
    Configuracoes.jsx
    Perfil.jsx
  components/
    MRCCompleta.jsx      ← MRC v17 (23 cols, heatmap E/I/G, modal 5 abas)
  contexts/
    AuthContext.jsx
  lib/
    supabase.js
  index.css              ← design system (on-brand + semânticas)
```

---

## Pendências (próximos passos)

### Prioridade 1 — Engine de Cálculo
1. Reimplementar `calcularIndiceMaturidade` seguindo METODOLOGIA_CALCULO.md
2. F1 binária por área (10% fixo)
3. Peso proporcional por controle com denominador único
4. Progressão acumulada por fase
5. Regressão: inefetivo volta F2-E1
6. Régua N1-N5 por % na trilha (não por contagem de resultados)

### Prioridade 2 — UX
7. Exportação Excel/PDF (lógica real)
8. Melhorar Dashboard (replicar v17)
9. Tela Por Área (cards + detalhe)

### Prioridade 3 — Funcionalidades
10. Fluxo de aprovação (workflow)
11. Botão Novo Risco/Controle
12. F4 dois ciclos
13. Importação Google Drive
14. Novo Projeto — perguntar sistemas do cliente
