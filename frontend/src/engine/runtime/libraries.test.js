import { describe, it, expect } from 'vitest'
import { sketch } from './testHarness.js'

const binding = (protocol, pins, extra = {}) => ({ componentId: protocol, protocol, powered: true, pins, ...extra })

describe('device libraries', () => {
  it('drives a servo and follows binding changes', () => {
    const run = sketch('#include <Servo.h>\nServo motor; void setup() { motor.attach(9); } void loop() { motor.write(45); delay(10); }', {
      env: { peripheralMap: [binding('servo', { signal: 'D9' })] },
    })
    run.advance(1)
    expect(run.ofType('peripheral').at(-1)).toMatchObject({ componentId: 'servo', protocol: 'servo', data: { angle: 45 } })
    run.runtime.handle({ type: 'env', peripheralMap: [] })
    run.advance(30)
    expect(run.ofType('log').filter((message) => message.code === 'unbound_device')).toHaveLength(1)
    expect(run.ofType('peripheral')).toHaveLength(2)
  })

  it('renders LCD text and OLED page bytes on bound I2C devices', () => {
    const run = sketch('#include <LiquidCrystal_I2C.h>\n#include <Adafruit_SSD1306.h>\nLiquidCrystal_I2C lcd(0x27, 16, 2); Adafruit_SSD1306 display(128, 64); void setup() { lcd.init(); lcd.setCursor(0, 1); lcd.print("VoltQuest"); display.begin(SSD1306_SWITCHCAPVCC, 0x3c); display.clearDisplay(); display.drawPixel(2, 9, WHITE); display.display(); } void loop() { delay(1000); }', {
      env: { peripheralMap: [binding('lcd_i2c', { sda: 'A4', scl: 'A5' }, { i2cAddress: 0x27 }), binding('oled_i2c', { sda: 'A4', scl: 'A5' }, { i2cAddress: 0x3c })] },
    })
    run.advance(1)
    const events = run.ofType('peripheral')
    expect(events.findLast((message) => message.protocol === 'lcd_i2c').data.lines).toEqual(['                ', 'VoltQuest       '])
    const display = events.find((message) => message.protocol === 'oled_i2c').data
    expect(display.pixels).toHaveLength(1024)
    expect(display.pixels[130]).toBe(2)
    expect(display.pixels.reduce((total, value) => total + value, 0)).toBe(2)
  })

  it('publishes NeoPixel colors and brightness without mutating earlier messages', () => {
    const run = sketch('#include <Adafruit_NeoPixel.h>\nAdafruit_NeoPixel ring(12, 6, NEO_GRB + NEO_KHZ800); void setup() { ring.begin(); ring.setPixelColor(0, ring.Color(255, 16, 8)); ring.setBrightness(64); ring.show(); ring.clear(); ring.show(); } void loop() { delay(1000); }', {
      env: { peripheralMap: [binding('neopixel', { din: 'D6' })] },
    })
    run.advance(1)
    const events = run.ofType('peripheral')
    expect(events[0].data).toMatchObject({ brightness: 64, pixels: [[255, 16, 8], ...Array.from({ length: 11 }, () => [0, 0, 0])] })
    expect(events[1].data.pixels[0]).toEqual([0, 0, 0])
  })

  it('reads DHT and BME controls and reports unavailable sensors', () => {
    const run = sketch('#include <DHT.h>\n#include <Adafruit_BME280.h>\nDHT sensor(2, DHT22); Adafruit_BME280 weather; void setup() { sensor.begin(); Serial.println(sensor.readTemperature()); Serial.println(sensor.readHumidity()); Serial.println(weather.begin(0x76)); Serial.println(weather.readPressure()); } void loop() { delay(1000); }', {
      env: { peripheralMap: [binding('dht', { data: 'D2' }), binding('bme280_i2c', { sda: 'A4', scl: 'A5' }, { i2cAddress: 0x76 })], peripherals: { dht: { temperatureC: 30, humidity: 60 }, bme280_i2c: { pressureHpa: 1000 } } },
    })
    run.advance(1)
    expect(run.text()).toBe('30.00\n60.00\n1\n100000.00\n')
    const missing = sketch('#include <DHT.h>\nDHT sensor(2, DHT22); void setup() { Serial.println(sensor.readTemperature()); } void loop() { delay(1000); }')
    missing.advance(1)
    expect(missing.text()).toBe('nan\n')
  })
})

