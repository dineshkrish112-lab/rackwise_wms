export const UNIT_LABEL = { KG: 'kg', NOS: 'nos', DRUM: 'drums', LITRE: 'L' }

export function fmtKg(kg) {
  const v = Number(kg) || 0
  if (Math.abs(v) >= 1000) return `${parseFloat((v / 1000).toFixed(2)).toLocaleString('en-IN')} t`
  return `${parseFloat(v.toFixed(1)).toLocaleString('en-IN')} kg`
}

/** "4 drums · 800 kg" for unit materials, "2 t" for kg materials. */
export function fmtQty(kg, unit, unitWeightKg) {
  if (!unit || unit === 'KG') return fmtKg(kg)
  const n = Math.round((Number(kg) || 0) / (unitWeightKg || 1))
  return `${n.toLocaleString('en-IN')} ${UNIT_LABEL[unit] || unit} · ${fmtKg(kg)}`
}

export const fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '–'
export const fmtDateTime = d => d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '–'
export const fmtTime = d => d ? new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''
export const isoDate = d => {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}
export const initials = name => (name || '?').split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase()

export const ROLE_LABEL = { SUPER_ADMIN: 'Platform owner', ORG_ADMIN: 'Administrator', MANAGER: 'Warehouse manager', STORE_KEEPER: 'Store keeper', VIEWER: 'Viewer' }
export const STORAGE_LABEL = { SOLID: 'Solid', LIQUID: 'Liquid', EQUIPMENT: 'Equipment' }
export const VISUAL_LABEL = { STEEL: 'Steel rods / bars', COPPER: 'Coils', CASTING: 'Castings', CARTON: 'Cartons', CRATE: 'Crates', DRUM: 'Drums', MOTOR: 'Motors', PUMP: 'Pumps', GENERIC: 'Boxes' }
export const VISUAL_ICON = { STEEL: 'ti-stack-2', COPPER: 'ti-circles', CASTING: 'ti-settings-2', CARTON: 'ti-package', CRATE: 'ti-layers-subtract', DRUM: 'ti-droplet', MOTOR: 'ti-engine', PUMP: 'ti-droplet-bolt', GENERIC: 'ti-box' }
export const VISUAL_TINT = {
  STEEL: ['#eef1f4', '#5b6470'], COPPER: ['#fbeee6', '#b4561f'], CASTING: ['#eceef1', '#4b5563'], CARTON: ['#f8efe2', '#9a6b2f'],
  CRATE: ['#e7f5ec', '#2f7d4f'], DRUM: ['#e8f0fd', '#1e5bb8'], MOTOR: ['#e8f0fd', '#1e4fa0'], PUMP: ['#e8f0fd', '#1e4fa0'], GENERIC: ['#f1f5f9', '#475569']
}
export const TXN_LABEL = { IN: 'Receipt', OUT: 'Dispatch', TRANSFER_OUT: 'Transfer out', TRANSFER_IN: 'Transfer in', ADJUST: 'Stock count' }

export const binStatus = b => b.blocked ? 'blocked' : b.qtyKg <= 0 ? 'empty' : b.qtyKg / b.capacityKg >= 0.85 ? 'full' : 'partial'

export function downloadCsv(filename, rows) {
  const esc = v => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = rows.map(r => r.map(esc).join(',')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
