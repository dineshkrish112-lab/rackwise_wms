import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api, { errMsg } from '../api'
import { useAuth } from '../context/AuthContext'
import { useWarehouse } from '../context/WarehouseContext'
import { useApi } from '../hooks'
import { fmtDateTime, fmtQty, UNIT_LABEL } from '../format'
import { Confirm, Empty, Field, Loading, Modal, PageHead, StatusPill, useToast } from '../components/ui'
import PickModal from '../components/PickModal'
import { QtyInput } from './Receipts'

function NewDispatch({ warehouseId, onClose, onSaved }) {
  const toast = useToast()
  const stock = useApi('/stock/materials', { warehouseId })
  const [f, setF] = useState({ materialId: '', qtyKg: 0, destination: '', customerRef: '', remarks: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const material = stock.data?.find(m => m.materialId === Number(f.materialId))
  const matForQty = material && { id: material.materialId, unit: material.unit, unitWeightKg: material.unitWeightKg }

  const save = async e => {
    e.preventDefault()
    if (!f.materialId) return setErr('Choose a material')
    if (!(f.qtyKg > 0)) return setErr('Enter a quantity')
    if (material && f.qtyKg > material.qtyKg + 0.01) return setErr(`Only ${fmtQty(material.qtyKg, material.unit, material.unitWeightKg)} in stock`)
    if (!f.destination.trim()) return setErr('Enter where it is going')
    setBusy(true)
    try {
      const r = await api.post('/dispatches', { ...f, materialId: Number(f.materialId), warehouseId })
      toast(`${r.data.dspNo} created`)
      onSaved(r.data)
    } catch (e2) { setErr(errMsg(e2)) } finally { setBusy(false) }
  }
  return (
    <Modal title="New dispatch" icon="ti-truck" onClose={onClose}
      footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" form="dsf" disabled={busy}>Create dispatch</button></>}>
      <form id="dsf" className="stack" onSubmit={save}>
        {err && <div className="alert error">{err}</div>}
        <Field label="Material" hint={material ? `In stock: ${fmtQty(material.qtyKg, material.unit, material.unitWeightKg)} in ${material.bins} bins` : undefined}>
          <select className="input" value={f.materialId} onChange={e => { setErr(''); setF({ ...f, materialId: e.target.value, qtyKg: 0 }) }}>
            <option value="">Choose material…</option>
            {stock.data?.filter(m => m.qtyKg > 0).map(m => <option key={m.materialId} value={m.materialId}>{m.name} · {fmtQty(m.qtyKg, m.unit, m.unitWeightKg)}</option>)}
          </select>
        </Field>
        <Field label="Quantity to dispatch" hint={material && material.unit !== 'KG' ? `${material.unitWeightKg} kg per ${UNIT_LABEL[material.unit].replace(/s$/, '')}` : undefined}>
          <QtyInput material={matForQty} valueKg={f.qtyKg} onChange={v => { setErr(''); setF({ ...f, qtyKg: v }) }} />
        </Field>
        <Field label="Destination"><input className="input" value={f.destination} placeholder="Assembly line 3, customer name…" onChange={e => { setErr(''); setF({ ...f, destination: e.target.value }) }} /></Field>
        <Field label="Order or customer reference"><input className="input" value={f.customerRef} onChange={e => setF({ ...f, customerRef: e.target.value })} /></Field>
        <Field label="Remarks"><textarea className="input" rows="2" value={f.remarks} onChange={e => setF({ ...f, remarks: e.target.value })} /></Field>
      </form>
    </Modal>
  )
}

export default function Dispatches() {
  const { can } = useAuth()
  const toast = useToast()
  const { warehouseId, warehouse } = useWarehouse()
  const [params, setParams] = useSearchParams()
  const list = useApi(warehouseId ? '/dispatches' : null, { warehouseId })
  const [status, setStatus] = useState('PENDING')
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(params.get('new') === '1')
  const [pick, setPick] = useState(null)
  const [cancel, setCancel] = useState(null)

  useEffect(() => { if (params.get('new')) setParams({}, { replace: true }) }, []) // eslint-disable-line

  const rows = useMemo(() => (list.data || []).filter(r => (status === 'ALL' || r.status === status) &&
    (!q || `${r.dspNo} ${r.materialName} ${r.destination || ''} ${r.customerRef || ''}`.toLowerCase().includes(q.toLowerCase()))), [list.data, status, q])
  const counts = useMemo(() => (list.data || []).reduce((a, r) => ({ ...a, [r.status]: (a[r.status] || 0) + 1 }), {}), [list.data])

  return (
    <>
      <PageHead title="Dispatch" sub={`Outward material for ${warehouse?.name || '…'} · picks oldest stock first`}>
        {can('OPERATE') && <button className="btn primary" onClick={() => setCreating(true)}><i className="ti ti-plus" />New dispatch</button>}
      </PageHead>
      <div className="toolbar">
        <div className="tabs">
          {[['PENDING', 'Waiting to pick'], ['DISPATCHED', 'Dispatched'], ['CANCELLED', 'Cancelled'], ['ALL', 'All']].map(([k, l]) => (
            <button key={k} className={status === k ? 'on' : ''} onClick={() => setStatus(k)}>{l}{k !== 'ALL' && counts[k] ? ` (${counts[k]})` : ''}</button>
          ))}
        </div>
        <input className="input" style={{ maxWidth: 280 }} placeholder="Search number, material, destination" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      {list.error && <div className="alert error">{list.error}</div>}
      {list.loading && !list.data ? <Loading /> : rows.length === 0 ? (
        <div className="card"><Empty icon="ti-truck" title={status === 'PENDING' ? 'Nothing waiting to pick' : 'No dispatches'}>Create a dispatch when material needs to go out.</Empty></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Number</th><th>Material</th><th className="right">Quantity</th><th>Destination</th><th>Created</th><th>Status</th><th /></tr></thead>
            <tbody>
              {rows.map(d => (
                <tr key={d.id}>
                  <td><b className="mono">{d.dspNo}</b><div className="muted" style={{ fontSize: 12 }}>{d.customerRef || ''}</div></td>
                  <td>{d.materialName}{d.status === 'PENDING' && d.availableKg < d.qtyKg && <div><span className="pill red">Short stock</span></div>}</td>
                  <td className="right nowrap">{fmtQty(d.qtyKg, d.unit, d.unitWeightKg)}</td>
                  <td>{d.destination}</td>
                  <td className="nowrap">{fmtDateTime(d.createdAt)}<div className="muted" style={{ fontSize: 12 }}>{d.createdByName}</div></td>
                  <td><StatusPill status={d.status} />{d.dispatchedAt && <div className="muted" style={{ fontSize: 12 }}>{fmtDateTime(d.dispatchedAt)}</div>}</td>
                  <td>
                    {d.status === 'PENDING' && can('OPERATE') && (
                      <div className="actions">
                        <button className="btn amber sm" onClick={() => setPick(d)}><i className="ti ti-arrow-big-up-lines" />Pick</button>
                        <button className="btn ghost sm icon" title="Cancel dispatch" onClick={() => setCancel(d)}><i className="ti ti-x" /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {creating && <NewDispatch warehouseId={warehouseId} onClose={() => setCreating(false)} onSaved={d => { setCreating(false); setStatus('PENDING'); list.reload(); setPick(d) }} />}
      {pick && <PickModal dispatch={pick} onClose={() => setPick(null)} onDone={() => { setPick(null); list.reload() }} />}
      {cancel && <Confirm title="Cancel dispatch" danger confirmText="Cancel dispatch" message={`Cancel ${cancel.dspNo} for ${cancel.materialName}?`}
        onClose={() => setCancel(null)} onConfirm={async () => {
          try { await api.post(`/dispatches/${cancel.id}/cancel`); toast(`${cancel.dspNo} cancelled`); setCancel(null); list.reload() } catch (e) { toast(errMsg(e), 'error') }
        }} />}
    </>
  )
}
