# METODOLOGIA POLÍMATA CI — Especificação de Cálculo v3
> Validada em 26/03/2026 — inclui atalho F1→F3, risco descontinuado, mapeamento de colunas

---

## 1. Trilha de Desenvolvimento — 5 Fases (7 etapas)

| Código | Nome | Peso | Acumulado |
|---|---|---|---|
| F1 | Diagnóstico Inicial | 10% | 10% |
| F2-E1 | Plano de Ação e Teste de Desenho | 12,5% | 22,5% |
| F2-E2 | Teste de Aderência | 12,5% | 35% |
| F3 | Revisão dos Controles Internos | 25% | 60% |
| F4-C1 | Auditoria Contínua — Ciclo 1 | 15% | 75% |
| F4-C2 | Auditoria Contínua — Ciclo 2 | 15% | 90% |
| F5 | Auditoria Independente | 10% | 100% |

---

## 2. Regra da F1 — Fase Binária

A F1 vale **10% fixo por área**. Não é calculada por controle individual.

- Quando o diagnóstico da área é concluído, ela ganha 10%
- O resultado de cada controle (Efetivo/Inefetivo/GAP) NÃO afeta o percentual da F1
- O resultado da F1 determina o **caminho** que cada controle percorrerá (ver seção 6)

---

## 3. Peso Proporcional do Controle (F2+)

A partir da F2, cada controle tem peso proporcional à sua criticidade dentro da área.

**Multiplicadores de criticidade:**
| Criticidade | Multiplicador |
|---|---|
| Crítico | 0.40 |
| Significativo | 0.30 |
| Moderado | 0.20 |
| Baixo | 0.10 |

**Fórmula:**
```
peso_controle = multiplicador_criticidade / Σ(multiplicadores de TODOS os controles ativos da área)
```

**IMPORTANTE:** O denominador é ÚNICO para toda a área (soma ponderada de todos os controles ativos). NÃO separar por faixa de criticidade.

**Exemplo:** Área com 2 Críticos + 1 Significativo + 1 Baixo:
- Denominador = (2×0.40) + (1×0.30) + (1×0.10) = 1.20
- Cada Crítico = 0.40/1.20 = 33,3%
- Significativo = 0.30/1.20 = 25,0%
- Baixo = 0.10/1.20 = 8,3%
- Total = 100% ✓

---

## 4. Risco Descontinuado

Quando um risco/controle deixa de existir na área:

- Ele recebe status **"Descontinuado"** (campo `status_risco` / coluna AX na planilha)
- **NÃO é deletado** da base — permanece para rastreabilidade e histórico
- **É excluído dos cálculos** — não entra no denominador do peso proporcional
- Se a área tinha 40 controles e 1 foi descontinuado, o cálculo usa 39 controles ativos

**Na engine de cálculo:** filtrar apenas controles com `status_risco != 'Descontinuado'` antes de calcular denominador e contribuições.

---

## 5. Cálculo do Percentual da Área

```
percentual_area = 10% (F1 fixa) + Σ (peso_controle × peso_fase) para cada controle EFETIVO em cada fase concluída
```

Um controle contribui com `peso_controle × peso_fase` **apenas se efetivo naquela fase**.

Se o controle está aguardando teste numa fase (ainda não tem resultado), ele contribui 0% naquela fase.

---

## 6. Atalho: Controle Efetivo na F1 → Pula para F3

Esta é uma regra fundamental da metodologia:

- Se o controle é **Efetivo na F1**, ele **pula direto para F3**
- O peso da F2 inteira (25% = 12,5% + 12,5%) é **somado automaticamente** ao percentual dele
- Na F3, se for Efetivo novamente, ganha mais 25%

**Resultado:** um controle Efetivo na F1 que também é Efetivo na F3 contribui com:
```
peso_controle × (12,5% + 12,5% + 25%) = peso_controle × 50%
```

