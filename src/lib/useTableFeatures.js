import { useState, useCallback, useRef } from 'react'

/* ── Sorting hook ── */
export function useSort(defaultKey = null, defaultDir = null) {
  const [sortKey, setSortKey] = useState(defaultKey)
  const [sortDir, setSortDir] = useState(defaultDir) // 'asc' | 'desc' | null

  const toggleSort = useCallback((key) => {
    if (sortKey !== key) { setSortKey(key); setSortDir('asc') }
    else if (sortDir === 'asc') setSortDir('desc')
    else { setSortKey(null); setSortDir(null) }
  }, [sortKey, sortDir])

  const sortData = useCallback((data) => {
    if (!sortKey || !sortDir) return data
    const sorted = [...data].sort((a, b) => {
      let va = a[sortKey], vb = b[sortKey]
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      // numbers
      const na = typeof va === 'number' ? va : parseFloat(va)
      const nb = typeof vb === 'number' ? vb : parseFloat(vb)
      if (!isNaN(na) && !isNaN(nb)) return sortDir === 'asc' ? na - nb : nb - na
      // dates (ISO)
      if (typeof va === 'string' && /^\d{4}-\d{2}-\d{2}/.test(va)) {
        const da = new Date(va), db = new Date(vb)
        if (!isNaN(da) && !isNaN(db)) return sortDir === 'asc' ? da - db : db - da
      }
      // strings — localeCompare for proper accent/pt-BR handling
      va = String(va).trim()
      vb = String(vb).trim()
      const cmp = va.localeCompare(vb, 'pt-BR', { sensitivity: 'base', numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [sortKey, sortDir])

  const sortIndicator = useCallback((key) => {
    if (sortKey !== key) return ''
    return sortDir === 'asc' ? ' ▲' : ' ▼'
  }, [sortKey, sortDir])

  return { sortKey, sortDir, toggleSort, sortData, sortIndicator }
}

/* ── Column resize hook ── */
export function useColumnResize(initialWidths) {
  const [widths, setWidths] = useState(initialWidths || {})
  const dragRef = useRef(null)

  const onResizeStart = useCallback((e, colKey) => {
    e.preventDefault(); e.stopPropagation()
    const startX = e.clientX
    const startW = widths[colKey] || e.target.parentElement.offsetWidth
    dragRef.current = { colKey, startX, startW }
    const onMove = (ev) => {
      if (!dragRef.current) return
      const diff = ev.clientX - dragRef.current.startX
      const nw = Math.max(40, dragRef.current.startW + diff)
      setWidths(prev => ({ ...prev, [dragRef.current.colKey]: nw }))
    }
    const onUp = () => {
      dragRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [widths])

  const getWidth = useCallback((colKey, fallback) => {
    return widths[colKey] || fallback
  }, [widths])

  return { widths, onResizeStart, getWidth }
}

/* ── Sortable + Resizable <th> styles ── */
export const thSortable = {
  cursor: 'pointer',
  userSelect: 'none',
  position: 'relative',
  whiteSpace: 'nowrap',
}

export const resizeHandle = {
  position: 'absolute',
  right: 0,
  top: 0,
  bottom: 0,
  width: 5,
  cursor: 'col-resize',
  zIndex: 3,
}
