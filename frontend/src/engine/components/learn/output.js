/** Learn cards for output parts. */

export const ledLearn = {
  summary:
    'An LED lights when current flows from anode to cathode, but only after its forward voltage (about 1.8 V red … 2.8 V white) is reached. It has almost no resistance of its own, so a series resistor sets the current.',
  pinout: ['anode (+): the longer leg — connect toward the positive side / MCU pin.', 'cathode (−): the shorter leg on the flat side of the lens — connect toward GND.'],
  tips: [
    'Brightness follows current: ~13 mA (220 Ω on 5 V) is bright, ~3 mA (1 kΩ) is a soft glow.',
    'On a 3.3 V board the same 220 Ω gives about 6 mA for red and just 2 mA for blue — still visible.',
    'Reversed LEDs simply stay dark; they are not damaged at these voltages.',
  ],
  formulas: ['I = (Vsrc − Vf) / (R + Rpin + rOn)', 'Example: (5 V − 1.8 V) / (220 Ω + 25 Ω + 10 Ω) ≈ 12.5 mA', 'brightness = √(I / 20 mA), capped at 1'],
  pitfalls: [
    'No resistor: (5 V − 1.8 V) / 10 Ω ≈ 320 mA — the LED pops and the pin is overloaded (40 mA max).',
    'Both legs in the same breadboard strip short the LED — it never lights.',
  ],
}

export const rgbLedLearn = {
  summary:
    'An RGB LED is three LEDs (red, green, blue) in one lens sharing a common cathode. Mix colours by driving the three anodes with PWM.',
  pinout: ['r: red anode (Vf ≈ 1.8 V).', 'cathode: the longest leg — to GND.', 'g: green anode (≈ 2.1 V).', 'b: blue anode (≈ 2.7 V).'],
  tips: [
    'Each colour needs its own series resistor (220 Ω); one shared resistor makes the colours fight each other.',
    'Use three PWM pins and analogWrite(r, 255) analogWrite(g, 128) analogWrite(b, 0) for orange.',
  ],
  formulas: ['Per channel: I = (Vsrc − Vf_channel) / (R + Rpin + rOn)', 'Colour mix ≈ (duty_r, duty_g, duty_b) / 255'],
  pitfalls: ['Blue needs the highest Vf, so it is dimmest at 3.3 V — increase its duty or lower its resistor.'],
}

export const buzzerLearn = {
  summary:
    'A piezo buzzer clicks every time the voltage across it changes; drive it with tone(pin, frequency) and the clicks become a note. Electrically it looks like about 1 kΩ, so a pin drives it directly.',
  pinout: ['pos (+): to the tone pin.', 'neg (−): to GND.'],
  tips: ['tone(8, 440) plays A4; noTone(8) stops it. Only one tone at a time per board.', 'Typical audible range: 200 Hz to 5 kHz; piezos are loudest around 2–4 kHz.'],
  formulas: ['Current ≈ 5 V / 1 kΩ = 5 mA', 'Period T = 1 / f  (440 Hz → 2.27 ms)'],
  pitfalls: ['Using delay() inside a melody blocks everything else — use millis() for lights that keep blinking.'],
}

export const servoLearn = {
  summary:
    'A hobby servo turns to an angle you command with a pulse train: a 1–2 ms pulse every 20 ms maps to 0–180°. The Servo library generates the pulses; the servo needs 5 V power and a shared ground.',
  pinout: ['signal (orange/yellow): to a digital pin, e.g. D9.', 'vcc (red): 5V / VIN — at least 4.5 V.', 'gnd (brown/black): GND.'],
  tips: [
    'servo.attach(9); servo.write(90); — 90° is the middle position.',
    'Power the servo from 5V/VIN, never from a GPIO pin: it can draw hundreds of mA while moving.',
    'On the ESP32 the 3.3 V signal is fine; use ESP32Servo.h and power from VIN.',
  ],
  formulas: ['Pulse width ≈ 1000 µs + angle / 180° × 1000 µs', 'Frame period = 20 ms (50 Hz)'],
  pitfalls: ['A servo powered from 3V3 stutters or does nothing — it is unpowered below 4.5 V here.', 'Forgetting the shared GND leaves the signal without a reference.'],
}

export const lcdLearn = {
  summary:
    'A 16x2 character LCD with an I2C backpack shows two lines of 16 characters using just two data wires (SDA, SCL) plus power. The LiquidCrystal_I2C library talks to it at address 0x27.',
  pinout: ['gnd: GND.', 'vcc: 5V (the backlight and logic want 5 V).', 'sda: A4 (Uno/Nano) or GPIO21 (ESP32).', 'scl: A5 (Uno/Nano) or GPIO22 (ESP32).'],
  tips: [
    'LiquidCrystal_I2C lcd(0x27, 16, 2); lcd.init(); lcd.backlight(); lcd.print("Hello");',
    'lcd.setCursor(column, row) before printing the second line: lcd.setCursor(0, 1).',
    'Some backpacks use address 0x3F — change the addr prop and the constructor to match.',
  ],
  formulas: ['Address on the bus: 0x27 (0x3F alternative)', 'Two wires, up to 127 devices — each needs a different address'],
  pitfalls: ['Wrong address or swapped SDA/SCL: the screen lights but shows nothing.', 'Powered from 3V3 the backlight is dim and text may vanish (needs ≥ 4.5 V).'],
}

