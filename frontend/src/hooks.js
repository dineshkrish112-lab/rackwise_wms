import { useCallback, useEffect, useState } from 'react'
import api, { errMsg } from './api'

/** Load data from the API. Returns { data, error, loading, reload, setData }. */
export function useApi(url, params, deps = []) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const key = JSON.stringify(params || {})
  const reload = useCallback(async () => {
    if (!url) { setLoading(false); return }
    setLoading(true)
    try {
      const r = await api.get(url, { params })
      setData(r.data)
      setError('')
    } catch (e) { setError(errMsg(e)) } finally { setLoading(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, key, ...deps])
  useEffect(() => { reload() }, [reload])
  return { data, error, loading, reload, setData }
}
