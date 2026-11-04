import { useState } from 'react'
import api, { errMsg } from '../api'
import { useAuth } from '../context/AuthContext'
import { Field, PageHead, useToast } from '../components/ui'

export default function Settings() {
  const { me, updateOrg } = useAuth()
  const toast = useToast()
  const org = me.organization
  const [f, setF] = useState({ name: org.name, tagline: org.tagline || '', brandColor: org.brandColor || '#d71920', address: org.address || '', contactEmail: org.contactEmail || '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k, v) => { setErr(''); setF({ ...f, [k]: v }) }

  const save = async e => {
    e.preventDefault()
    if (!f.name.trim()) return setErr('Organisation name is required')
    if (!/^#[0-9a-fA-F]{6}$/.test(f.brandColor)) return setErr('Brand colour must look like #d71920')
    setBusy(true)
    try {
      const r = await api.put('/organization', f)
      updateOrg(r.data)
      toast('Settings saved')
    } catch (e2) { setErr(errMsg(e2)) } finally { setBusy(false) }
  }
  const parts = f.name.split(' ')

  return (
    <>
      <PageHead title="Organisation settings" sub="Your name and colour appear across the app for everyone in your organisation." />
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', alignItems: 'start' }}>
        <form className="card stack" onSubmit={save}>
          {err && <div className="alert error">{err}</div>}
          <Field label="Organisation name"><input className="input" value={f.name} onChange={e => set('name', e.target.value)} /></Field>
          <Field label="Tagline"><input className="input" value={f.tagline} onChange={e => set('tagline', e.target.value)} placeholder="Pumps · Motors · Solutions" /></Field>
          <Field label="Brand colour">
            <div className="input-group">
              <input type="color" value={f.brandColor} onChange={e => set('brandColor', e.target.value)} style={{ width: 52, height: 40, border: '1px solid #d6dce5', borderRadius: 10, padding: 3, background: '#fff' }} aria-label="Pick colour" />
              <input className="input mono" value={f.brandColor} onChange={e => set('brandColor', e.target.value)} />
            </div>
          </Field>
          <Field label="Address"><textarea className="input" rows="2" value={f.address} onChange={e => set('address', e.target.value)} /></Field>
          <Field label="Contact email"><input className="input" type="email" value={f.contactEmail} onChange={e => set('contactEmail', e.target.value)} /></Field>
          <div className="row"><span className="muted" style={{ fontSize: 12 }}>Plan: {org.plan} · Code: {org.code}</span><span className="spacer" /><button className="btn primary" disabled={busy}>Save settings</button></div>
        </form>
        <div className="card">
          <div className="card-h"><i className="ti ti-eye" style={{ color: 'var(--blue)' }} />Preview</div>
          <div style={{ background: 'var(--navy)', borderRadius: 12, padding: 16 }}>
            <div className="brand-name" style={{ fontSize: 22 }}>{parts[0]}{parts.length > 1 && <span style={{ color: f.brandColor }}> {parts.slice(1).join(' ')}</span>}</div>
            <small style={{ color: '#7f8ea6' }}>{f.tagline}</small>
            <div style={{ marginTop: 14, background: f.brandColor, color: '#fff', borderRadius: 10, padding: '9px 12px', fontWeight: 600, display: 'flex', gap: 10, alignItems: 'center' }}><i className="ti ti-layout-dashboard" />Dashboard</div>
          </div>
        </div>
      </div>
    </>
  )
}
