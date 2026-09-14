// Component renderers (package G2) — see docs/CONTRACTS.md §4.3 (types) and §10 (renderer props).
// Every renderer is React.memo'd and receives:
//   <Renderer comp def state peripheral control running powered selected ghost damaged burntPins board tone onControl interactive />
// It draws in local coordinates (pin i at dx·PITCH, dy·PITCH); the canvas mounts it at translate(O)·rotate(rot).
import { UnoRenderer, NanoRenderer, Esp32Renderer, Esp32S3Renderer } from './mcu.jsx'
import { ResistorRenderer, CapacitorRenderer, DiodeRenderer, TransistorNpnRenderer, LevelShifterRenderer } from './passives.jsx'
import { LedRenderer, RgbLedRenderer, SevenSegmentRenderer, NeopixelRingRenderer } from './leds.jsx'
import { PushbuttonRenderer, PotentiometerRenderer, LdrRenderer, TouchPadRenderer, PirRenderer } from './inputs.jsx'
import { UltrasonicRenderer, Dht22Renderer, Bme280Renderer } from './sensors.jsx'
import { Lcd16x2Renderer, OledRenderer } from './displays.jsx'
import { BuzzerRenderer, ServoRenderer, DcMotorRenderer, RelayRenderer } from './actuators.jsx'
import { GenericPartRenderer } from './Generic.jsx'
import { RaspberryPiRenderer } from './raspberrypi.jsx'
import { ExtraPartRenderer } from './extra.jsx'

/** Renderer component per component type (CONTRACTS §4.3 table). */
export const RENDERERS = Object.freeze({
  uno: UnoRenderer,
  nano: NanoRenderer,
  esp32: Esp32Renderer,
  esp32s3: Esp32S3Renderer,
  raspberrypi4: RaspberryPiRenderer,
  raspberrypi5: RaspberryPiRenderer,
  resistor: ResistorRenderer,
  led: LedRenderer,
  rgb_led: RgbLedRenderer,
  capacitor: CapacitorRenderer,
  diode: DiodeRenderer,
  transistor_npn: TransistorNpnRenderer,
  pushbutton: PushbuttonRenderer,
  potentiometer: PotentiometerRenderer,
  ldr: LdrRenderer,
  buzzer: BuzzerRenderer,
  servo: ServoRenderer,
  lcd16x2_i2c: Lcd16x2Renderer,
  oled_ssd1306: OledRenderer,
  seven_segment: SevenSegmentRenderer,
  neopixel_ring: NeopixelRingRenderer,
  ultrasonic_hcsr04: UltrasonicRenderer,
  pir: PirRenderer,
  dht22: Dht22Renderer,
  bme280: Bme280Renderer,
  touch_pad: TouchPadRenderer,
  level_shifter: LevelShifterRenderer,
  relay_5v: RelayRenderer,
  dc_motor: DcMotorRenderer,
  slide_switch: ExtraPartRenderer,
  reed_switch: ExtraPartRenderer,
  tilt_switch: ExtraPartRenderer,
  trimpot: ExtraPartRenderer,
  variable_resistor: ExtraPartRenderer,
  thermistor_ntc: ExtraPartRenderer,
  force_sensor: ExtraPartRenderer,
  flex_sensor: ExtraPartRenderer,
})

/** Renderer for a component type, or `null` when none exists (the canvas then falls back to GenericPartRenderer). */
export function getRenderer(type) {
  return RENDERERS[type] ?? null
}

export { GenericPartRenderer }
export { ESP32_BURNT_TITLE, AVR_BURNT_TITLE } from './mcu.jsx'
export { oledPixelPath } from './displays.jsx'
