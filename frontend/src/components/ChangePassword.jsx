import { useState } from 'react'
import api, { errMsg } from '../api'
import { Field, Modal, useToast } from './ui'

export default function ChangePassword({ onClose }) {
  const toast = useToast()
  const [f, setF] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async e => {
    e.preventDefault()
    if (f.newPassword.length < 8) return setErr('New password must be at least 8 characters')
    if (f.newPassword !== f.confirm) return setErr('New passwords do not match')
    setBusy(true)
    try {
      await api.post('/auth/password', { currentPassword: f.currentPassword, newPassword: f.newPassword })
      toast('Password changed')
      onClose()
    } catch (e2) { setErr(errMsg(e2)) } finally { setBusy(false) }
  }

  return (
    <Modal title="Change password" icon="ti-key" size="sm" onClose={onClose}
      footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" form="pwdf" disabled={busy}>Save password</button></>}>
      <form id="pwdf" className="stack" onSubmit={save}>
        {err && <div className="alert error">{err}</div>}
        <Field label="Current password"><input className="input" type="password" autoComplete="current-password" value={f.currentPassword} onChange={e => { setErr(''); setF({ ...f, currentPassword: e.target.value }) }} required /></Field>
        <Field label="New password" hint="At least 8 characters"><input className="input" type="password" autoComplete="new-password" value={f.newPassword} onChange={e => { setErr(''); setF({ ...f, newPassword: e.target.value }) }} required /></Field>
        <Field label="Confirm new password"><input className="input" type="password" autoComplete="new-password" value={f.confirm} onChange={e => { setErr(''); setF({ ...f, confirm: e.target.value }) }} required /></Field>
      </form>
    </Modal>
  )
}
