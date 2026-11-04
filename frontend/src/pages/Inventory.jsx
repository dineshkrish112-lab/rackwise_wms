import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useWarehouse } from '../context/WarehouseContext'
import { useApi } from '../hooks'
import { downloadCsv, fmtDate, fmtKg, fmtQty } from '../format'
import { Empty, Kpi, Loading, PageHead } from '../components/ui'

export default function Inventory() {
  const { warehouseId, warehouse, warehouses } = useWarehouse()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [tab, setTab] = useState('material')
  const [scope, setScope] = useState('wh')
  const [q, setQ] = useState(params.get('q') || '')
  const whParam = scope === 'wh' ? warehouseId : undefined
  const mats = useApi('/stock/materials', { warehouseId: whParam })
  const batches = useApi('/stock/batches', { warehouseId: whParam })

  useEffect(() => { const x = params.get('q'); if (x) { setQ(x); setTab('location') } }, [params])

  const ql = q.trim().toLowerCase()
  const matRows = useMemo(() => (mats.data || []).filter(m => !ql || `${m.name} ${m.code} ${m.category || ''}`.toLowerCase().includes(ql)), [mats.data, ql])
  const batchRows = useMemo(() => (batches.data || []).filter(b => !ql || `${b.binCode} ${b.materialName} ${b.materialCode} ${b.batchNo} ${b.warehouseCode}`.toLowerCase().includes(ql)), [batches.data, ql])
  const total = (mats.data || []).reduce((a, m) => a + m.qtyKg, 0)
  const low = (mats.data || []).filter(m => m.low).length

  const locate = b => {
    if (scope === 'all' && b.warehouseId !== warehouseId) return
    nav(`/dashboard?focus=${encodeURIComponent(b.binCode)}&tone=cyan`)
  }
  const exportCsv = () => {
    if (tab === 'material') {
      downloadCsv('stock-by-material.csv', [['Code', 'Material', 'Category', 'Qty (kg)', 'Bins', 'Oldest batch', 'Reorder level (kg)', 'Low'],
        ...matRows.map(m => [m.code, m.name, m.category, m.qtyKg, m.bins, fmtDate(m.oldestReceivedAt), m.reorderLevelKg, m.low ? 'Yes' : 'No'])])
    } else {
      downloadCsv('stock-by-location.csv', [['Warehouse', 'Bin', 'Material', 'Batch', 'Qty (kg)', 'Received', 'Age (days)'],
        ...batchRows.map(b => [b.warehouseCode, b.binCode, b.materialName, b.batchNo, b.qtyKg, fmtDate(b.receivedAt), b.ageDays])])
    }
  }

  return (
    <>
      <PageHead title="Inventory" sub={scope === 'wh' ? warehouse?.name : `All ${warehouses.length} warehouses`}>
        <button className="btn ghost" onClick={exportCsv}><i className="ti ti-download" />Export CSV</button>
      </PageHead>
      <div className="grid g3" style={{ marginBottom: 14 }}>
        <Kpi icon="ti-box" label="Total stock" value={fmtKg(total)} />
        <Kpi icon="ti-packages" label="Materials in stock" value={(mats.data || []).filter(m => m.qtyKg > 0).length} tone="green" />
        <Kpi icon="ti-alert-triangle" label="Below reorder level" value={low} tone={low ? 'red' : 'green'} />
      </div>
      <div className="toolbar">
        <div className="tabs">
          <button className={tab === 'material' ? 'on' : ''} onClick={() => setTab('material')}>By material</button>
          <button className={tab === 'location' ? 'on' : ''} onClick={() => setTab('location')}>By location and batch</button>
        </div>
        <div className="tabs">
          <button className={scope === 'wh' ? 'on' : ''} onClick={() => setScope('wh')}>This warehouse</button>
          <button className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>All warehouses</button>
        </div>
        <input className="input" style={{ maxWidth: 300 }} placeholder="Search material, bin or batch" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      {(mats.error || batches.error) && <div className="alert error">{mats.error || batches.error}</div>}
      {tab === 'material' && (mats.loading && !mats.data ? <Loading /> : matRows.length === 0 ? <div className="card"><Empty title="No materials match" /></div> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Material</th><th>Category</th><th className="right">In stock</th><th className="right">Bins</th><th>Oldest batch</th><th>Status</th></tr></thead>
            <tbody>
              {matRows.map(m => (
                <tr key={m.materialId} className="click" onClick={() => { setTab('location'); setQ(m.code) }}>
                  <td><b>{m.name}</b><div className="muted mono" style={{ fontSize: 12 }}>{m.code}</div></td>
                  <td>{m.category || '–'}</td>
                  <td className="right nowrap"><b>{fmtQty(m.qtyKg, m.unit, m.unitWeightKg)}</b></td>
                  <td className="right">{m.bins}</td>
                  <td>{fmtDate(m.oldestReceivedAt)}</td>
                  <td>{m.qtyKg <= 0 ? <span className="pill gray">Out of stock</span> : m.low ? <span className="pill red">Below reorder ({fmtKg(m.reorderLevelKg)})</span> : <span className="pill green">OK</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {tab === 'location' && (batches.loading && !batches.data ? <Loading /> : batchRows.length === 0 ? <div className="card"><Empty title="No stock matches" /></div> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr>{scope === 'all' && <th>Warehouse</th>}<th>Bin</th><th>Material</th><th>Batch</th><th className="right">Quantity</th><th>Received</th><th>Age</th><th /></tr></thead>
            <tbody>
              {batchRows.map(b => (
                <tr key={b.id}>
                  {scope === 'all' && <td>{b.warehouseCode}</td>}
                  <td><b className="mono">{b.binCode}</b></td>
                  <td>{b.materialName}</td>
                  <td className="mono">{b.batchNo}</td>
                  <td className="right nowrap"><b>{fmtQty(b.qtyKg, b.unit, b.unitWeightKg)}</b></td>
                  <td className="nowrap">{fmtDate(b.receivedAt)}</td>
                  <td><span className={`pill ${b.ageDays > 60 ? 'red' : b.ageDays > 30 ? 'amber' : 'green'}`}>{b.ageDays} days</span></td>
                  <td>{(scope === 'wh' || b.warehouseId === warehouseId) && <button className="btn ghost sm" onClick={() => locate(b)}><i className="ti ti-cube" />Locate</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  )
}
