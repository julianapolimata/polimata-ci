import { useState, useMemo, useRef, useEffect } from 'react'
import { gerarRelatorioExcel } from '../lib/gerarRelatorio'
import { getStatusComputado } from '../lib/fases'

// ── Multi-select dropdown component ──────────────────────────────────────────
function MultiSelect({ label, options, selected, onChange, placeholder }) {
  const [open, setOpen] = useState(false)
  const [openUp, setOpenUp] = useState(false)
  const ref = useRef(null)
  const btnRef = useRef(null)

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleOpen = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      setOpenUp(spaceBelow < 280)
    }
    setOpen(o => !o)
  }

  const displayText = selected.length === 0
    ? placeholder
    : selected.length === options.length
      ? 'Todos'
      : selected.length <= 2
        ? selected.map(v => options.find(o => o.value === v)?.label || v).join(', ')
        : `${selected.length} selecionados`

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <label style={{ fontSize: 11, color: 'var(--txt3)', display: 'block', marginBottom: 4, fontWeight: 500 }}>{label}</label>
      <button
        ref={btnRef}
        onClick={handleOpen}
        style={{
          width: '100%', padding: '8px 10px', fontSize: 12,
          border: selected.length > 0 ? '1.5px solid var(--copper)' : '1px solid var(--brd)',
          borderRadius: 6, background: 'var(--card-bg, #fff)', color: 'var(--txt1)',
          fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <span style={{
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
          color: selected.length === 0 ? 'var(--txt3)' : 'var(--txt1)',
        }}>{displayText}</span>
        <span style={{ fontSize: 10, color: 'var(--txt3)', marginLeft: 4 }}>{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute',
          ...(openUp
            ? { bottom: '100%', marginBottom: 4 }
            : { top: '100%', marginTop: 4 }),
          left: 0, right: 0,
          background: 'var(--card-bg, #fff)', border: '1px solid var(--brd)',
          borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          zIndex: 100, maxHeight: 260, overflowY: 'auto', padding: '4px 0',
        }}>
          <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--brd)', display: 'flex', gap: 8 }}>
            <button
              onClick={() => onChange(options.map(o => o.value))}
              style={{ fontSize: 11, color: 'var(--copper)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, padding: 0 }}
            >Todos</button>
            <span style={{ color: 'var(--brd)' }}>|</span>
            <button
              onClick={() => onChange([])}
              style={{ fontSize: 11, color: 'var(--txt3)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
            >Limpar</button>
          </div>
          {options.map(opt => (
            <label
              key={opt.value}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
                cursor: 'pointer', fontSize: 12, color: 'var(--txt1)',
                background: selected.includes(opt.value) ? 'rgba(204,145,94,0.06)' : 'transparent',
                transition: 'background .1s',
              }}
              onMouseEnter={e => { if (!selected.includes(opt.value)) e.currentTarget.style.background = 'rgba(0,0,0,0.03)' }}
              onMouseLeave={e => { e.currentTarget.style.background = selected.includes(opt.value) ? 'rgba(204,145,94,0.06)' : 'transparent' }}
            >
              <span style={{
                width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                border: selected.includes(opt.value) ? '1.5px solid var(--copper)' : '1.5px solid var(--brd)',
                background: selected.includes(opt.value) ? 'var(--copper)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all .1s',
              }}>
                {selected.includes(opt.value) && <span style={{ color: '#fff', fontSize: 10, lineHeight: 1 }}>✓</span>}
              </span>
              {opt.label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Status options ───────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { value: 'nao_iniciado', label: 'Não Iniciado' },
  { value: 'teste_pendente', label: 'Teste Pendente' },
  { value: 'em_analise', label: 'Em Análise' },
  { value: 'em_revisao', label: 'Em Revisão' },
  { value: 'aprovado', label: 'Aprovado' },
  { value: 'reprovado', label: 'Em Correção' },
]

const SITUACAO_OPTIONS = [
  { value: 'existente', label: 'Existente' },
  { value: 'evitado', label: 'Evitado' },
  { value: 'transferido', label: 'Transferido' },
]

const FASE_OPTIONS = [
  { value: 'f1', label: 'F1 — Diagnóstico' },
  { value: 'f2e1', label: 'F2-E1 — Teste de Desenho' },
  { value: 'f2e2', label: 'F2-E2 — Aderência' },
  { value: 'f3', label: 'F3 — Revisão Integral' },
  { value: 'f4c1', label: 'F4-C1 — Auditoria Contínua' },
  { value: 'f4c2', label: 'F4-C2 — Auditoria Contínua' },
  { value: 'f5', label: 'F5 — Auditoria Independente' },
]

// ── Main component ───────────────────────────────────────────────────────────
export default function Relatorios({ projeto, areasCalc, todosControles, clienteNome, projetoNome }) {
  const [secoes, setSecoes] = useState({ resumo: true, detalhamento: true, matriz: true, planos: true })
  const [filtroAreas, setFiltroAreas] = useState([])
  const [filtroSituacao, setFiltroSituacao] = useState([])
  const [filtroFase, setFiltroFase] = useState([])
  const [filtroStatus, setFiltroStatus] = useState([])
  const [filtroRegredidos, setFiltroRegredidos] = useState(false)
  const [gerando, setGerando] = useState(false)

  const areas = useMemo(() => {
    if (!areasCalc) return []
    return [...areasCalc].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
  }, [areasCalc])

  const areaOptions = useMemo(() => areas.map(a => ({ value: a.id, label: a.nome })), [areas])

  const controlesFiltrados = useMemo(() => {
    let lista = todosControles || []

    if (filtroAreas.length > 0) {
      lista = lista.filter(c => filtroAreas.includes(c.area_id))
    }

    if (filtroSituacao.length > 0) {
      lista = lista.filter(c => filtroSituacao.includes(c.status_risco || 'existente'))
    }

    if (filtroStatus.length > 0) {
      lista = lista.filter(c => filtroStatus.includes(getStatusComputado(c)))
    }

    if (filtroFase.length > 0) {
      lista = lista.filter(c => {
        const done = f => f && f !== 'Teste Não Realizado'
        return filtroFase.some(fase => {
          if (fase === 'f1') return done(c.r1)
          if (fase === 'f2e1') return done(c.st_pa)
          if (fase === 'f2e2') return done(c.r_ader)
          if (fase === 'f3') return done(c.r3)
          if (fase === 'f4c1') return done(c.r_f4c1)
          if (fase === 'f4c2') return done(c.r_f4c2)
          if (fase === 'f5') return done(c.r_f5)
          return false
        })
      })
    }

    if (filtroRegredidos) {
      lista = lista.filter(c => (c.num_regressoes || 0) > 0)
    }

    return lista
  }, [todosControles, filtroAreas, filtroSituacao, filtroFase, filtroStatus, filtroRegredidos])

  const toggle = key => setSecoes(prev => ({ ...prev, [key]: !prev[key] }))

  const handleGerar = async () => {
    if (controlesFiltrados.length === 0) return
    setGerando(true)
    try {
      await gerarRelatorioExcel({
        controles: controlesFiltrados,
        areas: areasCalc || [],
        secoes,
        clienteNome: clienteNome || '',
        projetoNome: projetoNome || '',
        projeto,
      })
    } catch (err) {
      console.error('Erro ao gerar relatório:', err)
      alert('Erro ao gerar o relatório. Tente novamente.')
    } finally {
      setGerando(false)
    }
  }

  const temFiltroAtivo = filtroAreas.length > 0 || filtroSituacao.length > 0 || filtroFase.length > 0 || filtroStatus.length > 0 || filtroRegredidos
  const limparFiltros = () => { setFiltroAreas([]); setFiltroSituacao([]); setFiltroFase([]); setFiltroStatus([]); setFiltroRegredidos(false) }

  const algumaSelecionada = Object.values(secoes).some(Boolean)

  const SECOES = [
    { key: 'resumo', num: '1', titulo: 'Resumo executivo', desc: 'KPIs globais, maturidade, distribuição por fase, controles efetivos vs inefetivos' },
    { key: 'detalhamento', num: '2', titulo: 'Detalhamento por área', desc: 'Cada área em aba separada com todos os controles, fases (F1–F5), resultados e status' },
    { key: 'matriz', num: '3', titulo: 'Matriz de calor', desc: 'Impacto × probabilidade com contagem de controles e formatação condicional' },
    { key: 'planos', num: '4', titulo: 'Planos de ação', desc: 'Controles com inconsistências, recomendações, prazos e responsáveis' },
  ]

  return (
    <div style={{ padding: '32px 40px 300px', maxWidth: 960, fontFamily: "'Montserrat', sans-serif" }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--txt1)', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
        Gerar relatório
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: '#92400E', background: 'rgba(234,179,8,0.18)', border: '1px solid rgba(234,179,8,0.4)', borderRadius: 999, padding: '3px 10px' }}>Em desenvolvimento</span>
      </h2>
      <p style={{ fontSize: 13, color: 'var(--txt3)', margin: '0 0 28px' }}>
        Configure as seções e filtros para gerar seu relatório em Excel
      </p>

      {/* Seções */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28 }}>
        {SECOES.map(s => (
          <button
            key={s.key}
            onClick={() => toggle(s.key)}
            style={{
              background: secoes[s.key] ? 'rgba(204,145,94,0.06)' : 'var(--card-bg, #fff)',
              border: secoes[s.key] ? '1.5px solid var(--copper)' : '1px solid var(--brd)',
              borderRadius: 10,
              padding: '16px 18px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all .15s',
              fontFamily: 'inherit',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{
                width: 22, height: 22, borderRadius: 5,
                background: secoes[s.key] ? 'var(--copper)' : 'var(--brd)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 600, color: '#fff',
                transition: 'background .15s',
              }}>{s.num}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--txt1)' }}>{s.titulo}</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--txt3)', margin: 0, lineHeight: 1.5 }}>{s.desc}</p>
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ borderTop: '1px solid var(--brd)', paddingTop: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt1)' }}>Filtros</div>
          {temFiltroAtivo && (
            <button
              onClick={limparFiltros}
              style={{ fontSize: 11, color: 'var(--copper)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
            >Limpar todos</button>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 14, alignItems: 'end' }}>
          <MultiSelect
            label="Área"
            options={areaOptions}
            selected={filtroAreas}
            onChange={setFiltroAreas}
            placeholder="Todas as áreas"
          />
          <MultiSelect
            label="Status"
            options={STATUS_OPTIONS}
            selected={filtroStatus}
            onChange={setFiltroStatus}
            placeholder="Todos os status"
          />
          <MultiSelect
            label="Situação do risco"
            options={SITUACAO_OPTIONS}
            selected={filtroSituacao}
            onChange={setFiltroSituacao}
            placeholder="Todas"
          />
          <MultiSelect
            label="Fase mínima concluída"
            options={FASE_OPTIONS}
            selected={filtroFase}
            onChange={setFiltroFase}
            placeholder="Qualquer fase"
          />
          <div>
            <label style={{ fontSize: 11, color: 'var(--txt3)', display: 'block', marginBottom: 4, fontWeight: 500 }}>Regredidos</label>
            <button
              onClick={() => setFiltroRegredidos(v => !v)}
              style={{
                width: '100%', padding: '8px 10px', fontSize: 12,
                border: filtroRegredidos ? '1.5px solid #F9A825' : '1px solid var(--brd)',
                borderRadius: 6, background: filtroRegredidos ? '#FFF8E1' : 'var(--card-bg, #fff)',
                color: filtroRegredidos ? '#7A5700' : 'var(--txt3)',
                fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer',
                fontWeight: filtroRegredidos ? 600 : 400,
              }}
            >
              {filtroRegredidos ? '⚠ Apenas regredidos' : 'Todos'}
            </button>
          </div>
        </div>
      </div>

      {/* Resumo + Botão */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--brd)', paddingTop: 20 }}>
        <div style={{ fontSize: 13, color: 'var(--txt3)' }}>
          <strong style={{ color: 'var(--txt1)' }}>{controlesFiltrados.length}</strong> controles selecionados
          {temFiltroAtivo && (
            <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--copper)' }}>
              ({[
                filtroAreas.length > 0 && `${filtroAreas.length} área${filtroAreas.length > 1 ? 's' : ''}`,
                filtroStatus.length > 0 && `${filtroStatus.length} status`,
                filtroSituacao.length > 0 && `${filtroSituacao.length} situação`,
                filtroFase.length > 0 && `${filtroFase.length} fase${filtroFase.length > 1 ? 's' : ''}`,
                filtroRegredidos && 'regredidos',
              ].filter(Boolean).join(', ')})
            </span>
          )}
        </div>
        <button
          onClick={handleGerar}
          disabled={gerando || !algumaSelecionada || controlesFiltrados.length === 0}
          style={{
            padding: '10px 28px',
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'inherit',
            background: gerando || !algumaSelecionada || controlesFiltrados.length === 0 ? 'var(--brd)' : 'var(--navy)',
            color: gerando || !algumaSelecionada || controlesFiltrados.length === 0 ? 'var(--txt3)' : '#F3EEE4',
            border: 'none',
            borderRadius: 8,
            cursor: gerando || !algumaSelecionada || controlesFiltrados.length === 0 ? 'not-allowed' : 'pointer',
            transition: 'all .15s',
          }}
        >
          {gerando ? 'Gerando...' : 'Gerar relatório (.xlsx)'}
        </button>
      </div>
    </div>
  )
}