export const oledLearn = {
  summary:
    'A 0.96" SSD1306 OLED is a 128×64 pixel monochrome display driven over I2C. Draw text and shapes with Adafruit_GFX, then call display() to push the frame.',
  pinout: ['vcc: 3V3 or 5V (the module regulates; needs ≥ 3 V).', 'gnd: GND.', 'scl: I2C clock (A5 / GPIO22).', 'sda: I2C data (A4 / GPIO21).'],
  tips: [
    'Adafruit_SSD1306 display(128, 64, &Wire); display.begin(SSD1306_SWITCHCAPVCC, 0x3C);',
    'Nothing appears until display.display() — and clearDisplay() first when redrawing.',
    'Pixels are OLEDs: white pixels use power, black ones are off.',
  ],
  formulas: ['Frame buffer = 128 × 64 / 8 = 1024 bytes', 'Address 0x3C (0x3D alternative)'],
  pitfalls: ['begin() returns false when the address does not match or SDA/SCL are swapped.', 'Mind the pin order: many modules are VCC-GND-SCL-SDA, others GND-VCC.'],
}

export const sevenSegmentLearn = {
  summary:
    'A seven-segment display is eight LEDs (segments a–g plus the decimal point) sharing a common cathode. Light the right combination to show a digit: 0 = a b c d e f, 1 = b c, and so on.',
  pinout: [
    'Top row: g, f, com, a, b.  Bottom row: e, d, com, c, dp.',
    'Both com pins are the same common cathode — connect either one to GND.',
    'Segments are laid out a (top), b (top right), c (bottom right), d (bottom), e (bottom left), f (top left), g (middle).',
  ],
  tips: ['Give every segment its own 220 Ω resistor; a single resistor on com makes digits dimmer the more segments are lit.', 'Store the digit patterns in a byte array and loop over the 7 segment pins.'],
  formulas: ['Per segment: I = (Vsrc − 1.8 V) / (R + Rpin + 10 Ω)', 'Eight segments × 12 mA ≈ 100 mA total from the supply'],
  pitfalls: ['Eight pins at once can exceed the total current an Uno should source at the same time — use higher resistors or fewer segments.'],
}

export const neopixelLearn = {
  summary:
    'A NeoPixel (WS2812B) ring is a chain of addressable RGB LEDs. One data wire carries colours for every pixel; the library handles the timing. Each pixel can draw up to 60 mA at full white.',
  pinout: ['din: data in — to a digital pin (through a 330–470 Ω resistor in real builds).', 'vcc: 5V / VIN (≥ 4.5 V).', 'gnd: GND.'],
  tips: [
    'Adafruit_NeoPixel ring(12, PIN, NEO_GRB + NEO_KHZ800); ring.begin(); ring.setPixelColor(0, ring.Color(255, 0, 0)); ring.show();',
    'Set ring.setBrightness(40) — full brightness on 12 pixels is blinding and hungry.',
    'A 3.3 V ESP32 data signal works in the simulator and usually in real life; a level shifter makes it reliable.',
  ],
  formulas: ['Max current ≈ pixels × 60 mA  (12 pixels → 720 mA at full white)', 'Colour = (r, g, b) each 0–255'],
  pitfalls: ['Powering 12 pixels from the 500 mA USB budget at full white overloads it — dim them.', 'Data goes into DIN, not DOUT; the arrow on the ring shows the direction.'],
}

export const dcMotorLearn = {
  summary:
    'A small DC motor spins when current flows through it; reverse the current and it spins the other way. It draws far more than a pin can supply, so drive it through a transistor.',
  pinout: ['p1 / p2: the two motor leads — no polarity, just direction.'],
  tips: [
    'Wire: 5V → motor → collector of an NPN, emitter → GND, base ← pin through 1 kΩ.',
    'Add a flyback diode across the motor (cathode to +) to absorb the voltage spike when it stops.',
    'Speed follows current — PWM on the transistor base gives smooth speed control.',
  ],
  formulas: ['Stall current ≈ 5 V / 20 Ω = 250 mA (way over the 40 mA pin limit)', 'Speed ∝ current in this model'],
  pitfalls: ['Connecting the motor straight to a pin overloads the pin and stalls the sketch\'s LEDs too.'],
}

export const relayLearn = {
  summary:
    'A 5 V relay module is an electrically controlled switch: a small signal on IN energises a coil that flips a mechanical contact between COM–NC (normally closed) and COM–NO (normally open).',
  pinout: ['vcc: 5V / VIN.', 'gnd: GND.', 'in: control signal from a pin (HIGH = on).', 'com: common contact.', 'no: normally open — connected to com only when on.', 'nc: normally closed — connected to com only when off.'],
  tips: ['Use it to switch a lamp or motor circuit that is separate from the microcontroller.', 'The module turns on when IN rises above about 60 % of its supply.'],
  formulas: ['relayOn = powered AND V(in) − V(gnd) > 0.6 × Vmodule'],
  pitfalls: ['Powered from 3V3 the coil never pulls in (needs ≥ 4.5 V).', 'A 3.3 V ESP32 signal only just reaches the 0.6 × 5 V = 3 V threshold — power the module from 3V3-compatible relays or use a transistor in real builds.'],
}
