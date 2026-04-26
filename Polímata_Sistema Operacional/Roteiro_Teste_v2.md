# Roteiro de Teste — Polímata CI

**Data:** 21/04/2026  
**Escopo:** Todas as alterações desta sessão (14 itens)  
**Ambiente:** https://polimata-ci.vercel.app

---

## Pré-requisitos

- Ter pelo menos 1 projeto com áreas e controles cadastrados
- Ter acesso admin (admin_polimata)
- Ter um segundo usuário com perfil cliente (gestor_cliente) — ou usar o botão "Visão Cliente" que foi implementado

---

## 1. Dashboard — Header Compacto

**O que mudou:** Header de 3 linhas virou barra horizontal única.

- [ ] Abrir o Dashboard
- [ ] Verificar que o título "Maturidade do Ambiente de Controles Internos", nome do cliente e contagem de áreas/controles aparecem numa única linha
- [ ] Verificar que "Última atualização" aparece à direita na mesma linha
- [ ] Confirmar que os KPIs abaixo estão visíveis sem precisar rolar

---

## 2. Dashboard — KPIs

**O que mudou:** Card "Total de Controles" agora usa cor navy (antes era creme, quase invisível).

- [ ] Verificar que o card "Total de Controles" tem borda superior navy e número em navy
- [ ] Verificar que todos os 6 cards (Maturidade, Total, Efetivos, Inefetivos, GAP, Planos de Ação) estão legíveis

---

## 3. Dashboard — Maturidade via Banco

**O que mudou:** Cálculo de maturidade agora vem da view `vw_maturidade_areas` (servidor), não mais do JavaScript local.

- [ ] Verificar que cada área mostra percentual e nível de maturidade (N1-N5)
- [ ] Clicar em uma área e verificar que a barra de progresso corresponde ao percentual
- [ ] Confirmar que os contadores (Efetivos, Inefetivos, GAP) batem com os dados

---

## 4. Visão Por Área — Header Compacto

**O que mudou:** Header de 2 linhas virou barra horizontal com botão Voltar, nome da área e info na mesma linha.

- [ ] Clicar em uma área no Dashboard
- [ ] Verificar que o header mostra: botão "← VOLTAR" + nome da área + "X controles · Peso empresa: Y%" em uma linha
- [ ] Verificar "Última atualização" à direita

---

## 5. Visão Por Área — Linhas Clicáveis

**O que mudou:** Cada linha da tabela agora é clicável e abre o modal de detalhes.

- [ ] Clicar em qualquer linha da tabela (não no botão, na linha mesmo)
- [ ] Verificar que o modal de detalhe abre corretamente
- [ ] Clicar no botão "Ver" — verificar que também funciona (sem abrir o modal duas vezes)
- [ ] Clicar no botão "Atualizar" ou "Resultado" — verificar que abre o modal correto (não o de detalhe)
- [ ] Passar o mouse sobre uma linha — verificar que tem hover sutil (destaque visual)

---

## 6. Visão Por Área — Novo Risco com Área Fixa

**O que mudou:** Ao criar novo risco dentro de uma área, o campo de área vem travado (não é um dropdown).

- [ ] Dentro da visão de uma área, clicar no botão "+ Novo Risco"
- [ ] Verificar que o campo "Área" mostra o nome da área em texto fixo (não é um select/dropdown)
- [ ] Preencher os campos obrigatórios e salvar
- [ ] Verificar que o controle foi criado na área correta

---

## 7. Visão Por Área — Filtros Atualizados

**O que mudou:** Filtro de resultado agora é geral (qualquer fase), adicionado filtro por fase, adicionado botão "Visão Cliente".

- [ ] Verificar que os filtros são: Busca, Criticidade, **Fase**, **Resultado** (sem "impacto" separado)
- [ ] Selecionar um filtro de Fase (ex: "Diagnóstico Inicial") — verificar que filtra corretamente
- [ ] Selecionar um filtro de Resultado (ex: "Efetivo") — verificar que filtra por resultado da fase atual do controle, não só F1
- [ ] **Botão Visão Cliente** (só aparece para admin):
  - [ ] Clicar em "Visão Cliente"
  - [ ] Verificar que aparece banner "Simulando visão: Cliente"
  - [ ] Verificar que os botões de ação mudam (só "Ver" + badge de status simplificado)
  - [ ] Clicar "← Voltar visão Admin" para restaurar

---

## 8. F2-E1 — Plano de Ação (TOD)

**O que mudou:** Label renomeado para "Plano de Ação (TOD)", resultado mudou de "Concluído" para "Efetivo".

