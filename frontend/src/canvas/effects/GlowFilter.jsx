import { memo } from 'react'

/**
 * Soft blur filter for LED halos. Place inside `<defs>` and reference with `filter={`url(#${id})`}`.
 * The region is oversized so the blur is never clipped.
 * @param {{ id: string, blur?: number }} props
 */
function GlowFilterImpl({ id, blur = 4 }) {
  return (
    <filter id={id} x="-100%" y="-100%" width="300%" height="300%" colorInterpolationFilters="sRGB" data-effect="glow-filter">
      <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="blur" />
      </feMerge>
    </filter>
  )
}

export const GlowFilter = memo(GlowFilterImpl)
export default GlowFilter
