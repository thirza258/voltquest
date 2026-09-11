/**
 * Language suite for the Arduino-C++ subset (CONTRACTS §6).
 *
 * The host here is a stand-in for package E2: just enough `Serial`, `delay` and friends to observe what the
 * VM does. Every mandatory case from §6 is in the first block.
 */
import { describe, it, expect } from 'vitest'
import { compile, createVM, formatValue } from './index.js'

/**
 * Compiles and runs a sketch, returning everything it printed plus the VM.
 * @param {string} source
 * @param {{ intBits?: number, statementCostUs?: number, natives?: object, classes?: object, globals?: object,
 *           slices?: number, budget?: number }} [options]
 */
function run(source, options = {}) {
  const { intBits = 16, statementCostUs = 1, slices = 10, budget = 20000 } = options
  const compiled = compile(source, { intBits })
  if (!compiled.ok) throw new Error(`compile failed: ${JSON.stringify(compiled.errors)}`)
  const serial = []
  const pins = []
  const print = (args, ctx) => serial.push(args.length ? formatValue(args[0], ctx.argTypes[0], args[1], intBits) : '')
  const vm = createVM(compiled.program, {
    intBits,
    statementCostUs,
    natives: {
      'Serial.begin': () => {},
      'Serial.print': print,
      'Serial.println': (args, ctx) => { print(args, ctx); serial.push('\n') },
      delay: function* (args, ctx) { yield ctx.sleep(args[0] * 1000) },
      delayMicroseconds: function* (args, ctx) { yield ctx.sleep(args[0]) },
      millis: { fn: (_args, ctx) => Math.floor(ctx.now() / 1000), returns: 'unsigned long' },
      micros: { fn: (_args, ctx) => ctx.now(), returns: 'unsigned long' },
      pinMode: () => {},
      digitalWrite: (args, ctx) => pins.push({ pin: args[0], level: args[1], t: ctx.now() }),
      apply1: function* (args, ctx) { return yield* ctx.invoke(args[0], [args[1]]) },
      ...(options.natives ?? {}),
    },
    globals: { HIGH: 1, LOW: 0, OUTPUT: 1, INPUT: 0, DEC: 10, HEX: 16, OCT: 8, BIN: 2, LED_BUILTIN: 13, ...(options.globals ?? {}) },
    classes: options.classes ?? {},
  })
  vm.start()
  let status = { status: 'running' }
  for (let i = 0; i < slices; i++) {
    status = vm.step(budget)
    if (status.status === 'sleeping') vm.advanceTo(status.wakeAtUs)
    else if (status.status !== 'running') break
  }
  return { vm, status, pins, out: serial.join('') }
}

/** Wraps statements in a minimal sketch. */
const setup = (body, tail = 'void loop(){}') => `void setup(){\n${body}\n}\n${tail}`

