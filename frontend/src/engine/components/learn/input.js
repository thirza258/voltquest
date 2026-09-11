/** Learn cards for input parts and sensors. */

export const pushbuttonLearn = {
  summary:
    'A tactile pushbutton connects its two sides only while pressed. The legs come in two pairs that are always joined internally, so straddle the breadboard so that each pair sits in a different row.',
  pinout: ['a1 / a2: one side (always connected to each other).', 'b1 / b2: the other side, two rows over.', 'Pressed: a ↔ b closes with about 0.1 Ω.'],
  tips: [
    'Wire one side to GND and the other to a pin set to INPUT_PULLUP: reads HIGH released, LOW pressed.',
    'Without a pull-up or pull-down the released pin floats and flickers randomly.',
    'For a pull-down version: 10 kΩ from pin to GND, other side of the button to 5V — reads HIGH when pressed.',
  ],
  formulas: ['Pull-up: released V = Vcc (through ~35 kΩ), pressed V ≈ 0 V', 'Debounce: ignore changes within 20–50 ms'],
  pitfalls: ['Rotated so both pairs sit in the same strip, the button is permanently "pressed".', 'digitalRead on a floating pin gives random values — always add a pull.'],
}

export const potentiometerLearn = {
  summary:
    'A potentiometer is a resistor with a sliding contact (wiper). Between the ends it is always 10 kΩ; between an end and the wiper the resistance follows the knob. Wired end-to-end across the supply it becomes an adjustable voltage divider.',
  pinout: ['end1: to 5V (or 3V3 on the ESP32).', 'wiper: the middle pin — to an analog input.', 'end2: to GND.'],
  tips: [
    'analogRead(A0) then gives 0 at one end and 1023 (4095 on ESP32) at the other.',
    'map(value, 0, 1023, 0, 255) turns a knob position into a PWM level.',
    'Swap end1 and end2 to reverse the direction of the knob.',
  ],
  formulas: ['Vwiper = Vcc × position  (position 0..1)', 'Rend1–wiper = R × (1 − position), Rwiper–end2 = R × position'],
  pitfalls: ['On the ESP32 feed end1 from 3V3, not VIN — 5 V on the wiper burns the GPIO.', 'Wiring the wiper to a supply forces current through a tiny resistance at the knob\'s end.'],
}

export const ldrLearn = {
  summary:
    'A light-dependent resistor (photoresistor) has high resistance in the dark (~200 kΩ) and low in bright light (~1 kΩ). Pair it with a fixed 10 kΩ resistor to turn light into a voltage an analog pin can read.',
  pinout: ['p1 / p2: no polarity.', 'Spans 3 holes.'],
  tips: [
    'Divider: 5V → LDR → A0 → 10 kΩ → GND. Brighter light → lower LDR resistance → higher voltage at A0.',
    'Pick the fixed resistor near the LDR\'s mid-range (10 kΩ) for the most sensitive readings.',
    'Use the light slider on the part to test day/night thresholds without waiting for sunset.',
  ],
  formulas: ['R_ldr ≈ 200 kΩ × (1 kΩ / 200 kΩ)^(light / 100 %)   (logarithmic)', 'V_A0 = Vcc × R_fixed / (R_ldr + R_fixed)'],
  pitfalls: ['LDR straight into an input with no fixed resistor: the pin floats at Vcc regardless of light.'],
}

export const touchPadLearn = {
  summary:
    'A touch pad is just a piece of metal or copper tape wired to an ESP32 touch pin. touchRead() measures the pad\'s capacitance: it drops from about 70 to around 15 when a finger is on it.',
  pinout: ['pad: wire to a touch-capable GPIO (T0 = GPIO4, T2 = GPIO2 …).'],
  tips: ['if (touchRead(T0) < 40) — a threshold halfway between idle (~70) and touched (~15).', 'Only ESP32 boards have touch hardware; on an Uno the pad does nothing.'],
  formulas: ['idle ≈ 70, touched ≈ 15 (lower = more capacitance)'],
  pitfalls: ['Long wires and nearby metal raise the idle reading — calibrate at startup instead of hard-coding.'],
}

