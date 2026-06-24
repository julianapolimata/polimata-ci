// Sobre o Sistema — manual do módulo Gestão Orçamentária
import { PageHeader, Card, VERDE } from './_shared'
import { METODOS } from '../../lib/orcamento/sugestao'

const P = ({ children }) => <p style={{ fontSize: 12.5, lineHeight: 1.65, color: 'var(--lt-text)', margin: '0 0 8px' }}>{children}</p>
const Termo = ({ t, children }) => <P><strong style={{ color: VERDE.startsWith('var') ? '#0E7A5A' : VERDE }}>{t}</strong> — {children}</P>

export default function Sobre({ projeto }) {
  return (
    <div style={{ padding: '20px 28px 40px', maxWidth: 880, margin: '0 auto' }}>
      <PageHeader projeto={projeto} titulo="📖 Sobre o Sistema" subtitulo="Manual da Gestão Orçamentária Polímata" />

      <Card titulo="1. Visão geral"><P>
        A <strong>Gestão Orçamentária</strong> é o módulo do Polímata App para empresas de pequeno e médio porte estruturarem, acompanharem e analisarem seu orçamento empresarial. Ele responde: quanto a empresa gastou no passado (histórico), quanto planeja gastar (orçado), quanto está gastando agora (realizado) e onde estão os desvios — com apoio de IA nas definições.</P>
        <P>Por que existe: PMEs já superaram a planilha, mas não têm porte para sistemas corporativos (Treasy, Prophix, SAP BPC). Este módulo preenche a lacuna com identidade Polímata, IA integrada e custo acessível.</P>
      </Card>

      <Card titulo="2. Conceitos fundamentais">
        <Termo t="Categoria Gerencial">a estrutura do orçamento (ex.: Receitas, CPV — Matéria Prima, Despesa com Pessoal). As contas do ERP apontam para categorias.</Termo>
        <Termo t="Competência">o realizado é alocado pelo mês de competência (quando o fato ocorreu), não pelo pagamento.</Termo>
        <Termo t="Cenário">uma versão paralela do orçamento do ano (Realista, Otimista, ad-hoc). Um cenário é marcado ★ Aprovado e vira a referência oficial.</Termo>
        <Termo t="Em escopo">contas de resultado relevantes para o orçamento. Contas de ativo/passivo/transitórias ficam fora do escopo.</Termo>
        <Termo t="Centro de Custo">dimensão opcional para alocar valores por área (Produção, Comercial, Administrativo…).</Termo>
      </Card>

      <Card titulo="3. Fluxo de trabalho">
        <P><strong>1) Plano de Contas</strong> → crie as categorias gerenciais (a IA categoriza as contas do ERP). <strong>2) Importar Realizado</strong> → envie o Excel do ERP mês a mês; o histórico alimenta tudo. <strong>3) Cenários</strong> → crie o cenário do ano. <strong>4) Gerador</strong> → configure o método de projeção por categoria e gere as sugestões. <strong>5) Cadastrar Orçado</strong> → revise (Histórico | Tendência | Sugestão 💡 | Final), aceite ou edite, submeta e aprove ★. <strong>6) Acompanhe</strong> → Dashboard Executivo e Orçado vs Realizado com semáforo de desvios.</P>
      </Card>

      <Card titulo="4. Métodos de sugestão (peso igual entre os 6)">
        {METODOS.map(m => <Termo key={m.id} t={m.nome}>{m.desc}</Termo>)}
        <P style={{}}>A <strong>IA (Claude)</strong> também apoia: categorização automática de contas do ERP com nível de confiança, justificativa de cada sugestão de orçamento e insights executivos no Dashboard e nos Cenários.</P>
      </Card>

      <Card titulo="5. Índices de mercado">
        <P>Buscados automaticamente da API SGS do Banco Central: <strong>IPCA</strong> (inflação oficial), <strong>INPC</strong> (dissídios), <strong>IGP-M</strong> (aluguéis/contratos), <strong>INCC</strong> (construção) e <strong>IPA-DI</strong> (atacado/matéria-prima). Ficam em cache no banco e aparecem no Gerador.</P>
      </Card>

      <Card titulo="6. Semáforo de desvios">
        <P><span style={{ color: '#15803D', fontWeight: 700 }}>🟢 Verde</span>: desvio até 5% — dentro do esperado. <span style={{ color: '#B45309', fontWeight: 700 }}>🟡 Amarelo</span>: 5 a 10% — atenção. <span style={{ color: '#B91C1C', fontWeight: 700 }}>🔴 Vermelho</span>: acima de 10% — crítico. O semáforo considera a natureza da conta: receita acima do orçado é favorável; custo/despesa acima é desfavorável.</P>
      </Card>

      <Card titulo="7. Perguntas frequentes">
        <Termo t="Posso editar um valor sugerido?">Sim — em Cadastrar Orçado, clique no valor final e digite. O status vira “Editado” e a redistribuição mensal preserva o perfil da sugestão.</Termo>
        <Termo t="E se a IA errar a categoria?">Toda sugestão tem confiança e pode ser corrigida manualmente. A correção fica salva no mapa e vale para as próximas importações.</Termo>
        <Termo t="Reimportei o mesmo mês, duplica?">Não — a importação substitui o realizado importado daquela competência.</Termo>
        <Termo t="Quem aprova o orçamento?">O fluxo é Rascunho → Submetido → Aprovado ★, na tela Cadastrar Orçado.</Termo>
      </Card>
    </div>
  )
}
