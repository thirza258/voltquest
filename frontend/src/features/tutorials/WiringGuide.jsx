import { useI18n } from '../../i18n/index.jsx'
import { getBoard } from '../../engine/boards/index.js'
import { getDef, resolvePins } from '../../engine/components/registry.js'
import { findBreadboard, stripOf } from '../../engine/components/breadboard.js'

export function wireEndpoint(doc, terminal, t = value => value) {
  const [owner, pin] = terminal.split(':')
  const component = doc.components.find((entry) => entry.id === owner)
  if (!component) {
    const breadboard = findBreadboard(doc, owner)
    const strip = breadboard ? stripOf(breadboard.type, pin) : null
    if (strip) {
      for (const part of doc.components) {
        for (const [partPin, position] of Object.entries(resolvePins(part, doc).pins)) {
          if (!position.hole) continue
          const [pinBoard, pinHole] = position.hole.split(':')
          if (pinBoard === owner && stripOf(breadboard.type, pinHole) === strip) {
            return { label: `${t(getDef(part.type).name)} · ${partPin} ${t('strip')}`, location: terminal }
          }
        }
      }
    }
    return { label: terminal, location: terminal }
  }
  const definition = getDef(component.type)
  const resolved = resolvePins(component, doc).pins[pin]
  const board = getBoard(component.type)
  const physical = board?.family === 'raspberrypi' ? ` · ${t('physical pin')} ${board.pins.findIndex((entry) => entry.name === pin) + 1}` : ''
  return { label: `${t(definition.name)} · ${pin}${physical}`, location: resolved?.hole ?? `${t(definition.name)} ${t('header')}` }
}

export function WiringGuide({ doc, selectedWire, onSelectWire }) {
  const { t } = useI18n()
  const parts = doc.components.filter((component) => !getBoard(component.type))
  return <section className="mt-6 rounded-lg border border-line bg-white p-5" aria-labelledby="wiring-title">
    <h2 id="wiring-title" className="text-lg font-semibold">{t("Where to put every component and cable")}</h2>
    <p className="mt-2 max-w-4xl text-sm leading-relaxed text-ink-secondary">{t("The example is already wired so you can compare it with these instructions. A hole such as ")}<strong>{t("bb1:a20")}</strong>{t(" means breadboard 1, letter a, number 20. On each breadboard, a–e at the same number are connected; f–j at the same number form a separate strip. The center gap separates them. Red and blue power rails also need wires to the supply and ground; their colors alone do not power them.")}</p>
    {parts.length > 0 && <p className="mt-3 text-sm leading-relaxed text-ink-secondary">{t("Put component legs in the holes listed on the part cards. Put cable ends in the separate, free holes listed in the cable table. For example, a leg in a20 connects electrically to a cable in b20; never force both into the same hole.")}</p>}
    {parts.length > 0 && <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{parts.map((component) => {
      const pins = resolvePins(component, doc).pins
      return <div key={component.id} className="rounded-md bg-surface-sunken p-3"><h3 className="text-sm font-semibold">{t(getDef(component.type).name)}{component.props?.ohms ? ` · ${component.props.ohms} Ω` : ''}</h3><ul className="mt-2 space-y-1 text-xs text-slate-600">{Object.entries(pins).map(([pin, position]) => <li key={pin}><span className="font-medium">{pin}</span> → <code>{position.hole ?? position.terminal}</code></li>)}</ul></div>
    })}</div>}
    {doc.wires.length ? <><p className="my-4 text-sm text-slate-600">{t("Follow the cable list in order. Select a row to highlight its endpoints on the circuit. Cable color is a label; the endpoints determine the electrical connection.")}</p><div className="overflow-x-auto"><table className="w-full min-w-[600px] border-collapse text-left text-sm"><thead className="border-b border-line text-xs uppercase text-slate-500"><tr><th className="p-2">{t("Cable")}</th><th className="p-2">{t("Connect from")}</th><th className="p-2">{t("Connect to")}</th><th className="p-2">{t("Locate")}</th></tr></thead><tbody>{doc.wires.map((wire, index) => {
      const from = wireEndpoint(doc, wire.from, t)
      const to = wireEndpoint(doc, wire.to, t)
      return <tr key={wire.id} className={`border-b border-line ${selectedWire === wire.id ? 'bg-brand-50' : ''}`}><td className="p-2 align-top"><strong>{index + 1}</strong><span className="block text-xs capitalize text-slate-500">{t(wire.color)}</span></td><td className="p-2 align-top">{t(from.label)}<code className="mt-1 block text-xs text-brand-700">{from.location}</code></td><td className="p-2 align-top">{t(to.label)}<code className="mt-1 block text-xs text-brand-700">{to.location}</code></td><td className="p-2 align-top"><button aria-pressed={selectedWire === wire.id} onClick={() => onSelectWire(selectedWire === wire.id ? null : wire.id)} className="rounded border border-line-strong px-2 py-1 text-xs font-medium text-brand-700">{t("Show cable ")}{index + 1}</button></td></tr>
    })}</tbody></table></div></> : <p className="mt-4 text-sm text-slate-600">{t("This lesson needs only the powered board. No breadboard components or cables are required.")}</p>}
  </section>
}
