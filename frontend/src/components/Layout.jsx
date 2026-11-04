import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useWarehouse } from '../context/WarehouseContext'
import { ROLE_LABEL, initials } from '../format'
import ChangePassword from './ChangePassword'

const NAV = [
  { sec: 'Operations', perm: 'READ' },
  { to: '/dashboard', icon: 'ti-layout-dashboard', label: 'Dashboard', perm: 'READ', title: 'Dashboard', sub: 'Live 3D view of your warehouse' },
  { to: '/inventory', icon: 'ti-packages', label: 'Inventory', perm: 'READ', title: 'Inventory', sub: 'Stock by material and location' },
  { to: '/receipts', icon: 'ti-truck-delivery', label: 'Receipts', perm: 'READ', title: 'Receipts', sub: 'Inward material and putaway' },
  { to: '/dispatch', icon: 'ti-truck', label: 'Dispatch', perm: 'READ', title: 'Dispatch', sub: 'Outward material, first in first out' },
  { to: '/transfers', icon: 'ti-arrows-exchange', label: 'Transfers', perm: 'OPERATE', title: 'Transfers', sub: 'Move stock between bins' },
  { to: '/stock-count', icon: 'ti-clipboard-check', label: 'Stock count', perm: 'OPERATE', title: 'Stock count', sub: 'Verify bins and correct quantities' },
  { to: '/reports', icon: 'ti-chart-bar', label: 'Reports', perm: 'READ', title: 'Reports and analysis', sub: 'Daily, weekly and monthly movement' },
  { to: '/qr-labels', icon: 'ti-qrcode', label: 'QR labels', perm: 'READ', title: 'QR labels', sub: 'Print bin labels for scanning' },
  { sec: 'Setup', perm: 'MANAGE' },
  { to: '/warehouses', icon: 'ti-building-warehouse', label: 'Warehouses', perm: 'MANAGE', title: 'Warehouses', sub: 'Sites, racks and 3D layout' },
  { to: '/materials', icon: 'ti-box-seam', label: 'Materials', perm: 'MANAGE', title: 'Materials', sub: 'Item master' },
  { to: '/users', icon: 'ti-users', label: 'Users', perm: 'ADMIN', title: 'Users', sub: 'People and roles' },
  { to: '/settings', icon: 'ti-settings', label: 'Settings', perm: 'ADMIN', title: 'Organisation settings', sub: 'Name, branding and contact' },
  { sec: 'Platform', perm: 'PLATFORM' },
  { to: '/platform', icon: 'ti-building-skyscraper', label: 'Organisations', perm: 'PLATFORM', title: 'Customer organisations', sub: 'Onboard and manage tenants' }
]

export default function Layout() {
  const { me, can, logout } = useAuth()
  const { warehouses, warehouseId, setWarehouseId } = useWarehouse()
  const [open, setOpen] = useState(false)
  const [menu, setMenu] = useState(false)
  const [pwd, setPwd] = useState(false)
  const [q, setQ] = useState('')
  const loc = useLocation()
  const nav = useNavigate()
  const menuRef = useRef(null)
  const org = me.organization

  useEffect(() => { setOpen(false); setMenu(false) }, [loc.pathname])
  useEffect(() => {
    const close = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const current = NAV.find(n => n.to && loc.pathname.startsWith(n.to)) || {}
  const items = NAV.filter(n => !n.perm || can(n.perm))
  const nameParts = (org?.name || 'Rackwise').split(' ')
  const showWh = can('READ') && warehouses.length > 0 && !loc.pathname.startsWith('/warehouses') && !['/materials', '/users', '/settings'].includes(loc.pathname)

  const search = e => {
    e.preventDefault()
    if (q.trim()) nav(`/inventory?q=${encodeURIComponent(q.trim())}`)
  }
  const signOut = async () => { await logout(); nav('/login', { replace: true }) }

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="side-brand">
          <div className="brand-name">{nameParts[0]}{nameParts.length > 1 && <span> {nameParts.slice(1).join(' ')}</span>}</div>
          <small>{org?.tagline || 'Platform administration'}</small>
        </div>
        <nav className="nav">
          {items.map((n, i) => n.sec
            ? <div key={i} className="nav-sec">{n.sec}</div>
            : <NavLink key={n.to} to={n.to}><i className={`ti ${n.icon}`} />{n.label}</NavLink>)}
        </nav>
        <div className="side-foot"><b>Rackwise WMS</b>3D warehouse management · v1.0</div>
      </aside>
      <div className={`backdrop ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />

      <div className="main">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setOpen(true)} aria-label="Open menu"><i className="ti ti-menu-2" /></button>
          <h1>{current.title || 'Rackwise'}<small>{current.sub}</small></h1>
          {can('READ') && (
            <form className="search" onSubmit={search}>
              <i className="ti ti-search" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search material, batch or bin code" aria-label="Search" />
            </form>
          )}
          <div className="spacer" />
          {showWh && (
            <select className="wh-select" value={warehouseId || ''} onChange={e => setWarehouseId(Number(e.target.value))} aria-label="Warehouse">
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          )}
          <div style={{ position: 'relative' }} ref={menuRef}>
            <button className="user-btn" onClick={() => setMenu(m => !m)} aria-haspopup="menu">
              <span className="avatar">{initials(me.user.fullName)}</span>
              <span className="user-meta">{me.user.fullName}<small>{ROLE_LABEL[me.user.role]}</small></span>
              <i className="ti ti-chevron-down" />
            </button>
            {menu && (
              <div className="dropdown" role="menu">
                <div style={{ padding: '8px 10px' }}>
                  <b>{me.user.fullName}</b>
                  <div className="muted" style={{ fontSize: 12 }}>{me.user.email}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{ROLE_LABEL[me.user.role]}{org ? ` · ${org.name}` : ''}</div>
                </div>
                <hr />
                <button onClick={() => { setMenu(false); setPwd(true) }}><i className="ti ti-key" />Change password</button>
                {can('ADMIN') && <button onClick={() => nav('/settings')}><i className="ti ti-settings" />Organisation settings</button>}
                <hr />
                <button className="danger" onClick={signOut}><i className="ti ti-logout" />Sign out</button>
              </div>
            )}
          </div>
        </header>
        <main className="content"><Outlet /></main>
      </div>
      {pwd && <ChangePassword onClose={() => setPwd(false)} />}
    </div>
  )
}
