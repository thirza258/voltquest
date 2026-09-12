import { getDef, describeValue, resolvePins, resistorBands, WIRE_COLORS } from '../../engine/components/registry.js'
import { Button, NumberField, Select, Slider, Switch } from '../../ui/index.js'

function Control({ control, value, onChange }) {
  if (control.kind === 'multi') return <>{control.controls.map(c => <Control key={c.field} control={c} value={value} onChange={onChange} />)}</>
  const v = value?.[control.field] ?? control.default
  if (control.kind === 'momentary') return <button type="button" aria-label="Hold pushbutton" aria-pressed={!!v} className="rounded-md border border-brand-600 px-3 py-2 text-sm text-brand-700" onPointerDown={e => { e.currentTarget.setPointerCapture?.(e.pointerId); onChange({ [control.field]: true }) }} onPointerUp={() => onChange({ [control.field]: false })} onPointerCancel={() => onChange({ [control.field]: false })} onLostPointerCapture={() => onChange({ [control.field]: false })} onBlur={() => onChange({ [control.field]: false })} onKeyDown={e => { if ([' ', 'Enter'].includes(e.key)) { e.preventDefault(); onChange({ [control.field]: true }) } }} onKeyUp={e => { if ([' ', 'Enter'].includes(e.key)) onChange({ [control.field]: false }) }}>Hold button</button>
  if (control.kind === 'toggle') return <Switch label={control.label} checked={!!v} onChange={checked => onChange({ [control.field]: checked })} />
  return <Slider label={control.label ?? control.field} min={control.min ?? 0} max={control.max ?? 1} step={control.step ?? 0.01} value={v ?? 0} unit={control.unit} onChange={next => onChange({ [control.field]: next })} />
}

export default function Inspector({ doc, selectedIds, state, readOnly, onProps, onRotate, onRemove, onWireColor, onControl }) {
  const comp = doc.components.find(c => selectedIds.includes(c.id))
  const cable = doc.wires.find(w => selectedIds.includes(w.id))
  if (!comp && !cable) return <p className="p-4 text-sm text-slate-600">Select a part to see live values.</p>
  if (!comp) return <section className="space-y-3 p-3"><h3 className="font-semibold">Jumper wire</h3><p className="break-all font-mono text-xs">{cable.from} → {cable.to}</p><Select label="Wire color" value={cable.color} onChange={color => onWireColor(cable.id, color)} disabled={readOnly} options={WIRE_COLORS.map(value => ({ value, label: value }))} />{!readOnly && <Button variant="danger" size="sm" onClick={() => onRemove([cable.id])}>Remove wire</Button>}</section>
  const def = getDef(comp.type)
  const live = state?.evaluation?.componentStates?.[comp.id]
  const pins = resolvePins(comp, doc).pins
  return <section className="space-y-4 overflow-auto p-3" aria-label="Component inspector">
    <div><h3 className="font-semibold">{def.name}</h3><p className="text-xs text-slate-600">{describeValue(comp.type, comp.props)}</p></div>
    <dl className="grid grid-cols-3 gap-2 text-xs">{[['Voltage', live?.voltage, 'V', 2], ['Current', live?.current == null ? null : live.current * 1000, 'mA', 2], ['Power', live?.power == null ? null : live.power * 1000, 'mW', 2]].map(([label, value, unit, precision]) => <div key={label} className="rounded border border-line p-2"><dt className="text-slate-600">{label}</dt><dd className="mt-1 font-mono">{value == null ? '—' : value.toFixed(precision)} {unit}</dd></div>)}</dl>
    <p className="text-xs text-slate-600">State: {state?.damaged?.[comp.id] ? 'damaged — reset or replace' : live?.state ?? (state?.powered ? 'powered' : 'unpowered')}</p>
    {comp.type === 'resistor' && <div><div className="flex h-7 items-center gap-3 rounded border border-amber-300 bg-amber-100 px-3" aria-label={`Resistor bands: ${resistorBands(comp.props.ohms).join(', ')}`}>{resistorBands(comp.props.ohms).map((color, i) => <span key={i} className="h-full w-2" style={{ backgroundColor: color }} />)}</div>{live && <p className="mt-2 font-mono text-xs text-slate-600">I = V / R = {Math.abs(live.voltage).toFixed(2)} V / {comp.props.ohms} Ω = {Math.abs(live.current * 1000).toFixed(2)} mA</p>}</div>}
    {Object.entries(def.props).map(([key, prop]) => prop.type === 'enum' ? <Select key={key} label={prop.label} value={comp.props[key]} disabled={readOnly} onChange={v => onProps(comp.id, { [key]: typeof prop.default === 'number' ? Number(v) : v })} options={prop.options.map(v => ({ value: v, label: `${v}${prop.unit ? ` ${prop.unit}` : ''}` }))} /> : prop.type === 'boolean' ? <Switch key={key} label={prop.label} checked={!!comp.props[key]} disabled={readOnly} onChange={v => onProps(comp.id, { [key]: v })} /> : <NumberField key={key} label={prop.label} value={comp.props[key]} min={prop.min} max={prop.max} step={prop.step} unit={prop.unit} disabled={readOnly} onChange={v => onProps(comp.id, { [key]: v })} />)}
    {def.control && <Control control={def.control} value={state?.controls?.[comp.id]} onChange={patch => onControl(comp.id, patch)} />}
    {!readOnly && <div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => onRotate(comp.id)}>Rotate 90°</Button><Button size="sm" variant="danger" onClick={() => onRemove([comp.id])}>Remove part</Button></div>}
    <div><h4 className="mb-1 text-xs font-semibold text-slate-600">Pin placement</h4><ul className="space-y-1 font-mono text-xs">{Object.entries(pins).map(([name, p]) => <li key={name}>{name} → {p.hole ?? 'header pin'}</li>)}</ul></div>
    <div className="space-y-2 text-sm text-slate-600"><p>{def.learn?.summary}</p>{def.learn?.tips?.map(tip => <p key={tip}>{tip}</p>)}{def.learn?.formulas?.map(formula => <p key={formula} className="font-mono text-xs">{formula}</p>)}{def.learn?.pitfalls?.map(tip => <p key={tip} className="text-amber-800">{tip}</p>)}</div>
  </section>
}
