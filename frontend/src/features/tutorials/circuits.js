import { makeDoc, place, wire } from '../../engine/components/seeds.js'
import { getBoard } from '../../engine/boards/index.js'
import { resolvePins } from '../../engine/components/registry.js'
import { findBreadboard, holesInStrip, stripOf } from '../../engine/components/breadboard.js'

export function tutorialCode(tutorial, boardId) {
  return tutorial.codeOverrides?.[boardId] ?? tutorial.code
}

function allocateCableHoles(doc) {
  const terminals = new Map(doc.components.flatMap((component) => Object.entries(resolvePins(component, doc).pins).map(([pin, position]) => [`${component.id}:${pin}`, position])))
  const occupied = new Set([...terminals.values()].map((position) => position.hole).filter(Boolean))
  function endpoint(terminal) {
    const position = terminals.get(terminal)
    if (!position?.hole) return terminal
    const [boardId, hole] = position.hole.split(':')
    const breadboard = findBreadboard(doc, boardId)
    const free = holesInStrip(breadboard.type, stripOf(breadboard.type, hole)).find((candidate) => !occupied.has(`${boardId}:${candidate.name}`))
    if (!free) throw new Error(`No free cable hole beside ${terminal}`)
    const cableHole = `${boardId}:${free.name}`
    occupied.add(cableHole)
    return cableHole
  }
  doc.wires = doc.wires.map((cable) => ({ ...cable, from: endpoint(cable.from), to: endpoint(cable.to) }))
  return doc
}

export function tutorialCircuit(tutorial, boardId) {
  const board = getBoard(boardId)
  const doc = makeDoc({ mcu: boardId, boardMode: board.family === 'esp32' ? 'dual' : 'half', name: tutorial.title })
  const controller = `c_${boardId}`
  const output = board.family === 'avr' ? 'D9' : board.family === 'raspberrypi' ? 'GPIO17' : 'GPIO18'
  const input = board.family === 'avr' ? 'D2' : board.family === 'raspberrypi' ? 'GPIO27' : 'GPIO4'
  const power = `${controller}:${board.vcc === 5 ? '5V' : '3V3'}`
  const ground = `${controller}:GND`
  const controlBoard = board.family === 'esp32' ? 'bb2' : 'bb1'
  let wireIndex = 0
  const connect = (from, to, color = 'green') => wire(doc, from, to, color, `w_tut${String(wireIndex++).padStart(3, '0')}`)

  function led(pin, row, column, color, suffix) {
    const resistor = place(doc, 'resistor', 'bb1', `${column}${row}`, { ohms: 220 }, 0, `c_resistor${suffix}`)
    const light = place(doc, 'led', 'bb1', `${column}${row + 5}`, { color }, 0, `c_led${suffix}`)
    connect(`${controller}:${pin}`, `${resistor}:p1`)
    connect(`${resistor}:p2`, `${light}:anode`)
    connect(`${light}:cathode`, ground, 'black')
  }

  if (['led', 'button', 'pot', 'touch'].includes(tutorial.preset)) led(output, 20, 'a', 'red', '')
  if (tutorial.preset === 'traffic') {
    led('GPIO17', 20, 'a', 'red', 'red')
    led('GPIO22', 20, 'f', 'yellow', 'amber')
    led('GPIO27', 5, 'a', 'green', 'green')
  }
  if (tutorial.preset === 'button') {
    const button = place(doc, 'pushbutton', controlBoard, 'f20', {}, 0, 'c_button')
    connect(`${controller}:${input}`, `${button}:a1`)
    connect(`${button}:b1`, ground, 'black')
  }
  if (tutorial.preset === 'pot') {
    const pot = place(doc, 'potentiometer', controlBoard, 'f20', {}, 0, 'c_pot')
    connect(`${pot}:end1`, ground, 'black')
    connect(`${pot}:end2`, power, 'red')
    connect(`${pot}:wiper`, `${controller}:${board.family === 'avr' ? 'A0' : boardId === 'esp32s3' ? 'GPIO4' : 'GPIO34'}`)
  }
  if (tutorial.preset === 'touch') {
    const pad = place(doc, 'touch_pad', controlBoard, 'f20', {}, 0, 'c_touch')
    connect(`${pad}:pad`, `${controller}:GPIO4`)
  }
  if (tutorial.preset === 'servo') {
    const servo = place(doc, 'servo', 'bb1', 'f20', {}, 0, 'c_servo')
    connect(`${servo}:signal`, `${controller}:D9`)
    connect(`${servo}:vcc`, power, 'red')
    connect(`${servo}:gnd`, ground, 'black')
  }
  if (tutorial.preset === 'lcd') {
    const display = place(doc, 'lcd16x2_i2c', 'bb1', 'f20', {}, 0, 'c_lcd')
    connect(`${display}:vcc`, power, 'red')
    connect(`${display}:gnd`, ground, 'black')
    connect(`${display}:sda`, `${controller}:${board.i2c.sda}`)
    connect(`${display}:scl`, `${controller}:${board.i2c.scl}`, 'yellow')
  }
  if (tutorial.preset === 'dht') {
    const sensor = place(doc, 'dht22', controlBoard, 'f20', {}, 0, 'c_dht')
    connect(`${sensor}:vcc`, power, 'red')
    connect(`${sensor}:gnd`, ground, 'black')
    connect(`${sensor}:data`, `${controller}:${boardId === 'esp32s3' ? 'GPIO16' : 'GPIO23'}`)
  }
  return allocateCableHoles(doc)
}