describe('integer semantics (CONTRACTS §6, mandatory cases)', () => {
  it('wraps the result of an operator to the static result type', () => {
    const src = 'int a = 40;\nvoid setup(){ Serial.println(a * 1000); }\nvoid loop(){}'
    expect(run(src, { intBits: 16 }).out).toBe('-25536\n')
    expect(run(src, { intBits: 32 }).out).toBe('40000\n')
  })

  it('wraps int × int before the store, even into a long', () => {
    const src = 'long big = 1000 * 1000;\nvoid setup(){ Serial.println(big); }\nvoid loop(){}'
    expect(run(src, { intBits: 16 }).out).toBe('16960\n')
    expect(run(src, { intBits: 32 }).out).toBe('1000000\n')
  })

  it('prints floats with two decimals and chars as characters', () => {
    expect(run(setup('float f = 3.0; Serial.print(f);')).out).toBe('3.00')
    expect(run(setup('char c = 65; Serial.print(c);')).out).toBe('A')
  })

  it('promotes 8-bit types to int and wraps only on store', () => {
    expect(run(setup('byte a = 200, b = 100; Serial.print(a + b); Serial.print(","); byte c = a + b; Serial.print(c);')).out)
      .toBe('300,44')
    expect(run(setup('byte d = 255; d++; Serial.print(d);')).out).toBe('0')
  })

  it('keeps long arithmetic 32-bit', () => {
    expect(run(setup('long x = 1000; x *= 1000; Serial.print(x);')).out).toBe('1000000')
    expect(run(setup('long y = 1000000L * 1000000L; Serial.print(y);'), { intBits: 32 }).out).toBe('-727379968')
  })

  it('wraps compound assignment and unsigned types', () => {
    expect(run(setup('unsigned int u = 65535; u += 2; Serial.print(u);')).out).toBe('1')
    expect(run(setup('unsigned long t = 4294967295UL; t += 2; Serial.print(t);')).out).toBe('1')
  })

  it('implements C shift and bitwise semantics at the board width', () => {
    expect(run(setup('Serial.print(1 << 15);')).out).toBe('-32768')
    expect(run(setup('Serial.print(1 << 20);')).out).toBe('0')
    expect(run(setup('Serial.print(1L << 20);')).out).toBe('1048576')
    expect(run(setup('unsigned int u = 0xFFFF; Serial.print(u >> 4);')).out).toBe('4095')
    expect(run(setup('Serial.print(~0);')).out).toBe('-1')
  })

  it('truncates integer division and errors on divide by zero', () => {
    expect(run(setup('Serial.print(7 / 2); Serial.print(","); Serial.print(-7 / 2); Serial.print(","); Serial.print(7 % 3);')).out)
      .toBe('3,-3,1')
    expect(run(setup('float f = 7; Serial.print(f / 2); Serial.print(","); Serial.print(7.0 / 2);')).out).toBe('3.50,3.50')
    const r = run('void setup(){\n  int z = 0;\n  Serial.print(5 / z);\n}\nvoid loop(){}')
    expect(r.status).toMatchObject({ status: 'error', error: { message: 'division by zero', line: 3 } })
  })
})

describe('control flow', () => {
  it('falls through switch cases until break', () => {
    const src = setup('for (int i = 0; i < 4; i++) { switch (i) { case 0: Serial.print("A"); case 1: Serial.print("B"); break; case 2: Serial.print("C"); break; default: Serial.print("D"); } }')
    expect(run(src).out).toBe('ABBCD')
  })

  it('supports do…while, break and continue', () => {
    expect(run(setup('int i = 0; do { Serial.print(i); i++; } while (i < 3);')).out).toBe('012')
    expect(run(setup('for (int i = 0; i < 6; i++) { if (i == 2) continue; if (i == 4) break; Serial.print(i); }')).out).toBe('013')
  })

  it('runs multi-expression for init and step', () => {
    expect(run(setup('for (int i = 0, j = 3; i < j; i++, j--) Serial.print(i);')).out).toBe('01')
  })

  it('recurses', () => {
    const src = 'int fib(int n){ if (n < 2) return n; return fib(n - 1) + fib(n - 2); }\nvoid setup(){ Serial.println(fib(15)); }\nvoid loop(){}'
    expect(run(src).out).toBe('610\n')
  })

  it('hoists functions so declaration order does not matter', () => {
    const src = 'void setup(){ Serial.print(later(3)); }\nint later(int x){ return x * x; }\nvoid loop(){}'
    expect(run(src).out).toBe('9')
  })

  it('accepts prototypes', () => {
    const src = 'int square(int x);\nvoid setup(){ Serial.print(square(4)); }\nint square(int x){ return x * x; }\nvoid loop(){}'
    expect(run(src).out).toBe('16')
  })

  it('keeps static locals across calls and scopes blocks', () => {
    const src = 'void tick(){ static int n = 0; n++; Serial.print(n); }\nvoid setup(){ tick(); tick(); tick(); int n = 9; { int n = 1; Serial.print(n); } Serial.print(n); }\nvoid loop(){}'
    expect(run(src).out).toBe('12319')
  })

  it('preempts and resumes around a native that sleeps mid-expression', () => {
    const r = run(setup('int x = readSensor() + 1; Serial.print(x);'), {
      natives: { readSensor: function* (_args, ctx) { yield ctx.sleep(100); return 42 } },
    })
    expect(r.out).toBe('43')
    expect(r.vm.now()).toBeGreaterThanOrEqual(100)
  })

  it('re-evaluates an impure loop condition every iteration', () => {
    let level = 0
    const src = setup('int n = 0; while (digitalRead(2) == LOW) { n++; if (n > 3) press(); } Serial.print(n);')
    const r = run(src, {
      natives: { digitalRead: { fn: () => level, returns: 'int' }, press: () => { level = 1 } },
    })
    expect(r.out).toBe('4')
  })

  it('evaluates ternary, comma and logical short-circuit', () => {
    expect(run(setup('int i = 0; int x = (i++, i + 1); Serial.print(x); Serial.print(i > 0 ? "y" : "n");')).out).toBe('2y')
    expect(run(setup('int c = 0; if (c != 0 && 10 / c > 1) Serial.print("bad"); else Serial.print("ok");')).out).toBe('ok')
  })
})

