import { useEffect, useRef, useState } from 'react'
import { Modal } from './ui'

/** Bin QR labels contain "RW:<warehouse code>:<bin code>". Plain bin codes are accepted too. */
export const parseScan = text => {
  const t = (text || '').trim()
  const parts = t.split(':')
  return (parts.length >= 3 && parts[0] === 'RW' ? parts.slice(2).join(':') : t).toUpperCase()
}

function CameraScanner({ onResult, onClose }) {
  const id = useRef(`qr-${Math.random().toString(36).slice(2)}`)
  const [err, setErr] = useState('')
  useEffect(() => {
    let scanner, stopped = false
    import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (stopped) return
      scanner = new Html5Qrcode(id.current)
      scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 220, height: 220 } },
        text => { stopped = true; scanner.stop().catch(() => {}).finally(() => onResult(parseScan(text))) },
        () => {}
      ).catch(() => setErr('Camera is not available. Allow camera access, or type the bin code instead.'))
    })
    return () => { stopped = true; scanner?.isScanning && scanner.stop().catch(() => {}) }
  }, [onResult])
  return (
    <Modal title="Scan bin QR code" icon="ti-scan" size="sm" onClose={onClose}>
      {err ? <div className="alert warn">{err}</div> : <p className="muted" style={{ marginTop: 0 }}>Point the camera at the QR label on the rack beam.</p>}
      <div id={id.current} className="scanner-box" />
    </Modal>
  )
}

/** Text input for a bin code with a camera scan button. Works without a scanner by typing. */
export default function ScanInput({ value, onChange, placeholder = 'Scan or type bin code', autoFocus, invalid }) {
  const [cam, setCam] = useState(false)
  return (
    <div className="input-group">
      <input className="input mono" style={invalid ? { borderColor: 'var(--red)' } : undefined} value={value} placeholder={placeholder}
        autoFocus={autoFocus} onChange={e => onChange(e.target.value.toUpperCase())} aria-label="Bin code" />
      <button type="button" className="btn ghost icon" onClick={() => setCam(true)} title="Scan with camera" aria-label="Scan with camera"><i className="ti ti-scan" /></button>
      {cam && <CameraScanner onClose={() => setCam(false)} onResult={code => { setCam(false); onChange(code) }} />}
    </div>
  )
}