- Se o controle é **Inefetivo ou GAP na F1**, ele segue o caminho normal: F2-E1 → F2-E2 → F3
- Nesse caso, ele ganha cada etapa conforme for efetivo nela

**Fluxo visual:**
```
F1 resultado Efetivo  → [+25% automático F2] → F3 → F4 → F5
F1 resultado Inefetivo → F2-E1 → F2-E2 → F3 → F4 → F5
F1 resultado GAP       → F2-E1 → F2-E2 → F3 → F4 → F5
```

---

## 7. Regressão

Qualquer controle que receba resultado **Inefetivo** ou **GAP** em qualquer fase a partir da F2:
- **Volta para F2-E1** (Plano de Ação)
- **Perde TODA contribuição acumulada nas fases F2+**
- Mantém apenas os 10% da F1 (que é fixa da área)
- Os demais controles da área que estão efetivos MANTÊM sua contribuição normalmente

**Nota:** Um controle que era Efetivo na F1 (e ganhou F2 automático) mas é reprovado na F3:
- Perde os 25% automáticos da F2 + os 25% da F3
- Volta para F2-E1 com apenas 10% da F1
- Precisa percorrer F2-E1 → F2-E2 → F3 normalmente

---

## 8. Regras Especiais por Fase

### F3 — Revisão dos Controles Internos
- Somente controles **efetivos na F2-E2** (ou efetivos na F1 com atalho) são testados na F3
- Controles que não passaram pela F2-E2 como efetivos não entram na F3

### F4 — Auditoria Contínua
- 2 ciclos por ano (C1 = 15%, C2 = 15%)
- Os controles da área são **divididos** entre os ciclos
- Cada controle é testado em **apenas 1 ciclo por ano**
- O mesmo controle **não é testado duas vezes** no mesmo ano

### F5 — Auditoria Independente
- Pode ser executada pela Polímata ou por terceiro externo
- Peso: 10%

---

## 9. Régua de Maturidade

O percentual acumulado da área posiciona na régua:

| Nível | Nome | Faixa | Descrição |
|---|---|---|---|
| N1 | Não confiável | 0%–10% | Ambiente imprevisível, controles não projetados ou não funcionam |
| N2 | Informal | 11%–25% | Controles projetados, em implementação, funcionamento parcial |
| N3 | Padronizado | 26%–50% | Controles projetados, funcionando e documentados |
| N4 | Monitorado | 51%–80% | Controles padronizados, testados periodicamente |
| N5 | Otimizado | 81%–100% | Controles integrados com monitoramento em tempo real |

---

## 10. Índice Consolidado da Empresa

```
indice_empresa = Σ (percentual_area × peso_area) para todas as áreas ativas
```

Os pesos das áreas somam 100% e estão definidos no banco (tabela `areas`, campo `peso`).

---

## 11. Exemplo Validado (atualizado com atalho F1→F3)

**Área de Compras** (peso 15%, 4 controles ativos, F1 concluída):

| Controle | Criticidade | Peso | F1 | Caminho | Contribuição F2+ |
|---|---|---|---|---|---|
| C.COM.01 | Crítico (0.40) | 44,4% | **Efetivo** | Atalho → F2 auto + aguarda F3 | 44,4%×25% = **11,11%** |
| C.COM.02 | Signif. (0.30) | 33,3% | Inefetivo | Normal → F2E1 ef + F2E2 ef + F3 ef | 33,3%×12,5% + 33,3%×12,5% + 33,3%×25% = **16,67%** |
| C.COM.03 | Baixo (0.10) | 11,1% | GAP | Normal → Regrediu F2E2 | **0%** |
| C.COM.04 | Baixo (0.10) | 11,1% | Inefetivo | Normal → Aguarda F2E1 | **0%** |

**Percentual = 10% + 11,11% + 16,67% + 0% + 0% = 37,78% → N3 (Padronizado)**

✅ Validado pela Juliana em 26/03/2026.

---

## 12. Premissas de um Controle

Todo controle deve responder às 6 perguntas-chave:
Por quê? Quando? Onde? Quem? Como? Qual o resultado?

