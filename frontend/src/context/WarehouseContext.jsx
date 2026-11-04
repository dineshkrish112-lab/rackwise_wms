import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import api from '../api'
import { useAuth } from './AuthContext'

const WhCtx = createContext(null)
const KEY = 'rw_wh'

export function WarehouseProvider({ children }) {
  const { me, can } = useAuth()
  const [warehouses, setWarehouses] = useState([])
  const [warehouseId, setWarehouseIdState] = useState(() => { try { return Number(localStorage.getItem(KEY)) || null } catch { return null } })
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    if (!me || !can('READ')) { setWarehouses([]); setLoaded(true); return }
    const r = await api.get('/warehouses')
    setWarehouses(r.data)
    setWarehouseIdState(cur => (r.data.some(w => w.id === cur) ? cur : r.data[0]?.id ?? null))
    setLoaded(true)
  }, [me, can])

  useEffect(() => { setLoaded(false); refresh().catch(() => setLoaded(true)) }, [refresh])

  const setWarehouseId = useCallback(id => {
    setWarehouseIdState(id)
    try { localStorage.setItem(KEY, String(id)) } catch { /* ignore */ }
  }, [])

  const warehouse = warehouses.find(w => w.id === warehouseId) || null
  const value = useMemo(() => ({ warehouses, warehouseId, warehouse, setWarehouseId, refresh, loaded }),
    [warehouses, warehouseId, warehouse, setWarehouseId, refresh, loaded])
  return <WhCtx.Provider value={value}>{children}</WhCtx.Provider>
}

export const useWarehouse = () => useContext(WhCtx)