describe('arrays and sizeof', () => {
  it('supports initializers and the sizeof(a)/sizeof(a[0]) idiom', () => {
    const src = 'int a[] = {10, 20, 30, 40};\nvoid setup(){ Serial.print(sizeof(a) / sizeof(a[0])); int s = 0; for (unsigned int i = 0; i < sizeof(a) / sizeof(a[0]); i++) s += a[i]; Serial.print(","); Serial.print(s); }\nvoid loop(){}'
    expect(run(src).out).toBe('4,100')
  })

  it('supports 2-D arrays and per-element wrapping', () => {
    const src = 'byte m[2][3] = {{1, 2, 3}, {4, 5, 300}};\nvoid setup(){ Serial.print(m[1][2]); m[0][0] = 258; Serial.print(","); Serial.print(m[0][0]); Serial.print(","); Serial.print(sizeof(m)); }\nvoid loop(){}'
    expect(run(src).out).toBe('44,2,6')
  })

  it('reports out-of-bounds access with the source line', () => {
    const r = run('int a[3];\nvoid setup(){\n\n  a[7] = 1;\n}\nvoid loop(){}')
    expect(r.status).toMatchObject({ status: 'error', error: { message: 'array index 7 out of bounds (size 3)', line: 4 } })
  })

  it('passes arrays to functions as handles', () => {
    const src = 'void bump(int v[], int n){ for (int i = 0; i < n; i++) v[i]++; }\nint a[3] = {1, 2, 3};\nvoid setup(){ bump(a, 3); Serial.print(a[0]); Serial.print(a[2]); }\nvoid loop(){}'
    expect(run(src).out).toBe('24')
  })

  it('hands a char[] to a native as a mutable handle (snprintf-style)', () => {
    const src = setup('char buf[16]; writeInto(buf, "hi"); Serial.print(buf[0]); Serial.print(buf);')
    const writeInto = (args) => {
      const [dest, text] = args
      for (let i = 0; i < text.length; i++) dest[i] = text.charCodeAt(i)
      dest[text.length] = 0
    }
    expect(run(src, { natives: { writeInto } }).out).toBe('hhi')
  })

  it('initialises char arrays from string literals', () => {
    expect(run(setup('char buf[8] = "hi"; Serial.print(buf[0]); Serial.print(buf[1]); Serial.print(sizeof(buf));')).out).toBe('hi8')
  })
})

