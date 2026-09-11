import { INK, PartFrame, PinDots, PinLabels, ValueLabel, bodyBox, defineRenderer } from './common.jsx'

/** Fallback for component types without a dedicated renderer: labelled box + pin pads. */
const GenericPartRenderer = defineRenderer('GenericPartRenderer', function GenericPartRenderer({ comp, def, selected, ghost, damaged }) {
  const box = bodyBox(def)
  const name = def?.name ?? def?.type ?? comp?.type ?? 'Part'
  return (
    <PartFrame comp={comp} def={def} selected={selected} ghost={ghost} damaged={damaged} ariaLabel={name}>
      <rect x={box.x + 2} y={box.y + 2} width={box.width - 4} height={box.height - 4} rx={4} fill="#F1F5F9" stroke={INK.strong} strokeDasharray="3 2" />
      <ValueLabel x={box.x + box.width / 2} y={box.y + box.height / 2 + 3.5} text={name} fill={INK.muted} />
      <PinLabels def={def} dy={13} />
      <PinDots def={def} />
    </PartFrame>
  )
})

export { GenericPartRenderer }
