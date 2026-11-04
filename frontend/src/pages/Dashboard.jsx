import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api, { errMsg } from '../api'
import { useAuth } from '../context/AuthContext'
import { useWarehouse } from '../context/WarehouseContext'
import { fmtDate, fmtKg, fmtQty, fmtTime, TXN_LABEL, VISUAL_ICON, VISUAL_TINT } from '../format'
import WarehouseScene from '../components/WarehouseScene'
import RackPanel from '../components/RackPanel'
import PutawayModal from '../components/PutawayModal'
import PickModal from '../components/PickModal'
import { Empty, Kpi, Loading, useToast } from '../components/ui'

const TONE = { green: '#22c55e', amber: '#f59e0b', cyan: '#06b6d4' }

export default function Dashboard() {
  const { can } = useAuth()
  const toast = useToast()
  const { warehouses, warehouseId, setWarehouseId, warehouse, loaded } = useWarehouse()
  const [params, setParams] = useSearchParams()
  const [dash, setDash] = useState(null)
  const [layout, setLayout] = useState(null)
  const [receipt, setReceipt] = useState(null)
  const [sugg, setSugg] = useState(null)
  const [dispatch, setDispatch] = useState(null)
  const [picks, setPicks] = useState(null)
  const [sel, setSel] = useState({ rack: null, bin: null })
  const [hl, setHl] = useState([])
  const [modal, setModal] = useState(null)
  const [err, setErr] = useState('')

  const materialsById = useMemo(() => {
    const m = {}
    layout?.racks.forEach(r => r.bins.forEach(b => { if (b.materialId) m[b.materialId] = b.visual }))
    return m
  }, [layout])

  const load = useCallback(async () => {
    if (!warehouseId) return
    try {
      const [d, l, r, ds] = await Promise.all([
        api.get('/dashboard', { params: { warehouseId } }),
        api.get(`/warehouses/${warehouseId}/layout`),
        api.get('/receipts', { params: { warehouseId } }),
        api.get('/dispatches', { params: { warehouseId } })
      ])
      setDash(d.data)
      setLayout(l.data)
      const nextR = r.data.filter(x => x.status === 'PENDING').at(-1) || null
      const nextD = ds.data.filter(x => x.status === 'PENDING').at(-1) || null
      setReceipt(nextR)
      setDispatch(nextD)
      setSugg(nextR ? (await api.get(`/receipts/${nextR.id}/suggestion`)).data : null)
      setPicks(nextD ? (await api.get(`/dispatches/${nextD.id}/picks`)).data : null)
      setErr('')
    } catch (e) { setErr(errMsg(e)) }
  }, [warehouseId])

  useEffect(() => { setLayout(null); setDash(null); setSel({ rack: null, bin: null }); setHl([]); load() }, [load])

  // Deep link from receipts/dispatch/inventory: /dashboard?focus=A1-L1-B03,A1-L2-B03&tone=green
  useEffect(() => {
    const focus = params.get('focus')
    if (!focus || !layout) return
    const codes = focus.split(',').filter(Boolean)
    const color = TONE[params.get('tone')] || TONE.cyan
    setHl(codes.map((c, i) => ({ code: c, color, text: i === 0 ? c : c })))
    const rack = layout.racks.find(r => r.bins.some(b => b.code === codes[0]))
    if (rack) setSel({ rack: rack.id, bin: codes[0] })
    setParams({}, { replace: true })
  }, [params, layout, setParams])

  if (!loaded) return <Loading />
  if (!warehouses.length) {
    return (
      <div className="card"><Empty icon="ti-building-warehouse" title="No warehouses yet">
        <p>Create your first warehouse and its racks to see the 3D view.</p>
        {can('MANAGE') && <Link className="btn primary" to="/warehouses">Create warehouse</Link>}
      </Empty></div>
    )
  }

  const selRack = layout?.racks.find(r => r.id === sel.rack)
  const showSugg = () => {
    if (!sugg?.allocations.length) return
    setHl(sugg.allocations.map((a, i) => ({ code: a.binCode, color: TONE.green, text: i === 0 ? `Put here · ${a.binCode}` : a.binCode })))
    const r = layout.racks.find(x => x.bins.some(b => b.code === sugg.allocations[0].binCode))
    setSel({ rack: r?.id, bin: sugg.allocations[0].binCode })
  }
  const showPicks = () => {
    if (!picks?.picks.length) return
    setHl(picks.picks.map((p, i) => ({ code: p.binCode, color: TONE.amber, text: i === 0 ? `Pick first · ${p.binCode}` : p.binCode })))
    const r = layout.racks.find(x => x.bins.some(b => b.code === picks.picks[0].binCode))
    setSel({ rack: r?.id, bin: picks.picks[0].binCode })
  }
  const quickPutaway = async () => {
    try {
      await api.post(`/receipts/${receipt.id}/putaway`, { allocations: sugg.allocations.map(a => ({ binCode: a.binCode, qtyKg: a.qtyKg })) })
      toast(`${receipt.materialName} stored in ${sugg.allocations.map(a => a.binCode).join(', ')}`)
      const codes = sugg.allocations.map(a => a.binCode)
      await load()
      focusCodes(codes, 'green', 'Stored')
    } catch (e) { toast(errMsg(e), 'error') }
  }
  // Move the camera to where the goods went and mark the bins.
  const focusCodes = (codes, tone, word) => {
    setHl(codes.map(c => ({ code: c, color: TONE[tone], text: `${word} · ${c}` })))
    const r = layout?.racks.find(x => x.bins.some(b => b.code === codes[0]))
    if (r) setSel({ rack: r.id, bin: codes[0] })
  }
  const afterDone = (codes, tone, word) => {
    setModal(null)
    load().then(() => focusCodes(codes, tone, word))
  }

  const rVisual = receipt && (materialsById[receipt.materialId] || 'GENERIC')
  const dVisual = dispatch && (materialsById[dispatch.materialId] || 'GENERIC')

  return (
    <div className="dash">
      <div className="stack" style={{ gap: 12 }}>
        <div className="wh-strip">
          {(dash?.warehouses || warehouses.map(w => ({ ...w, utilisationPct: 0 }))).map(w => (
            <button key={w.id} className={`wh-card ${w.id === warehouseId ? 'active' : ''}`} onClick={() => setWarehouseId(w.id)}>
              <i className="ti ti-building-warehouse" />
              <div style={{ minWidth: 0, flex: 1 }}>
                <b>{w.name}</b><small>{w.location || w.code} · {w.utilisationPct}% full</small>
                <div className="bar"><i style={{ width: `${w.utilisationPct}%`, background: w.utilisationPct >= 85 ? '#ef4444' : '#22c55e' }} /></div>
              </div>
            </button>
          ))}
        </div>
        {err && <div className="alert error"><i className="ti ti-alert-circle" />{err}</div>}
        <div className="grid g4 kpis">
          <Kpi icon="ti-box" label="Stock in warehouse" value={dash ? fmtKg(dash.stockKg) : '–'} />
          <Kpi icon="ti-chart-donut" label="Utilisation" value={dash ? `${dash.utilisationPct}% of ${fmtKg(dash.capacityKg)}` : '–'} tone="green" />
          <Kpi icon="ti-truck" label="Today dispatch" value={dash ? `${dash.todayDispatchCount} · ${fmtKg(dash.todayDispatchKg)}` : '–'} tone="violet" />
          <Kpi icon="ti-clipboard-list" label="Pending jobs" value={dash ? `${dash.pendingReceipts} in · ${dash.pendingDispatches} out` : '–'} tone="amber" />
        </div>
      </div>

      <WarehouseScene layout={layout} selectedRackId={sel.rack} selectedBin={sel.bin} highlights={hl}
        onSelect={(rack, bin) => setSel({ rack, bin })} hint="Drag to rotate · scroll to zoom · click a rack">
        {!layout && <div className="center-load" style={{ position: 'absolute', inset: 0 }}><div className="spinner" /></div>}
        {selRack && warehouse && (
          <RackPanel rack={selRack} warehouse={warehouse} selectedBin={sel.bin}
            onSelectBin={code => { setSel(s => ({ ...s, bin: code })); setHl([{ code, color: TONE.cyan, text: code }]) }}
            onClose={() => { setSel({ rack: null, bin: null }); setHl([]) }} />
        )}
      </WarehouseScene>

      <div className="dash-bottom">
        <div className="card">
          <div className="card-h"><i className="ti ti-truck-delivery" style={{ color: 'var(--green)' }} />Incoming material<span className="spacer" />
            <Link className="pill green" to="/receipts?new=1">+ New receipt</Link></div>
          {!receipt ? <Empty icon="ti-circle-check" title="No pending receipts">All inward material is stored.</Empty> : (
            <div className="job">
              <div className="thumb" style={{ background: VISUAL_TINT[rVisual][0], color: VISUAL_TINT[rVisual][1] }}><i className={`ti ${VISUAL_ICON[rVisual]}`} /></div>
              <div className="job-t"><b>{receipt.materialName}</b>
                <small>{fmtQty(receipt.qtyKg, receipt.unit, receipt.unitWeightKg)} · {receipt.grnNo}</small>
                <small>{receipt.supplier || '–'} · received {fmtDate(receipt.createdAt)}</small></div>
              <div className="sugg">
                <div>
                  <div className="sugg-h"><i className="ti ti-circle-check" />Suggested location</div>
                  <div className="code mono">{sugg?.allocations.length ? sugg.allocations.map(a => a.binCode).join(' + ') : 'No free bin'}</div>
                  <div className="why">{sugg?.allocations[0] ? `${sugg.allocations[0].reason} · ${sugg.allocations[0].distanceM} m from dock` : 'Free space or add racks'}</div>
                </div>
                <div className="acts">
                  <button className="btn ghost sm" onClick={showSugg}>Show in 3D</button>
                  {can('OPERATE') && <button className="btn green sm" disabled={!sugg?.allocations.length || sugg.unallocatedKg > 0} onClick={quickPutaway}>Confirm</button>}
                  {can('OPERATE') && <button className="btn ghost sm" onClick={() => setModal({ type: 'putaway', item: receipt })}>Change bins</button>}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-h"><i className="ti ti-truck" style={{ color: 'var(--amber)' }} />Dispatch request<span className="spacer" />
            {dispatch ? <span className="pill amber mono">{dispatch.dspNo}</span> : <Link className="pill amber" to="/dispatch?new=1">+ New dispatch</Link>}</div>
          {!dispatch ? <Empty icon="ti-circle-check" title="No pending dispatches">Nothing waiting to go out.</Empty> : (
            <div className="job">
              <div className="thumb" style={{ background: VISUAL_TINT[dVisual][0], color: VISUAL_TINT[dVisual][1] }}><i className={`ti ${VISUAL_ICON[dVisual]}`} /></div>
              <div className="job-t"><b>{dispatch.materialName}</b>
                <small>{fmtQty(dispatch.qtyKg, dispatch.unit, dispatch.unitWeightKg)}</small>
                <small>To {dispatch.destination} · {fmtDate(dispatch.createdAt)}</small></div>
              <div className="sugg out">
                <div>
                  <div className="sugg-h"><i className="ti ti-arrow-big-up-lines" />Pick from (FIFO)</div>
                  <div className="code mono">{picks?.picks.length ? picks.picks.map(p => p.binCode).join(' + ') : 'Out of stock'}</div>
                  <div className="why">{picks?.picks[0] ? `Oldest batch first · received ${fmtDate(picks.picks[0].receivedAt)}` : 'No stock available'}</div>
                </div>
                <div className="acts">
                  <button className="btn ghost sm" onClick={showPicks}>Show in 3D</button>
                  {can('OPERATE') && <button className="btn amber sm" disabled={!picks?.picks.length || picks.shortKg > 0} onClick={() => setModal({ type: 'pick', item: dispatch })}>Pick and confirm</button>}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-h"><i className="ti ti-activity" style={{ color: 'var(--blue)' }} />Recent transactions<span className="spacer" /><Link className="pill gray" to="/reports?tab=ledger">View all</Link></div>
          {!dash?.recent.length ? <Empty icon="ti-history" title="No movements yet" /> : dash.recent.map(t => {
            const inward = t.type === 'IN' || t.type === 'TRANSFER_IN' || (t.type === 'ADJUST' && t.qtyKg > 0)
            return (
              <div key={t.id} className="tx-row">
                <span className="tx-ic" style={{ background: inward ? 'var(--green-bg)' : 'var(--red-bg)', color: inward ? 'var(--green)' : 'var(--red)' }}><i className={`ti ${inward ? 'ti-arrow-down' : 'ti-arrow-up'}`} /></span>
                <div style={{ minWidth: 0 }}><b>{TXN_LABEL[t.type]} · {t.materialName}</b><small>{t.binCode ? `${inward ? 'To' : 'From'} ${t.binCode}` : t.refNo}</small></div>
                <div className="tx-amt" style={{ color: inward ? 'var(--green)' : 'var(--red)' }}>{inward ? '+' : '−'}{fmtKg(Math.abs(t.qtyKg))}<small className="muted">{fmtTime(t.at)}</small></div>
              </div>
            )
          })}
        </div>

        <div className="card">
          <div className="card-h"><i className="ti ti-bolt" style={{ color: 'var(--amber)' }} />Quick actions</div>
          <div className="qa">
            <Link to="/qr-labels"><i className="ti ti-qrcode" />QR labels</Link>
            <Link to={can('OPERATE') ? '/transfers' : '/inventory'}><i className="ti ti-arrows-exchange" />{can('OPERATE') ? 'Transfer stock' : 'Inventory'}</Link>
            <Link to={can('OPERATE') ? '/stock-count' : '/inventory'}><i className="ti ti-clipboard-check" />{can('OPERATE') ? 'Stock count' : 'Stock list'}</Link>
            <Link to="/reports"><i className="ti ti-chart-histogram" />Monthly analysis</Link>
          </div>
          {dash?.lowStock.length > 0 && (
            <div className="alert warn" style={{ marginTop: 10 }}><i className="ti ti-alert-triangle" />
              <div><b>{dash.lowStock.length} below reorder level</b><div style={{ fontSize: 12 }}>{dash.lowStock.slice(0, 3).map(l => l.name).join(', ')}</div></div>
            </div>
          )}
        </div>
      </div>

      {modal?.type === 'putaway' && <PutawayModal receipt={modal.item} onClose={() => setModal(null)} onDone={codes => afterDone(codes, 'green', 'Stored')} />}
      {modal?.type === 'pick' && <PickModal dispatch={modal.item} onClose={() => setModal(null)} onDone={codes => afterDone(codes, 'amber', 'Picked')} />}
    </div>
  )
}
