# PERFIS DE ACESSO E WORKFLOW — CI Polímata
> Validado em 26/03/2026

---

## 1. Perfis de Acesso

### 1.1 admin_polimata
- **Escopo:** Todos os clientes e projetos
- **Permissões:**
  - Acesso total ao sistema
  - Cria/edita/exclui clientes, projetos, áreas, sistemas, usuários
  - Edita análises (todos os campos de todas as fases)
  - Aprova e reprova análises no workflow
  - Visualiza notas internas e histórico de revisões
  - Exporta relatórios (PDF, Excel)
  - Gerencia configurações globais

### 1.2 consultor_polimata
- **Escopo:** Apenas clientes + projetos atribuídos via `perfis_projetos`
- **Permissões:**
  - Edita análises controle a controle (campos de todas as fases)
  - Faz upload de fichas
  - Submete análises para revisão (aciona o workflow)
  - Baixa relatórios dos projetos atribuídos
  - Visualiza notas de reprovação (recebe notificação)
- **Restrições:**
  - NÃO edita estrutura (clientes, projetos, áreas, sistemas)
  - NÃO gerencia usuários
  - NÃO aprova análises
  - NÃO vê clientes/projetos de outros consultores

### 1.3 gestor_cliente
- **Escopo:** Apenas projetos do seu cliente (atribuídos via `perfis_projetos`)
- **Permissões:**
  - Visualiza todas as áreas dos projetos atribuídos
  - Consulta a MRC completa, Dashboard, régua de maturidade
  - Baixa relatórios (PDF, Excel)
- **Restrições:**
  - Somente consulta — NÃO edita nenhum dado
  - NÃO vê notas internas, revisões ou comentários da Polímata
  - NÃO vê resultados em status `rascunho` ou `em_revisao` (só `aprovado`)

### 1.4 usuario_cliente
- **Escopo:** Apenas áreas atribuídas dentro dos projetos do seu cliente
- **Permissões:**
  - Visualiza dados das áreas atribuídas
  - Consulta a MRC (filtrada pelas áreas dele)
  - Baixa relatórios das áreas atribuídas
- **Restrições:**
  - Mesmas do gestor_cliente + filtro por área
  - NÃO vê áreas não atribuídas

---

## 2. Modelo de Dados de Acesso

### Tabela `perfis`
| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid (= auth.users.id) | Identificador do usuário |
| nome | text | Nome completo |
| email | text | Email (login) |
| papel | text | admin_polimata / consultor_polimata / gestor_cliente / usuario_cliente |
| cliente_id | uuid (FK clientes) | Cliente vinculado (NULL para admin) |

### Tabela `perfis_projetos` (N:N)
| Campo | Tipo | Descrição |
|---|---|---|
| perfil_id | uuid (FK perfis) | Usuário |
| projeto_id | uuid (FK projetos) | Projeto atribuído |

Um usuário pode ter acesso a múltiplos projetos, mas seleciona um por vez no sistema.

### Tabela `permissoes_area` (só para usuario_cliente)
| Campo | Tipo | Descrição |
|---|---|---|
| perfil_id | uuid (FK perfis) | Usuário |
| area_id | uuid (FK areas) | Área liberada |

Se o usuario_cliente tem `acesso_todas_areas = true`, essa tabela é ignorada.

---

## 3. Workflow de Aprovação

### 3.1 Status do Controle
```
rascunho → em_revisao → aprovado
                      → reprovado → (consultor edita) → em_revisao → ...
```

### 3.2 Fluxo Detalhado

**Passo 1 — Consultor preenche**
- Consultor edita os campos da análise (resultado, inconsistências, recomendações, etc.)
- Faz upload da ficha de risco
- Status: `rascunho`
- Resultado NÃO entra no cálculo de maturidade

**Passo 2 — Consultor submete**
- Clica em "Submeter para Revisão"
- Status muda para `em_revisao`
- Admin recebe notificação (email + sistema + pop-up)
- Resultado NÃO entra no cálculo de maturidade

