/** Interface modules. */
import { ESP_BOARDS, footprint, pin } from './shared.js'
import { levelShifterLearn } from '../learn/module.js'

export const level_shifter = {
  type: 'level_shifter',
  name: 'Logic level shifter',
  category: 'module',
  mount: 'board',
  recommendedBoards: ESP_BOARDS,
  footprint: footprint(
    [
      pin('hv', 0, 0, 'HV'),
      pin('hv1', 1, 0, 'HV1'),
      pin('hv2', 2, 0, 'HV2'),
      pin('hv3', 3, 0, 'HV3'),
      pin('hv4', 4, 0, 'HV4'),
      pin('gnd_h', 5, 0, 'GND'),
      pin('lv', 0, 3, 'LV'),
      pin('lv1', 1, 3, 'LV1'),
      pin('lv2', 2, 3, 'LV2'),
      pin('lv3', 3, 3, 'LV3'),
      pin('lv4', 4, 3, 'LV4'),
      pin('gnd_l', 5, 3, 'GND'),
    ],
    6,
    4,
  ),
  props: {},
  model: [
    {
      kind: 'level_shifter',
      pins: { hv: 'hv', lv: 'lv', gnd_h: 'gnd_h', gnd_l: 'gnd_l' },
      channels: [
        ['hv1', 'lv1'],
        ['hv2', 'lv2'],
        ['hv3', 'lv3'],
        ['hv4', 'lv4'],
      ],
    },
  ],
  control: null,
  peripheral: null,
  learn: levelShifterLearn,
  bom: { partName: 'Bidirectional logic level shifter, 4 channel', catalogId: 'level_shifter' },
}

export const MODULE_DEFS = [level_shifter]
