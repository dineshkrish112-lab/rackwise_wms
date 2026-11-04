import axios from 'axios'

const TOKEN_KEY = 'rw_token'

export const tokenStore = {
  get() { try { return localStorage.getItem(TOKEN_KEY) } catch { return null } },
  set(t) { try { localStorage.setItem(TOKEN_KEY, t) } catch { /* private mode */ } },
  clear() { try { localStorage.removeItem(TOKEN_KEY) } catch { /* private mode */ } }
}

const api = axios.create({ baseURL: '/api', timeout: 30000 })

api.interceptors.request.use(cfg => {
  const t = tokenStore.get()
  if (t) cfg.headers.Authorization = `Bearer ${t}`
  return cfg
})

api.interceptors.response.use(r => r, err => {
  if (err.response?.status === 401 && !err.config?.url?.includes('/auth/login')) {
    tokenStore.clear()
    window.dispatchEvent(new Event('rw:session-expired'))
  }
  return Promise.reject(err)
})

export const errMsg = e => e?.response?.data?.message || (e?.code === 'ERR_NETWORK' ? 'Cannot reach the server. Is the backend running?' : e?.message) || 'Something went wrong'

export default api
