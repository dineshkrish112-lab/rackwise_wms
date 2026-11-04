import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { errMsg } from '../api'
import { Field } from '../components/ui'

// Demo accounts created by the backend seeder on an empty database (see README.md).
const DEMO = import.meta.env.DEV ? [
  ['Texmo administrator', 'admin@texmo.com', 'Admin@12345'],
  ['Texmo warehouse manager', 'manager@texmo.com', 'Manager@12345'],
  ['Texmo store keeper', 'store@texmo.com', 'Store@12345'],
  ['Second customer (Demo Industries)', 'admin@demo.com', 'Admin@12345'],
  ['Platform owner (you)', 'owner@rackwise.app', 'Owner@12345']
] : []

function IsoArt() {
  // Small isometric rack illustration for the sign-in page.
  const P = (x, y, z) => [200 + (x - y) * 26, 120 + (x + y) * 15 - z * 30]
  const face = (pts, fill) => <polygon points={pts.map(p => p.join(',')).join(' ')} fill={fill} />
  const box = (x, y, z, w, d, h, c, k) => (
    <g key={k}>
      {face([P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)], c[0])}
      {face([P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x, y + d, z + h)], c[1])}
      {face([P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x + w, y, z + h)], c[2])}
    </g>
  )
  const els = []
  const cols = [['#f5c58a', '#d9a35f', '#b98445'], ['#9fe1cb', '#5dcaa5', '#1d9e75'], ['#b5d4f4', '#85b7eb', '#378add']]
  for (let r = 0; r < 3; r++) for (let b = 0; b < 4; b++) for (let l = 0; l < 3; l++) {
    els.push(box(b * 1.2, r * 2.4, l * 1.05, 1.2, 1, 0.06, ['#f0731a', '#c95a0e', '#a8480a'], `s${r}${b}${l}`))
    if ((r * 7 + b * 3 + l * 5) % 4 !== 0) els.push(box(b * 1.2 + 0.1, r * 2.4 + 0.1, l * 1.05 + 0.06, 1, 0.8, 0.7, cols[(r + b + l) % 3], `b${r}${b}${l}`))
  }
  return <svg className="iso" width="520" height="420" viewBox="0 0 400 340" aria-hidden="true">{els}</svg>
}

export default function Login() {
  const { login } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async e => {
    e.preventDefault()
    if (!email.trim() || !password) return setErr('Enter your email and password')
    setBusy(true)
    setErr('')
    try {
      const me = await login(email.trim(), password)
      const home = me.user.role === 'SUPER_ADMIN' ? '/platform' : '/dashboard'
      const from = loc.state?.from
      nav(from && from !== '/login' && from !== '/' ? from : home, { replace: true })
    } catch (e2) { setErr(errMsg(e2)) } finally { setBusy(false) }
  }

  return (
    <div className="login">
      <section className="login-art">
        <div className="logo"><span className="logo-mark"><i className="ti ti-building-warehouse" /></span>Rackwise WMS</div>
        <IsoArt />
        <h1>See every rack, every bin,<br /><span>in real 3D.</span></h1>
        <p>Warehouse and inventory management for manufacturers: smart putaway, first-in-first-out dispatch, QR scanning and live analysis across all your sites.</p>
        <div className="feat">
          <div><i className="ti ti-cube" />3D warehouse twin</div>
          <div><i className="ti ti-map-pin-bolt" />Nearest-bin putaway</div>
          <div><i className="ti ti-clock-hour-4" />FIFO dispatch</div>
          <div><i className="ti ti-qrcode" />QR scan or manual entry</div>
        </div>
      </section>
      <section className="login-form">
        <form className="login-box" onSubmit={submit}>
          <h2>Sign in</h2>
          <p>Welcome back. Sign in to your organisation's workspace.</p>
          <div className="stack">
            {err && <div className="alert error"><i className="ti ti-alert-circle" />{err}</div>}
            <Field label="Work email">
              <input className="input" type="email" autoComplete="username" placeholder="name@company.com" value={email} onChange={e => { setEmail(e.target.value); setErr('') }} autoFocus />
            </Field>
            <Field label="Password">
              <div className="input-group">
                <input className="input" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => { setPassword(e.target.value); setErr('') }} />
                <button type="button" className="btn ghost icon" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'}><i className={`ti ${show ? 'ti-eye-off' : 'ti-eye'}`} /></button>
              </div>
            </Field>
            <button className="btn brand block" style={{ height: 44, marginTop: 6 }} disabled={busy}>
              {busy ? <span className="spinner" style={{ width: 18, height: 18, borderTopColor: '#fff' }} /> : <><i className="ti ti-login" />Sign in</>}
            </button>
          </div>
          {DEMO.length > 0 && (
            <div className="demo-accts">
              <b>Demo accounts</b> <span className="muted" style={{ fontSize: 12 }}>(development build only, click to fill)</span>
              {DEMO.map(([label, e, p]) => (
                <button type="button" key={e} onClick={() => { setEmail(e); setPassword(p); setErr('') }}>
                  <span>{label}</span><span className="muted mono">{e}</span>
                </button>
              ))}
            </div>
          )}
        </form>
      </section>
    </div>
  )
}