describe('String', () => {
  it('concatenates Arduino-style', () => {
    expect(run(setup(`String s = "n="; s += 42; s = s + " f=" + 2.5 + " c=" + 'x'; Serial.print(s);`)).out)
      .toBe('n=42 f=2.50 c=x')
  })

  it('implements every method of the subset', () => {
    const src = setup(`
      String s = "  Hello World  ";
      s.trim();
      Serial.println(s);
      Serial.println(s.length());
      Serial.println(s.charAt(1));
      Serial.println(s.indexOf("o"));
      Serial.println(s.lastIndexOf("o"));
      Serial.println(s.substring(6, 11));
      Serial.println(String("42abc").toInt());
      Serial.println(String("3.5x").toFloat());
      Serial.println(s.equals("Hello World"));
      Serial.println(s.equalsIgnoreCase("hello world"));
      Serial.println(s.startsWith("Hello"));
      Serial.println(s.endsWith("World"));
      Serial.println(s.compareTo("Hello World"));
      Serial.println(s.isEmpty());
      Serial.println(s.c_str());
      String t = s;
      t.replace("World", "There");
      t.concat("!");
      Serial.println(t);
      t.remove(5);
      t.setCharAt(0, 'J');
      t.toUpperCase();
      Serial.println(t);
      t.toLowerCase();
      t.reserve(64);
      Serial.println(t);`)
    expect(run(src).out.split('\n')).toEqual([
      'Hello World', '11', 'e', '4', '7', 'World', '42', '3.50', '1', '1', '1', '1', '0', '0', 'Hello World',
      'Hello There!', 'JELLO', 'jello', '',
    ])
  })

  it('compares Strings by value and casts with a base or decimals', () => {
    expect(run(setup('String a = "ab"; String b = "ab"; Serial.print(a == b); Serial.print(a != "x");')).out).toBe('11')
    expect(run(setup('Serial.print(String(255, HEX)); Serial.print(","); Serial.print(String(3.14159, 3));')).out).toBe('FF,3.142')
  })

  it('indexes a String and handles raw string literals', () => {
    expect(run(setup('String s = "abc"; Serial.print(s[1]);')).out).toBe('b')
    expect(run(setup('String j = R"J({"k":1})J"; Serial.print(j);')).out).toBe('{"k":1}')
  })
})

describe('functions as values and lambdas', () => {
  it('passes a lambda to a native and invokes it through ctx.invoke', () => {
    expect(run(setup('auto twice = [](int x){ return x * 2; }; Serial.print(apply1(twice, 21));')).out).toBe('42')
  })

  it('captures by reference with [&] and by value with [=]', () => {
    const src = setup(`
      int base = 10;
      auto byRef = [&](int x){ return x + base; };
      auto byVal = [=](int x){ return x + base; };
      base = 100;
      Serial.print(apply1(byRef, 1));
      Serial.print(",");
      Serial.print(apply1(byVal, 1));`)
    expect(run(src).out).toBe('101,11')
  })

  it('captures through nested lambdas', () => {
    const src = setup('int n = 2; auto outer = [&](int x){ int m = 3; auto inner = [&](int y){ return y * m * n; }; return apply1(inner, x); }; Serial.print(apply1(outer, 5));')
    expect(run(src).out).toBe('30')
  })

  it('passes a function name as a value', () => {
    const src = 'int triple(int x){ return x * 3; }\nvoid setup(){ Serial.print(apply1(triple, 5)); }\nvoid loop(){}'
    expect(run(src).out).toBe('15')
  })
})