export const pirLearn = {
  summary:
    'A PIR motion sensor watches for moving body heat and raises its OUT pin to 3.3 V while motion is detected. It has its own regulator, so it wants 5 V power but is safe for 3.3 V inputs.',
  pinout: ['vcc: 5V / VIN (≥ 4.5 V).', 'out: 3.3 V HIGH on motion — to any digital input.', 'gnd: GND.'],
  tips: ['pinMode(pin, INPUT); if (digitalRead(pin) == HIGH) — no pull-up needed.', 'Real sensors hold OUT high for a few seconds after motion; toggle the "motion" switch here to test.'],
  formulas: ['OUT = 3.3 V when motion, 0 V otherwise (through ~50 Ω)'],
  pitfalls: ['Powered from 3V3 the module is unpowered and OUT stays low forever.'],
}

export const dht22Learn = {
  summary:
    'The DHT22 measures temperature (−40…80 °C) and humidity (0…100 %) and reports them over a single data wire using its own timing protocol. The DHT library does the decoding.',
  pinout: ['vcc: 3V3 or 5V (≥ 3 V).', 'data: to any digital pin (a 10 kΩ pull-up to VCC is built into most modules).', 'gnd: GND.'],
  tips: [
    'DHT dht(PIN, DHT22); dht.begin(); float t = dht.readTemperature(); float h = dht.readHumidity();',
    'Readings take up to 2 s each — do not poll faster than every 2000 ms.',
    'Drag the temperature/humidity sliders to simulate a warm, humid afternoon.',
  ],
  formulas: ['Heat index and dew point are computed by the library from t and h', 'Data line idles HIGH at VCC; unpowered → readings are NaN'],
  pitfalls: ['isnan(t) is how you detect a missing sensor — check it before printing.'],
}

export const bme280Learn = {
  summary:
    'The BME280 is a precise environmental sensor: temperature, barometric pressure and humidity over I2C. Pressure lets you estimate altitude and spot weather changes.',
  pinout: ['vin: 3V3 or 5V (≥ 3 V; the module regulates).', 'gnd: GND.', 'scl: I2C clock (A5 / GPIO22).', 'sda: I2C data (A4 / GPIO21).'],
  tips: [
    'Adafruit_BME280 bme; if (!bme.begin(0x76)) Serial.println("no sensor");',
    'bme.readTemperature(), bme.readPressure() / 100.0F (hPa), bme.readHumidity().',
    'Publish readings over MQTT every few seconds for a weather station.',
  ],
  formulas: ['Altitude ≈ 44330 × (1 − (P / 1013.25 hPa)^0.1903) metres', 'I2C address 0x76 (0x77 alternative)'],
  pitfalls: ['begin() returns false with the wrong address or swapped SDA/SCL.'],
}

export const ultrasonicLearn = {
  summary:
    'The HC-SR04 measures distance with sound: pulse TRIG for 10 µs, and ECHO goes HIGH for as long as the ping takes to bounce back. It runs on 5 V, so its 5 V ECHO must be divided down for an ESP32.',
  pinout: ['vcc: 5V / VIN (≥ 4.5 V).', 'trig: any digital output.', 'echo: 5 V pulse output — safe for an Uno, needs a divider or level shifter for an ESP32.', 'gnd: GND.'],
  tips: [
    'digitalWrite(TRIG, HIGH); delayMicroseconds(10); digitalWrite(TRIG, LOW); long us = pulseIn(ECHO, HIGH);',
    'Distance in cm = us / 58.3 (sound travels there and back at 343 m/s).',
    'ESP32: ECHO → 1 kΩ → GPIO, GPIO → 2.2 kΩ → GND gives 5 V × 2.2 / 3.2 = 3.44 V.',
  ],
  formulas: ['distance_cm = echo_µs / 58.3', 'echo_µs = distance_cm × 58.3   (50 cm → 2915 µs)', 'Divider: Vout = 5 V × R2 / (R1 + R2)'],
  pitfalls: ['ECHO straight into an ESP32 GPIO burns the pin (5 V > 3.6 V).', 'A 10 kΩ / 1 kΩ divider is the wrong way round: 0.45 V never reads HIGH.'],
}
