/** Learn cards for passive parts and the transistor. */

export const resistorLearn = {
  summary:
    'A resistor limits current. Push a voltage across it and a predictable current flows: the bigger the resistance, the smaller the current. Its value is printed as colour bands.',
  pinout: ['p1 / p2: no polarity — either way round works.', 'Spans 5 holes: bridge two different row strips (or the gap between the a–e and f–j blocks).'],
  tips: [
    '220 Ω is the go-to value for an LED on a 5 V pin (about 13 mA); 1 kΩ gives a dimmer, safer 3 mA.',
    '10 kΩ is the standard pull-up / pull-down and the standard partner for an LDR or thermistor divider.',
    'Read the bands from the side where they are closer together; the gold band is the tolerance (±5 %).',
  ],
  formulas: [
    'Ohm\'s law: V = I × R   →   I = V / R',
    'LED current: I = (Vsrc − Vf) / (R + Rpin + rOn)',
    'Power dissipated: P = V × I = I² × R  (a 1/4 W resistor is fine below 0.25 W)',
    'Divider: Vout = Vin × R2 / (R1 + R2)',
  ],
  pitfalls: [
    'Both legs in the same 5-hole strip short the resistor out — the current simply bypasses it.',
    'Too small a value (or none at all) lets an LED draw far more than its 30 mA limit: smoke.',
  ],
}

export const capacitorLearn = {
  summary:
    'A capacitor stores charge. It smooths sudden voltage dips and filters noise. In this DC simulation it behaves like an open circuit once charged — no steady current flows through it.',
  pinout: ['pos (+): the longer leg / unmarked side of an electrolytic can.', 'neg (−): the shorter leg, marked with a stripe.'],
  tips: [
    'Place 100 µF across a module\'s VCC and GND to keep servos and NeoPixels from resetting your board.',
    'Values are in microfarads (µF); bigger stores more energy but charges slower.',
  ],
  formulas: ['Charge: Q = C × V', 'RC time constant: τ = R × C  (63 % charged after one τ)', 'Energy: E = ½ × C × V²'],
  pitfalls: [
    'Electrolytic capacitors are polarised — connect + to the higher voltage or they vent in real life.',
    'Because DC is simulated, you will not see blink timing change with the capacitor here.',
  ],
}

export const diodeLearn = {
  summary:
    'A rectifier diode is a one-way valve for current: it conducts from anode to cathode once about 0.7 V is across it and blocks the other way. Use it to protect against reversed polarity or motor kick-back.',
  pinout: ['anode (+): current enters here.', 'cathode (−): the end with the silver stripe; current leaves here.'],
  tips: [
    'Place it "backwards" across a motor or relay coil (cathode to +) as a flyback diode.',
    'It drops about 0.7 V, so a 5 V supply through a diode gives roughly 4.3 V.',
  ],
  formulas: ['Conducting: V ≈ 0.7 V + I × 1 Ω', 'Reverse: I ≈ 0 (open)'],
  pitfalls: ['Reversed, it blocks completely — a "dead" circuit is often a backwards diode.', 'Rated for 1 A here; a direct short across a supply still exceeds that.'],
}

export const npnLearn = {
  summary:
    'An NPN transistor is an electronic switch and amplifier. A small current into the base lets a current up to about 100 times larger flow from collector to emitter — so a 40 mA pin can control a 300 mA motor.',
  pinout: ['e (emitter): connect to GND.', 'b (base): drive from a pin through a 1–10 kΩ resistor.', 'c (collector): the load (motor, relay, LED strip) sits between + and here.'],
  tips: [
    'Always add a base resistor: 1 kΩ from a 5 V pin gives about 4 mA of base current, enough for ~400 mA of load.',
    'When fully on (saturated) the collector sits at about 0.2 V — nearly a closed switch.',
    'Combine with a flyback diode across motors and relay coils.',
  ],
  formulas: ['Base current: Ib = (Vpin − 0.7 V) / Rb', 'Collector current (active): Ic = β × Ib, β ≈ 100', 'Saturated: Vce ≈ 0.2 V'],
  pitfalls: [
    'Base straight to a pin without a resistor pulls far more than 40 mA — the pin overheats.',
    'Flat-face pinout of a 2N2222 is E-B-C left to right; swapping E and C makes it barely conduct.',
  ],
}
