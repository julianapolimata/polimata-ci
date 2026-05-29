# ESTADO DO SISTEMA — CI Polímata
> Atualizado em: 11/04/2026 (nova sessão)
> **IMPORTANTE: LEIA A SEÇÃO "TESTES PENDENTES" ANTES DE CONTINUAR**

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
- **NUNCA usar itálico** em documentos gerados pelo sistema

---

## 🔴 TESTES PENDENTES — LEIA ISTO PRIMEIRO!

### DO QUE FOI DESENVOLVIDO NA SESSÃO 10/04/2026:

**ModalNovoRisco.jsx:**
- ⏳ Testar **Passo 1** completo (Identificação)
  - ✅ Área carrega? 
  - ✅ Subprocesso carrega dinamicamente?
  - ✅ Gerência carrega?
  - ❌ **Resp. Subprocesso carrega com 51 nomes?** ← TESTADO?
  
- ⏳ Testar **Passo 2** completo (Características + Premissas)
  - ❌ Características (6 campos) preenchem?
  - ❌ Premissas (6 campos) preenchem?
  - ❌ Resultado (radio) muda?
  - ❌ Automatizado desabilita "Quem faz?"?
  - ❌ Impacto × Probabilidade calcula criticidade?
  - ❌ Plano de Ação condicional (só se Inefetivo/GAP)?

- ⏳ Testar **Passo 3** (Gerar Ficha)
  - ❌ Resumo mostra dados corretos?
  - ❌ Botão "Salvar e Gerar Ficha" faz download Excel?
  - ❌ Excel tem todos os campos preenchidos corretamente?

- ⏳ Testar **Salvamento no BD**
  - ❌ Risco inserido com status `ficha_gerada`?
  - ❌ Todos os campos salvam corretamente?
  - ❌ Referências (R.PREFIXO.XX, C.PREFIXO.XX) geram correto?

**ModalRegistrarResultado.jsx:**
- ⏳ Testar **Habilitação do botão "Resultado"**
  - ❌ Botão aparece desabilitado (cinzento)?
  - ❌ Botão habilita (fica dourado) quando status=`ficha_gerada`?

- ⏳ Testar **Modal Resultado**
  - ❌ Abre corretamente ao clicar?
  - ❌ Resultado (radio) muda?
  - ❌ Inconsistência aparece se Inefetivo/GAP?
  - ❌ Criticidade calcula correto?
  - ❌ Plano de Ação aparece se Inefetivo/GAP?
  - ❌ Botão "✓ Salvar Resultado" funciona?

- ⏳ Testar **Salvamento em Resultado**
  - ❌ Status muda para `em_analise` após salvar?
  - ❌ Dados salvam no BD corretamente?
  - ❌ Badge "Em Análise" aparece na tabela?

**Dashboard.jsx - Integração:**
- ✅ Botão "➕ Novo Risco" aparece? (VERIFICADO)
- ✅ Botão renomeado "Resultado"? (VERIFICADO)
- ⏳ Fluxo completo funciona end-to-end?

**Tabela `responsaveis`:**
- ✅ 51 responsáveis inseridos? (VERIFICADO)
- ⏳ Dropdown carrega os 51 nomes? (FALTA TESTAR)
- ⏳ Ao selecionar um, salva no BD? (FALTA TESTAR)

---

## Campos Supabase — tabela `mrc`

### Constraint status_workflow:
```sql
CHECK (status_workflow = ANY (ARRAY['rascunho','em_revisao','aprovado','reprovado','em_analise','teste_pendente','ficha_gerada']))
```
✅ `ficha_gerada` adicionado ✅

### Tabela `mrc_audit_log`:
- id, mrc_id, campo, valor_anterior, valor_novo, usuario_id, criado_em

### Tabela `responsaveis` (NOVA):
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
✅ Criada e com 51 registros para Brascabos ✅

---

## Telas Implementadas

### 3. Por Área (rota `/area/:areaId`) — ✅ QUASE COMPLETO
- 5 KPIs + Filtros + tabela MRC 23 colunas
- Botão **"➕ Novo Risco"** (dourado, acima da tabela) ✅ ADICIONADO
- Botão "Ver" → ModalDetalhe
- Botão "Atualizar" (dourado) → ModalAtualizar
- Botão **"Resultado"** (renomeado de "Registrar") → ModalRegistrarResultado ✅ NOVO
- Badges "EM ANÁLISE", "TESTE PENDENTE", **"FICHA GERADA"** (novo) ✅
- ⏳ **FALTA TESTAR:** Tudo junto funciona?

---

## IMPLEMENTAÇÕES CONFIRMADAS (10/04/2026)

