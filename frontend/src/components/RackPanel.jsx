import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { errMsg } from '../api'
import { binStatus, fmtDate, fmtKg, fmtQty, STORAGE_LABEL } from '../format'
import { Ring } from './ui'

/** Side panel for a selected rack: capacity, rack front view grid, and the selected bin's batches. */
export default function RackPanel({ rack, warehouse, selectedBin, onSelectBin, onClose }) {
  const nav = useNavigate()
  const [detail, setDetail] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    setDetail(null)
    setErr('')
    if (!selectedBin) return
    api.get(`/warehouses/${warehouse.id}/bins/${encodeURIComponent(selectedBin)}`).then(r => setDetail(r.data)).catch(e => setErr(errMsg(e)))
  }, [selectedBin, warehouse.id, rack])

  const used = rack.bins.reduce((a, b) => a + b.qtyKg, 0)
  const cap = rack.bins.reduce((a, b) => a + b.capacityKg, 0)
  const pct = cap ? Math.round((used / cap) * 100) : 0
  const filled = rack.bins.filter(b => b.qtyKg > 0)
  const oldest = filled.filter(b => b.oldestReceivedAt).sort((a, b) => new Date(a.oldestReceivedAt) - new Date(b.oldestReceivedAt))[0]
  const materials = [...new Set(filled.map(b => b.materialName))]
  const floor = rack.rackType === 'FLOOR'
  const levels = [...Array(rack.levels).keys()].map(i => i + 1)
  if (!floor) levels.reverse()

  return (
    <aside className="rack-panel" aria-label={`Rack ${rack.code} details`}>
      <div className="rp-h">
        <i className="ti ti-box" style={{ fontSize: 20, color: 'var(--blue)' }} />
        <b>{floor ? 'Zone' : 'Rack'} {rack.code}</b>
        <span className="pill gray">{STORAGE_LABEL[rack.storageType]}</span>
        <button onClick={onClose} aria-label="Close"><i className="ti ti-x" /></button>
      </div>
      <div className="ringrow">
        <Ring pct={pct} />
        <div>
          <small>Capacity used</small>
          <b>{fmtKg(used)} / {fmtKg(cap)}</b>
          <small style={{ marginTop: 4 }}>{filled.length} bins used · {rack.bins.length - filled.length} free</small>
        </div>
      </div>
      <div className="kv"><i className="ti ti-map-pin" /><div><small>Location</small><b>{warehouse.code} / {rack.zoneCode || '–'} / {rack.code}</b></div></div>
      <div className="kv"><i className="ti ti-package" /><div><small>Materials stored</small><b>{materials.length ? materials.join(', ') : 'Empty'}</b>
        {rack.preferredMaterialName && <small>Reserved for {rack.preferredMaterialName}</small>}</div></div>
      <div className="kv"><i className="ti ti-clock-hour-4" /><div><small>Oldest stock (dispatch first)</small><b>{oldest ? `${oldest.code} · ${fmtDate(oldest.oldestReceivedAt)}` : '–'}</b></div></div>

      <div className="row" style={{ justifyContent: 'space-between', margin: '14px 0 8px' }}>
        <b style={{ fontSize: 13.5 }}>{floor ? 'Floor slots' : 'Rack front view'}</b>
        <div className="mini-legend"><span style={{ '--c': '#22c55e' }}>Free</span><span style={{ '--c': '#f59e0b' }}>Partial</span><span style={{ '--c': '#ef4444' }}>Full</span></div>
      </div>
      <div className="elev" style={{ gridTemplateColumns: `26px repeat(${rack.bays}, 1fr)` }}>
        {levels.map(l => [
          <div key={`l${l}`} className="rl">{floor ? 'R' : 'L'}{l}</div>,
          ...[...Array(rack.bays).keys()].map(bi => {
            const b = rack.bins.find(x => x.levelNo === l && x.bayNo === bi + 1)
            if (!b) return <div key={`${l}-${bi}`} />
            return (
              <button key={b.code} className={`cell st-${binStatus(b)} ${selectedBin === b.code ? 'pick' : ''}`} title={`${b.code} · ${fmtKg(b.qtyKg)} / ${fmtKg(b.capacityKg)}`}
                onClick={() => onSelectBin(b.code)} aria-label={b.code}>
                <i style={{ height: `${Math.min(100, Math.round((b.qtyKg / b.capacityKg) * 100))}%` }} />
              </button>
            )
          })
        ])}
        <div />
        {[...Array(rack.bays).keys()].map(i => <div key={`b${i}`} className="rl">{floor ? 'S' : 'B'}{String(i + 1).padStart(2, '0')}</div>)}
      </div>

      <div className="bin-info">
        {!selectedBin && <span className="muted">Select a bin in the grid or in 3D to see its batches.</span>}
        {selectedBin && err && <span className="err">{err}</span>}
        {selectedBin && !err && !detail && <span className="muted">Loading {selectedBin}…</span>}
        {detail && (
          <>
            <div className="row"><b className="mono">{detail.code}</b><span className="spacer" /><span className="muted">{fmtKg(detail.qtyKg)} / {fmtKg(detail.capacityKg)}</span></div>
            {detail.batches.length === 0 && <div className="muted">Empty bin · ready for putaway</div>}
            {detail.batches.map(b => (
              <div key={b.id} style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid #e2e8f0' }}>
                <b>{b.materialName}</b><br />
                {fmtQty(b.qtyKg, b.unit, b.unitWeightKg)} · batch <span className="mono">{b.batchNo}</span><br />
                <span className="muted">Received {fmtDate(b.receivedAt)} · {b.ageDays} days old</span>
              </div>
            ))}
          </>
        )}
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn ghost sm" style={{ flex: 1 }} onClick={() => nav(`/qr-labels?rack=${rack.id}`)}><i className="ti ti-qrcode" />QR labels</button>
        {detail?.batches.length > 0 && <button className="btn ghost sm" style={{ flex: 1 }} onClick={() => nav(`/transfers?bin=${encodeURIComponent(detail.code)}`)}><i className="ti ti-arrows-exchange" />Transfer</button>}
      </div>
    </aside>
  )
}
