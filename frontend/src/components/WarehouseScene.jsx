import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { WarehouseView } from '../three/WarehouseView'

/**
 * React wrapper around the three.js WarehouseView.
 * Props: layout, selectedRackId, selectedBin, highlights [{code,color,text}], onSelect(rackId, binCode), children (overlays).
 */
const WarehouseScene = forwardRef(function WarehouseScene({ layout, selectedRackId, selectedBin, highlights, onSelect, children, hint, style, className }, ref) {
  const host = useRef(null)
  const labels = useRef(null)
  const view = useRef(null)
  const onSelectRef = useRef(onSelect)
  const [mode, setMode] = useState('3d')
  const [failed, setFailed] = useState(false)
  onSelectRef.current = onSelect

  useEffect(() => {
    try {
      view.current = new WarehouseView(host.current, labels.current, { onSelect: (r, b) => onSelectRef.current?.(r, b) })
    } catch (e) {
      console.error(e)
      setFailed(true)
    }
    return () => { view.current?.dispose(); view.current = null }
  }, [])

  useEffect(() => {
    if (view.current && layout) view.current.setLayout(layout, { keepCamera: true })
  }, [layout])

  const prevSel = useRef('')
  useEffect(() => {
    if (!view.current || !layout) return
    const key = `${selectedRackId}|${selectedBin}`
    const changed = key !== prevSel.current
    prevSel.current = key
    // Only move the camera when the user picks something new, not when stock data refreshes.
    if (selectedRackId) view.current.select(selectedRackId, selectedBin, { fly: changed })
    else view.current.clearSelection()
  }, [selectedRackId, selectedBin, layout])

  useEffect(() => {
    if (view.current && layout) view.current.setHighlights(highlights || [])
  }, [highlights, layout])

  useImperativeHandle(ref, () => ({
    focusBin: code => view.current?.focusBin(code),
    resetView: () => view.current?.resetView()
  }), [])

  const switchMode = m => { setMode(m); view.current?.setMode(m) }

  return (
    <div className={`stage ${className || ''}`} style={style}>
      <div className="viewport" ref={host} />
      <div className="labels" ref={labels} />
      {failed && <div className="center-load" style={{ position: 'absolute', inset: 0 }}>3D view is not supported on this device. Use the grid views instead.</div>}
      <div className="stage-tools">
        <div className="seg">
          <button className={mode === '3d' ? 'on' : ''} onClick={() => switchMode('3d')}><i className="ti ti-cube" />3D</button>
          <button className={mode === '2d' ? 'on' : ''} onClick={() => switchMode('2d')}><i className="ti ti-layout-grid" />2D</button>
        </div>
        <div className="zoom">
          <button onClick={() => view.current?.zoom(0.7)} aria-label="Zoom in"><i className="ti ti-plus" /></button>
          <button onClick={() => view.current?.zoom(1.4)} aria-label="Zoom out"><i className="ti ti-minus" /></button>
          <button onClick={() => view.current?.resetView()} aria-label="Reset view"><i className="ti ti-focus-centered" /></button>
        </div>
      </div>
      <div className="legend">
        <span><i style={{ background: '#22c55e' }} />Available</span>
        <span><i style={{ background: '#f59e0b' }} />Partial</span>
        <span><i style={{ background: '#ef4444' }} />Full</span>
        <span><i style={{ background: '#06b6d4' }} />Selected</span>
      </div>
      {hint && !selectedRackId && <div className="stage-hint">{hint}</div>}
      {children}
    </div>
  )
})

export default WarehouseScene