- [ ] Abrir um controle que está na fase F2-E1 (Inefetivo ou GAP no F1)
- [ ] Verificar que a coluna "Fase Atual" mostra "Plano de Ação (TOD)"
- [ ] Clicar em "Resultado" para registrar resultado:
  - [ ] Verificar que a seção se chama "3. Plano de Ação (TOD)"
  - [ ] Verificar que as opções de status são: **Pendente**, **Em Desenvolvimento**, **Efetivo** (não "Concluído")
- [ ] Na MRC Completa, verificar que a aba se chama "Plano de Ação (TOD)"
- [ ] No modal de detalhe, verificar que a seção se chama "Plano de Ação (TOD)"

---

## 9. MRC Completa — Visual do Heatmap

**O que mudou:** Cards de criticidade na legenda redesenhados com borda lateral colorida, visual mais limpo.

- [ ] Abrir a MRC Completa
- [ ] Verificar o heatmap: grid 4×4 com cores corretas (verde → amarelo → vermelho)
- [ ] Verificar a legenda à direita: 4 cards com borda lateral colorida (vermelho, amarelo, amarelo, verde)
- [ ] Cada card mostra: nome do nível, contagem grande, e breakdown E/I/G
- [ ] Clicar em uma célula do heatmap — verificar que filtra a tabela

---

## 10. MRC Completa — Filtros Atualizados

**O que mudou:** Removidos filtros de impacto/probabilidade, adicionado filtro por fase.

- [ ] Verificar que os filtros são: Busca, Área, Criticidade, **Fase**, Resultado
- [ ] **NÃO** devem aparecer: "Todos impactos", "Todas probabilidades"
- [ ] Resultado **NÃO** deve ter opção "Concluído"
- [ ] Selecionar filtro por Fase — verificar que filtra corretamente
- [ ] Selecionar filtro por Área — verificar que o dropdown mostra todas as áreas
- [ ] Clicar "✕ Limpar filtros" — verificar que reseta tudo

---

## 11. MRC Completa — Scroll Horizontal

- [ ] Na tabela da MRC, verificar que é possível rolar horizontalmente
- [ ] Verificar que o cabeçalho (th) acompanha o scroll vertical (fica fixo no topo)

---

## 12. Propagação de Nomes (Triggers)

**O que mudou:** Alterar nome do gerente, nome da área ou responsável de subprocesso agora propaga automaticamente para todos os controles relacionados.

- [ ] Ir em Configurações > Áreas
- [ ] Alterar o nome do **gerente** de uma área
- [ ] Verificar na MRC que todos os controles daquela área agora mostram o novo gerente
- [ ] Alterar o **nome** de uma área
- [ ] Verificar na MRC que o campo "área" dos controles foi atualizado
- [ ] Em um controle, alterar o **responsável de subprocesso**
- [ ] Verificar que todos os controles com o mesmo subprocesso foram atualizados

---

## 13. Políticas RLS (Segurança)

**O que mudou:** 9 políticas de segurança corrigidas no banco.

- [ ] Como admin: criar, editar e excluir um controle — tudo deve funcionar
- [ ] Como admin: criar um projeto — deve funcionar
- [ ] Como admin: adicionar um perfil a um projeto — deve funcionar
- [ ] Como cliente: tentar editar um controle — deve ser bloqueado (sem botão de edição)

---

## 14. Botão "Limpar Base"

**O que mudou:** Botão admin-only para limpar todos os dados de teste.

- [ ] Ir em Configurações (ou área administrativa)
- [ ] Verificar que o botão "Limpar Base" aparece **apenas para admin**
- [ ] **NÃO CLICAR** se houver dados reais — este botão apaga tudo!
- [ ] Se for base de teste: clicar e confirmar, verificar que os dados foram removidos

---

## 15. Ficha Excel (Download)

- [ ] Na visão por área, clicar no botão "Excel"
- [ ] Verificar que o arquivo baixa corretamente
- [ ] Abrir o arquivo e verificar que a fase em curso mostra "F2-E1 — Plano de Ação (TOD)" onde aplicável

---

## Checklist Final

- [ ] Nenhum erro no console do navegador (F12 > Console)
- [ ] Todas as páginas carregam sem tela branca
- [ ] Navegação Dashboard → Área → Voltar funciona sem problemas
- [ ] MRC Completa carrega todos os controles
- [ ] Exportação Excel funciona em ambas as telas

---

**Observação:** O domínio customizado (ci.polimatagrc.com.br ou similar) ficou como pendência. Quando quiser configurar, é só avisar.
