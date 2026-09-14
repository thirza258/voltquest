/** Ordered list of every component definition (drawer order: mcu, passive, output, input, module). */
import { MCU_DEFS } from './mcu.js'
import { PASSIVE_DEFS } from './passive.js'
import { OUTPUT_DEFS } from './output.js'
import { INPUT_DEFS } from './input.js'
import { MODULE_DEFS } from './module.js'
import { EXTRA_DEFS } from './extra.js'
import { DRONE_DEFS } from '../../drone/document.js'

export const ALL_DEFS = [...MCU_DEFS, ...PASSIVE_DEFS, ...OUTPUT_DEFS, ...INPUT_DEFS, ...EXTRA_DEFS, ...MODULE_DEFS, ...DRONE_DEFS]
