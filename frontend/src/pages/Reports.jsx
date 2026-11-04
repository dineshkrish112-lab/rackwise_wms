import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useWarehouse } from '../context/WarehouseContext'
import { useApi } from '../hooks'
import { downloadCsv, fmtDateTime, fmtKg, isoDate, TXN_LABEL } from '../format'
import { Empty, Kpi, Loading, PageHead } from '../components/ui'

const PRESETS = [
  ['7d', 'Last 7 days', 6, 'DAY'], ['30d', 'Last 30 days', 29, 'DAY'], ['12w', 'Last 12 weeks', 83, 'WEEK'], ['6m', 'Last 6 months', 182, 'MONTH']
]
const COLORS = ['#d71920', '#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#06b6d4', '#64748b', '#db2777']
const tickKg = v => (v >= 1000 ? `${Math.round(v / 100) / 10}t` : `${v}`)

export default function Reports() {
  const { warehouseId, warehouses } = useWarehouse()
  const [params] = useSearchParams()
  const [tab, setTab] = useState(params.get('tab') || 'movement')
  const [scope, setScope] = useState('wh')
  const [preset, setPreset] = useState('30d')
  const [custom, setCustom] = useState({ from: isoDate(Date.now() - 29 * 864e5), to: isoDate(Date.now()), groupBy: 'DAY' })
  const [type, setType] = useState('')

  const p = PRESETS.find(x => x[0] === preset)
  const range = p ? { from: isoDate(Date.now() - p[2] * 864e5), to: isoDate(Date.now()), groupBy: p[3] } : custom
  const wh = scope === 'wh' ? warehouseId : undefined
  const mv = useApi(tab === 'movement' ? '/reports/movements' : null, { warehouseId: wh, ...range })
  const st = useApi(tab === 'stock' ? '/reports/stock' : null, { warehouseId: wh })
  const led = useApi(tab === 'ledger' ? '/stock/transactions' : null, { warehouseId: wh, from: range.from, to: range.to, type: type || undefined })

  const peak = useMemo(() => (mv.data?.series || []).reduce((a, s) => (s.outKg > (a?.outKg || 0) ? s : a), null), [mv.data])
  const periods = mv.data?.series.length || 1

  const exportCsv = () => {
    if (tab === 'movement' && mv.data) downloadCsv(`movement-${range.from}-to-${range.to}.csv`, [['Period', 'Received (kg)', 'Dispatched (kg)', 'Dispatches'], ...mv.data.series.map(s => [s.label, s.inKg, s.outKg, s.dispatchCount])])
    if (tab === 'stock' && st.data) downloadCsv('stock-analysis.csv', [['Material', 'Qty (kg)'], ...st.data.byMaterial.map(x => [x.name, x.value])])
    if (tab === 'ledger' && led.data) downloadCsv(`ledger-${range.from}-to-${range.to}.csv`, [['Time', 'Warehouse', 'Type', 'Material', 'Bin', 'Batch', 'Qty (kg)', 'Reference', 'User', 'Remarks'],
      ...led.data.map(t => [fmtDateTime(t.at), t.warehouseCode, TXN_LABEL[t.type], t.materialName, t.binCode, t.batchNo, t.qtyKg, t.refNo, t.userName, t.remarks])])
  }

  return (
    <>
      <PageHead title="Reports and analysis" sub={scope === 'wh' ? warehouses.find(w => w.id === warehouseId)?.name : 'All warehouses'}>
        <button className="btn ghost" onClick={exportCsv}><i className="ti ti-download" />Export CSV</button>
        <button className="btn ghost" onClick={() => window.print()}><i className="ti ti-printer" />Print</button>
      </PageHead>
      <div className="toolbar no-print">
        <div className="tabs">
          <button className={tab === 'movement' ? 'on' : ''} onClick={() => setTab('movement')}>Dispatch and receipts</button>
          <button className={tab === 'stock' ? 'on' : ''} onClick={() => setTab('stock')}>Stock analysis</button>
          <button className={tab === 'ledger' ? 'on' : ''} onClick={() => setTab('ledger')}>Stock ledger</button>
        </div>
        <div className="tabs">
          <button className={scope === 'wh' ? 'on' : ''} onClick={() => setScope('wh')}>This warehouse</button>
          <button className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>All warehouses</button>
        </div>
        {tab !== 'stock' && (
          <select className="input" style={{ width: 170 }} value={preset} onChange={e => setPreset(e.target.value)}>
            {PRESETS.map(x => <option key={x[0]} value={x[0]}>{x[1]}</option>)}
            <option value="custom">Custom range</option>
          </select>
        )}
        {tab !== 'stock' && preset === 'custom' && (
          <>
            <input className="input" type="date" style={{ width: 160 }} value={custom.from} onChange={e => setCustom({ ...custom, from: e.target.value })} />
            <input className="input" type="date" style={{ width: 160 }} value={custom.to} onChange={e => setCustom({ ...custom, to: e.target.value })} />
            {tab === 'movement' && (
              <select className="input" style={{ width: 130 }} value={custom.groupBy} onChange={e => setCustom({ ...custom, groupBy: e.target.value })}>
                <option value="DAY">By day</option><option value="WEEK">By week</option><option value="MONTH">By month</option>
              </select>
            )}
          </>
        )}
        {tab === 'ledger' && (
          <select className="input" style={{ width: 160 }} value={type} onChange={e => setType(e.target.value)}>
            <option value="">All movements</option>
            {Object.entries(TXN_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        )}
      </div>

      {tab === 'movement' && (mv.loading && !mv.data ? <Loading /> : mv.error ? <div className="alert error">{mv.error}</div> : mv.data && (
        <div className="stack" style={{ gap: 14 }}>
          <div className="grid g4">
            <Kpi icon="ti-truck" label="Total dispatched" value={fmtKg(mv.data.totalOutKg)} tone="violet" />
            <Kpi icon="ti-truck-delivery" label="Total received" value={fmtKg(mv.data.totalInKg)} tone="green" />
            <Kpi icon="ti-receipt" label="Dispatch orders" value={mv.data.totalDispatches.toLocaleString('en-IN')} />
            <Kpi icon="ti-trending-up" label={`Average per ${range.groupBy.toLowerCase()}`} value={fmtKg(mv.data.totalOutKg / periods)} tone="amber" />
          </div>
          <div className="card">
            <div className="card-h"><i className="ti ti-chart-bar" style={{ color: 'var(--brand)' }} />Dispatched vs received per {range.groupBy.toLowerCase()}
              <span className="spacer" />{peak && <span className="pill violet">Peak: {peak.label} · {fmtKg(peak.outKg)}</span>}</div>
            <div style={{ height: 320 }}>
              <ResponsiveContainer>
                <BarChart data={mv.data.series} margin={{ top: 6, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={14} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={tickKg} />
                  <Tooltip formatter={v => fmtKg(v)} />
                  <Legend />
                  <Bar dataKey="outKg" name="Dispatched" fill="#d71920" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="inKg" name="Received" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="grid g2">
            <div className="card">
              <div className="card-h"><i className="ti ti-trophy" style={{ color: 'var(--amber)' }} />Top dispatched materials</div>
              {!mv.data.topMaterials.length ? <Empty title="No dispatches in this period" /> : mv.data.topMaterials.map((m, i) => (
                <div key={m.name} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 2fr 80px', gap: 10, alignItems: 'center', padding: '6px 0' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                  <div className="bar" style={{ height: 10 }}><i style={{ width: `${(m.value / mv.data.topMaterials[0].value) * 100}%`, background: COLORS[i % COLORS.length] }} /></div>
                  <b className="right">{fmtKg(m.value)}</b>
                </div>
              ))}
            </div>
            <div className="card">
              <div className="card-h"><i className="ti ti-building-warehouse" style={{ color: 'var(--blue)' }} />Dispatch by warehouse</div>
              {!mv.data.byWarehouse.length ? <Empty title="No dispatches in this period" /> : (
                <div style={{ height: 260 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={mv.data.byWarehouse} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={2}>
                        {mv.data.byWarehouse.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={v => fmtKg(v)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      {tab === 'stock' && (st.loading && !st.data ? <Loading /> : st.error ? <div className="alert error">{st.error}</div> : st.data && (
        <div className="stack" style={{ gap: 14 }}>
          <div className="grid g4">
            <Kpi icon="ti-box" label="Total stock" value={fmtKg(st.data.totalKg)} />
            {st.data.aging.slice(0, 3).map((a, i) => <Kpi key={a.name} icon="ti-clock" label={`Aged ${a.name}`} value={fmtKg(a.value)} tone={['green', 'amber', 'red'][i]} />)}
          </div>
          <div className="grid g2">
            <div className="card">
              <div className="card-h"><i className="ti ti-packages" style={{ color: 'var(--blue)' }} />Stock by material</div>
              <div style={{ height: Math.max(220, st.data.byMaterial.length * 30) }}>
                <ResponsiveContainer>
                  <BarChart data={st.data.byMaterial} layout="vertical" margin={{ left: 20, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef2f7" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={tickKg} />
                    <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={v => fmtKg(v)} />
                    <Bar dataKey="value" name="Stock" fill="#2563eb" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="stack" style={{ gap: 14 }}>
              <div className="card">
                <div className="card-h"><i className="ti ti-hourglass" style={{ color: 'var(--amber)' }} />Stock age (how long since receipt)</div>
                <div style={{ height: 220 }}>
                  <ResponsiveContainer>
                    <BarChart data={st.data.aging}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={tickKg} />
                      <Tooltip formatter={v => fmtKg(v)} />
                      <Bar dataKey="value" name="Stock">{st.data.aging.map((_, i) => <Cell key={i} fill={['#16a34a', '#f59e0b', '#ea580c', '#dc2626'][i]} />)}</Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="card">
                <div className="card-h"><i className="ti ti-building-warehouse" style={{ color: 'var(--blue)' }} />By warehouse and storage type</div>
                {[...st.data.byWarehouse, ...st.data.byStorageType.map(x => ({ ...x, name: `${x.name.charAt(0)}${x.name.slice(1).toLowerCase()} materials` }))].map((x, i) => (
                  <div key={x.name + i} className="row" style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}><span>{x.name}</span><span className="spacer" /><b>{fmtKg(x.value)}</b></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}

      {tab === 'ledger' && (led.loading && !led.data ? <Loading /> : led.error ? <div className="alert error">{led.error}</div> : !led.data?.length ? <div className="card"><Empty title="No movements in this period" /></div> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Time</th>{scope === 'all' && <th>Warehouse</th>}<th>Type</th><th>Material</th><th>Bin</th><th>Batch</th><th className="right">Qty</th><th>Reference</th><th>User</th></tr></thead>
            <tbody>
              {led.data.slice(0, 500).map(t => (
                <tr key={t.id}>
                  <td className="nowrap">{fmtDateTime(t.at)}</td>
                  {scope === 'all' && <td>{t.warehouseCode}</td>}
                  <td><span className={`pill ${t.type === 'IN' ? 'green' : t.type === 'OUT' ? 'red' : t.type === 'ADJUST' ? 'amber' : 'blue'}`}>{TXN_LABEL[t.type]}</span></td>
                  <td>{t.materialName}</td>
                  <td className="mono">{t.binCode || '–'}</td>
                  <td className="mono">{t.batchNo || '–'}</td>
                  <td className="right nowrap"><b>{fmtKg(t.qtyKg)}</b></td>
                  <td className="mono">{t.refNo}</td>
                  <td>{t.userName}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {led.data.length > 500 && <div className="muted" style={{ padding: 12 }}>Showing 500 of {led.data.length}. Export CSV for the full list.</div>}
        </div>
      ))}
    </>
  )
}
