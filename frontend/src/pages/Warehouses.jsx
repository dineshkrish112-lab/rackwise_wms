import { useState } from 'react'
import { Link } from 'react-router-dom'
import api, { errMsg } from '../api'
import { useAuth } from '../context/AuthContext'
import { useWarehouse } from '../context/WarehouseContext'
import { useApi } from '../hooks'
import { fmtKg } from '../format'
import { Confirm, Empty, Field, Loading, Modal, PageHead, useToast } from '../components/ui'

function WarehouseForm({ item, onClose, onSaved }) {
  const toast = useToast()
  const [f, setF] = useState(item || { code: '', name: '', location: '', widthM: 68, depthM: 46, dockX: 23, dockZ: -21, active: true })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k, v) => { setErr(''); setF({ ...f, [k]: v }) }
  const save = async e => {
    e.preventDefault()
    if (!f.code.trim() || !f.name.trim()) return setErr('Code and name are required')
    setBusy(true)
    try {
      const body = { ...f, widthM: Number(f.widthM), depthM: Number(f.depthM), dockX: Number(f.dockX), dockZ: Number(f.dockZ) }
      const r = item ? await api.put(`/warehouses/${item.id}`, body) : await api.post('/warehouses', body)
      toast(item ? 'Warehouse saved' : `${r.data.name} created. Now add racks.`)
      onSaved(r.data)
    } catch (e2) { setErr(errMsg(e2)) } finally { setBusy(false) }
  }
  return (
    <Modal title={item ? `Edit ${item.name}` : 'New warehouse'} icon="ti-building-warehouse" onClose={onClose}
      footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" form="whf" disabled={busy}>Save</button></>}>
      <form id="whf" className="stack" onSubmit={save}>
        {err && <div className="alert error">{err}</div>}
        <div className="grid g2">
          <Field label="Code" hint="Short code, e.g. WH-E"><input className="input" value={f.code} onChange={e => set('code', e.target.value)} /></Field>
          <Field label="Name"><input className="input" value={f.name} onChange={e => set('name', e.target.value)} /></Field>
        </div>
        <Field label="Location"><input className="input" value={f.location || ''} onChange={e => set('location', e.target.value)} /></Field>
        <div className="grid g2">
          <Field label="Floor width (m)"><input className="input" type="number" value={f.widthM} onChange={e => set('widthM', e.target.value)} /></Field>
          <Field label="Floor depth (m)"><input className="input" type="number" value={f.depthM} onChange={e => set('depthM', e.target.value)} /></Field>
        </div>
        <div className="grid g2">
          <Field label="Dock position X (m)" hint="0 is the centre; positive is right"><input className="input" type="number" value={f.dockX} onChange={e => set('dockX', e.target.value)} /></Field>
          <Field label="Dock position Z (m)" hint="Negative is towards the back wall"><input className="input" type="number" value={f.dockZ} onChange={e => set('dockZ', e.target.value)} /></Field>
        </div>
        <label className="row"><input type="checkbox" checked={f.active} onChange={e => set('active', e.target.checked)} />Active</label>
      </form>
    </Modal>
  )
}

export default function Warehouses() {
  const { can } = useAuth()
  const toast = useToast()
  const { refresh } = useWarehouse()
  const list = useApi('/warehouses')
  const dash = useApi('/dashboard')
  const [edit, setEdit] = useState(null)
  const [del, setDel] = useState(null)
  const stats = Object.fromEntries((dash.data?.warehouses || []).map(w => [w.id, w]))

  const saved = () => { setEdit(null); list.reload(); dash.reload(); refresh() }

  return (
    <>
      <PageHead title="Warehouses" sub="Each site has its own racks, bins and 3D layout.">
        <button className="btn primary" onClick={() => setEdit({})}><i className="ti ti-plus" />New warehouse</button>
      </PageHead>
      {list.error && <div className="alert error">{list.error}</div>}
      {list.loading && !list.data ? <Loading /> : !list.data?.length ? (
        <div className="card"><Empty icon="ti-building-warehouse" title="No warehouses yet">Create a warehouse, then design its racks in the layout builder.</Empty></div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {list.data.map(w => {
            const s = stats[w.id]
            return (
              <div key={w.id} className="card stack" style={{ gap: 10 }}>
                <div className="row">
                  <span className="thumb" style={{ background: 'var(--blue-bg)', color: 'var(--blue)', width: 44, height: 44 }}><i className="ti ti-building-warehouse" /></span>
                  <div style={{ minWidth: 0 }}><b style={{ fontSize: 15 }}>{w.name}</b><div className="muted">{w.code} · {w.location || 'No location'}</div></div>
                  <span className="spacer" />
                  {!w.active && <span className="pill gray">Inactive</span>}
                </div>
                <div>
                  <div className="row" style={{ fontSize: 12.5 }}><span className="muted">Utilisation</span><span className="spacer" /><b>{s ? `${s.utilisationPct}%` : '–'}</b></div>
                  <div className="bar" style={{ height: 8, marginTop: 4 }}><i style={{ width: `${s?.utilisationPct || 0}%`, background: (s?.utilisationPct || 0) >= 85 ? '#ef4444' : '#22c55e' }} /></div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{s ? `${fmtKg(s.stockKg)} of ${fmtKg(s.capacityKg)}` : ''} · floor {w.widthM} × {w.depthM} m</div>
                </div>
                <div className="row">
                  <Link className="btn primary sm" style={{ flex: 1 }} to={`/warehouses/${w.id}/layout`}><i className="ti ti-cube" />Racks and 3D layout</Link>
                  <button className="btn ghost sm icon" onClick={() => setEdit(w)} aria-label="Edit"><i className="ti ti-pencil" /></button>
                  {can('ADMIN') && <button className="btn ghost sm icon" onClick={() => setDel(w)} aria-label="Delete"><i className="ti ti-trash" /></button>}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {edit && <WarehouseForm item={edit.id ? edit : null} onClose={() => setEdit(null)} onSaved={saved} />}
      {del && <Confirm title="Delete warehouse" danger confirmText="Delete" message={`Delete ${del.name} and all its racks? This only works when the warehouse has no stock.`}
        onClose={() => setDel(null)} onConfirm={async () => {
          try { await api.delete(`/warehouses/${del.id}`); toast('Warehouse deleted'); setDel(null); saved() } catch (e) { toast(errMsg(e), 'error') }
        }} />}
    </>
  )
}
