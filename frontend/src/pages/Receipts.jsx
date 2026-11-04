import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api, { errMsg } from '../api'
import { useAuth } from '../context/AuthContext'
import { useWarehouse } from '../context/WarehouseContext'
import { useApi } from '../hooks'
import { fmtDateTime, fmtQty, UNIT_LABEL } from '../format'
import { Confirm, Empty, Field, Loading, Modal, PageHead, StatusPill, useToast } from '../components/ui'
import PutawayModal from '../components/PutawayModal'

export function QtyInput({ material, valueKg, onChange }) {
  // Lets users enter drums or numbers for unit materials; stores kg.
  const unit = material?.unit || 'KG'
  const w = material?.unitWeightKg || 1
  const [units, setUnits] = useState(valueKg ? String(Math.round((valueKg / w) * 100) / 100) : '')
  useEffect(() => { setUnits(valueKg ? String(Math.round((valueKg / w) * 100) / 100) : '') }, [material?.id]) // eslint-disable-line
  return (
    <div className="input-group">
      <input className="input" type="number" min="0" step="any" value={units} placeholder="0"
        onChange={e => { setUnits(e.target.value); onChange((Number(e.target.value) || 0) * w) }} />
      <span className="btn ghost" style={{ pointerEvents: 'none', minWidth: 64 }}>{UNIT_LABEL[unit]}</span>
    </div>
  )
}