describe('objects, structs and enums', () => {
  const Servo = {
    construct: (args) => ({ angle: 0, pin: args[0] ?? -1 }),
    methods: {
      attach: (args, ctx) => { ctx.self.pin = args[0] },
      write: (args, ctx) => { ctx.self.angle = args[0] },
      read: { fn: (_args, ctx) => ctx.self.angle, returns: 'int' },
    },
    fields: (self) => ({ pin: self.pin }),
  }

  it('constructs host classes and calls their methods', () => {
    const src = 'Servo arm;\nvoid setup(){ arm.attach(9); arm.write(90); Serial.print(arm.read()); Serial.print(","); Serial.print(arm.pin); }\nvoid loop(){}'
    expect(run(src, { classes: { Servo } }).out).toBe('90,9')
  })

  it('passes constructor arguments', () => {
    const src = 'Servo arm(5);\nvoid setup(){ Serial.print(arm.pin); }\nvoid loop(){}'
    expect(run(src, { classes: { Servo } }).out).toBe('5')
  })

  it('resolves static-style member calls through natives and host globals', () => {
    const src = setup('Serial.print(WiFi.status()); ESP.restart();')
    const seen = []
    const r = run(src, {
      natives: { 'WiFi.status': { fn: () => 3, returns: 'int' } },
      globals: { ESP: { restart: (args, ctx) => { seen.push(ctx.line >= 0) } } },
    })
    expect(r.out).toBe('3')
    expect(seen).toEqual([true])
  })

  it('gives every element of a struct array its own storage', () => {
    const src = [
      'struct LedCfg { int pin; int ms; };',
      'LedCfg cfgs[2] = {{3, 10}, {5, 20}};',
      'void setup(){',
      '  for (int i = 0; i < 2; i++) { Serial.print(cfgs[i].pin); Serial.print(":"); Serial.print(cfgs[i].ms); Serial.print(" "); }',
      '  cfgs[0].pin = 9;',
      '  Serial.print(cfgs[0].pin); Serial.print(cfgs[1].pin);',
      '}',
      'void loop(){}',
    ].join('\n')
    expect(run(src).out).toBe('3:10 5:20 95')
  })

  it('invokes a lambda passed to a host method', () => {
    const WebServer = {
      construct: (args) => ({ port: args[0], routes: {} }),
      methods: {
        on: (args, ctx) => { ctx.self.routes[args[0]] = args[args.length - 1] },
        begin: () => {},
        handleClient: function* (_args, ctx) {
          const handler = ctx.self.routes['/']
          if (!handler || ctx.self.served) return
          ctx.self.served = true
          yield* ctx.invoke(handler, [])
        },
      },
    }
    const src = [
      'WebServer server(80);',
      'String body = "ok";',
      'void setup(){ server.on("/", [](){ Serial.print(body); }); server.begin(); }',
      'void loop(){ server.handleClient(); }',
    ].join('\n')
    expect(run(src, { classes: { WebServer }, slices: 2, budget: 400 }).out).toBe('ok')
  })

  it('supports basic structs and enums', () => {
    const src = 'struct Point { int x; int y; };\nenum Mode { OFF, ON = 5, LATER };\nvoid setup(){ Point p; p.x = 3; p.y = 4; Serial.print(p.x * p.x + p.y * p.y); Point q = {1, 2}; Serial.print(q.y); Serial.print(ON); Serial.print(LATER); }\nvoid loop(){}'
    expect(run(src).out).toBe('25256')
  })
})

describe('preprocessor and casts in running sketches', () => {
  it('applies #define and #ifdef', () => {
    const src = '#define LED 13\n#define DEBUG\nvoid setup(){\n#ifdef DEBUG\n  Serial.print(LED);\n#else\n  Serial.print(0);\n#endif\n}\nvoid loop(){}'
    expect(run(src).out).toBe('13')
  })

  it('treats PROGMEM and F() as no-ops', () => {
    const src = 'const char* MSG PROGMEM = "rom";\nvoid setup(){ Serial.print(F("hi")); Serial.print(MSG); }\nvoid loop(){}'
    expect(run(src).out).toBe('hirom')
  })

  it('supports C-style and functional casts', () => {
    expect(run(setup('Serial.print((int)3.9); Serial.print(int(-3.9)); Serial.print(char(66)); Serial.print(byte(300)); Serial.print(float(7) / 2);')).out)
      .toBe('3-3B443.50')
  })

  it('uses a native declared return type for formatting and its params for coercion', () => {
    const r = run(setup('Serial.print(half(7)); Serial.print(","); Serial.print(clamp8(300));'), {
      natives: {
        half: { fn: (args) => args[0] / 2, returns: 'float' },
        clamp8: { fn: (args) => args[0], returns: 'byte', params: ['byte'] },
      },
    })
    expect(r.out).toBe('3.50,44')
  })
})

