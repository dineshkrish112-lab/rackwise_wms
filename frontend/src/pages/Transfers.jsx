import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api, { errMsg } from '../api'
import { useWarehouse } from '../context/WarehouseContext'
import { useApi } from '../hooks'
import { fmtDate, fmtDateTime, fmtKg, fmtQty, isoDate } from '../format'
import { Empty, Field, PageHead, useToast } from '../components/ui'
import ScanInput from '../components/ScanInput'

export default function Transfers() {
  const toast = useToast()
  const { warehouseId, warehouse } = useWarehouse()
  const [params] = useSearchParams()
  const [from, setFrom] = useState(params.get('bin') || '')
  const [bin, setBin] = useState(null)
  const [batchId, setBatchId] = useState(null)
  const [to, setTo] = useState('')
  const [qty, setQty] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const history = useApi(warehouseId ? '/stock/transactions' : null, { warehouseId, type: 'TRANSFER_IN', from: isoDate(Date.now() - 30 * 864e5) })

  const lookup = async code => {
    setErr('')
    setBin(null)
    setBatchId(null)
    if (!code) return
    try {
      const r = await api.get(`/warehouses/${warehouseId}/bins/${encodeURIComponent(code)}`)
      setBin(r.data)
      if (r.data.batches.length === 1) { setBatchId(r.data.batches[0].id); setQty(String(r.data.batches[0].qtyKg)) }
      if (!r.data.batches.length) setErr(`${r.data.code} is empty`)
    } catch (e) { setErr(errMsg(e)) }
  }
  useEffect(() => { if (from && warehouseId) lookup(from) }, [warehouseId]) // eslint-disable-line

  const batch = bin?.batches.find(b => b.id === batchId)
  const submit = async e => {
    e.preventDefault()
    if (!batch) return setErr('Choose the batch to move')
    if (!to.trim()) return setErr('Scan or type the target bin')
    if (!(Number(qty) > 0) || Number(qty) > batch.qtyKg) return setErr(`Quantity must be between 0 and ${batch.qtyKg} kg`)
    setBusy(true)
    try {
      await api.post('/stock/transfers', { batchId: batch.id, toBinCode: to.trim(), qtyKg: Number(qty) })
      toast(`Moved ${fmtKg(Number(qty))} from ${bin.code} to ${to.trim()}`)
      setTo('')
      setQty('')
      lookup(bin.code)
      history.reload()
    } catch (e2) { setErr(errMsg(e2)) } finally { setBusy(false) }
  }

  return (
    <>
      <PageHead title="Transfer stock" sub={`Move material between bins in ${warehouse?.name || '…'}. Batch date is kept, so FIFO stays correct.`} />
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', alignItems: 'start' }}>
        <form className="card stack" onSubmit={submit}>
          <div className="card-h" style={{ margin: 0 }}><i className="ti ti-arrows-exchange" style={{ color: 'var(--blue)' }} />New transfer</div>
          <Field label="1. From bin">
            <div className="input-group">
              <div style={{ flex: 1 }}><ScanInput value={from} onChange={setFrom} /></div>
              <button type="button" className="btn ghost" onClick={() => lookup(from.trim())}>Find</button>
            </div>
          </Field>
          {bin && bin.batches.length > 0 && (
            <Field label="2. Batch to move">
              <div className="stack" style={{ gap: 6 }}>
                {bin.batches.map(b => (
                  <label key={b.id} className="row" style={{ border: `1px solid ${batchId === b.id ? 'var(--blue)' : 'var(--line)'}`, borderRadius: 10, padding: '8px 10px', cursor: 'pointer', background: batchId === b.id ? 'var(--blue-bg)' : '#fff' }}>
                    <input type="radio" checked={batchId === b.id} onChange={() => { setBatchId(b.id); setQty(String(b.qtyKg)) }} />
                    <div style={{ flex: 1 }}><b>{b.materialName}</b><div className="muted" style={{ fontSize: 12 }}>Batch {b.batchNo} · received {fmtDate(b.receivedAt)}</div></div>
                    <b className="nowrap">{fmtQty(b.qtyKg, b.unit, b.unitWeightKg)}</b>
                  </label>
                ))}
              </div>
            </Field>
          )}
          <Field label="3. To bin"><ScanInput value={to} onChange={v => { setErr(''); setTo(v) }} /></Field>
          <Field label="Quantity (kg)" hint={batch ? `Up to ${fmtKg(batch.qtyKg)}` : undefined}>
            <input className="input" type="number" min="0" step="any" value={qty} onChange={e => { setErr(''); setQty(e.target.value) }} />
          </Field>
          {err && <div className="alert error"><i className="ti ti-alert-circle" />{err}</div>}
          <button className="btn primary" disabled={busy || !batch}><i className="ti ti-arrows-exchange" />Transfer</button>
        </form>
        <div className="card">
          <div className="card-h"><i className="ti ti-history" style={{ color: 'var(--blue)' }} />Transfers in the last 30 days</div>
          {!history.data?.length ? <Empty icon="ti-arrows-exchange" title="No transfers yet" /> : history.data.slice(0, 30).map(t => (
            <div key={t.id} className="tx-row">
              <span className="tx-ic" style={{ background: 'var(--blue-bg)', color: 'var(--blue)' }}><i className="ti ti-arrows-exchange" /></span>
              <div style={{ minWidth: 0 }}><b>{t.materialName}</b><small>To {t.binCode} · batch {t.batchNo} · {t.userName}</small></div>
              <div className="tx-amt">{fmtKg(t.qtyKg)}<small className="muted">{fmtDateTime(t.at)}</small></div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
