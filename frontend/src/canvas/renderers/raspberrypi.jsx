import { getBoard } from '../../engine/boards/index.js'
import { PartFrame, PinDot, TEXT_CLASS, bodyBox, defineRenderer, footprintPins } from './common.jsx'

export const RaspberryPiRenderer = defineRenderer('RaspberryPiRenderer', function RaspberryPiRenderer(props) {
  const { comp, def, powered, burntPins } = props
  const board = getBoard(comp.type)
  const box = bodyBox(def)
  const pins = footprintPins(def)
  return <PartFrame {...props} ariaLabel={`${board.name}, GPIO teaching diagram, ${powered ? 'powered' : 'power off'}`}>
    <rect width={box.width} height={box.height} rx={16} fill="#2D7051" stroke="#14532D" strokeWidth={3} data-mcu-board={comp.type} />
    <rect x={32} y={12} width={492} height={49} rx={4} fill="#111827" />
    {pins.map((pin, index) => <g key={pin.id}>
      <PinDot id={pin.id} x={pin.x} y={pin.y} r={5} burnt={Boolean(burntPins?.[pin.id])} title={`Physical pin ${index + 1}: ${pin.label}${burntPins?.[pin.id] ? ' — damaged GPIO' : ''}`} />
      <text x={pin.x} y={index % 2 === 0 ? pin.y - 11 : pin.y + 23} textAnchor="middle" fontSize={10} fill="#F8FAFC" className={TEXT_CLASS} data-physical-pin={index + 1}>{index + 1}</text>
    </g>)}
    <text x={40} y={120} fontSize={16} fill="#D1FAE5" className={TEXT_CLASS}>40-pin header · BCM labels on hover</text>
    <rect x={100} y={165} width={180} height={150} rx={8} fill="#1F2937" stroke="#0F172A" strokeWidth={3} />
    <text x={190} y={245} textAnchor="middle" fontSize={24} fill="#F8FAFC" className={TEXT_CLASS}>SoC</text>
    <rect x={320} y={175} width={100} height={70} rx={4} fill="#1F2937" stroke="#0F172A" />
    <text x={370} y={216} textAnchor="middle" fontSize={15} fill="#F8FAFC" className={TEXT_CLASS}>RAM</text>
    {[130, 270, 410].map((position, index) => <g key={position}>
      <rect x={box.width - 110} y={position} width={116} height={100} rx={6} fill="#CBD5E1" stroke="#64748B" strokeWidth={3} />
      <text x={box.width - 55} y={position + 57} textAnchor="middle" fontSize={16} fill="#334155" className={TEXT_CLASS}>{index < 2 ? 'USB' : 'LAN'}</text>
    </g>)}
    <text x={60} y={380} fontSize={36} fontWeight={700} fill="#F8FAFC" className={TEXT_CLASS}>{board.name}</text>
    <text x={60} y={420} fontSize={18} fill="#D1FAE5" className={TEXT_CLASS}>3.3 V GPIO · Python learning model</text>
    <text x={60} y={453} fontSize={15} fill="#D1FAE5" className={TEXT_CLASS}>Simplified diagram, not a Linux emulator</text>
    <circle cx={60} cy={490} r={8} fill={powered ? '#FACC15' : '#365314'} data-power-led={powered ? 'on' : 'off'} />
    <text x={80} y={496} fontSize={15} fill="#F8FAFC" className={TEXT_CLASS}>POWER</text>
  </PartFrame>
})
