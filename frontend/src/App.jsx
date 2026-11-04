import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { WarehouseProvider } from './context/WarehouseContext'
import Layout from './components/Layout'
import { Loading } from './components/ui'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Inventory from './pages/Inventory'
import Receipts from './pages/Receipts'
import Dispatches from './pages/Dispatches'
import Transfers from './pages/Transfers'
import StockCount from './pages/StockCount'
import Reports from './pages/Reports'
import QrLabels from './pages/QrLabels'
import Warehouses from './pages/Warehouses'
import LayoutBuilder from './pages/LayoutBuilder'
import Materials from './pages/Materials'
import Users from './pages/Users'
import Settings from './pages/Settings'
import Platform from './pages/Platform'
import NotFound from './pages/NotFound'

function Guard({ perm, children }) {
  const { can } = useAuth()
  return can(perm) ? children : <NotFound denied />
}

export default function App() {
  const { me, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <Loading />
  if (!me) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace state={{ from: loc.pathname }} />} />
      </Routes>
    )
  }
  const home = me.user.role === 'SUPER_ADMIN' ? '/platform' : '/dashboard'
  return (
    <WarehouseProvider>
      <Routes>
        <Route path="/login" element={<Navigate to={home} replace />} />
        <Route element={<Layout />}>
          <Route index element={<Navigate to={home} replace />} />
          <Route path="/dashboard" element={<Guard perm="READ"><Dashboard /></Guard>} />
          <Route path="/inventory" element={<Guard perm="READ"><Inventory /></Guard>} />
          <Route path="/receipts" element={<Guard perm="READ"><Receipts /></Guard>} />
          <Route path="/dispatch" element={<Guard perm="READ"><Dispatches /></Guard>} />
          <Route path="/transfers" element={<Guard perm="OPERATE"><Transfers /></Guard>} />
          <Route path="/stock-count" element={<Guard perm="OPERATE"><StockCount /></Guard>} />
          <Route path="/reports" element={<Guard perm="READ"><Reports /></Guard>} />
          <Route path="/qr-labels" element={<Guard perm="READ"><QrLabels /></Guard>} />
          <Route path="/warehouses" element={<Guard perm="MANAGE"><Warehouses /></Guard>} />
          <Route path="/warehouses/:id/layout" element={<Guard perm="MANAGE"><LayoutBuilder /></Guard>} />
          <Route path="/materials" element={<Guard perm="MANAGE"><Materials /></Guard>} />
          <Route path="/users" element={<Guard perm="ADMIN"><Users /></Guard>} />
          <Route path="/settings" element={<Guard perm="ADMIN"><Settings /></Guard>} />
          <Route path="/platform" element={<Guard perm="PLATFORM"><Platform /></Guard>} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </WarehouseProvider>
  )
}
