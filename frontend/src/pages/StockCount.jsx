import { useState } from 'react'
import api, { errMsg } from '../api'
import { useWarehouse } from '../context/WarehouseContext'
import { useApi } from '../hooks'
import { fmtDate, fmtDateTime, fmtKg, isoDate } from '../format'
import { Empty, Field, PageHead, useToast } from '../components/ui'
import ScanInput from '../components/ScanInput'

export default function StockCount() {
  const toast = useToast()
  const { warehouseId, warehouse } = useWarehouse()
  const [code, setCode] = useState('')
  const [bin, setBin] = useState(null)
  const [counts, setCounts] = useState({})
  const [reason, setReason] = useState('Cycle count')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const history = useApi(warehouseId ? '/stock/transactions' : null, { warehouseId, type: 'ADJUST', from: isoDate(Date.now() - 60 * 864e5) })

  const lookup = async () => {
    setErr('')
    setBin(null)
    if (!code.trim()) return setErr('Scan or type a bin code')
    try {
      const r = await api.get(`/warehouses/${warehouseId}/bins/${encodeURIComponent(code.trim())}`)
      setBin(r.data)
      setCounts(Object.fromEntries(r.data.batches.map(b => [b.id, String(b.qtyKg)])))
    } catch (e) { setErr(errMsg(e)) }
  }

  const changed = bin ? bin.batches.filter(b => counts[b.id] !== '' && Math.abs(Number(counts[b.id]) - b.qtyKg) > 0.005) : []
  const save = async () => {
    if (changed.some(b => Number(counts[b.id]) < 0 || isNaN(Number(counts[b.id])))) return setErr('Counted quantities must be zero or more')
    setBusy(true)
    try {
      for (const b of changed) await api.post('/stock/adjustments', { batchId: b.id, countedKg: Number(counts[b.id]), reason })
      toast(changed.length ? `${changed.length} correction${changed.length > 1 ? 's' : ''} saved for ${bin.code}` : `${bin.code} matches the system`)
      setCode('')
      setBin(null)
      history.reload()
    } catch (e) { setErr(errMsg(e)) } finally { setBusy(false) }
  }

  return (
    <>
      <PageHead title="Stock count" sub={`Physically count a bin in ${warehouse?.name || '…'} and correct the system quantity.`} />
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', alignItems: 'start' }}>
        <div className="card stack">
          <div className="card-h" style={{ margin: 0 }}><i className="ti ti-clipboard-check" style={{ color: 'var(--blue)' }} />Count a bin</div>
          <Field label="Bin">
            <div className="input-group"><div style={{ flex: 1 }}><ScanInput value={code} onChange={v => { setErr(''); setCode(v) }} autoFocus /></div><button className="btn primary" onClick={lookup}>Open</button></div>
          </Field>
          {bin && (
            <>
              <div className="alert info"><i className="ti ti-info-circle" /><div><b className="mono">{bin.code}</b> · rack {bin.rackCode}, level {bin.levelNo} · capacity {fmtKg(bin.capacityKg)}</div></div>
              {bin.batches.length === 0 ? <Empty icon="ti-box-off" title="Bin is empty in the system">If you found material here, record it as a receipt.</Empty> : bin.batches.map(b => (
                <div key={b.id} className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) 150px', alignItems: 'end' }}>
                  <div><b>{b.materialName}</b><div className="muted" style={{ fontSize: 12 }}>Batch {b.batchNo} · {fmtDate(b.receivedAt)} · system {fmtKg(b.qtyKg)}</div></div>
                  <Field label="Counted (kg)"><input className="input" type="number" min="0" step="any" value={counts[b.id] ?? ''} onChange={e => { setErr(''); setCounts(c => ({ ...c, [b.id]: e.target.value })) }} /></Field>
                </div>
              ))}
              {bin.batches.length > 0 && <Field label="Reason"><input className="input" value={reason} onChange={e => setReason(e.target.value)} /></Field>}
              {changed.length > 0 && <div className="alert warn"><i className="ti ti-alert-triangle" />{changed.length} batch{changed.length > 1 ? 'es differ' : ' differs'} from the system and will be corrected.</div>}
              {bin.batches.length > 0 && <button className="btn primary" disabled={busy} onClick={save}><i className="ti ti-check" />{changed.length ? 'Save corrections' : 'Confirm count matches'}</button>}
            </>
          )}
          {err && <div className="alert error"><i className="ti ti-alert-circle" />{err}</div>}
        </div>
        <div className="card">
          <div className="card-h"><i className="ti ti-history" style={{ color: 'var(--blue)' }} />Corrections in the last 60 days</div>
          {!history.data?.length ? <Empty icon="ti-clipboard-check" title="No corrections" /> : history.data.slice(0, 40).map(t => (
            <div key={t.id} className="tx-row">
              <span className="tx-ic" style={{ background: t.qtyKg >= 0 ? 'var(--green-bg)' : 'var(--red-bg)', color: t.qtyKg >= 0 ? 'var(--green)' : 'var(--red)' }}><i className={`ti ${t.qtyKg >= 0 ? 'ti-plus' : 'ti-minus'}`} /></span>
              <div style={{ minWidth: 0 }}><b>{t.materialName} · {t.binCode}</b><small>{t.remarks} · {t.userName}</small></div>
              <div className="tx-amt" style={{ color: t.qtyKg >= 0 ? 'var(--green)' : 'var(--red)' }}>{t.qtyKg >= 0 ? '+' : '−'}{fmtKg(Math.abs(t.qtyKg))}<small className="muted">{fmtDateTime(t.at)}</small></div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
