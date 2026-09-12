import React from 'react'
import { useI18n } from '../i18n/index.jsx'
import { Grid3x3, Maximize2, ZoomIn, ZoomOut } from 'lucide-react'
import { IconButton } from '../ui/index.js'
import { MAX_ZOOM, MIN_ZOOM } from './geometry.js'

/**
 * Bottom-left canvas toolbar: zoom out / zoom in / fit / 100 % / grid toggle, followed by whatever
 * the app shell drops in through `extra` (the breadboard-layout switcher).
 *
 * Stays enabled in `readOnly` — looking around a showcase circuit is not an edit.
 */
export const CanvasToolbar = React.memo(function CanvasToolbar({
  zoom,
  onZoomIn,
  onZoomOut,
  onFit,
  onActualSize,
  showGrid,
  onToggleGrid,
  extra,
}) {
  const { t } = useI18n()
  const percent = Math.round((zoom ?? 1) * 100)
  return (
    <div
      data-canvas-toolbar
      className="absolute bottom-3 left-3 z-10 flex items-center gap-1 rounded-lg border border-line bg-surface-panel/95 p-1 shadow-sm backdrop-blur"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <IconButton
        icon={<ZoomOut size={16} />}
        label="Zoom out"
        size="sm"
        disabled={zoom <= MIN_ZOOM + 1e-6}
        onClick={() => onZoomOut?.()}
      />
      <IconButton
        icon={<ZoomIn size={16} />}
        label="Zoom in"
        size="sm"
        disabled={zoom >= MAX_ZOOM - 1e-6}
        onClick={() => onZoomIn?.()}
      />
      <IconButton icon={<Maximize2 size={16} />} label="Fit to circuit (F)" size="sm" onClick={() => onFit?.()} />
      <button
        type="button"
        title={t('Zoom to 100%')}
        aria-label={t('Zoom to 100 percent')}
        onClick={() => onActualSize?.()}
        className="tabular rounded-md px-2 py-1 text-xxs font-medium text-ink-secondary hover:bg-surface-sunken"
      >
        {percent}%
      </button>
      <IconButton
        icon={<Grid3x3 size={16} />}
        label={showGrid ? 'Hide grid' : 'Show grid'}
        size="sm"
        active={!!showGrid}
        onClick={onToggleGrid}
      />
      {extra ? (
        <>
          <span className="mx-1 h-5 w-px bg-line" aria-hidden="true" />
          {extra}
        </>
      ) : null}
    </div>
  )
})

export default CanvasToolbar