**Passo 3a — Admin aprova**
- Admin revisa a análise e clica em "Aprovar"
- Status muda para `aprovado`
- Resultado É INCORPORADO no cálculo de maturidade
- Consultor recebe notificação de aprovação
- Cliente passa a ver o resultado

**Passo 3b — Admin reprova**
- Admin escreve nota de texto livre com o motivo
- Status muda para `reprovado`
- Consultor recebe notificação com a nota
- Consultor pode editar e resubmeter → volta ao passo 2

### 3.3 Regras Importantes
- Se um controle **aprovado** for alterado por qualquer motivo, o workflow **reinicia** (volta para `rascunho`)
- Controle reprovado só reabre pelo fluxo normal (consultor edita → submete novamente)
- Um controle aprovado NÃO pode ser "reaberto" manualmente — só se voltar pela trilha de desenvolvimento (regressão)

### 3.4 Impacto no Cálculo
- Apenas controles com `status_workflow = 'aprovado'` entram no cálculo de maturidade
- Controles em `rascunho`, `em_revisao` ou `reprovado` contribuem 0% para a área

---

## 4. Visibilidade por Perfil

| Informação | admin | consultor | gestor_cliente | usuario_cliente |
|---|---|---|---|---|
| Resultado aprovado | ✅ | ✅ (seus projetos) | ✅ | ✅ (suas áreas) |
| Resultado em_revisao | ✅ | ✅ (seus projetos) | ❌ | ❌ |
| Resultado rascunho | ✅ | ✅ (seus projetos) | ❌ | ❌ |
| Notas de revisão | ✅ | ✅ (suas análises) | ❌ | ❌ |
| Histórico de revisões | ✅ | ✅ (suas análises) | ❌ | ❌ |
| Dashboard workflow | ✅ | ❌ | ❌ | ❌ |
| Cadastro clientes/usuários | ✅ | ❌ | ❌ | ❌ |
| Edição de análises | ✅ | ✅ (seus projetos) | ❌ | ❌ |
| Upload fichas | ✅ | ✅ (seus projetos) | ❌ | ❌ |
| Export PDF/Excel | ✅ | ✅ (seus projetos) | ✅ | ✅ (suas áreas) |

---

## 5. Notificações (planejado)

| Evento | Destinatário | Canais |
|---|---|---|
| Análise submetida para revisão | admin_polimata | Email + sistema + pop-up Windows |
| Análise aprovada | consultor que submeteu | Email + sistema + pop-up Windows |
| Análise reprovada (com nota) | consultor que submeteu | Email + sistema + pop-up Windows |

- Email com layout Polímata (logo, cores navy/dourado)
- Pop-up nativo via Service Worker (funciona com sistema fechado)
- Notificação interna no sistema (badge na sidebar)

---

## 6. Tabelas de Workflow no Banco

### Campos adicionais na tabela `mrc`
| Campo | Tipo | Descrição |
|---|---|---|
| status_workflow | text | rascunho / em_revisao / aprovado / reprovado |
| arquivo_ficha_url | text | URL da ficha no Supabase Storage |
| submetido_por | uuid | Quem submeteu |
| submetido_em | timestamptz | Quando submeteu |
| aprovado_por | uuid | Quem aprovou |
| aprovado_em | timestamptz | Quando aprovou |

### Tabela `revisoes` (histórico interno)
| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid | PK |
| mrc_id | uuid | FK para o controle |
| autor_id | uuid | Quem fez a ação |
| tipo | text | submissao / aprovacao / reprovacao / comentario |
| nota | text | Nota de texto livre (obrigatória na reprovação) |
| status_antes | text | Status anterior |
| status_depois | text | Status novo |
| criado_em | timestamptz | Timestamp |

### Tabela `notificacoes`
| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid | PK |
| destinatario_id | uuid | Usuário que recebe |
| tipo | text | submissao / aprovacao / reprovacao |
| mrc_id | uuid | Controle relacionado |
| mensagem | text | Texto da notificação |
| lida | boolean | Se já foi vista |
| criado_em | timestamptz | Timestamp |
