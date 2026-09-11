/** Learn cards for the MCU boards (beginner tone; the board `notes` carry the deeper facts). */

export const unoLearn = {
  summary:
    'The Arduino Uno is the classic 5 V microcontroller board. Your sketch runs setup() once, then loop() forever, and each pin becomes an output (drives 0 V or 5 V) or an input (reads a voltage) depending on pinMode().',
  pinout: [
    'D0–D13: digital I/O. D13 also drives the built-in LED (LED_BUILTIN).',
    '~D3, ~D5, ~D6, ~D9, ~D10, ~D11: PWM-capable — analogWrite(pin, 0..255).',
    'A0–A5: analog inputs (0–5 V → 0–1023); usable as digital pins 14–19. A4 = SDA, A5 = SCL.',
    '5V / 3V3 / VIN: supply pins. GND ×3: all the same ground.',
    'D0 (RX) / D1 (TX): the USB serial link — avoid them for your circuits.',
  ],
  tips: [
    'Always connect a GND pin to the breadboard\'s − rail first; every circuit needs a return path.',
    'Power the + rail from 5V for LEDs and modules; use 3V3 only for parts that say so.',
    'A pin can only supply about 40 mA. Put a 220 Ω resistor in series with every LED.',
    'Set pinMode(pin, INPUT_PULLUP) for buttons and wire the button to GND — no extra resistor needed.',
  ],
  formulas: [
    'analogRead value = Vin / 5 V × 1023',
    'LED current I = (5 V − Vf) / (R + 25 Ω)   (25 Ω is the pin\'s own output resistance)',
  ],
  pitfalls: [
    'int is 16-bit: 40 × 1000 overflows to −25536. Use long or unsigned long for millis() math.',
    'Shorting 5V to GND trips the USB supply — nothing lights up and everything gets warm.',
  ],
}

export const nanoLearn = {
  summary:
    'The Arduino Nano is the Uno\'s little sibling: the same chip, the same 5 V pins and sketches, on a board that plugs straight into the breadboard.',
  pinout: [
    'Top row (D13, 3V3, AREF, A0–A7, 5V, RST, GND, VIN) and bottom row (D12–D2, GND, RST, RX0, TX1) straddle the breadboard gap.',
    'D13 drives the built-in LED; ~D3, ~D5, ~D6, ~D9, ~D10, ~D11 are PWM pins.',
    'A0–A5 are analog + digital; A6 and A7 are analog-input only.',
    'A4 = SDA and A5 = SCL for I2C displays and sensors.',
  ],
  tips: [
    'Place the Nano with its top row in column b — the bottom row then lands in column f, leaving a–a and g–j free for wires.',
    'Each Nano pin gets its own 5-hole row strip, so wire parts to the strip rather than trying to reach the pin itself.',
    'Use the two GND pins to feed both − rails so wiring stays short.',
  ],
  formulas: ['analogRead value = Vin / 5 V × 1023', 'LED current I = (5 V − Vf) / (R + 25 Ω)'],
  pitfalls: ['Rotating the Nano 90° never fits: the 15-pin rows are longer than the breadboard is tall.'],
}

export const esp32Learn = {
  summary:
    'The ESP32 DevKit V1 is a 3.3 V, 32-bit microcontroller with built-in WiFi. It is far faster than an Uno and adds touch sensing, a 12-bit ADC and two DACs — but its pins are NOT 5 V tolerant.',
  pinout: [
    'GPIOn pins: any of them can be a digital input/output and PWM output (ledcWrite / analogWrite).',
    'GPIO34, 35, 36 (VP) and 39 (VN): input-only, ADC1 — the best pins for analog sensors when WiFi is on.',
    'T0 = GPIO4, T2 = GPIO2, T3 = GPIO15, T4 = GPIO13, T5 = GPIO12, T6 = GPIO14, T7 = GPIO27, T8 = GPIO33, T9 = GPIO32: touch pads.',
    'GPIO25 / GPIO26: 8-bit DAC outputs. GPIO21 = SDA, GPIO22 = SCL. GPIO2 = built-in LED.',
    'VIN: 5 V from USB for 5 V modules. 3V3: the 3.3 V logic supply. GND ×2.',
  ],
  tips: [
    'Anchor the board at column a (row 1): the pins land in a and i, leaving row j free below. Dual-board mode exposes rows on both sides.',
    'LEDs still need a resistor, but current is lower at 3.3 V: 220 Ω with a red LED gives about 6 mA.',
    'For a 5 V sensor output (HC-SR04 echo), use a 1 kΩ / 2.2 kΩ divider or a level shifter before the GPIO.',
    'Read pots and LDRs on ADC1 pins (GPIO32–39); ADC2 pins return 0 while WiFi is connected.',
  ],
  formulas: [
    'analogRead value = Vin / 3.3 V × 4095',
    'Divider output Vout = Vin × R2 / (R1 + R2)   →   5 V × 2.2 k / 3.2 k = 3.44 V',
  ],
  pitfalls: [
    'Feeding more than 3.6 V into a GPIO burns it — VIN, 5 V modules and Uno outputs are all dangerous.',
    'Porting Uno code: 1023 becomes 4095, and delay() is the same but the loop runs about 15× faster.',
  ],
}

export const esp32s3Learn = {
  summary:
    'The ESP32-S3 DevKitC-1 is the newer, wider ESP32: still 3.3 V and WiFi-capable, with 14 touch pads, 20 ADC pins, native USB and an on-board RGB LED. It bridges a dual breadboard with 22 pins per side.',
  pinout: [
    'GPIO1–GPIO20: 12-bit ADC inputs (ADC1 = GPIO1–10, ADC2 = GPIO11–20) and T1–T14 touch pads on GPIO1–14.',
    'GPIO8 = SDA, GPIO9 = SCL (default Wire bus). GPIO48 = on-board RGB LED (LED_BUILTIN).',
    'GPIO43 (TX) / GPIO44 (RX): UART0 — the serial monitor. GPIO19 / GPIO20: native USB D− / D+.',
    '5V passes the USB supply through; both 3V3 pins are the 3.3 V logic supply. GND ×4.',
  ],
  tips: [
    'The S3 spans 22 rows — anchor it at row 1 and use dual-board mode so both pin rows are reachable.',
    'Use ADC1 (GPIO1–10) for analog sensors in WiFi projects.',
    'There is no DAC: create analog-ish output with PWM and an RC filter.',
  ],
  formulas: ['analogRead value = Vin / 3.3 V × 4095', 'PWM average voltage = duty / 255 × 3.3 V'],
  pitfalls: [
    'Never connect 5 V to a GPIO — same 3.6 V limit as every ESP32.',
    'GPIO0, GPIO45 and GPIO46 decide the boot mode; a pull-down on GPIO0 at power-up keeps the board in the bootloader.',
  ],
}
