import { useState } from 'react'
import api, { errMsg } from '../api'
import { useAuth } from '../context/AuthContext'
import { useApi } from '../hooks'
import { fmtDateTime, initials, ROLE_LABEL } from '../format'
import { Empty, Field, Loading, Modal, PageHead, useToast } from '../components/ui'

const ROLE_HELP = {
  ORG_ADMIN: 'Everything, including users and settings',
  MANAGER: 'Operations, warehouses, racks, materials and reports',
  STORE_KEEPER: 'Receipts, putaway, dispatch, transfers and stock count',
  VIEWER: 'Read-only: dashboard, inventory and reports'
}

function UserForm({ item, onClose, onSaved }) {
  const toast = useToast()
  const [f, setF] = useState(item ? { ...item, password: '' } : { fullName: '', email: '', role: 'STORE_KEEPER', phone: '', active: true, password: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k, v) => { setErr(''); setF({ ...f, [k]: v }) }
  const save = async e => {
    e.preventDefault()
    if (!f.fullName.trim() || !f.email.trim()) return setErr('Name and email are required')
    if (!item && f.password.length < 8) return setErr('Set a password of at least 8 characters')
    if (item && f.password && f.password.length < 8) return setErr('New password must be at least 8 characters')
    setBusy(true)
    try {
      const body = { fullName: f.fullName, email: f.email, role: f.role, phone: f.phone, active: f.active, password: f.password || null }
      if (item) await api.put(`/users/${item.id}`, body)
      else await api.post('/users', body)
      toast(`${f.fullName} saved`)
      onSaved()
    } catch (e2) { setErr(errMsg(e2)) } finally { setBusy(false) }
  }
  return (
    <Modal title={item ? `Edit ${item.fullName}` : 'Add user'} icon="ti-user-plus" onClose={onClose}
      footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" form="uf" disabled={busy}>Save</button></>}>
      <form id="uf" className="stack" onSubmit={save}>
        {err && <div className="alert error">{err}</div>}
        <div className="grid g2">
          <Field label="Full name"><input className="input" value={f.fullName} onChange={e => set('fullName', e.target.value)} /></Field>
          <Field label="Phone"><input className="input" value={f.phone || ''} onChange={e => set('phone', e.target.value)} /></Field>
        </div>
        <Field label="Work email" hint="Used to sign in"><input className="input" type="email" value={f.email} onChange={e => set('email', e.target.value)} /></Field>
        <Field label="Role" hint={ROLE_HELP[f.role]}>
          <select className="input" value={f.role} onChange={e => set('role', e.target.value)}>
            {Object.keys(ROLE_HELP).map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </Field>
        <Field label={item ? 'Reset password' : 'Password'} hint={item ? 'Leave empty to keep the current password' : 'At least 8 characters. Share it securely.'}>
          <input className="input" type="password" autoComplete="new-password" value={f.password} onChange={e => set('password', e.target.value)} />
        </Field>
        <label className="row"><input type="checkbox" checked={f.active} onChange={e => set('active', e.target.checked)} />Active (can sign in)</label>
      </form>
    </Modal>
  )
}

export default function Users() {
  const { me } = useAuth()
  const list = useApi('/users')
  const [edit, setEdit] = useState(null)
  return (
    <>
      <PageHead title="Users" sub={`People who can sign in to ${me.organization?.name}`}>
        <button className="btn primary" onClick={() => setEdit({})}><i className="ti ti-user-plus" />Add user</button>
      </PageHead>
      {list.error && <div className="alert error">{list.error}</div>}
      {list.loading && !list.data ? <Loading /> : !list.data?.length ? <div className="card"><Empty title="No users" /></div> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Role</th><th>Phone</th><th>Last sign-in</th><th>Status</th><th /></tr></thead>
            <tbody>
              {list.data.map(u => (
                <tr key={u.id}>
                  <td><div className="row"><span className="avatar">{initials(u.fullName)}</span><div><b>{u.fullName}{u.id === me.user.id && <span className="muted"> (you)</span>}</b><div className="muted" style={{ fontSize: 12 }}>{u.email}</div></div></div></td>
                  <td><span className="pill blue">{ROLE_LABEL[u.role]}</span></td>
                  <td>{u.phone || '–'}</td>
                  <td>{u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : <span className="muted">Never</span>}</td>
                  <td>{u.active ? <span className="pill green">Active</span> : <span className="pill gray">Disabled</span>}</td>
                  <td><div className="actions"><button className="btn ghost sm" onClick={() => setEdit(u)}><i className="ti ti-pencil" />Edit</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edit && <UserForm item={edit.id ? edit : null} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); list.reload() }} />}
    </>
  )
}
