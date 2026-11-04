import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import api, { tokenStore } from '../api'

const AuthCtx = createContext(null)

const PERMS = {
  READ: ['ORG_ADMIN', 'MANAGER', 'STORE_KEEPER', 'VIEWER'],
  OPERATE: ['ORG_ADMIN', 'MANAGER', 'STORE_KEEPER'],
  MANAGE: ['ORG_ADMIN', 'MANAGER'],
  ADMIN: ['ORG_ADMIN'],
  PLATFORM: ['SUPER_ADMIN']
}

function applyBrand(org) {
  document.documentElement.style.setProperty('--brand', org?.brandColor || '#d71920')
  document.title = org ? `${org.name} · Rackwise WMS` : 'Rackwise WMS'
}

export function AuthProvider({ children }) {
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(!!tokenStore.get())

  useEffect(() => {
    if (!tokenStore.get()) return
    api.get('/auth/me').then(r => { setMe(r.data); applyBrand(r.data.organization) })
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const expired = () => { setMe(null); applyBrand(null) }
    window.addEventListener('rw:session-expired', expired)
    return () => window.removeEventListener('rw:session-expired', expired)
  }, [])

  const login = useCallback(async (email, password) => {
    const r = await api.post('/auth/login', { email, password })
    tokenStore.set(r.data.token)
    setMe(r.data.me)
    applyBrand(r.data.me.organization)
    return r.data.me
  }, [])

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout') } catch { /* token may already be invalid */ }
    tokenStore.clear()
    setMe(null)
    applyBrand(null)
  }, [])

  const updateOrg = useCallback(org => {
    setMe(m => ({ ...m, organization: org }))
    applyBrand(org)
  }, [])

  const can = useCallback(perm => !!me && PERMS[perm]?.includes(me.user.role), [me])

  const value = useMemo(() => ({ me, loading, login, logout, can, updateOrg }), [me, loading, login, logout, can, updateOrg])
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export const useAuth = () => useContext(AuthCtx)
