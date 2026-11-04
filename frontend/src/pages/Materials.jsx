import { useMemo, useState } from 'react'
import api, { errMsg } from '../api'
import { useApi } from '../hooks'
import { fmtKg, STORAGE_LABEL, UNIT_LABEL, VISUAL_ICON, VISUAL_LABEL, VISUAL_TINT } from '../format'
import { Confirm, Empty, Field, Loading, Modal, PageHead, useToast } from '../components/ui'

const BLANK = { code: '', name: '', category: '', storageType: 'SOLID', unit: 'KG', unitWeightKg: 1, reorderLevelKg: 0, visual: 'GENERIC', active: true }

function MaterialForm({ item, onClose, onSaved }) {
  const toast = useToast()
  const [f, setF] = useState(item || BLANK)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k, v) => { setErr(''); setF({ ...f, [k]: v }) }
  const save = async e => {
    e.preventDefault()
    if (!f.code.trim() || !f.name.trim()) return setErr('Code and name are required')
    if (f.unit !== 'KG' && !(Number(f.unitWeightKg) > 0)) return setErr('Enter the weight of one unit')
    setBusy(true)
    try {
      const body = { ...f, unitWeightKg: f.unit === 'KG' ? 1 : Number(f.unitWeightKg), reorderLevelKg: Number(f.reorderLevelKg) || 0 }
      if (item) await api.put(`/materials/${item.id}`, body)
      else await api.post('/materials', body)
      toast(`${f.name} saved`)
      onSaved()
    } catch (e2) { setErr(errMsg(e2)) } finally { setBusy(false) }
  }
  return (
    <Modal title={item ? `Edit ${item.name}` : 'New material'} icon="ti-box-seam" onClose={onClose}
      footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" form="mf" disabled={busy}>Save</button></>}>
      <form id="mf" className="stack" onSubmit={save}>
        {err && <div className="alert error">{err}</div>}
        <div className="grid g2">
          <Field label="Code"><input className="input" value={f.code} onChange={e => set('code', e.target.value.toUpperCase())} placeholder="MS-ROD-40" /></Field>
          <Field label="Category"><input className="input" value={f.category || ''} onChange={e => set('category', e.target.value)} placeholder="Raw material" /></Field>
        </div>
        <Field label="Name"><input className="input" value={f.name} onChange={e => set('name', e.target.value)} placeholder="Steel rod Ø40 mm" /></Field>
        <div className="grid g2">
          <Field label="Storage type" hint="Liquids only go to liquid racks">
            <select className="input" value={f.storageType} onChange={e => set('storageType', e.target.value)}>
              {Object.entries(STORAGE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="3D look">
            <select className="input" value={f.visual} onChange={e => set('visual', e.target.value)}>
              {Object.entries(VISUAL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid g2">
          <Field label="Counted in">
            <select className="input" value={f.unit} onChange={e => set('unit', e.target.value)}>
              <option value="KG">Kilograms / tons</option><option value="NOS">Numbers (pieces)</option><option value="DRUM">Drums</option><option value="LITRE">Litres</option>
            </select>
          </Field>
          {f.unit !== 'KG' && <Field label={`Weight of one ${UNIT_LABEL[f.unit].replace(/s$/, '')} (kg)`}><input className="input" type="number" min="0" step="any" value={f.unitWeightKg} onChange={e => set('unitWeightKg', e.target.value)} /></Field>}
        </div>
        <Field label="Reorder level (kg)" hint="Dashboard warns when stock falls below this. 0 turns it off."><input className="input" type="number" min="0" value={f.reorderLevelKg} onChange={e => set('reorderLevelKg', e.target.value)} /></Field>
        <label className="row"><input type="checkbox" checked={f.active} onChange={e => set('active', e.target.checked)} />Active (can be received)</label>
      </form>
    </Modal>
  )
}

export default function Materials() {
  const toast = useToast()
  const list = useApi('/materials')
  const [edit, setEdit] = useState(null)
  const [del, setDel] = useState(null)
  const [q, setQ] = useState('')
  const rows = useMemo(() => (list.data || []).filter(m => !q || `${m.code} ${m.name} ${m.category || ''}`.toLowerCase().includes(q.toLowerCase())), [list.data, q])

  return (
    <>
      <PageHead title="Materials" sub="Everything you store: raw materials, components, liquids and finished goods.">
        <button className="btn primary" onClick={() => setEdit({})}><i className="ti ti-plus" />New material</button>
      </PageHead>
      <div className="toolbar"><input className="input" style={{ maxWidth: 320 }} placeholder="Search code, name or category" value={q} onChange={e => setQ(e.target.value)} /></div>
      {list.error && <div className="alert error">{list.error}</div>}
      {list.loading && !list.data ? <Loading /> : !rows.length ? <div className="card"><Empty icon="ti-box-seam" title="No materials">Add the materials you store.</Empty></div> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Material</th><th>Category</th><th>Storage</th><th>Unit</th><th className="right">Reorder level</th><th>Status</th><th /></tr></thead>
            <tbody>
              {rows.map(m => (
                <tr key={m.id}>
                  <td><div className="row"><span className="thumb" style={{ width: 36, height: 36, fontSize: 18, background: VISUAL_TINT[m.visual][0], color: VISUAL_TINT[m.visual][1] }}><i className={`ti ${VISUAL_ICON[m.visual]}`} /></span>
                    <div><b>{m.name}</b><div className="muted mono" style={{ fontSize: 12 }}>{m.code}</div></div></div></td>
                  <td>{m.category || '–'}</td>
                  <td><span className={`pill ${m.storageType === 'LIQUID' ? 'blue' : m.storageType === 'EQUIPMENT' ? 'violet' : 'gray'}`}>{STORAGE_LABEL[m.storageType]}</span></td>
                  <td>{m.unit === 'KG' ? 'kg' : `${UNIT_LABEL[m.unit]} (${m.unitWeightKg} kg each)`}</td>
                  <td className="right">{m.reorderLevelKg ? fmtKg(m.reorderLevelKg) : '–'}</td>
                  <td>{m.active ? <span className="pill green">Active</span> : <span className="pill gray">Inactive</span>}</td>
                  <td><div className="actions">
                    <button className="btn ghost sm icon" onClick={() => setEdit(m)} aria-label="Edit"><i className="ti ti-pencil" /></button>
                    <button className="btn ghost sm icon" onClick={() => setDel(m)} aria-label="Delete"><i className="ti ti-trash" /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edit && <MaterialForm item={edit.id ? edit : null} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); list.reload() }} />}
      {del && <Confirm title="Delete material" danger confirmText="Delete" message={`Delete ${del.name}? Materials with stock or history cannot be deleted; deactivate them instead.`}
        onClose={() => setDel(null)} onConfirm={async () => {
          try { await api.delete(`/materials/${del.id}`); toast('Material deleted'); setDel(null); list.reload() } catch (e) { toast(errMsg(e), 'error') }
        }} />}
    </>
  )
}
