import { createContext, useCallback, useContext, useEffect, useState } from 'react'

/* ---------- toasts ---------- */
const ToastCtx = createContext(() => {})
export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const push = useCallback((msg, type = 'ok') => {
    const id = Math.random()
    setItems(x => [...x, { id, msg, type }])
    setTimeout(() => setItems(x => x.filter(t => t.id !== id)), type === 'error' ? 4500 : 3000)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            <i className={`ti ${t.type === 'error' ? 'ti-alert-circle' : 'ti-circle-check'}`} />{t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
export const useToast = () => useContext(ToastCtx)

/* ---------- modal ---------- */
export function Modal({ title, icon, onClose, children, footer, size }) {
  useEffect(() => {
    const k = e => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="modal-bg" onMouseDown={e => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${size || ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-h">
          {icon && <i className={`ti ${icon}`} style={{ fontSize: 22, color: 'var(--blue)' }} />}
          <b>{title}</b>
          <button className="x" onClick={onClose} aria-label="Close"><i className="ti ti-x" /></button>
        </div>
        <div className="modal-b">{children}</div>
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>
  )
}

export function Field({ label, hint, error, children }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
      {error ? <span className="err">{error}</span> : hint && <span className="hint">{hint}</span>}
    </div>
  )
}

export function Empty({ icon = 'ti-inbox', title, children }) {
  return <div className="empty"><i className={`ti ${icon}`} /><b>{title}</b>{children}</div>
}

export function Loading() {
  return <div className="center-load"><div className="spinner" /></div>
}

export function PageHead({ title, sub, children }) {
  return (
    <div className="page-head">
      <div><h2>{title}</h2>{sub && <p>{sub}</p>}</div>
      <div className="spacer" />
      {children}
    </div>
  )
}

export function Kpi({ icon, label, value, tone = 'blue' }) {
  return (
    <div className="kpi">
      <span className="ic" style={{ background: `var(--${tone}-bg)`, color: `var(--${tone})` }}><i className={`ti ${icon}`} /></span>
      <div style={{ minWidth: 0 }}><small>{label}</small><b>{value}</b></div>
    </div>
  )
}

export function Ring({ pct, size = 76 }) {
  const r = size / 2 - 7, c = 2 * Math.PI * r
  const col = pct >= 85 ? '#ef4444' : pct >= 60 ? '#16a34a' : '#22c55e'
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`${pct}% used`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e8edf3" strokeWidth="8" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${(c * pct) / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="54%" textAnchor="middle" fontSize="16" fontWeight="700" fill="#0f172a">{pct}%</text>
    </svg>
  )
}

const STATUS_TONE = { PENDING: 'amber', STORED: 'green', DISPATCHED: 'green', CANCELLED: 'gray' }
export function StatusPill({ status }) {
  return <span className={`pill ${STATUS_TONE[status] || 'gray'}`}>{status?.charAt(0) + status?.slice(1).toLowerCase()}</span>
}

export function Confirm({ title, message, confirmText = 'Confirm', danger, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false)
  return (
    <Modal title={title} onClose={onClose} size="sm" footer={<>
      <button className="btn ghost" onClick={onClose}>Cancel</button>
      <button className={`btn ${danger ? 'danger' : 'primary'}`} disabled={busy} onClick={async () => { setBusy(true); try { await onConfirm() } finally { setBusy(false) } }}>{confirmText}</button>
    </>}>
      <p style={{ margin: 0, lineHeight: 1.6 }}>{message}</p>
    </Modal>
  )
}
