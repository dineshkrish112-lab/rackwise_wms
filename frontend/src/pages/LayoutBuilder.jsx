import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api, { errMsg } from '../api'
import { useApi } from '../hooks'
import { fmtKg, STORAGE_LABEL } from '../format'
import WarehouseScene from '../components/WarehouseScene'
import { Confirm, Empty, Field, Loading, PageHead, useToast } from '../components/ui'

const BLANK = { code: '', rackType: 'RACK', storageType: 'SOLID', bays: 5, levels: 4, binCapacityKg: 2000, posX: 0, posZ: 0, rotation: 0, zoneCode: 'Z-ST', preferredMaterialId: '' }

/** Rack builder: add or edit racks and floor zones; the 3D preview updates live. This is what makes the product reusable for any customer. */
export default function LayoutBuilder() {
  const { id } = useParams()
  const toast = useToast()
  const layout = useApi(`/warehouses/${id}/layout`)
  const mats = useApi('/materials')
  const [editing, setEditing] = useState(null)
  const [f, setF] = useState(BLANK)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [del, setDel] = useState(null)

  useEffect(() => {
    if (!editing) return
    if (editing === 'new') setF(BLANK)
    else setF({ ...editing, preferredMaterialId: editing.preferredMaterialId || '' })
    setErr('')
  }, [editing])

  // Live preview: replace the edited rack in the layout with the form values.
  const preview = useMemo(() => {
    if (!layout.data) return null
    if (!editing) return layout.data
    const bays = Math.max(1, Math.min(40, Number(f.bays) || 1)), levels = Math.max(1, Math.min(12, Number(f.levels) || 1))
    const code = (f.code || 'NEW').toUpperCase()
    const draft = {
      id: editing === 'new' ? -1 : editing.id, code, rackType: f.rackType, storageType: f.storageType, bays, levels,
      binCapacityKg: Number(f.binCapacityKg) || 0, posX: Number(f.posX) || 0, posZ: Number(f.posZ) || 0, rotation: Number(f.rotation) || 0, zoneCode: f.zoneCode,
      bins: [...Array(levels * bays).keys()].map(i => {
        const l = Math.floor(i / bays) + 1, b = (i % bays) + 1
        const old = editing !== 'new' && editing.bays === bays && editing.levels === levels ? editing.bins.find(x => x.levelNo === l && x.bayNo === b) : null
        return old || { id: -1000 - i, code: `${code}-${l}-${b}`, levelNo: l, bayNo: b, capacityKg: Number(f.binCapacityKg) || 1, qtyKg: 0 }
      })
    }
    const racks = layout.data.racks.filter(r => r.id !== draft.id).concat(draft)
    return { ...layout.data, racks }
  }, [layout.data, editing, f])

  const set = (k, v) => { setErr(''); setF(x => ({ ...x, [k]: v })) }
  const save = async e => {
    e.preventDefault()
    if (!f.code.trim()) return setErr('Rack code is required')
    setBusy(true)
    try {
      const body = { ...f, bays: Number(f.bays), levels: Number(f.levels), binCapacityKg: Number(f.binCapacityKg), posX: Number(f.posX), posZ: Number(f.posZ),
        rotation: Number(f.rotation), preferredMaterialId: f.preferredMaterialId ? Number(f.preferredMaterialId) : null }
      if (editing === 'new') await api.post(`/warehouses/${id}/racks`, body)
      else await api.put(`/warehouses/${id}/racks/${editing.id}`, body)
      toast(`${f.rackType === 'FLOOR' ? 'Zone' : 'Rack'} ${f.code.toUpperCase()} saved`)
      setEditing(null)
      layout.reload()
    } catch (e2) { setErr(errMsg(e2)) } finally { setBusy(false) }
  }

  if (layout.loading && !layout.data) return <Loading />
  if (layout.error) return <div className="alert error">{layout.error}</div>
  const w = layout.data.warehouse
  const compatible = (mats.data || []).filter(m => m.storageType === f.storageType && m.active)

  return (
    <>
      <PageHead title={`${w.name} · racks and layout`} sub={`Floor ${w.widthM} × ${w.depthM} m · centre is (0, 0) · dock at (${w.dockX}, ${w.dockZ})`}>
        <Link className="btn ghost" to="/warehouses"><i className="ti ti-arrow-left" />Warehouses</Link>
        <button className="btn primary" onClick={() => setEditing('new')}><i className="ti ti-plus" />Add rack or zone</button>
      </PageHead>
      <div className="builder">
        <div className="card list">
          {editing ? (
            <form className="stack" onSubmit={save}>
              <div className="card-h" style={{ margin: 0 }}><i className="ti ti-pencil" style={{ color: 'var(--blue)' }} />{editing === 'new' ? 'New rack or zone' : `Edit ${editing.code}`}</div>
              {err && <div className="alert error">{err}</div>}
              <div className="grid g2">
                <Field label="Code"><input className="input" value={f.code} onChange={e => set('code', e.target.value.toUpperCase())} placeholder="A3" /></Field>
                <Field label="Type">
                  <select className="input" value={f.rackType} onChange={e => set('rackType', e.target.value)}>
                    <option value="RACK">Shelf rack</option><option value="FLOOR">Floor zone</option>
                  </select>
                </Field>
              </div>
              <div className="grid g2">
                <Field label="Storage type">
                  <select className="input" value={f.storageType} onChange={e => { set('storageType', e.target.value); set('preferredMaterialId', '') }}>
                    {Object.entries(STORAGE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Field>
                <Field label="Zone code"><input className="input" value={f.zoneCode || ''} onChange={e => set('zoneCode', e.target.value.toUpperCase())} /></Field>
              </div>
              <div className="grid g2">
                <Field label={f.rackType === 'FLOOR' ? 'Slot columns' : 'Bays (along rack)'}><input className="input" type="number" min="1" max="40" value={f.bays} onChange={e => set('bays', e.target.value)} /></Field>
                <Field label={f.rackType === 'FLOOR' ? 'Slot rows' : 'Levels (height)'}><input className="input" type="number" min="1" max="12" value={f.levels} onChange={e => set('levels', e.target.value)} /></Field>
              </div>
              <Field label="Capacity per bin (kg)"><input className="input" type="number" min="1" value={f.binCapacityKg} onChange={e => set('binCapacityKg', e.target.value)} /></Field>
              <div className="grid g2">
                <Field label="Position X (m)"><input className="input" type="number" step="0.5" value={f.posX} onChange={e => set('posX', e.target.value)} /></Field>
                <Field label="Position Z (m)"><input className="input" type="number" step="0.5" value={f.posZ} onChange={e => set('posZ', e.target.value)} /></Field>
              </div>
              {f.rackType === 'RACK' && (
                <Field label="Direction">
                  <select className="input" value={f.rotation} onChange={e => set('rotation', Number(e.target.value))}>
                    <option value={0}>Runs front to back (Z)</option><option value={90}>Runs left to right (X)</option>
                  </select>
                </Field>
              )}
              <Field label="Reserved for material" hint="Putaway fills reserved racks first">
                <select className="input" value={f.preferredMaterialId} onChange={e => set('preferredMaterialId', e.target.value)}>
                  <option value="">Any compatible material</option>
                  {compatible.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </Field>
              <div className="alert info"><i className="ti ti-info-circle" />{Number(f.bays) * Number(f.levels) || 0} bins will be created. Watch the 3D preview while you edit.</div>
              <div className="row">
                <button type="button" className="btn ghost" onClick={() => setEditing(null)}>Cancel</button>
                <span className="spacer" />
                <button className="btn primary" disabled={busy}><i className="ti ti-device-floppy" />Save</button>
              </div>
            </form>
          ) : (
            <>
              <div className="card-h"><i className="ti ti-stack-2" style={{ color: 'var(--blue)' }} />{layout.data.racks.length} racks and zones</div>
              {!layout.data.racks.length && <Empty icon="ti-stack-2" title="No racks yet">Add your first rack to start the 3D layout.</Empty>}
              {layout.data.racks.map(r => {
                const used = r.bins.reduce((a, b) => a + b.qtyKg, 0), cap = r.bins.reduce((a, b) => a + b.capacityKg, 0)
                return (
                  <div key={r.id} className="rack-item" onClick={() => setEditing(r)}>
                    <span className="code">{r.code}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b>{r.rackType === 'FLOOR' ? 'Floor zone' : 'Rack'} · {STORAGE_LABEL[r.storageType]}</b>
                      <div className="muted" style={{ fontSize: 12 }}>{r.bays} × {r.levels} · {fmtKg(r.binCapacityKg)} per bin{r.preferredMaterialName ? ` · ${r.preferredMaterialName}` : ''}</div>
                      <div className="bar" style={{ marginTop: 4 }}><i style={{ width: `${cap ? (used / cap) * 100 : 0}%` }} /></div>
                    </div>
                    <button className="btn ghost sm icon" onClick={e => { e.stopPropagation(); setDel(r) }} aria-label={`Delete ${r.code}`}><i className="ti ti-trash" /></button>
                  </div>
                )
              })}
            </>
          )}
        </div>
        <WarehouseScene layout={preview} selectedRackId={editing ? (editing === 'new' ? -1 : editing.id) : null} onSelect={rid => {
          const r = layout.data.racks.find(x => x.id === rid)
          if (r) setEditing(r)
        }} hint="Click a rack to edit it" />
      </div>
      {del && <Confirm title={`Delete ${del.code}`} danger confirmText="Delete" message={`Delete ${del.code} and its ${del.bins.length} bins? Only empty racks can be deleted.`}
        onClose={() => setDel(null)} onConfirm={async () => {
          try { await api.delete(`/warehouses/${id}/racks/${del.id}`); toast(`${del.code} deleted`); setDel(null); setEditing(null); layout.reload() } catch (e) { toast(errMsg(e), 'error') }
        }} />}
    </>
  )
}