---

## 13. Criticidade do Risco

Matriz de **Impacto × Probabilidade**:
- **Impacto:** Baixo, Moderado, Alto, Crítico
- **Probabilidade:** Baixa, Média, Alta, Extrema
- **Resultado:** 4 níveis — Baixo, Moderado, Significativo, Crítico

---

## 14. Mapeamento de Colunas da Planilha → Sistema

Referência para entender quais campos da aba "Matriz de Riscos" alimentam cada fase na aba "Cálculo".

### Identificação do Controle
| Campo | Coluna Planilha | Campo Supabase |
|---|---|---|
| Processo/Área | E | processo (via areas.nome) |
| Criticidade (F1) | W | criticidade |
| Impacto | U | impacto |
| Probabilidade | V | probabilidade |
| Resultado F1 | R | r1 |
| Status Risco (Existente/Descontinuado) | AX | status_risco |

### F2-E1 — Plano de Ação e Teste de Desenho
| Campo | Coluna Planilha | Condição na aba Cálculo |
|---|---|---|
| Status do PA | AG | "Concluído" = controle entra no cálculo F2-E2 |
| Métricas status PA | K25:O25 | Não Iniciado / Em desenvolvimento / Em revisão / Concluído / N/A |

### F2-E2 — Teste de Aderência
| Campo | Coluna Planilha | Condição |
|---|---|---|
| Resultado aderência | (usa métricas Q25:S25) | Efetivo / Inefetivo / GAP |
| Pré-requisito | AG = "Concluído" | Só testa se PA concluído |

### F3 — Revisão dos Controles Internos
| Campo | Coluna Planilha | Condição |
|---|---|---|
| Apto para F3 | AY | "Sim" = controle entra na F3 |
| Resultado F3 | (via métricas I70:K70) | Efetivo / Inefetivo / GAP |

### F4-C1 — Auditoria Contínua Ciclo 1
| Campo | Coluna Planilha | Condição |
|---|---|---|
| Selecionado para teste | BK | "Testar" |
| Resultado C1 | BM | Efetivo / Inefetivo / GAP / N/A |
| Criticidade C1 | (usa W da F1) | Para % Criticidade |

### F4-C2 — Auditoria Contínua Ciclo 2
| Campo | Coluna Planilha | Condição |
|---|---|---|
| Selecionado para teste | BT | "Testar" |
| Resultado C2 | BV | Efetivo / Inefetivo / GAP / N/A |

### F5 — Auditoria Independente
| Campo | Coluna Planilha | Condição |
|---|---|---|
| Status risco | AX | "Existente" (filtra descontinuados) |
| Resultado F5 | CD | Efetivo / Inefetivo / GAP |
| Criticidade F5 | CI | Para % Criticidade |

---

## 15. Bugs Confirmados na Planilha (não reproduzir no sistema)

| # | Bug | Onde | Impacto |
|---|---|---|---|
| 1 | **Denominador separado por faixa** | F2-E1, F2-E2, F3 | Peso por criticidade distorcido |
| 2 | **Inconsistência F2/F3 vs F4/F5** | F4 e F5 usam proporção simples, F2/F3 usam multiplicadores | Duas lógicas diferentes para o mesmo conceito |
| 3 | **#REF! em F4-C1** | Coluna E (E97:E110) | Referência quebrada a célula deletada |
| 4 | **Sem regressão** | Toda a aba | Controle inefetivo não volta para F2-E1 |
| 5 | **Sem progressão acumulada** | Toda a aba | Cada fase calcula isolada, não soma F1+F2+F3... |
| 6 | **Sem atalho F1→F3** | F2 inteira | Efetivo na F1 deveria pular F2 com peso automático |
| 7 | **Sem filtro de descontinuados no denominador** | F2, F3 | Riscos descontinuados ainda contam no total |

**O sistema deve implementar a METODOLOGIA (este documento), não replicar os bugs da planilha.**
