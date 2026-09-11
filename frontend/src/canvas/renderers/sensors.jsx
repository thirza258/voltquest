import { INK, Lead, PITCH, PartFrame, PinDots, PinLabels, SensorPanel, TEXT_CLASS, clamp, defineRenderer, pinPoint, sensorPanelHeight } from './common.jsx'

/** Frame box that spans the module PCB (above the pins) and the optional sensor panel above it. */
function moduleBox(def, firstPin, lastPin, boardTop, panelHeight) {
  const a = pinPoint(def, firstPin)
  const b = pinPoint(def, lastPin)
  const top = boardTop - (panelHeight ? panelHeight + 6 : 0)
  const width = Math.max(b.x - a.x + PITCH, 148)
  return { x: Math.min(a.x - PITCH / 2, (a.x + b.x) / 2 - width / 2), y: top, width, height: PITCH / 2 - top }
}

/** Reads a control value with a fallback to the slider default, clamped to its range. */
function controlValue(control, key, fallback, min, max) {
  return clamp(control?.[key] ?? fallback, min, max)
}

/** HC-SR04 ultrasonic ranger: two transducers; distance slider when selected or running. */
const UltrasonicRenderer = defineRenderer('UltrasonicRenderer', function UltrasonicRenderer({ comp, def, control, selected, ghost, damaged, running, onControl, interactive = true }) {
  const vcc = pinPoint(def, 'vcc')
  const gnd = pinPoint(def, 'gnd')
  const cx = (vcc.x + gnd.x) / 2
  const boardTop = -PITCH / 2 - 42
  const showPanel = selected || running
  const panelH = sensorPanelHeight(1)
  const distance = controlValue(control, 'distanceCm', 50, 2, 400)
  const enabled = interactive && !ghost && typeof onControl === 'function'
  const box = moduleBox(def, 'vcc', 'gnd', boardTop, showPanel ? panelH : 0)
  return (
    <PartFrame comp={comp} def={def} selected={selected} ghost={ghost} damaged={damaged} box={box} ariaLabel={`Ultrasonic sensor, ${Math.round(distance)} cm`}>
      {['vcc', 'trig', 'echo', 'gnd'].map((id) => (
        <Lead key={id} from={pinPoint(def, id)} to={{ x: pinPoint(def, id).x, y: -6 }} />
      ))}
      <rect x={vcc.x - PITCH / 2} y={boardTop} width={gnd.x - vcc.x + PITCH} height={-6 - boardTop} rx={3} fill="#1D4ED8" stroke="#1E3A8A" />
      {[vcc.x + 8, gnd.x - 8].map((tx) => (
        <g key={tx}>
          <circle cx={tx} cy={boardTop + 20} r={15} fill="#CBD5E1" stroke="#64748B" />
          <circle cx={tx} cy={boardTop + 20} r={10} fill="#94A3B8" />
          <circle cx={tx} cy={boardTop + 20} r={4} fill="#64748B" />
        </g>
      ))}
      <rect x={cx - 7} y={boardTop + 8} width={14} height={6} rx={2} fill="#E2E8F0" />
      <text x={cx} y={boardTop + 33} textAnchor="middle" fontSize={7} fontWeight={600} fill="#DBEAFE" className={TEXT_CLASS} aria-hidden="true">
        HC-SR04
      </text>
      {showPanel ? (
        <SensorPanel
          x={cx - 66}
          y={boardTop - panelH - 6}
          rows={[{ key: 'distanceCm', label: 'Distance', value: distance, min: 2, max: 400, step: 1, unit: 'cm' }]}
          disabled={!enabled}
          onChange={(key, v) => onControl?.({ [key]: v })}
        />
      ) : null}
      <PinLabels def={def} dy={13} labels={{ vcc: 'VCC', trig: 'TRIG', echo: 'ECHO', gnd: 'GND' }} />
      <PinDots def={def} />
    </PartFrame>
  )
})

