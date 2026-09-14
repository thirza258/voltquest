import { ALL_BOARDS, footprint, pin, slider } from './shared.js'
import { potentiometer } from './input.js'

const pullTip = 'Connect one contact to GND and the other to a digital input with INPUT_PULLUP. Closed reads LOW; open reads HIGH.'
const pullPitfall = 'An open switch needs a pull-up or pull-down. These ideal contacts do not simulate mechanical bounce.'
function contact(type, name, field, label, summary, width = 3) {
  return { type, name, category: 'input', mount: 'board', recommendedBoards: ALL_BOARDS,
    footprint: footprint([pin('p1', 0), pin('p2', width - 1)], width, 1), props: {},
    model: [{ kind: 'switch', pins: { a: 'p1', b: 'p2' }, closedWhen: { control: field }, rOn: 0.1 }],
    control: { kind: 'toggle', field, label, default: false }, peripheral: null,
    learn: { summary, pinout: ['p1 / p2: two contacts, no polarity.'], tips: [pullTip], pitfalls: [pullPitfall] },
    bom: { partName: name, catalogId: type },
  }
}
export const slide_switch = contact('slide_switch', 'Slide switch (SPST)', 'closed', 'Switch closed', 'A latching slide switch keeps its two contacts connected until you slide it back. Use it for a persistent on/off input.')
export const reed_switch = contact('reed_switch', 'Magnetic reed switch', 'magnetNear', 'Magnet nearby', 'A normally open reed switch closes when a magnet is nearby. Toggle the magnet control to test a door or lid sensor.', 5)
export const tilt_switch = contact('tilt_switch', 'Tilt switch', 'tilted', 'Tilted closed', 'A ball tilt switch closes its contacts in one orientation. The tilt control selects open or closed; it is not an angle sensor.')

export const trimpot = { ...potentiometer, type: 'trimpot', name: 'Trimpot',
  control: { ...potentiometer.control, label: 'Adjustment' },
  learn: { summary: 'A trimpot is a small adjustable voltage divider for calibration. Set the adjustment to choose the wiper voltage.',
    pinout: potentiometer.learn.pinout,
    tips: ['Connect end1 to the supply, end2 to GND, and wiper to an analog input. Adjustment 0 gives GND; adjustment 1 gives the supply voltage.'],
    formulas: ['Vwiper = Vcc × adjustment'], pitfalls: ['Use 3V3 for ESP32 analog inputs. Raspberry Pi has no built-in analog input.'] },
  bom: { partName: 'Trimpot', catalogId: 'trimpot' },
}

function resistive(type, name, control, curve, summary, tip, formula) {
  return { type, name, category: 'input', mount: 'board', recommendedBoards: ALL_BOARDS,
    footprint: footprint([pin('p1', 0), pin('p2', 2)], 3, 1), props: {},
    model: [{ kind: 'resistor', pins: { a: 'p1', b: 'p2' }, ohms: { fromControl: control.field, curve } }],
    control, peripheral: null,
    learn: { summary, pinout: ['p1 / p2: resistive element, no polarity.'], tips: [tip, 'Select the part to change its stimulus in the inspector while the simulation runs.'],
      formulas: [formula, 'Divider: Vout = Vcc × Rfixed / (Rsensor + Rfixed)'],
      pitfalls: ['Use a fixed resistor to form a voltage divider. ESP32 analog inputs need a 3V3 supply; Raspberry Pi needs an external ADC, which this part does not provide.', 'Sensor response is a teaching approximation, not a calibrated hardware measurement.'] },
    bom: { partName: name, catalogId: type },
  }
}
export const thermistor_ntc = resistive('thermistor_ntc', 'NTC thermistor (10 kΩ)', slider('temperatureC', 'Temperature', -20, 100, 25, { step: 1, unit: '°C' }), 'ntc',
  'An NTC thermistor loses resistance as it warms. This nominal 10 kΩ sensor uses a beta of 3950 K and reads 10 kΩ at 25 °C.',
  'Connect supply → thermistor → analog input → 10 kΩ resistor → GND. Warming the sensor raises the input voltage.', 'R = 10000 × exp(3950 × (1 / (T°C + 273.15) − 1 / 298.15))')
export const force_sensor = resistive('force_sensor', 'Force-sensitive resistor', slider('forcePercent', 'Applied force', 0, 100, 0, { unit: '%' }), 'force',
  'A force-sensitive resistor falls from 1 MΩ unloaded to about 1 kΩ at maximum pressure in this teaching model.',
  'Connect supply → force sensor → analog input → 10 kΩ resistor → GND. More force raises the input voltage.', 'R = 1000000 / (1 + 999 × force / 100)')
export const flex_sensor = resistive('flex_sensor', 'Flex sensor', slider('bendDegrees', 'Bend angle', 0, 90, 0, { unit: '°' }), 'flex',
  'A flex sensor increases resistance as it bends. This linear teaching model goes from 10 kΩ flat to 30 kΩ at 90 degrees.',
  'Connect supply → flex sensor → analog input → 10 kΩ resistor → GND. More bending lowers the input voltage.', 'R = 10000 + 20000 × bend / 90')
export const variable_resistor = { ...resistive('variable_resistor', 'Adjustable resistor', slider('resistanceOhms', 'Resistance', 100, 100000, 10000, { step: 100, unit: 'Ω' }), 'linear',
  'A two-terminal adjustable resistor lets you vary resistance from 100 Ω to 100 kΩ while the circuit runs.',
  'Put it in series with an LED to observe how resistance changes current, or use it in a voltage divider.', 'I = V / R'), category: 'passive',
  footprint: footprint([pin('p1', 0), pin('p2', 4)], 5, 1),
  learn: { summary: 'A two-terminal adjustable resistor lets you vary resistance from 100 Ω to 100 kΩ while the circuit runs.', pinout: ['p1 / p2: no polarity.'],
    tips: ['Start with a high resistance, then reduce it while watching current in the inspector.'], formulas: ['I = V / R'],
    pitfalls: ['Small resistance can overdrive an LED or GPIO. This part does not automatically limit current to a safe value.'] },
}
export const EXTRA_DEFS = [slide_switch, reed_switch, tilt_switch, trimpot, thermistor_ntc, force_sensor, flex_sensor, variable_resistor]
