import { useI18n } from '../../i18n/index.jsx'

/** Diagram and signal table derive from the evaluated circuit, never a separate sample drawing. */
export default function LogicDiagram({ circuit, result }) {
  const { t } = useI18n()
  const groups = new Map(), positions = new Map()
  const nodes = [
    ...['0', '1', ...circuit.inputs].map(id => ({ id, label: id, type: 'INPUT', depth: 0 })),
    ...circuit.nodes.map(node => ({ ...node, label: node.id, depth: result.depths[node.id] })),
    ...circuit.outputs.map(output => ({ id: `output:${output.name}`, label: output.name, type: 'OUTPUT', args: [output.signal], depth: result.depth + 1 })),
  ]
  for (const node of nodes) {
    const row = groups.get(node.depth) ?? 0
    positions.set(node.id, { x: 24 + node.depth * 172, y: 24 + row * 70 })
    groups.set(node.depth, row + 1)
  }
  const width = (result.depth + 2) * 172 + 24, height = Math.max(...groups.values()) * 70 + 28
  return <>
    <p className="mb-3 text-xs leading-6 text-slate-600">{t('Wires show their current bit: teal is 1, gray is 0. Rectangles are named logic blocks. Layout shows dependencies, not physical placement or timing.')}</p>
    {circuit.nodes.length <= 80 ? <div className="max-h-80 overflow-auto rounded-md border border-line bg-slate-50" tabIndex={0} aria-label={t('Scrollable logic diagram')}><svg width={width} height={height} role="img" aria-label={t('Live gate connections and values')}>
      {nodes.flatMap(node => (node.args ?? []).map((arg, index) => {
        const from = positions.get(arg), to = positions.get(node.id), y = to.y + 12 + index * 12
        return <path key={`${node.id}-${index}`} d={`M ${from.x + 128} ${from.y + 24} C ${from.x + 152} ${from.y + 24}, ${to.x - 24} ${y}, ${to.x} ${y}`} fill="none" stroke={result.signals[arg] ? '#0d9488' : '#94a3b8'} strokeWidth={result.signals[arg] ? 2 : 1} />
      }))}
      {nodes.map(node => {
        const { x, y } = positions.get(node.id), value = node.type === 'OUTPUT' ? result.outputs[node.label] : result.signals[node.id]
        return <g key={node.id} transform={`translate(${x},${y})`}><rect width="128" height="48" rx="6" fill={value ? '#f0fdfa' : '#fff'} stroke={value ? '#0d9488' : '#cbd5e1'} /><text x="8" y="17" fontSize="11" fill="#475569">{node.type}</text><text x="8" y="36" fontSize="12" fill="#0f172a">{node.label.length > 11 ? `${node.label.slice(0, 10)}…` : node.label} = {value}</text><title>{node.label}: {node.type}; {value}</title></g>
      })}
    </svg></div> : <p className="text-sm text-slate-600">{t('Large circuit: inspect all connections in the signal table below. Diagrams support up to 80 gates.')}</p>}
    <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold text-brand-700">{t('Signal values and connections')}</summary><div className="mt-3 max-h-80 overflow-auto"><table className="w-full text-left text-xs"><thead><tr>{['Signal', 'Gate', 'Inputs', 'Value'].map(label => <th className="p-2" key={label} scope="col">{t(label)}</th>)}</tr></thead><tbody>{nodes.map(node => <tr className="border-t border-line font-mono" key={node.id}><th className="p-2" scope="row">{node.label}</th><td className="p-2">{node.type}</td><td className="p-2">{node.args?.join(', ') || '—'}</td><td className="p-2">{node.type === 'OUTPUT' ? result.outputs[node.label] : result.signals[node.id]}</td></tr>)}</tbody></table></div></details>
  </>
}