describe('diagnostics', () => {
  const errorsOf = (src, opts) => compile(src, { intBits: 16, ...opts }).errors

  it('reports a missing semicolon at the right line and column', () => {
    expect(errorsOf('void setup(){\n  int a = 1\n}\nvoid loop(){}')[0])
      .toMatchObject({ line: 3, col: 1, message: "expected ';' before '}'", severity: 'error' })
  })

  it('reports an undeclared identifier being written to', () => {
    expect(errorsOf('void setup(){\n  counter = 5;\n}\nvoid loop(){}')[0])
      .toMatchObject({ line: 2, col: 3, message: "'counter' was not declared in this scope" })
  })

  it('reports missing setup()/loop()', () => {
    expect(errorsOf('void setup(){}').map((e) => e.message)).toEqual(['loop() not defined'])
    expect(errorsOf('void loop(){}').map((e) => e.message)).toEqual(['setup() not defined'])
  })

  it('reports a declared-but-never-defined function that is called', () => {
    expect(errorsOf('int helper(int a);\nvoid setup(){ helper(1); }\nvoid loop(){}')[0])
      .toMatchObject({ line: 1, message: "'helper' was not declared in this scope" })
  })

  it('turns free identifiers into errors when knownNames is supplied', () => {
    const src = 'void setup(){ touchRead(4); }\nvoid loop(){}'
    expect(errorsOf(src)).toEqual([])
    expect(errorsOf(src, { knownNames: ['Serial'] })[0])
      .toMatchObject({ line: 1, col: 15, message: "'touchRead' was not declared in this scope" })
  })

  it('reports lexical errors with a position', () => {
    expect(errorsOf('void setup(){}\nvoid loop(){ @ }')[0]).toMatchObject({ line: 2, col: 14 })
  })
})

describe('classesUsed / globalsUsed / includes', () => {
  it('collects what the runtime needs to check against the board libraries', () => {
    const src = [
      '#include <WiFi.h>',
      '#include <PubSubClient.h>',
      'WiFiClient net;',
      'PubSubClient mqtt(net);',
      'void setup(){ WiFi.begin(SSID_NAME, "pw"); touchRead(4); digitalWrite(LED_BUILTIN, HIGH); }',
      'void loop(){}',
    ].join('\n')
    const r = compile(src, { intBits: 32 })
    expect(r.ok).toBe(true)
    expect(r.includes).toEqual(['WiFi.h', 'PubSubClient.h'])
    expect(r.classesUsed).toEqual(expect.arrayContaining(['WiFiClient', 'PubSubClient', 'WiFi']))
    expect(r.globalsUsed).toEqual(expect.arrayContaining(['WiFi', 'SSID_NAME', 'touchRead', 'digitalWrite', 'LED_BUILTIN', 'HIGH']))
    expect(r.globalsUsed).not.toContain('net')
    expect(r.globalsUsed).not.toContain('mqtt')
  })

  it('does not report sketch-defined names as free', () => {
    const r = compile('int total = 0;\nint add(int a){ return a + total; }\nvoid setup(){ add(1); }\nvoid loop(){}', { intBits: 16 })
    expect(r.globalsUsed).toEqual([])
    expect(r.classesUsed).toEqual([])
  })
})

describe('formatValue', () => {
  it('renders each type the way Arduino Print does', () => {
    expect(formatValue(65, 'char')).toBe('A')
    expect(formatValue(3, 'float')).toBe('3.00')
    expect(formatValue(3.14159, 'float', 3)).toBe('3.142')
    expect(formatValue(1, 'bool')).toBe('1')
    expect(formatValue(0, 'bool')).toBe('0')
    expect(formatValue(255, 'int', 16)).toBe('FF')
    expect(formatValue(255, 'byte', 2)).toBe('11111111')
    expect(formatValue(64, 'int', 8)).toBe('100')
    expect(formatValue(-1, 'int', 16, 16)).toBe('FFFF')
    expect(formatValue(-1, 'int', 16, 32)).toBe('FFFFFFFF')
    expect(formatValue('hey', 'String')).toBe('hey')
  })

  it('falls back safely when the type is unknown — never as a char', () => {
    expect(formatValue(65)).toBe('65')
    expect(formatValue(7.5)).toBe('7.50')
    expect(formatValue(65, 'unknown')).toBe('65')
  })

  it('renders objects through __toString and char arrays as text', () => {
    expect(formatValue({ __toString: () => '192.168.4.1' })).toBe('192.168.4.1')
    expect(formatValue({ __class: 'Servo' })).toBe('[object]')
    expect(formatValue([104, 105, 0, 0])).toBe('hi')
    expect(formatValue(null)).toBe('')
  })
})