function NewReceipt({ warehouseId, onClose, onSaved }) {
  const toast = useToast()
  const mats = useApi('/materials')
  const [f, setF] = useState({ materialId: '', qtyKg: 0, supplier: '', invoiceNo: '', vehicleNo: '', remarks: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const material = mats.data?.find(m => m.id === Number(f.materialId))

  const save = async e => {
    e.preventDefault()
    if (!f.materialId) return setErr('Choose a material')
    if (!(f.qtyKg > 0)) return setErr('Enter a quantity')
    setBusy(true)
    try {
      const r = await api.post('/receipts', { ...f, materialId: Number(f.materialId), warehouseId })
      toast(`${r.data.grnNo} created`)
      onSaved(r.data)
    } catch (e2) { setErr(errMsg(e2)) } finally { setBusy(false) }
  }
  return (
    <Modal title="New goods receipt" icon="ti-truck-delivery" onClose={onClose}
      footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" form="rcf" disabled={busy}>Create receipt</button></>}>
      <form id="rcf" className="stack" onSubmit={save}>
        {err && <div className="alert error">{err}</div>}
        <Field label="Material">
          <select className="input" value={f.materialId} onChange={e => { setErr(''); setF({ ...f, materialId: e.target.value, qtyKg: 0 }) }}>
            <option value="">Choose material…</option>
            {mats.data?.filter(m => m.active).map(m => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}
          </select>
        </Field>
        <Field label="Quantity received" hint={material && material.unit !== 'KG' ? `${material.unitWeightKg} kg per ${UNIT_LABEL[material.unit].replace(/s$/, '')} · ${f.qtyKg || 0} kg total` : undefined}>
          <QtyInput material={material} valueKg={f.qtyKg} onChange={v => { setErr(''); setF({ ...f, qtyKg: v }) }} />
        </Field>
        <div className="grid g2">
          <Field label="Supplier"><input className="input" value={f.supplier} onChange={e => setF({ ...f, supplier: e.target.value })} /></Field>
          <Field label="Invoice number"><input className="input" value={f.invoiceNo} onChange={e => setF({ ...f, invoiceNo: e.target.value })} /></Field>
        </div>
        <Field label="Vehicle number"><input className="input" value={f.vehicleNo} placeholder="TN-38-AB-1234" onChange={e => setF({ ...f, vehicleNo: e.target.value })} /></Field>
        <Field label="Remarks"><textarea className="input" rows="2" value={f.remarks} onChange={e => setF({ ...f, remarks: e.target.value })} /></Field>
      </form>
    </Modal>
  )
}

export default function Receipts() {
  const { can } = useAuth()
  const toast = useToast()
  const { warehouseId, warehouse } = useWarehouse()
  const [params, setParams] = useSearchParams()
  const list = useApi(warehouseId ? '/receipts' : null, { warehouseId })
  const [status, setStatus] = useState('PENDING')
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(params.get('new') === '1')
  const [putaway, setPutaway] = useState(null)
  const [cancel, setCancel] = useState(null)

  useEffect(() => { if (params.get('new')) setParams({}, { replace: true }) }, []) // eslint-disable-line

  const rows = useMemo(() => (list.data || []).filter(r => (status === 'ALL' || r.status === status) &&
    (!q || `${r.grnNo} ${r.materialName} ${r.supplier || ''} ${r.invoiceNo || ''}`.toLowerCase().includes(q.toLowerCase()))), [list.data, status, q])
  const counts = useMemo(() => (list.data || []).reduce((a, r) => ({ ...a, [r.status]: (a[r.status] || 0) + 1 }), {}), [list.data])

  return (
    <>
      <PageHead title="Receipts" sub={`Inward material for ${warehouse?.name || '…'}`}>
        {can('OPERATE') && <button className="btn primary" onClick={() => setCreating(true)}><i className="ti ti-plus" />New receipt</button>}
      </PageHead>
      <div className="toolbar">
        <div className="tabs">
          {[['PENDING', 'Waiting for putaway'], ['STORED', 'Stored'], ['CANCELLED', 'Cancelled'], ['ALL', 'All']].map(([k, l]) => (
            <button key={k} className={status === k ? 'on' : ''} onClick={() => setStatus(k)}>{l}{k !== 'ALL' && counts[k] ? ` (${counts[k]})` : ''}</button>
          ))}
        </div>
        <input className="input" style={{ maxWidth: 280 }} placeholder="Search GRN, material, supplier" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      {list.error && <div className="alert error">{list.error}</div>}
      {list.loading && !list.data ? <Loading /> : rows.length === 0 ? (
        <div className="card"><Empty icon="ti-truck-delivery" title={status === 'PENDING' ? 'Nothing waiting for putaway' : 'No receipts'}>Create a receipt when material arrives at the dock.</Empty></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>GRN</th><th>Material</th><th className="right">Quantity</th><th>Supplier</th><th>Created</th><th>Status</th><th /></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td><b className="mono">{r.grnNo}</b><div className="muted" style={{ fontSize: 12 }}>{r.invoiceNo || ''}{r.vehicleNo ? ` · ${r.vehicleNo}` : ''}</div></td>
                  <td>{r.materialName}</td>
                  <td className="right nowrap">{fmtQty(r.qtyKg, r.unit, r.unitWeightKg)}</td>
                  <td>{r.supplier || '–'}</td>
                  <td className="nowrap">{fmtDateTime(r.createdAt)}<div className="muted" style={{ fontSize: 12 }}>{r.createdByName}</div></td>
                  <td><StatusPill status={r.status} />{r.storedAt && <div className="muted" style={{ fontSize: 12 }}>{fmtDateTime(r.storedAt)}</div>}</td>
                  <td>
                    {r.status === 'PENDING' && can('OPERATE') && (
                      <div className="actions">
                        <button className="btn green sm" onClick={() => setPutaway(r)}><i className="ti ti-map-pin-bolt" />Put away</button>
                        <button className="btn ghost sm icon" title="Cancel receipt" onClick={() => setCancel(r)}><i className="ti ti-x" /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {creating && <NewReceipt warehouseId={warehouseId} onClose={() => setCreating(false)} onSaved={r => { setCreating(false); setStatus('PENDING'); list.reload(); setPutaway(r) }} />}
      {putaway && <PutawayModal receipt={putaway} onClose={() => setPutaway(null)} onDone={() => { setPutaway(null); list.reload() }} />}
      {cancel && <Confirm title="Cancel receipt" danger confirmText="Cancel receipt" message={`Cancel ${cancel.grnNo} for ${cancel.materialName}? This cannot be undone.`}
        onClose={() => setCancel(null)} onConfirm={async () => {
          try { await api.post(`/receipts/${cancel.id}/cancel`); toast(`${cancel.grnNo} cancelled`); setCancel(null); list.reload() } catch (e) { toast(errMsg(e), 'error') }
        }} />}
    </>
  )
}
