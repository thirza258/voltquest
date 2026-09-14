import { useI18n } from '../../i18n/index.jsx'
import { PartFrame, PinDots, Lead, SensorPanel, ToggleChip, defineRenderer, PITCH } from './common.jsx'

/** Additional controls use the same callbacks in editable and read-only circuit previews. */
export const ExtraPartRenderer = defineRenderer('ExtraPartRenderer', function ExtraPartRenderer({ comp, def, control, selected, ghost, damaged, onControl, interactive = true }) {
  const { t } = useI18n()
  const spec = def.control
  const value = control?.[spec.field] ?? spec.default ?? false
  const width = (def.footprint.width - 1) * PITCH
  const cx = width / 2
  const enabled = interactive && !ghost && !!onControl
  const contact = spec.kind === 'toggle'
  const color = comp.type === 'thermistor_ntc' ? '#a16207' : comp.type === 'flex_sensor' ? '#b88746' : comp.type === 'force_sensor' ? '#334155' : comp.type === 'trimpot' ? '#2563eb' : '#0f766e'
  return <PartFrame comp={comp} def={def} selected={selected} ghost={ghost} damaged={damaged}>
    <Lead from={{ x: 0, y: 0 }} to={{ x: cx - 10, y: -15 }} />
    <Lead from={{ x: width, y: 0 }} to={{ x: cx + 10, y: -15 }} />
    {contact ? <>
      <rect x={cx - 22} y={-29} width={44} height={24} rx={comp.type === 'reed_switch' ? 11 : 3} fill={comp.type === 'reed_switch' ? '#ccfbf1' : '#e2e8f0'} stroke="#64748b" />
      {comp.type === 'reed_switch' ? <path d={`M${cx - 18},-17 h16 l7,${value ? 0 : -6} M${cx + 6},-17 h12`} fill="none" stroke={value ? '#0d9488' : '#64748b'} strokeWidth="3" /> : <rect x={cx + (value ? 3 : -16)} y={-26} width={13} height={18} rx="2" fill={value ? '#0d9488' : '#334155'} />}
    </> : comp.type === 'variable_resistor' ? <>
      <rect x={cx - 24} y={-25} width={48} height={18} rx="7" fill="#e7cb99" stroke="#a16207" />
      <path d={`M${cx - 18},-4 l36,-26 m-8,0 h8 v8`} fill="none" stroke="#475569" strokeWidth="2" />
    </> : comp.type === 'flex_sensor' ? <path d={`M${cx - 5},-6 v-22 q${Number(value) / 4},-10 ${Number(value) / 4},-32 h10 q0,26 -10,36 v18 Z`} fill={color} stroke="#92400e" /> : <>
      <circle cx={cx} cy={-19} r={15} fill={color} stroke="#475569" />
      <text x={cx} y={-16} textAnchor="middle" fill="#fff" fontSize="8">{comp.type === 'thermistor_ntc' ? 'NTC' : comp.type === 'force_sensor' ? 'FSR' : '↗'}</text>
    </>}
    {selected && (contact ? <ToggleChip x={cx} y={-46} width={112} label={t(spec.label)} pressed={!!value} disabled={!enabled} onToggle={next => onControl?.({ [spec.field]: next })} /> : <SensorPanel x={cx - 66} y={-100} rows={[{ key: spec.field, label: t(spec.label), value, min: spec.min, max: spec.max, step: spec.step ?? 0.01, unit: spec.unit }]} disabled={!enabled} onChange={(field, next) => onControl?.({ [field]: next })} />)}
    <PinDots def={def} />
  </PartFrame>
})
