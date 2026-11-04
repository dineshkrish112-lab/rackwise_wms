import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { errMsg } from '../api'
import { fmtDate, fmtKg, fmtQty } from '../format'
import { Loading, Modal, useToast } from './ui'
import ScanInput from './ScanInput'

/** FIFO pick list for a dispatch. Scanning each bin is optional but recommended. */
export default function PickModal({ dispatch, onClose, onDone }) {
  const toast = useToast()
  const nav = useNavigate()
  const [data, setData] = useState(null)
  const [scans, setScans] = useState({})
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.get(`/dispatches/${dispatch.id}/picks`).then(r => setData(r.data)).catch(e => setErr(errMsg(e)))
  }, [dispatch.id])

  const scanned = p => (scans[p.batchId] || '') === p.binCode
  const wrong = p => scans[p.batchId] && !scanned(p)

  const confirm = async () => {
    if (data.picks.some(wrong)) return setErr('A scanned bin does not match the pick list. Check the bin and scan again.')
    setBusy(true)
    try {
      await api.post(`/dispatches/${dispatch.id}/confirm`, { picks: data.picks.map(p => ({ batchId: p.batchId, qtyKg: p.qtyKg })) })
      toast(`${dispatch.dspNo} dispatched to ${dispatch.destination}`)
      onDone?.(data.picks.map(p => p.binCode))
    } catch (e) { setErr(errMsg(e)) } finally { setBusy(false) }
  }

  return (
    <Modal title={`Pick for ${dispatch.dspNo}`} icon="ti-arrow-big-up-lines" size="lg" onClose={onClose} footer={<>
      {data?.picks.length > 0 && <button className="btn ghost" onClick={() => nav(`/dashboard?focus=${data.picks.map(p => p.binCode).join(',')}&tone=amber`)}><i className="ti ti-cube" />Show in 3D</button>}
      <span className="spacer" />
      <button className="btn ghost" onClick={onClose}>Cancel</button>
      <button className="btn amber" disabled={busy || !data || data.shortKg > 0} onClick={confirm}><i className="ti ti-check" />Confirm dispatch</button>
    </>}>
      <div className="row wrap" style={{ marginBottom: 14 }}>
        <div><b style={{ fontSize: 15 }}>{dispatch.materialName}</b><div className="muted">{fmtQty(dispatch.qtyKg, dispatch.unit, dispatch.unitWeightKg)} to {dispatch.destination}</div></div>
        <span className="spacer" />
        <span className="pill amber"><i className="ti ti-clock-hour-4" />Oldest stock first (FIFO)</span>
      </div>
      {!data && !err && <Loading />}
      {data && (
        <div className="stack">
          {data.shortKg > 0 && <div className="alert error"><i className="ti ti-alert-circle" />Short by {fmtKg(data.shortKg)}. Not enough stock to complete this dispatch.</div>}
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>#</th><th>Bin</th><th>Batch</th><th>Received</th><th className="right">Pick</th><th style={{ width: 240 }}>Verify bin (optional)</th></tr></thead>
              <tbody>
                {data.picks.map((p, i) => (
                  <tr key={p.batchId}>
                    <td>{i + 1}</td>
                    <td><b className="mono">{p.binCode}</b><div className="muted" style={{ fontSize: 12 }}>Rack {p.rackCode} · level {p.levelNo}</div></td>
                    <td className="mono">{p.batchNo}</td>
                    <td>{fmtDate(p.receivedAt)}</td>
                    <td className="right"><b>{fmtQty(p.qtyKg, dispatch.unit, dispatch.unitWeightKg)}</b><div className="muted" style={{ fontSize: 12 }}>of {fmtKg(p.availableKg)}</div></td>
                    <td>
                      <ScanInput value={scans[p.batchId] || ''} invalid={wrong(p)} onChange={v => { setErr(''); setScans(s => ({ ...s, [p.batchId]: v })) }} />
                      {scanned(p) && <span className="pill green" style={{ marginTop: 4 }}><i className="ti ti-check" />Verified</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {err && <div className="alert error" style={{ marginTop: 12 }}><i className="ti ti-alert-circle" />{err}</div>}
    </Modal>
  )
}
