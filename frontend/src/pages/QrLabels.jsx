import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { useAuth } from '../context/AuthContext'
import { useWarehouse } from '../context/WarehouseContext'
import { useApi } from '../hooks'
import { fmtKg, STORAGE_LABEL } from '../format'
import { Empty, Loading, PageHead } from '../components/ui'

export default function QrLabels() {
  const { me } = useAuth()
  const { warehouseId, warehouse } = useWarehouse()
  const [params] = useSearchParams()
  const layout = useApi(warehouseId ? `/warehouses/${warehouseId}/layout` : null)
  const [rackId, setRackId] = useState(params.get('rack') ? Number(params.get('rack')) : 'all')
  useEffect(() => { if (!params.get('rack')) setRackId('all') }, [warehouseId]) // eslint-disable-line

  const bins = useMemo(() => (layout.data?.racks || [])
    .filter(r => rackId === 'all' || r.id === rackId)
    .flatMap(r => r.bins.map(b => ({ ...b, rack: r }))), [layout.data, rackId])

  return (
    <>
      <PageHead title="QR labels" sub="Stick a label on each bin. Store keepers scan it with a phone camera; until then they can type the code.">
        <select className="input no-print" style={{ width: 200 }} value={rackId} onChange={e => setRackId(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
          <option value="all">All racks</option>
          {layout.data?.racks.map(r => <option key={r.id} value={r.id}>{r.rackType === 'FLOOR' ? 'Zone' : 'Rack'} {r.code}</option>)}
        </select>
        <button className="btn primary no-print" onClick={() => window.print()} disabled={!bins.length}><i className="ti ti-printer" />Print {bins.length} labels</button>
      </PageHead>
      {layout.loading && !layout.data ? <Loading /> : !bins.length ? <div className="card"><Empty icon="ti-qrcode" title="No bins">Add racks to this warehouse first.</Empty></div> : (
        <div className="qr-grid">
          {bins.map(b => (
            <div key={b.id} className="qr-card">
              <div style={{ fontWeight: 800, fontStyle: 'italic', fontSize: 12 }}>{me.organization?.name} · {warehouse?.code}</div>
              <QRCodeSVG value={`RW:${warehouse?.code}:${b.code}`} size={120} level="M" />
              <div className="bc">{b.code}</div>
              <small>{b.rack.rackType === 'FLOOR' ? `Zone ${b.rack.code} · row ${b.levelNo} · slot ${b.bayNo}` : `Rack ${b.rack.code} · level ${b.levelNo} · bay ${b.bayNo}`}</small>
              <small>{STORAGE_LABEL[b.rack.storageType]} · max {fmtKg(b.capacityKg)}</small>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