/** DHT22 temperature/humidity sensor: white vented case with live readouts and sliders. */
const Dht22Renderer = defineRenderer('Dht22Renderer', function Dht22Renderer({ comp, def, control, selected, ghost, damaged, running, onControl, interactive = true }) {
  const vcc = pinPoint(def, 'vcc')
  const gnd = pinPoint(def, 'gnd')
  const cx = (vcc.x + gnd.x) / 2
  const boardTop = -PITCH / 2 - 50
  const showPanel = selected || running
  const panelH = sensorPanelHeight(2)
  const temperature = controlValue(control, 'temperatureC', 24.5, -10, 50)
  const humidity = controlValue(control, 'humidity', 55, 0, 100)
  const enabled = interactive && !ghost && typeof onControl === 'function'
  const box = moduleBox(def, 'vcc', 'gnd', boardTop, showPanel ? panelH : 0)
  const caseX = vcc.x - 8
  const caseW = gnd.x - vcc.x + 16
  return (
    <PartFrame comp={comp} def={def} selected={selected} ghost={ghost} damaged={damaged} box={box} ariaLabel={`DHT22 sensor, ${temperature.toFixed(1)} °C, ${Math.round(humidity)} % humidity`}>
      {['vcc', 'data', 'gnd'].map((id) => (
        <Lead key={id} from={pinPoint(def, id)} to={{ x: pinPoint(def, id).x, y: -6 }} />
      ))}
      <rect x={caseX} y={boardTop} width={caseW} height={-6 - boardTop} rx={4} fill="#F8FAFC" stroke="#CBD5E1" />
      {[0, 1, 2].map((row) =>
        [0, 1, 2, 3].map((col) => (
          <rect key={`${row}-${col}`} x={caseX + 8 + col * ((caseW - 16) / 4)} y={boardTop + 6 + row * 9} width={(caseW - 16) / 4 - 3} height={5} rx={1} fill="#E2E8F0" />
        )),
      )}
      {showPanel ? (
        <g aria-hidden="true">
          <text x={cx} y={boardTop + 42} textAnchor="middle" fontSize={8} fontWeight={600} fill={INK.secondary} className={`${TEXT_CLASS} tabular-nums`}>
            {temperature.toFixed(1)} °C · {Math.round(humidity)} %
          </text>
        </g>
      ) : (
        <text x={cx} y={boardTop + 42} textAnchor="middle" fontSize={7} fill={INK.muted} className={TEXT_CLASS} aria-hidden="true">
          DHT22
        </text>
      )}
      {showPanel ? (
        <SensorPanel
          x={cx - 66}
          y={boardTop - panelH - 6}
          rows={[
            { key: 'temperatureC', label: 'Temperature', value: temperature, min: -10, max: 50, step: 0.5, unit: '°C' },
            { key: 'humidity', label: 'Humidity', value: humidity, min: 0, max: 100, step: 1, unit: '%' },
          ]}
          disabled={!enabled}
          onChange={(key, v) => onControl?.({ [key]: v })}
        />
      ) : null}
      <PinLabels def={def} dy={13} labels={{ vcc: 'VCC', data: 'DATA', gnd: 'GND' }} />
      <PinDots def={def} />
    </PartFrame>
  )
})

/** BME280 I2C environmental sensor breakout (purple PCB) with temperature / pressure / humidity sliders. */
const Bme280Renderer = defineRenderer('Bme280Renderer', function Bme280Renderer({ comp, def, control, selected, ghost, damaged, running, onControl, interactive = true }) {
  const vin = pinPoint(def, 'vin')
  const sda = pinPoint(def, 'sda')
  const cx = (vin.x + sda.x) / 2
  const boardTop = -PITCH / 2 - 30
  const showPanel = selected || running
  const panelH = sensorPanelHeight(3)
  const temperature = controlValue(control, 'temperatureC', 24.5, -10, 50)
  const pressure = controlValue(control, 'pressureHpa', 1013, 950, 1050)
  const humidity = controlValue(control, 'humidity', 55, 0, 100)
  const addr = comp?.props?.addr ?? def?.props?.addr?.default ?? 0x76
  const enabled = interactive && !ghost && typeof onControl === 'function'
  const box = moduleBox(def, 'vin', 'sda', boardTop, showPanel ? panelH : 0)
  return (
    <PartFrame comp={comp} def={def} selected={selected} ghost={ghost} damaged={damaged} box={box} ariaLabel={`BME280 sensor, ${temperature.toFixed(1)} °C, ${Math.round(pressure)} hPa, ${Math.round(humidity)} %`}>
      {['vin', 'gnd', 'scl', 'sda'].map((id) => (
        <Lead key={id} from={pinPoint(def, id)} to={{ x: pinPoint(def, id).x, y: -6 }} />
      ))}
      <rect x={vin.x - PITCH / 2} y={boardTop} width={sda.x - vin.x + PITCH} height={-6 - boardTop} rx={3} fill="#6D28D9" stroke="#4C1D95" />
      <rect x={cx - 6} y={boardTop + 7} width={12} height={12} rx={1.5} fill="#CBD5E1" stroke="#64748B" />
      <circle cx={cx + 2} cy={boardTop + 11} r={1.5} fill="#475569" />
      <text x={cx} y={boardTop + 28} textAnchor="middle" fontSize={7} fontWeight={600} fill="#EDE9FE" className={TEXT_CLASS} aria-hidden="true">
        BME280 · 0x{Number(addr).toString(16).toUpperCase()}
      </text>
      {showPanel ? (
        <SensorPanel
          x={cx - 66}
          y={boardTop - panelH - 6}
          rows={[
            { key: 'temperatureC', label: 'Temperature', value: temperature, min: -10, max: 50, step: 0.5, unit: '°C' },
            { key: 'pressureHpa', label: 'Pressure', value: pressure, min: 950, max: 1050, step: 1, unit: 'hPa' },
            { key: 'humidity', label: 'Humidity', value: humidity, min: 0, max: 100, step: 1, unit: '%' },
          ]}
          disabled={!enabled}
          onChange={(key, v) => onControl?.({ [key]: v })}
        />
      ) : null}
      <PinLabels def={def} dy={13} labels={{ vin: 'VIN', gnd: 'GND', scl: 'SCL', sda: 'SDA' }} />
      <PinDots def={def} />
    </PartFrame>
  )
})

export { UltrasonicRenderer, Dht22Renderer, Bme280Renderer }