describe('ESP32 libraries', () => {
  it('supports ADC1, attenuation, touch, PWM and DAC without driving input-only pins', () => {
    const run = sketch('void setup() { analogWrite(34, 200); pinMode(35, OUTPUT); analogWrite(18, 128); dacWrite(25, 128); Serial.println(analogRead(34)); analogSetPinAttenuation(34, ADC_0db); Serial.println(analogRead(34)); Serial.println(touchRead(T0)); } void loop() { delay(1000); }', {
      board: 'esp32', env: { analog: { GPIO34: 1.65 }, touch: { GPIO4: 15 } },
    })
    run.advance(1)
    expect(run.text()).toBe('2048\n4095\n15\n')
    const pins = run.runtime.getPinStates()
    expect(pins.GPIO34).toBeUndefined()
    expect(pins.GPIO18).toMatchObject({ mode: 'pwm', duty: 128 / 255 })
    expect(pins.GPIO25.value).toBeCloseTo(128 / 255 * 3.3)
    expect(run.ofType('log').filter((message) => message.code === 'input_only_pin')).toHaveLength(2)
  })

  it.each(['esp32', 'esp32s3'])('connects WiFi while sleeping on %s', (board) => {
    const run = sketch('#include <WiFi.h>\nvoid setup() { WiFi.begin("VoltNet", "anything"); delay(1000); Serial.println(WiFi.localIP()); } void loop() { delay(1000); }', { board })
    run.advance(600)
    expect(run.ofType('wifi').at(-1)).toMatchObject({ status: 'connected', ip: '192.168.4.1' })
    expect(run.ofType('wifi').at(-1).t - run.ofType('wifi')[0].t).toBe(500000)
    run.advance(500)
    expect(run.text()).toBe('192.168.4.1\n')
  })

  it('blocks ESP32 ADC2 while WiFi is connected', () => {
    const run = sketch('#include <WiFi.h>\nvoid setup() { WiFi.softAP("Lab"); Serial.println(analogRead(4)); Serial.println(analogRead(34)); } void loop() { delay(1000); }', { board: 'esp32', env: { analog: { GPIO4: 3.3, GPIO34: 3.3 } } })
    run.advance(1)
    expect(run.text()).toBe('0\n4095\n')
    expect(run.ofType('log').map((message) => message.code)).toContain('adc2_wifi')
  })

  it('runs HTTP handlers with query/form arguments, headers, and fallback responses', () => {
    const run = sketch('#include <WiFi.h>\n#include <WebServer.h>\nWebServer server(80); void setup() { WiFi.softAP("Lab"); pinMode(2, OUTPUT); server.on("/led", HTTP_POST, []() { digitalWrite(2, HIGH); server.sendHeader("X-Lab", "ok"); server.send(200, "text/plain", server.arg("value")); }); server.on("/empty", []() {}); server.begin(); } void loop() { server.handleClient(); delay(1); }', { board: 'esp32' })
    run.advance(1)
    run.runtime.handle({ type: 'httpRequest', id: 'post', path: '/led?mode=on', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'value=hello+world' })
    run.runtime.handle({ type: 'httpRequest', id: 'missing', path: '/missing', method: 'GET' })
    run.runtime.handle({ type: 'httpRequest', id: 'empty', path: '/empty', method: 'GET' })
    run.advance(5)
    expect(run.ofType('httpResponse')).toMatchObject([
      { id: 'post', status: 200, contentType: 'text/plain', headers: { 'X-Lab': 'ok' }, body: 'hello world' },
      { id: 'missing', status: 404 }, { id: 'empty', status: 500 },
    ])
    expect(run.runtime.getPinStates().GPIO2.level).toBe(1)
  })

  it('connects MQTT after 200 ms and invokes the inbound byte-array callback', () => {
    const run = sketch('#include <WiFi.h>\n#include <PubSubClient.h>\nWiFiClient transport; PubSubClient client(transport); void received(char* topic, byte* payload, unsigned int length) { Serial.print(topic); Serial.print(":"); for (unsigned int index = 0; index < length; index++) Serial.write(payload[index]); } void setup() { WiFi.softAP("Lab"); client.setServer("broker.voltquest", 1883); client.setCallback(received); client.connect("weather"); client.subscribe("lab/#"); client.publish("lab/ready", "yes"); } void loop() { client.loop(); delay(1); }', { board: 'esp32' })
    run.advance(100)
    expect(run.ofType('mqtt')).toEqual([])
    run.advance(110)
    expect(run.ofType('mqtt').find((message) => message.event === 'connect')).toMatchObject({ ok: true, clientId: 'weather' })
    run.runtime.handle({ type: 'mqttInbound', topic: 'lab/temp', payload: '24.5' })
    run.advance(10)
    expect(run.text()).toBe('lab/temp:24.5')
  })

  it('supports legacy and modern LEDC addressing', () => {
    const run = sketch('void setup() { ledcSetup(0, 5000, 10); ledcAttachPin(18, 0); ledcWrite(0, 512); ledcAttach(19, 1000, 8); ledcWrite(19, 64); } void loop() { delay(1000); }', { board: 'esp32' })
    run.advance(1)
    expect(run.runtime.getPinStates()).toMatchObject({ GPIO18: { duty: 512 / 1023, freq: 5000 }, GPIO19: { duty: 64 / 255, freq: 1000 } })
  })
})