### ✅ ModalNovoRisco.jsx (1.392 linhas, 54 KB)
- 3 Passos: Identificação → Características+Premissas → Gerar Ficha
- Auto-geração de referências (R.PREFIXO.XX, C.PREFIXO.XX)
- Criticidade dinâmica (Impacto × Probabilidade)
- Lógica: Automatizado desabilita "Quem faz?"
- Alerta ao mudar resultado
- **Carrega responsáveis de tabela `responsaveis`** ✅
- Status: `ficha_gerada` após salvar
- Gera Excel (função reutilizada de ModalAtualizar)
- ⏳ **STATUS: Código pronto, FALTA testar**

### ✅ ModalRegistrarResultado.jsx (705 linhas, 27 KB)
- 1 tela única (pós-teste)
- Resultado (Efetivo/Inefetivo/GAP)
- Inconsistência, Melhoria, Criticidade, Plano de Ação
- Status: `em_analise` ao salvar
- **Botão renomeado "Registrar" → "Resultado"** ✅
- ⏳ **STATUS: Código pronto, FALTA testar**

### ✅ Dashboard.jsx (MODIFICADO)
- Imports: ModalNovoRisco + ModalRegistrarResultado
- States: modalNovoRisco, rowRegistrarResultado
- Botão "➕ Novo Risco" ✅
- Botão "Resultado" ✅
- Badge "Ficha Gerada" ✅
- ⏳ **STATUS: Integrado, FALTA testar fluxo completo**

### ✅ Tabela `responsaveis` (NOVA)
- Criada no Supabase
- RLS Policies: SELECT, INSERT, UPDATE, DELETE
- **51 responsáveis já cadastrados** para Brascabos ✅
- ⏳ **STATUS: Dados prontos, FALTA testar carregamento no modal**

---

## GIT & DEPLOYMENT

### Deploy 10/04/2026 — ✅ COMPLETO
- Todos os arquivos em produção (polimata-ci.vercel.app)
- Status: Live

---

## PRÓXIMAS AÇÕES — ORDEM DE PRIORIDADE

### 🔴 ALTA — ESTA SESSÃO (11/04)

**1. TESTE COMPLETO DO FLUXO** (Novo Risco → Resultado)
   - [ ] Abrir "Por Área" → "Novo Risco"
   - [ ] Passo 1: Preencher tudo, verificar "Resp. Subprocesso" carrega 51 nomes
   - [ ] Passo 2: Preencher características, premissas, resultado, criticidade
   - [ ] Passo 3: Verificar resumo, gerar Excel, baixar
   - [ ] Voltar à tabela: Verificar se risco aparece com status "Ficha Gerada"
   - [ ] Clicar botão "Resultado": Verificar se abre modal
   - [ ] Preencher Resultado: salvar
   - [ ] Voltar à tabela: Verificar se status mudou para "Em Análise"
   - [ ] Conferir BD: Todos os dados foram salvos?

**2. FIX BUGS** (se encontrar)
   - Se algo não funcionar, reportar aqui
   - Pode precisar ajustar código

**3. VALIDAÇÃO DE DADOS**
   - Verificar se `resp_sub` salva corretamente
   - Verificar se criticidade calcula correto
   - Verificar se Plano de Ação salva se Inefetivo/GAP

### 🟡 MÉDIA — PRÓXIMAS SEMANAS

**4. ClientesConfig.jsx — Nova aba "Responsáveis por Subprocesso"**
   - Evitar dropdown gigante (51 nomes)
   - Gerenciar por subprocesso na config
   - Sincronizar mudanças em toda MRC

**5. Propagação de mudanças**
   - Mudar gerente em área → reflete em `mrc.ger`
   - Mudar responsável de subprocesso → reflete em `mrc.resp_sub`

**6. F3 Criticidade Review + Regression**
   - Implementar lógica de revisão em F3
   - Implementar regressão (Efetivo → Inefetivo)

### 🟢 BAIXA — FUTURO

**7. Dark theme audit**
**8. PWA offline capability**
**9. Custom domain polimatagrc.com.br**

---

## Notas Técnicas

- ModalNovoRisco: fundo branco (contraste com tema escuro)
- Dashboard.jsx passa `projeto` completo
- `responsaveis` carregado no init do ModalNovoRisco
- Dropdown `resp_sub` = `responsaveis.map(r => <option value={r.nome}>{r.nome}</option>)`
- Status `ficha_gerada` habilitado para trigger do botão "Resultado"

---

## 🎯 RESUMO: O QUE FAZER AGORA

1. **TESTAR TUDO** usando o checklist acima
2. Se tudo passar → sessão completa ✅
3. Se tiver bugs → corrigir e redeployar
4. Depois → próximas funcionalidades

**Pronto para começar os testes?** 🚀

