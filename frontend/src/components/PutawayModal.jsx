import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { errMsg } from '../api'
import { fmtKg, fmtQty } from '../format'
import { Loading, Modal, useToast } from './ui'
import ScanInput from './ScanInput'

/** Confirm where a receipt is stored. Starts from the system's nearest-bin suggestion; the user can change bins. */
export default function PutawayModal({ receipt, onClose, onDone }) {
  const toast = useToast()
  const nav = useNavigate()
  const [lines, setLines] = useState(null)
  const [short, setShort] = useState(0)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.get(`/receipts/${receipt.id}/suggestion`).then(r => {
      setLines(r.data.allocations.map(a => ({ binCode: a.binCode, qtyKg: a.qtyKg, reason: a.reason, distanceM: a.distanceM })))
      setShort(r.data.unallocatedKg)
    }).catch(e => { setErr(errMsg(e)); setLines([]) })
  }, [receipt.id])

  const total = (lines || []).reduce((a, l) => a + (Number(l.qtyKg) || 0), 0)
  const diff = Math.round((receipt.qtyKg - total) * 100) / 100
  const set = (i, k, v) => { setErr(''); setLines(ls => ls.map((l, j) => (j === i ? { ...l, [k]: v, reason: k === 'binCode' ? 'Chosen by you' : l.reason } : l))) }

  const confirm = async () => {
    if (lines.some(l => !l.binCode.trim() || !(Number(l.qtyKg) > 0))) return setErr('Every line needs a bin code and a quantity')
    if (Math.abs(diff) > 0.01) return setErr(`Allocated ${fmtKg(total)} but the receipt is ${fmtKg(receipt.qtyKg)}`)
    setBusy(true)
    try {
      await api.post(`/receipts/${receipt.id}/putaway`, { allocations: lines.map(l => ({ binCode: l.binCode.trim(), qtyKg: Number(l.qtyKg) })) })
      toast(`${receipt.materialName} stored in ${lines.map(l => l.binCode).join(', ')}`)
      onDone?.(lines.map(l => l.binCode))
    } catch (e) { setErr(errMsg(e)) } finally { setBusy(false) }
  }

  return (
    <Modal title={`Put away ${receipt.grnNo}`} icon="ti-map-pin-bolt" size="lg" onClose={onClose} footer={<>
      {lines?.length > 0 && <button className="btn ghost" onClick={() => nav(`/dashboard?focus=${lines.map(l => l.binCode).join(',')}&tone=green`)}><i className="ti ti-cube" />Show in 3D</button>}
      <span className="spacer" />
      <button className="btn ghost" onClick={onClose}>Cancel</button>
      <button className="btn green" disabled={busy || !lines} onClick={confirm}><i className="ti ti-check" />Confirm putaway</button>
    </>}>
      <div className="row wrap" style={{ marginBottom: 14 }}>
        <div><b style={{ fontSize: 15 }}>{receipt.materialName}</b><div className="muted">{fmtQty(receipt.qtyKg, receipt.unit, receipt.unitWeightKg)} · {receipt.supplier || 'No supplier'}</div></div>
        <span className="spacer" />
        <span className={`pill ${Math.abs(diff) < 0.01 ? 'green' : 'amber'}`}>Allocated {fmtKg(total)} of {fmtKg(receipt.qtyKg)}</span>
      </div>
      {!lines && <Loading />}
      {lines && (
        <div className="stack">
          {short > 0 && <div className="alert warn"><i className="ti ti-alert-triangle" />Not enough free compatible space: {fmtKg(short)} could not be placed. Free up bins or add racks.</div>}
          <div className="alert info"><i className="ti ti-info-circle" />Suggested bins are the nearest free bins to the dock that can hold this material. Move the material, then scan or type each bin code to confirm.</div>
          {lines.map((l, i) => (
            <div key={i} className="grid" style={{ gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr) auto', alignItems: 'end' }}>
              <div className="field"><label>Bin {i + 1}{l.reason && <span className="muted" style={{ fontWeight: 400 }}> · {l.reason}{l.distanceM ? ` · ${l.distanceM} m from dock` : ''}</span>}</label>
                <ScanInput value={l.binCode} onChange={v => set(i, 'binCode', v)} />
              </div>
              <div className="field"><label>Quantity (kg)</label><input className="input" type="number" min="0" step="any" value={l.qtyKg} onChange={e => set(i, 'qtyKg', e.target.value)} /></div>
              <button className="btn ghost icon" onClick={() => setLines(ls => ls.filter((_, j) => j !== i))} disabled={lines.length === 1} aria-label="Remove line"><i className="ti ti-trash" /></button>
            </div>
          ))}
          <div><button className="btn ghost sm" onClick={() => setLines(ls => [...ls, { binCode: '', qtyKg: diff > 0 ? diff : 0, reason: 'Chosen by you' }])}><i className="ti ti-plus" />Add bin</button></div>
          {err && <div className="alert error"><i className="ti ti-alert-circle" />{err}</div>}
        </div>
      )}
    </Modal>
  )
}
