import { useState } from 'react'
import api, { errMsg } from '../api'
import { useApi } from '../hooks'
import { fmtDate } from '../format'
import { Confirm, Empty, Field, Kpi, Loading, Modal, PageHead, useToast } from '../components/ui'

function NewOrg({ onClose, onSaved }) {
  const toast = useToast()
  const [f, setF] = useState({ name: '', code: '', brandColor: '#2563eb', plan: 'STANDARD', adminName: '', adminEmail: '', adminPassword: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k, v) => { setErr(''); setF({ ...f, [k]: v }) }
  const save = async e => {
    e.preventDefault()
    if (!f.name.trim() || !/^[A-Za-z0-9-]{2,40}$/.test(f.code)) return setErr('Enter a name and a code (letters, numbers, dashes)')
    if (!f.adminName.trim() || !f.adminEmail.trim()) return setErr('Enter the first administrator')
    if (f.adminPassword.length < 8) return setErr('Admin password must be at least 8 characters')
    setBusy(true)
    try {
      await api.post('/platform/organizations', f)
      toast(`${f.name} onboarded`)
      onSaved()
    } catch (e2) { setErr(errMsg(e2)) } finally { setBusy(false) }
  }
  return (
    <Modal title="Onboard a customer" icon="ti-building-skyscraper" onClose={onClose}
      footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" form="of" disabled={busy}>Create organisation</button></>}>
      <form id="of" className="stack" onSubmit={save}>
        {err && <div className="alert error">{err}</div>}
        <div className="grid g2">
          <Field label="Company name"><input className="input" value={f.name} onChange={e => set('name', e.target.value)} /></Field>
          <Field label="Code"><input className="input" value={f.code} onChange={e => set('code', e.target.value.toUpperCase())} placeholder="ACME" /></Field>
        </div>
        <div className="grid g2">
          <Field label="Plan"><select className="input" value={f.plan} onChange={e => set('plan', e.target.value)}><option>STARTER</option><option>STANDARD</option><option>ENTERPRISE</option></select></Field>
          <Field label="Brand colour"><input type="color" value={f.brandColor} onChange={e => set('brandColor', e.target.value)} style={{ width: '100%', height: 40, border: '1px solid #d6dce5', borderRadius: 10 }} /></Field>
        </div>
        <div className="card-h" style={{ margin: '6px 0 0' }}>First administrator</div>
        <Field label="Name"><input className="input" value={f.adminName} onChange={e => set('adminName', e.target.value)} /></Field>
        <Field label="Email"><input className="input" type="email" value={f.adminEmail} onChange={e => set('adminEmail', e.target.value)} /></Field>
        <Field label="Temporary password" hint="They can change it after signing in"><input className="input" type="password" autoComplete="new-password" value={f.adminPassword} onChange={e => set('adminPassword', e.target.value)} /></Field>
      </form>
    </Modal>
  )
}

export default function Platform() {
  const toast = useToast()
  const list = useApi('/platform/organizations')
  const [creating, setCreating] = useState(false)
  const [toggle, setToggle] = useState(null)
  const data = list.data || []
  return (
    <>
      <PageHead title="Customer organisations" sub="Every customer gets an isolated workspace with its own warehouses, users and data.">
        <button className="btn primary" onClick={() => setCreating(true)}><i className="ti ti-plus" />Onboard customer</button>
      </PageHead>
      <div className="grid g3" style={{ marginBottom: 14 }}>
        <Kpi icon="ti-building-skyscraper" label="Organisations" value={data.length} />
        <Kpi icon="ti-circle-check" label="Active" value={data.filter(o => o.org.active).length} tone="green" />
        <Kpi icon="ti-users" label="Users across customers" value={data.reduce((a, o) => a + o.users, 0)} tone="violet" />
      </div>
      {list.error && <div className="alert error">{list.error}</div>}
      {list.loading && !list.data ? <Loading /> : !data.length ? <div className="card"><Empty title="No customers yet" /></div> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Organisation</th><th>Plan</th><th className="right">Warehouses</th><th className="right">Users</th><th>Since</th><th>Status</th><th /></tr></thead>
            <tbody>
              {data.map(({ org, users, warehouses, createdAt }) => (
                <tr key={org.id}>
                  <td><div className="row"><span className="avatar" style={{ background: org.brandColor }}>{org.code.slice(0, 2)}</span><div><b>{org.name}</b><div className="muted" style={{ fontSize: 12 }}>{org.code} · {org.contactEmail}</div></div></div></td>
                  <td><span className="pill violet">{org.plan}</span></td>
                  <td className="right">{warehouses}</td>
                  <td className="right">{users}</td>
                  <td>{fmtDate(createdAt)}</td>
                  <td>{org.active ? <span className="pill green">Active</span> : <span className="pill red">Suspended</span>}</td>
                  <td><div className="actions"><button className={`btn sm ${org.active ? 'ghost' : 'green'}`} onClick={() => setToggle(org)}>{org.active ? 'Suspend' : 'Reactivate'}</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {creating && <NewOrg onClose={() => setCreating(false)} onSaved={() => { setCreating(false); list.reload() }} />}
      {toggle && <Confirm title={toggle.active ? 'Suspend organisation' : 'Reactivate organisation'} danger={toggle.active} confirmText={toggle.active ? 'Suspend' : 'Reactivate'}
        message={toggle.active ? `${toggle.name} users will be signed out and cannot sign in until you reactivate.` : `${toggle.name} users can sign in again.`}
        onClose={() => setToggle(null)} onConfirm={async () => {
          try { await api.patch(`/platform/organizations/${toggle.id}`, { active: !toggle.active }); toast('Saved'); setToggle(null); list.reload() } catch (e) { toast(errMsg(e), 'error') }
        }} />}
    </>
  )
}
