import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../i18n/index.jsx'
import { NODES, requestTopology } from './topology.js'

// Fixed positions for the Packet Tracer-style diagram (viewBox 480 × 300).
const POS = {
  client: { x: 26, y: 120 }, server: { x: 158, y: 120 },
  sessions: { x: 300, y: 40 }, products: { x: 300, y: 120 }, files: { x: 300, y: 200 },
  news: { x: 410, y: 70 }, internal: { x: 410, y: 170 },
}
const W = 116, H = 44
const BASE_EDGES = [['client', 'server'], ['server', 'sessions'], ['server', 'products'], ['server', 'files'], ['server', 'news'], ['server', 'internal']]
const center = id => ({ x: POS[id].x + W / 2, y: POS[id].y + H / 2 })
const edgeKey = (a, b) => [a, b].sort().join('-')

/**
 * The VoltShop network. Faint base wiring is always drawn; the last request's path is highlighted,
 * a blocked hop is dashed red, and nodes a finding implicates turn red. A dot animates the request
 * along its hops purely as illustration — it advances no model and carries no data.
 */
export default function CyberTopology({ response }) {
  const { t } = useI18n()
  const topo = response ? requestTopology(response) : null
  const activeEdges = new Set((topo?.edges ?? []).map(([a, b]) => edgeKey(a, b)))
  const blockedTo = topo?.blocked ? topo.backend : null
  const findingNodes = new Set(topo?.findingNodes ?? [])
  const reached = new Set(topo?.reached ?? [])
  const [step, setStep] = useState(0)
  const raf = useRef(0)
  useEffect(() => {
    if (!topo || topo.hops.length < 2) return undefined
    setStep(0)
    let start = null
    const tick = now => {
      if (start === null) start = now
      const p = Math.min(1, (now - start) / (260 * (topo.hops.length - 1)))
      setStep(p * (topo.hops.length - 1))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [response, topo])
  let packet = null
  if (topo && topo.hops.length >= 2) {
    const i = Math.min(Math.floor(step), topo.hops.length - 2), frac = step - i
    const a = center(topo.hops[i]), b = center(topo.hops[i + 1])
    packet = { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac }
  }
  return <div className="cy-topology">
    <svg viewBox="0 0 480 300" role="img" aria-label={t('VoltShop network topology and the last request path')}>
      {BASE_EDGES.map(([a, b]) => {
        const ca = center(a), cb = center(b)
        const active = activeEdges.has(edgeKey(a, b))
        const blocked = blockedTo === b && a === 'server'
        return <line key={edgeKey(a, b)} x1={ca.x} y1={ca.y} x2={cb.x} y2={cb.y} className={`cy-edge ${blocked ? 'is-blocked' : active ? 'is-active' : ''}`} />
      })}
      {packet && <circle className="cy-packet" cx={packet.x} cy={packet.y} r="4" />}
      {NODES.map(node => {
        const p = POS[node.id]
        const cls = findingNodes.has(node.id) ? 'is-finding' : reached.has(node.id) ? 'is-reached' : ''
        return <g key={node.id} className={`cy-node ${cls}`}>
          <rect x={p.x} y={p.y} width={W} height={H} rx="6" />
          <text x={p.x + 8} y={p.y + 18} className="font-semibold">{t(node.label)}</text>
          <text x={p.x + 8} y={p.y + 32} className="cy-role">{t(node.role)}</text>
        </g>
      })}
    </svg>
    <div className="cy-legend" aria-hidden="true">
      <span><i style={{ background: 'var(--wb-accent)' }} />{t('Request path')}</span>
      <span><i style={{ background: 'var(--wb-danger)' }} />{t('Boundary crossed / blocked')}</span>
      <span>{t('Illustration only — no packet leaves the browser.')}</span>
    </div>
  </div>
}
