# Raspberry Pi 4 / 5 GPIO simulation

This is an extension requested after the original Arduino/ESP32 specification. The board ids are
`raspberrypi4` and `raspberrypi5`; both use `family: 'raspberrypi'` and `language: 'python'`.
The existing Arduino Uno/Nano and ESP32/ESP32-S3 profiles keep their Arduino C++ runtime.

## Hardware model

Both profiles expose the 40-pin header, 3.3 V GPIO, 3.3 V and 5 V power pins, and eight ground pins.
GPIO names in circuit documents and simulation messages are canonical `GPIO17` names.
`PinDef.number` is the BCM number; `PIN11` is an alias for physical header pin 11, which is GPIO17.
The free-mounted component has a 34 × 23 pitch body with two adjacent rows of 20 header pins.
Header pins follow physical order; pin 1 is at (2, 1), pin 2 at (2, 2), pin 3 at (3, 1).

The profiles have no built-in ADC, DAC or header-connected built-in LED. They are supported by
the same circuit compiler, solver, power, PWM and damage paths as the microcontroller boards.
The 50 Ω output resistance, 16 mA warning threshold, 50 kΩ pull resistance, 500 mA external-load
budget, 3.6 V damage threshold and one-microsecond statement cost are simplified teaching values.
They are not measurements of either physical board, Linux timing, or total USB supply capacity.

Header references: [Raspberry Pi hardware documentation](https://www.raspberrypi.com/documentation/computers/raspberry-pi.html)
and [GPIO Zero pinout and recipes](https://gpiozero.readthedocs.io/en/stable/recipes.html).

## Python subset

`runtime/python.js` parses a restricted Python syntax and lowers it into the existing cooperative
VM. It does not use JavaScript `eval`, execute Python on the server, or start a Linux process.
Compilation and runtime diagnostics map back to Python source line numbers.

Supported syntax:

- Comments, single-line strings, numeric and boolean variables, assignments and arithmetic.
- Comparisons, `and`, `or`, `not`, `if` / `elif` / `else`, `while` and `for ... in range(...)`.
- `pass`, `break`, `continue`, `print`, `int`, `float`, `str`, `abs`, `min`, `max`.
- Space-based indentation; simple positional and documented device keyword arguments.

Supported modules and calls:

| Import | Supported surface |
| --- | --- |
| `from gpiozero import LED, PWMLED, Button` | Device construction; LED `on`, `off`, `toggle`, `value`, `is_lit`, `is_active`, `close`; Button `value`, `is_pressed`, `close`; PWMLED `value` 0–1 and frequency |
| `import gpiozero` | Qualified construction such as `gpiozero.LED(17)` |
| `from time import sleep` / `import time` | `sleep(seconds)`, `time.monotonic()` in virtual seconds |
| `import RPi.GPIO as GPIO` | `setmode(BCM/BOARD)`, `setwarnings`, `setup`, `input`, `output`, `cleanup`, constants `IN/OUT/HIGH/LOW/PUD_OFF/PUD_UP/PUD_DOWN` |
| `GPIO.PWM(pin, frequency)` | `start(percent)`, `ChangeDutyCycle(percent)`, `ChangeFrequency`, `stop` |

GPIO Zero calls use BCM numbering. The `RPi.GPIO` calls are a simulator compatibility surface;
they do not claim that the legacy RPi.GPIO package works unchanged on physical Pi 5 hardware.
Prefer GPIO Zero for examples intended to span Pi 4 and Pi 5.

Variables have fixed VM types after first assignment; this is not full Python dynamic typing or
arbitrary-precision integer arithmetic. Functions, callbacks, exception handlers, lists/dicts,
comprehensions, arbitrary imports, file access, networking, cameras, Linux and external packages
are not implemented. Unsupported syntax/imports receive diagnostics rather than silently running
on a different platform. The tutorial page discloses these limits.

Finite scripts halt after their last statement. Outputs retain their last configuration until
reset, cleanup or another run. `start()` resets interpreter and device state; `reset()` clears
electrical runtime state while retaining the loaded program.

## Example

```python
from gpiozero import LED
from time import sleep

led = LED(17)
while True:
    led.on()
    sleep(0.5)
    led.off()
    sleep(0.5)
```

Wire physical pin 11 (BCM GPIO17) through 220 Ω to the LED anode and return the cathode to GND.
The tutorial's placement and cable tables identify the exact simulated breadboard holes.

## Persistence

The backend accepts both board ids, preserves Python source through project save/update/fork,
and rejects Arduino Blockly mode for Raspberry Pi projects. `/api/boards` advertises the
`python-gpio-subset` simulation capability so clients can describe it accurately.
