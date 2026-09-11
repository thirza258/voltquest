/** Learn cards for interface modules. */

export const levelShifterLearn = {
  summary:
    'A bidirectional logic level shifter translates signals between a 5 V side (HV) and a 3.3 V side (LV). Each channel has a pull-up to its own supply; pulling one side LOW pulls the other side LOW too, so a 5 V HIGH becomes a clean 3.3 V HIGH.',
  pinout: [
    'hv: 5 V reference (5V / VIN).  lv: 3.3 V reference (3V3).  gnd_h / gnd_l: GND (both).',
    'hv1–hv4: 5 V side of channels 1–4.  lv1–lv4: 3.3 V side of the same channels.',
  ],
  tips: [
    'Feed HV from VIN and LV from 3V3 on the ESP32 — both references are required for it to work.',
    'Sensor outputs (HC-SR04 echo) go into HVn; read LVn on the GPIO. MCU outputs go into LVn to drive 5 V inputs on HVn.',
    'Idle channels sit HIGH on both sides thanks to the 10 kΩ pull-ups.',
  ],
  formulas: ['V(LVn) = V(lv) when idle or HIGH; ≈ 0 V when either side is pulled LOW', 'Pull-ups: 10 kΩ per side'],
  pitfalls: ['Unpowered (hv or lv below 1 V): channels are open and nothing passes.', 'It shifts logic, not power — do not draw motor current through it.'],
}
