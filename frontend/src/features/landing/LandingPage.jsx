import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  BookOpen,
  Bot,
  CheckCircle2,
  Code,
  Cpu,
  Globe,
  Play,
  ShieldCheck,
  Sparkles,
  Terminal,
  Wifi,
  Wrench,
  Zap,
} from 'lucide-react'
import { useI18n } from '../../i18n/index.jsx'
import { AppHeader } from '../workspace/AppHeader.jsx'
import { Badge, Button, Card, cx } from '../../ui/index.js'

/**
 * Interactive Hardware + Software Demo Component for the Landing Page.
 * Lets users immediately feel the physical reactivity of code touching silicon.
 */
function InteractiveConvergenceDemo() {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState('sensor') // 'sensor' | 'iot' | 'drone'
  const [sensorVal, setSensorVal] = useState(65)
  const [btnPressed, setBtnPressed] = useState(false)
  const [iotLedState, setIotLedState] = useState(true)
  const [iotRequests, setIotRequests] = useState(1)
  const [droneThrottle, setDroneThrottle] = useState(58)

  // Computed electrical / physical state for Mode 1 (Sensor & PWM Actuation)
  const effectiveDuty = btnPressed ? 100 : sensorVal
  const ledVoltage = effectiveDuty === 0 ? 0 : 1.95 + (effectiveDuty / 100) * 0.25
  const ledCurrentMa = effectiveDuty === 0 ? 0 : Number(((effectiveDuty / 100) * 14.2).toFixed(1))
  const totalPowerMw = Number((ledVoltage * ledCurrentMa).toFixed(1))
  const ledBrightness = effectiveDuty === 0 ? 0 : Math.sqrt(effectiveDuty / 100)

  // Computed state for Mode 3 (Drone PID Flight)
  const m1Rpm = Math.round(12000 + (droneThrottle / 100) * 11000)
  const m2Rpm = Math.round(12000 + (droneThrottle / 100) * 11050)
  const m3Rpm = Math.round(12000 + (droneThrottle / 100) * 11000)
  const m4Rpm = Math.round(12000 + (droneThrottle / 100) * 11050)
  const twr = Number(((droneThrottle / 50) * 1.8).toFixed(2))
  const batteryV = Number((14.8 - (droneThrottle / 100) * 0.5).toFixed(2))

  return (
    <div className="rounded-xl border border-line bg-surface-panel p-3.5 sm:p-5 md:p-6 shadow-sm">
      {/* Scenario Selector Header */}
      <div className="flex flex-col gap-3 border-b border-line pb-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700">
            <Activity size={16} />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink md:text-base">
              {t("Live Simulation: See Hardware + Software in Action")}
            </h2>
            <p className="text-xs text-slate-500">
              {t("Test real-time deterministic simulation directly in your browser.")}
            </p>
          </div>
        </div>

        {/* Demo Mode Pills */}
        <div className="grid grid-cols-1 gap-1.5 w-full min-[480px]:grid-cols-3 sm:flex sm:w-auto sm:flex-wrap" role="tablist" aria-label={t("Demo scenarios")}>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'sensor'}
            onClick={() => setActiveTab('sensor')}
            className={cx(
              'rounded-md px-3 py-2 sm:py-1.5 text-xs font-medium transition-colors text-center truncate',
              activeTab === 'sensor'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-surface-sunken text-slate-600 hover:bg-slate-200 hover:text-ink',
            )}
          >
            {t("1. Sensor & PWM Feedback")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'iot'}
            onClick={() => setActiveTab('iot')}
            className={cx(
              'rounded-md px-3 py-2 sm:py-1.5 text-xs font-medium transition-colors text-center truncate',
              activeTab === 'iot'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-surface-sunken text-slate-600 hover:bg-slate-200 hover:text-ink',
            )}
          >
            {t("2. Virtual IoT Web Server")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'drone'}
            onClick={() => setActiveTab('drone')}
            className={cx(
              'rounded-md px-3 py-2 sm:py-1.5 text-xs font-medium transition-colors text-center truncate',
              activeTab === 'drone'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-surface-sunken text-slate-600 hover:bg-slate-200 hover:text-ink',
            )}
          >
            {t("3. 1 kHz Quad Drone PID")}
          </button>
        </div>
      </div>

      {/* Main Interactive Sandbox Grid */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-12">
        {/* Left: Physical Circuit & Real-time Telemetry (7 cols) */}
        <div className="flex flex-col justify-between rounded-lg border border-line bg-surface-sunken p-3 sm:p-4 lg:col-span-7">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 truncate">
                {t("Physical Domain (Circuits, Silicon & Physics)")}
              </span>
              <Badge tone={activeTab === 'sensor' ? 'brand' : activeTab === 'iot' ? 'info' : 'volt'}>
                {activeTab === 'sensor' ? t("ESP32 @ 3.3V") : activeTab === 'iot' ? t("ESP32-S3 WiFi") : t("Quad-X 5\" 4S")}
              </Badge>
            </div>

            {/* Scenario 1: Sensor & LED */}
            {activeTab === 'sensor' && (
              <div className="mt-4 space-y-4">
                {/* Circuit Canvas Mockup */}
                <div className="relative flex flex-col items-center justify-center rounded-lg border border-line bg-white p-4 sm:p-6">
                  {/* Glowing LED */}
                  <div className="flex flex-col items-center">
                    <div
                      className="h-14 w-14 sm:h-16 sm:w-16 rounded-full transition-all duration-150 flex items-center justify-center border-2 border-emerald-400"
                      style={{
                        backgroundColor: `rgba(16, 185, 129, ${Math.max(0.15, ledBrightness)})`,
                        boxShadow: effectiveDuty > 0 ? `0 0 ${Math.round(ledBrightness * 32)}px rgba(16, 185, 129, 0.8)` : 'none',
                      }}
                    >
                      <Zap
                        size={24}
                        className={effectiveDuty > 0 ? 'text-white drop-shadow' : 'text-slate-300'}
                      />
                    </div>
                    <span className="mt-2 font-mono text-xs font-semibold text-ink text-center">
                      {effectiveDuty > 0 ? t("LED Active (GPIO18)") : t("LED Off")}
                    </span>
                    <span className="font-mono text-xxs text-slate-500 text-center">
                      {t("Series: 220 Ω resistor on Pin 18")}
                    </span>
                  </div>

                  {/* Interactive Inputs */}
                  <div className="mt-5 w-full space-y-3 rounded-md border border-line bg-slate-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                      <label htmlFor="landing-pot-slider" className="font-medium text-ink">
                        {t("Analog Light Sensor / Pot (GPIO34):")}
                      </label>
                      <span className="font-mono font-bold text-brand-700">{Math.round((sensorVal / 100) * 4095)} ADC ({sensorVal}%)</span>
                    </div>
                    <input
                      id="landing-pot-slider"
                      type="range"
                      min="0"
                      max="100"
                      value={sensorVal}
                      onChange={(e) => setSensorVal(Number(e.target.value))}
                      className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-brand-600"
                    />

                    <div className="flex flex-col gap-2 min-[440px]:flex-row min-[440px]:items-center min-[440px]:justify-between pt-1">
                      <span className="text-xs text-slate-600">{t("Override with Pushbutton (GPIO4):")}</span>
                      <button
                        type="button"
                        onMouseDown={() => setBtnPressed(true)}
                        onMouseUp={() => setBtnPressed(false)}
                        onTouchStart={() => setBtnPressed(true)}
                        onTouchEnd={() => setBtnPressed(false)}
                        className={cx(
                          'w-full min-[440px]:w-auto rounded-md px-3 py-2 min-[440px]:py-1 text-xs font-semibold transition-all select-none text-center',
                          btnPressed
                            ? 'bg-brand-700 text-white shadow-inner translate-y-0.5'
                            : 'bg-white border border-line-strong text-ink hover:bg-slate-100 shadow-sm',
                        )}
                      >
                        {btnPressed ? t("● Button Held (100% Force)") : t("Hold Pushbutton")}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Live Electrical Readings */}
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  <div className="rounded-md border border-line bg-white p-2 sm:p-2.5 text-center">
                    <span className="block text-xxs font-medium uppercase tracking-tight text-slate-500 truncate">{t("Node Voltage")}</span>
                    <span className="font-mono text-xs sm:text-sm font-bold text-ink">{ledVoltage.toFixed(2)} V</span>
                  </div>
                  <div className="rounded-md border border-line bg-white p-2 sm:p-2.5 text-center">
                    <span className="block text-xxs font-medium uppercase tracking-tight text-slate-500 truncate">{t("Through Current")}</span>
                    <span className="font-mono text-xs sm:text-sm font-bold text-emerald-600">{ledCurrentMa} mA</span>
                  </div>
                  <div className="rounded-md border border-line bg-white p-2 sm:p-2.5 text-center">
                    <span className="block text-xxs font-medium uppercase tracking-tight text-slate-500 truncate">{t("Power Dissipation")}</span>
                    <span className="font-mono text-xs sm:text-sm font-bold text-volt-600">{totalPowerMw} mW</span>
                  </div>
                </div>
              </div>
            )}

            {/* Scenario 2: Virtual IoT */}
            {activeTab === 'iot' && (
              <div className="mt-4 space-y-4">
                <div className="rounded-lg border border-line bg-white p-3.5 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                    <div className="flex items-center gap-2">
                      <Wifi size={16} className="text-emerald-600 shrink-0" />
                      <span className="font-mono text-xs font-semibold text-ink truncate">ESP32_AP (192.168.4.1)</span>
                    </div>
                    <Badge tone="success">{t("HTTP Server Ready")}</Badge>
                  </div>

                  {/* Virtual Phone Client Simulator */}
                  <div className="my-4 rounded-lg border border-line-strong bg-slate-900 p-3 sm:p-4 text-white shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-1 border-b border-slate-700 pb-2 text-xxs text-slate-400">
                      <span>{t("Virtual Smartphone Browser")}</span>
                      <span className="font-mono truncate max-w-full">GET http://192.168.4.1/toggle</span>
                    </div>

                    <div className="mt-3 flex flex-col gap-2 min-[440px]:flex-row min-[440px]:items-center min-[440px]:justify-between">
                      <div>
                        <div className="text-xs font-semibold">{t("Smart Home Actuator")}</div>
                        <div className="text-xxs text-slate-400">
                          {t("State:")} <span className={iotLedState ? 'text-emerald-400 font-bold' : 'text-slate-400'}>{iotLedState ? 'HIGH (ON)' : 'LOW (OFF)'}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIotLedState(!iotLedState)
                          setIotRequests((r) => r + 1)
                        }}
                        className="w-full min-[440px]:w-auto rounded-md bg-brand-600 px-3 py-2 min-[440px]:py-1.5 text-xs font-semibold text-white transition-transform active:scale-95 hover:bg-brand-500 text-center"
                      >
                        {t("Toggle Switch (HTTP)")}
                      </button>
                    </div>

                    <div className="mt-3 rounded bg-slate-950 p-2 font-mono text-xxs text-emerald-400 overflow-x-auto break-all">
                      HTTP/1.1 200 OK • Content-Type: application/json<br />
                      {`{"status": "${iotLedState ? 'active' : 'idle'}", "gpio18": ${iotLedState ? 1 : 0}, "requests": ${iotRequests}}`}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  <div className="rounded-md border border-line bg-white p-2 sm:p-2.5 text-center">
                    <span className="block text-xxs font-medium uppercase tracking-tight text-slate-500 truncate">{t("IP Endpoint")}</span>
                    <span className="font-mono text-xs font-bold text-ink">192.168.4.1</span>
                  </div>
                  <div className="rounded-md border border-line bg-white p-2 sm:p-2.5 text-center">
                    <span className="block text-xxs font-medium uppercase tracking-tight text-slate-500 truncate">{t("Total Requests")}</span>
                    <span className="font-mono text-xs font-bold text-brand-600">{iotRequests} req</span>
                  </div>
                  <div className="rounded-md border border-line bg-white p-2 sm:p-2.5 text-center">
                    <span className="block text-xxs font-medium uppercase tracking-tight text-slate-500 truncate">{t("GPIO18 State")}</span>
                    <span className="font-mono text-xs font-bold text-emerald-600">{iotLedState ? '3.30 V' : '0.00 V'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Scenario 3: Quad Drone PID */}
            {activeTab === 'drone' && (
              <div className="mt-4 space-y-4">
                <div className="rounded-lg border border-line bg-white p-3.5 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-line pb-2">
                    <span className="font-mono text-xs font-semibold text-ink truncate">{'Quad-X 5" Frame • 1 kHz Dynamics'}</span>
                    <Badge tone="volt">TWR {twr} : 1</Badge>
                  </div>

                  <div className="my-4 grid grid-cols-2 gap-2.5 py-2 sm:grid-cols-4 sm:gap-6">
                    <div className="rounded-md border border-line bg-slate-50/70 p-2 text-center sm:border-0 sm:bg-transparent sm:p-0">
                      <div className="font-mono text-xs font-bold text-brand-700">M1 (CW)</div>
                      <div className="font-mono text-xs sm:text-sm text-ink">{m1Rpm.toLocaleString()} RPM</div>
                    </div>
                    <div className="rounded-md border border-line bg-slate-50/70 p-2 text-center sm:border-0 sm:bg-transparent sm:p-0">
                      <div className="font-mono text-xs font-bold text-brand-700">M2 (CCW)</div>
                      <div className="font-mono text-xs sm:text-sm text-ink">{m2Rpm.toLocaleString()} RPM</div>
                    </div>
                    <div className="rounded-md border border-line bg-slate-50/70 p-2 text-center sm:border-0 sm:bg-transparent sm:p-0">
                      <div className="font-mono text-xs font-bold text-brand-700">M3 (CCW)</div>
                      <div className="font-mono text-xs sm:text-sm text-ink">{m3Rpm.toLocaleString()} RPM</div>
                    </div>
                    <div className="rounded-md border border-line bg-slate-50/70 p-2 text-center sm:border-0 sm:bg-transparent sm:p-0">
                      <div className="font-mono text-xs font-bold text-brand-700">M4 (CW)</div>
                      <div className="font-mono text-xs sm:text-sm text-ink">{m4Rpm.toLocaleString()} RPM</div>
                    </div>
                  </div>

                  <div className="space-y-2 rounded-md border border-line bg-slate-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                      <label htmlFor="landing-drone-throttle" className="font-medium text-ink">{t("Transmitter Throttle (CH3):")}</label>
                      <span className="font-mono font-bold text-brand-700">{droneThrottle}% (PWM 1{droneThrottle + 10}0 µs)</span>
                    </div>
                    <input
                      id="landing-drone-throttle"
                      type="range"
                      min="0"
                      max="100"
                      value={droneThrottle}
                      onChange={(e) => setDroneThrottle(Number(e.target.value))}
                      className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-volt-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  <div className="rounded-md border border-line bg-white p-2 sm:p-2.5 text-center">
                    <span className="block text-xxs font-medium uppercase tracking-tight text-slate-500 truncate">{t("4S LiPo Voltage")}</span>
                    <span className="font-mono text-xs sm:text-sm font-bold text-ink">{batteryV} V</span>
                  </div>
                  <div className="rounded-md border border-line bg-white p-2 sm:p-2.5 text-center">
                    <span className="block text-xxs font-medium uppercase tracking-tight text-slate-500 truncate">{t("PID Loop Rate")}</span>
                    <span className="font-mono text-xs sm:text-sm font-bold text-emerald-600">1,000 Hz</span>
                  </div>
                  <div className="rounded-md border border-line bg-white p-2 sm:p-2.5 text-center">
                    <span className="block text-xxs font-medium uppercase tracking-tight text-slate-500 truncate">{t("Flight State")}</span>
                    <span className="font-mono text-xs sm:text-sm font-bold text-brand-700 truncate">{droneThrottle > 45 ? t("Airborne") : t("Ground")}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-t border-line pt-2 text-xxs text-slate-500">
            <span className="truncate">• {t("Exact Ohm's law & MNA nodal circuit solver")}</span>
            <span className="font-mono text-emerald-700 font-semibold shrink-0">{t("60 FPS Deterministic")}</span>
          </div>
        </div>

        {/* Right: Embedded Software & Output Console (5 cols) */}
        <div className="flex flex-col justify-between rounded-lg border border-slate-800 bg-slate-950 p-3 sm:p-4 font-mono text-white shadow-sm lg:col-span-5">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-xxs text-slate-400">
              <span className="flex items-center gap-1.5 font-semibold text-slate-300 truncate">
                <Code size={13} className="text-brand-400 shrink-0" />
                <span className="truncate">{activeTab === 'sensor' ? 'main.cpp (C++)' : activeTab === 'iot' ? 'web_server.ino' : 'flight_pid.cpp'}</span>
              </span>
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300 shrink-0">
                {activeTab === 'sensor' ? 'ESP32 C++' : activeTab === 'iot' ? 'ESP32-S3' : 'VoltFlight 1kHz'}
              </span>
            </div>

            {/* Code Block */}
            <div className="my-3 space-y-1 text-xs overflow-x-auto py-1">
              {activeTab === 'sensor' && (
                <>
                  <div className="text-slate-500 whitespace-pre">{'// Read analog sensor & calculate PWM output'}</div>
                  <div className="text-slate-300 whitespace-pre">
                    <span className="text-rose-400">int</span> sensorRaw = <span className="text-blue-400">analogRead</span>(34);
                  </div>
                  <div className="text-slate-300 whitespace-pre">
                    <span className="text-rose-400">int</span> duty = <span className="text-blue-400">map</span>(sensorRaw, 0, 4095, 0, 255);
                  </div>
                  <div className="rounded bg-brand-950/80 px-1.5 py-0.5 text-brand-300 border-l-2 border-brand-400 whitespace-pre">
                    <span className="text-blue-400">analogWrite</span>(18, {btnPressed ? 255 : Math.round((sensorVal / 100) * 255)}); <span className="text-slate-500">{'// Active Pin'}</span>
                  </div>
                  <div className="text-slate-400 whitespace-pre">
                    Serial.<span className="text-blue-400">printf</span>(<span className="text-amber-300">&quot;ADC:%d -&gt; PWM:%d\n&quot;</span>, sensorRaw, duty);
                  </div>
                </>
              )}

              {activeTab === 'iot' && (
                <>
                  <div className="text-slate-500 whitespace-pre">{'// RESTful Web Server Route Handler'}</div>
                  <div className="text-slate-300 whitespace-pre">
                    server.<span className="text-blue-400">on</span>(<span className="text-amber-300">&quot;/toggle&quot;</span>, HTTP_GET, []() {'{'}
                  </div>
                  <div className="pl-3 text-slate-300 whitespace-pre">
                    ledState = !ledState;
                  </div>
                  <div className="pl-3 rounded bg-brand-950/80 px-1.5 py-0.5 text-brand-300 border-l-2 border-brand-400 whitespace-pre">
                    <span className="text-blue-400">digitalWrite</span>(18, {iotLedState ? 'HIGH' : 'LOW'});
                  </div>
                  <div className="pl-3 text-slate-400 whitespace-pre">
                    server.<span className="text-blue-400">send</span>(200, <span className="text-amber-300">&quot;application/json&quot;</span>, json);
                  </div>
                  <div className="text-slate-300 whitespace-pre">{'}'});</div>
                </>
              )}

              {activeTab === 'drone' && (
                <>
                  <div className="text-slate-500 whitespace-pre">{'// 1 kHz Quaternion Attitude Loop'}</div>
                  <div className="text-slate-300 whitespace-pre">
                    Quaternion q = ahrs.<span className="text-blue-400">getOrientation</span>();
                  </div>
                  <div className="text-slate-300 whitespace-pre">
                    <span className="text-rose-400">float</span> rateError = targetRate - gyroRate;
                  </div>
                  <div className="rounded bg-brand-950/80 px-1.5 py-0.5 text-brand-300 border-l-2 border-brand-400 whitespace-pre">
                    <span className="text-rose-400">float</span> correction = pidPitch.<span className="text-blue-400">compute</span>(rateError);
                  </div>
                  <div className="text-slate-300 whitespace-pre">
                    esc.<span className="text-blue-400">writeMicroseconds</span>(motor, throttle + correction);
                  </div>
                </>
              )}
            </div>

            {/* Serial / Terminal Output Log */}
            <div className="mt-3 border-t border-slate-800 pt-2">
              <div className="flex items-center gap-1 text-xxs text-slate-500 mb-1">
                <Terminal size={11} className="shrink-0" />
                <span className="truncate">{t("Live Serial Output (115200 baud):")}</span>
              </div>
              <div className="h-24 overflow-y-auto overflow-x-auto rounded bg-black/70 p-2 font-mono text-xxs text-emerald-400 whitespace-pre-wrap break-all sm:break-normal">
                {activeTab === 'sensor' && (
                  <>
                    [SYS] Core 1 initialized • 240 MHz<br />
                    [ADC] GPIO34: {Math.round((sensorVal / 100) * 4095)} • Vref: 3.30V<br />
                    [PWM] GPIO18 set to {effectiveDuty}% duty ({ledVoltage.toFixed(2)}V, {ledCurrentMa}mA)<br />
                    {btnPressed && <span className="text-amber-300">[INT] GPIO4 External interrupt triggered!</span>}
                  </>
                )}
                {activeTab === 'iot' && (
                  <>
                    [WIFI] Connected to AP: ESP32_AP (RSSI: -42 dBm)<br />
                    [HTTP] GET /toggle • Client: 192.168.4.2<br />
                    [GPIO] GPIO18 -&gt; {iotLedState ? 'HIGH (1)' : 'LOW (0)'} • 200 OK sent<br />
                    [TELEMETRY] Total requests processed: {iotRequests}
                  </>
                )}
                {activeTab === 'drone' && (
                  <>
                    [IMU] MPU6050 calibrated • Accel +-8g, Gyro +-2000 dps<br />
                    [PID] P: 1.42, I: 0.05, D: 0.008 • dt: 1000 us<br />
                    [ESC] Motors M1..M4 armed • Throttle: {droneThrottle}%<br />
                    [AHRS] Roll: 0.02 deg • Pitch: -0.01 deg • TWR: {twr}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-t border-slate-800 pt-2 text-xxs text-slate-400">
            <span className="flex items-center gap-1 text-brand-300 font-semibold truncate">
              <Bot size={12} className="shrink-0" />
              {t("MCP & AI Assistant Connected")}
            </span>
            <span className="text-slate-500 shrink-0">{t("In-Browser Cooperative VM")}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Main Landing Page Component
 */
export function LandingPage() {
  const { t } = useI18n()
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen flex-col bg-surface-page text-ink selection:bg-brand-100 selection:text-brand-900">
      <AppHeader />

      <main className="flex-1">
        {/* ==================================================================== */}
        {/* HERO SECTION */}
        {/* ==================================================================== */}
        <section className="relative border-b border-line bg-gradient-to-b from-white via-surface-page to-surface-sunken/40 py-10 sm:py-12 md:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-3xl text-center">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
                  <Zap size={10} fill="currentColor" />
                </span>
                <span className="truncate">{t("Physical Computing & Simulation Laboratory")}</span>
              </div>

              {/* Main Punchy Headline (The Prompt's Core Message) */}
              <h1 className="mt-5 sm:mt-6 text-2xl min-[480px]:text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-ink md:leading-tight break-words">
                {t("In the age of AI, the future lies not on software, not on hardware, but")}{' '}
                <span className="text-brand-600 underline decoration-volt-400 decoration-wavy decoration-2">
                  {t("hardware + software")}
                </span>
                .
              </h1>

              {/* Subheadline / Value Proposition */}
              <p className="mt-4 sm:mt-5 text-sm sm:text-base md:text-lg text-ink-secondary md:leading-relaxed">
                {t(
                  "VoltQuest is an interactive in-browser lab for electronics, microcontroller firmware, IoT protocols, and autonomous drone physics. Code native Arduino C++ and Raspberry Pi Python directly connected to real circuit simulation.",
                )}
              </p>

              {/* Primary & Secondary Call to Actions */}
              <div className="mt-7 sm:mt-8 flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3">
                <Button
                  size="lg"
                  variant="primary"
                  icon={<Play size={16} fill="currentColor" />}
                  onClick={() => navigate('/campaign')}
                  className="w-full sm:w-auto shadow-sm"
                >
                  {t("Start Campaign Quests")}
                </Button>

                <Button
                  size="lg"
                  variant="secondary"
                  icon={<BookOpen size={16} />}
                  onClick={() => navigate('/tutorials')}
                  className="w-full sm:w-auto"
                >
                  {t("Explore Tutorials (35 Lessons)")}
                </Button>

                <Button
                  size="lg"
                  variant="secondary"
                  icon={<Wrench size={16} />}
                  onClick={() => navigate('/sandbox')}
                  className="w-full sm:w-auto"
                >
                  {t("Open Sandbox")}
                </Button>
              </div>

              {/* Quick Spec Highlights */}
              <div className="mt-8 sm:mt-10 grid grid-cols-2 gap-2 sm:gap-3 pt-6 border-t border-line text-left sm:grid-cols-4">
                <div className="rounded-lg border border-line bg-white p-2.5 sm:p-3">
                  <span className="block text-xxs font-medium uppercase tracking-wider text-slate-500 truncate">{t("Campaign Quests")}</span>
                  <span className="font-mono text-base sm:text-lg font-bold text-ink">20 {t("Levels")}</span>
                  <span className="block text-xxs text-slate-500 truncate">{t("5 worlds & 3-star gates")}</span>
                </div>
                <div className="rounded-lg border border-line bg-white p-2.5 sm:p-3">
                  <span className="block text-xxs font-medium uppercase tracking-wider text-slate-500 truncate">{t("Guided Lessons")}</span>
                  <span className="font-mono text-base sm:text-lg font-bold text-brand-600">35 {t("Tutorials")}</span>
                  <span className="block text-xxs text-slate-500 truncate">{t("Easy to Hard progression")}</span>
                </div>
                <div className="rounded-lg border border-line bg-white p-2.5 sm:p-3">
                  <span className="block text-xxs font-medium uppercase tracking-wider text-slate-500 truncate">{t("Hardware Boards")}</span>
                  <span className="font-mono text-base sm:text-lg font-bold text-ink">6 {t("Architectures")}</span>
                  <span className="block text-xxs text-slate-500 truncate">Uno • Nano • ESP32 • Pi</span>
                </div>
                <div className="rounded-lg border border-line bg-white p-2.5 sm:p-3">
                  <span className="block text-xxs font-medium uppercase tracking-wider text-slate-500 truncate">{t("Simulation Engine")}</span>
                  <span className="font-mono text-base sm:text-lg font-bold text-emerald-600">100% {t("Browser")}</span>
                  <span className="block text-xxs text-slate-500 truncate">{t("Deterministic DC & 1kHz physics")}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==================================================================== */}
        {/* INTERACTIVE SIMULATION DEMO SECTION */}
        {/* ==================================================================== */}
        <section className="py-12 md:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <InteractiveConvergenceDemo />
          </div>
        </section>

        {/* ==================================================================== */}
        {/* THE THESIS: WHY HARDWARE + SOFTWARE IN THE AGE OF AI */}
        {/* ==================================================================== */}
        <section className="border-y border-line bg-surface-sunken py-12 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="text-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-brand-700">
                {t("The Paradigm Shift")}
              </span>
              <h2 className="mt-2 text-xl min-[480px]:text-2xl sm:text-3xl font-bold tracking-tight text-ink">
                {t("Why the AI Era Belongs to Hardware + Software")}
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-xs sm:text-sm md:text-base text-slate-600">
                {t(
                  "As AI makes pure software generation ubiquitous, the ultimate bottleneck and greatest opportunity shifts to where digital algorithms physically interact with the real world.",
                )}
              </p>
            </div>

            <div className="mt-8 sm:mt-10 grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3">
              {/* Card 1: Software Alone */}
              <div className="rounded-xl border border-line bg-white p-4 sm:p-6 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                  <Code size={20} />
                </div>
                <h3 className="mt-4 text-base font-semibold text-ink">
                  {t("Software Alone is Disembodied")}
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {t(
                    "Pure software running inside remote datacenters cannot sense ambient pressure, steer a motor, or stabilize a drone in turbulence. Without physical sensors and actuators, algorithms remain isolated from reality.",
                  )}
                </p>
                <div className="mt-4 border-t border-line pt-3 font-mono text-xxs text-rose-600">
                  {t("• No physical agency • Disconnected from matter")}
                </div>
              </div>

              {/* Card 2: Hardware Alone */}
              <div className="rounded-xl border border-line bg-white p-4 sm:p-6 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <Cpu size={20} />
                </div>
                <h3 className="mt-4 text-base font-semibold text-ink">
                  {t("Hardware Alone is Static")}
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {t(
                    "Fixed silicon, passive breadboards, and disconnected motors cannot adapt to changing environments, calibrate sensor drift, or communicate over networks without firmware and control logic.",
                  )}
                </p>
                <div className="mt-4 border-t border-line pt-3 font-mono text-xxs text-amber-600">
                  {t("• Inert silicon • Zero autonomy or adaptation")}
                </div>
              </div>

              {/* Card 3: Hardware + Software */}
              <div className="rounded-xl border-2 border-brand-500 bg-brand-50/40 p-4 sm:p-6 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white">
                  <Sparkles size={20} />
                </div>
                <h3 className="mt-4 text-base font-semibold text-ink">
                  {t("Hardware + Software is Physical Intelligence")}
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {t(
                    "Autonomous robotics, smart edge sensors, intelligent drones, biomedical wearables, and cyber-physical systems. Software provides the decisions; hardware provides the physical reality.",
                  )}
                </p>
                <div className="mt-4 border-t border-brand-200 pt-3 font-mono text-xxs font-semibold text-brand-800">
                  {t("• The future of robotics & edge computing")}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==================================================================== */}
        {/* CORE PLATFORM CAPABILITIES */}
        {/* ==================================================================== */}
        <section className="py-12 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="text-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t("Comprehensive Simulation")}
              </span>
              <h2 className="mt-2 text-xl min-[480px]:text-2xl sm:text-3xl font-bold tracking-tight text-ink">
                {t("Engineered for Deep Physical & Firmware Realism")}
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-xs sm:text-sm md:text-base text-slate-600">
                {t("Every wire, resistor, logic gate, and firmware cycle is computed in real time.")}
              </p>
            </div>

            <div className="mt-8 sm:mt-12 grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {/* Feature 1 */}
              <Card className="p-4 sm:p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
                  <ShieldCheck size={18} />
                </div>
                <h3 className="mt-3.5 text-sm font-semibold text-ink">
                  {t("True Circuit Physics & Component Safety")}
                </h3>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                  {t(
                    "Modified Nodal Analysis (MNA) with piecewise-linear Katzenelson iterations. Simulates real Ohm's and Kirchhoff's laws, reverse diode breakdown, pin overcurrents, and virtual part burnouts.",
                  )}
                </p>
              </Card>

              {/* Feature 2 */}
              <Card className="p-4 sm:p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                  <Cpu size={18} />
                </div>
                <h3 className="mt-3.5 text-sm font-semibold text-ink">
                  {t("6 Supported Board Architectures")}
                </h3>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                  {t(
                    "Write code for Arduino Uno, Nano, ESP32, ESP32-S3, and Raspberry Pi 4 / 5 (40-pin Python GPIO). Sub-microsecond cooperative VM execution with UART, I2C, SPI, and PWM peripherals.",
                  )}
                </p>
              </Card>

              {/* Feature 3 */}
              <Card className="p-4 sm:p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                  <Globe size={18} />
                </div>
                <h3 className="mt-3.5 text-sm font-semibold text-ink">
                  {t("Connected IoT & Virtual Smartphone Browser")}
                </h3>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                  {t(
                    "Simulate embedded HTTP servers, REST endpoints, and MQTT pub/sub messaging. Test with an in-browser virtual phone that sends live HTTP requests to your simulated microcontroller.",
                  )}
                </p>
              </Card>

              {/* Feature 4 */}
              <Card className="p-4 sm:p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-volt-50 text-volt-600">
                  <span className="font-bold text-sm">FPV</span>
                </div>
                <h3 className="mt-3.5 text-sm font-semibold text-ink">
                  {t("Custom Quad Drone Engineering")}
                </h3>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                  {t(
                    "Design 3\", 5\", and 7\" quadcopters with 1 kHz 6-DoF quaternion rigid-body dynamics, ESC protocols (PWM, OneShot, DShot), PID tuning, blackbox plots, and 3D flight courses.",
                  )}
                </p>
              </Card>

              {/* Feature 5 */}
              <Card className="p-4 sm:p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-purple-50 text-purple-600">
                  <Bot size={18} />
                </div>
                <h3 className="mt-3.5 text-sm font-semibold text-ink">
                  {t("AI Circuit Guide & Coding Agent MCP")}
                </h3>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                  {t(
                    "Ask the integrated AI guide for circuit diagnostics, or connect Claude Code and OpenAI Codex via official Model Context Protocol (MCP) servers to build circuits autonomously.",
                  )}
                </p>
              </Card>

              {/* Feature 6 */}
              <Card className="p-4 sm:p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                  <Code size={18} />
                </div>
                <h3 className="mt-3.5 text-sm font-semibold text-ink">
                  {t("Monaco C++ & Visual Blockly Editors")}
                </h3>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                  {t(
                    "Switch effortlessly between a full-featured monospaced code editor and drag-and-drop Blockly blocks with instant two-way synchronization and syntax highlighting.",
                  )}
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* ==================================================================== */}
        {/* FOUR EXPLORATION PATHS */}
        {/* ==================================================================== */}
        <section className="border-t border-line bg-surface-sunken/60 py-12 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="text-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-brand-700">
                {t("Where to Begin")}
              </span>
              <h2 className="mt-2 text-xl min-[480px]:text-2xl sm:text-3xl font-bold tracking-tight text-ink">
                {t("Explore the Lab Your Way")}
              </h2>
            </div>

            <div className="mt-8 sm:mt-10 grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {/* Campaign */}
              <div className="flex flex-col justify-between rounded-xl border border-line bg-white p-4 sm:p-5 shadow-sm">
                <div>
                  <Badge tone="brand">{t("20 Quests")}</Badge>
                  <h3 className="mt-3 text-base font-semibold text-ink">{t("Campaign Mode")}</h3>
                  <p className="mt-2 text-xs text-slate-600">
                    {t("Follow the structured storyline across 5 themed worlds. Complete objectives, avoid smoke, and earn 3 stars.")}
                  </p>
                </div>
                <Link
                  to="/campaign"
                  className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline"
                >
                  {t("Enter Campaign")} <ArrowRight size={13} />
                </Link>
              </div>

              {/* Tutorials */}
              <div className="flex flex-col justify-between rounded-xl border border-line bg-white p-4 sm:p-5 shadow-sm">
                <div>
                  <Badge tone="info">{t("35 Lessons")}</Badge>
                  <h3 className="mt-3 text-base font-semibold text-ink">{t("Tutorial Lab")}</h3>
                  <p className="mt-2 text-xs text-slate-600">
                    {t("Interactive lessons from C++ basics to state machines, ESP32 IoT, and Raspberry Pi Python GPIO wiring.")}
                  </p>
                </div>
                <Link
                  to="/tutorials"
                  className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                >
                  {t("Browse Tutorials")} <ArrowRight size={13} />
                </Link>
              </div>

              {/* Sandbox */}
              <div className="flex flex-col justify-between rounded-xl border border-line bg-white p-4 sm:p-5 shadow-sm">
                <div>
                  <Badge tone="volt">{t("Freeform")}</Badge>
                  <h3 className="mt-3 text-base font-semibold text-ink">{t("Sandbox & Drone")}</h3>
                  <p className="mt-2 text-xs text-slate-600">
                    {t("Design custom circuits or build quadcopters from scratch. Export wiring diagrams, INO code, and priced BOMs.")}
                  </p>
                </div>
                <Link
                  to="/sandbox"
                  className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-volt-700 hover:text-volt-800 hover:underline"
                >
                  {t("Open Sandbox")} <ArrowRight size={13} />
                </Link>
              </div>

              {/* Showcase */}
              <div className="flex flex-col justify-between rounded-xl border border-line bg-white p-4 sm:p-5 shadow-sm">
                <div>
                  <Badge tone="success">{t("Community")}</Badge>
                  <h3 className="mt-3 text-base font-semibold text-ink">{t("Showcase & Fork")}</h3>
                  <p className="mt-2 text-xs text-slate-600">
                    {t("Discover public projects built by other engineers. Inspect wiring, run their code, and fork with one click.")}
                  </p>
                </div>
                <Link
                  to="/showcase"
                  className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
                >
                  {t("View Showcase")} <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ==================================================================== */}
        {/* HARDWARE ECOSYSTEM MATRIX */}
        {/* ==================================================================== */}
        <section className="py-12 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="rounded-xl border border-line bg-surface-panel p-4 sm:p-6 md:p-8 shadow-sm">
              <div className="border-b border-line pb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("Virtual Parts Drawer")}
                </span>
                <h2 className="mt-1 text-lg sm:text-xl font-bold text-ink">
                  {t("Supported Microcontrollers, Sensors & Components")}
                </h2>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-700">
                    {t("Microcontrollers & SBCs")}
                  </h3>
                  <ul className="mt-3 space-y-2 text-xs text-slate-700">
                    <li className="flex items-start gap-2 font-mono">
                      <CheckCircle2 size={13} className="shrink-0 text-emerald-600 mt-0.5" />
                      <span>Arduino Uno R3 (ATmega328P, 5V)</span>
                    </li>
                    <li className="flex items-start gap-2 font-mono">
                      <CheckCircle2 size={13} className="shrink-0 text-emerald-600 mt-0.5" />
                      <span>Arduino Nano (Compact ATmega328P)</span>
                    </li>
                    <li className="flex items-start gap-2 font-mono">
                      <CheckCircle2 size={13} className="shrink-0 text-emerald-600 mt-0.5" />
                      <span>ESP32 (Dual-Core, WiFi, Bluetooth, 3.3V)</span>
                    </li>
                    <li className="flex items-start gap-2 font-mono">
                      <CheckCircle2 size={13} className="shrink-0 text-emerald-600 mt-0.5" />
                      <span>ESP32-S3 (Dual Type-C, USB OTG)</span>
                    </li>
                    <li className="flex items-start gap-2 font-mono">
                      <CheckCircle2 size={13} className="shrink-0 text-emerald-600 mt-0.5" />
                      <span>Raspberry Pi 4 & Pi 5 (40-pin Python GPIO)</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-700">
                    {t("Sensors & Environmental")}
                  </h3>
                  <ul className="mt-3 space-y-2 text-xs text-slate-700">
                    <li className="flex items-start gap-2 font-mono">
                      <CheckCircle2 size={13} className="shrink-0 text-emerald-600 mt-0.5" />
                      <span>HC-SR04 Ultrasonic Distance Sensor</span>
                    </li>
                    <li className="flex items-start gap-2 font-mono">
                      <CheckCircle2 size={13} className="shrink-0 text-emerald-600 mt-0.5" />
                      <span>DHT11 Temperature & Humidity Sensor</span>
                    </li>
                    <li className="flex items-start gap-2 font-mono">
                      <CheckCircle2 size={13} className="shrink-0 text-emerald-600 mt-0.5" />
                      <span>BME280 Precision Barometer / Temp</span>
                    </li>
                    <li className="flex items-start gap-2 font-mono">
                      <CheckCircle2 size={13} className="shrink-0 text-emerald-600 mt-0.5" />
                      <span>LDR Light Dependent Photoresistor</span>
                    </li>
                    <li className="flex items-start gap-2 font-mono">
                      <CheckCircle2 size={13} className="shrink-0 text-emerald-600 mt-0.5" />
                      <span>Potentiometers & Pushbuttons</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-700">
                    {t("Actuators, Displays & Power")}
                  </h3>
                  <ul className="mt-3 space-y-2 text-xs text-slate-700">
                    <li className="flex items-start gap-2 font-mono">
                      <CheckCircle2 size={13} className="shrink-0 text-emerald-600 mt-0.5" />
                      <span>SSD1306 128x64 I2C OLED Display</span>
                    </li>
                    <li className="flex items-start gap-2 font-mono">
                      <CheckCircle2 size={13} className="shrink-0 text-emerald-600 mt-0.5" />
                      <span>16x2 Character LCD Display (I2C)</span>
                    </li>
                    <li className="flex items-start gap-2 font-mono">
                      <CheckCircle2 size={13} className="shrink-0 text-emerald-600 mt-0.5" />
                      <span>WS2812B Addressable NeoPixel Strips</span>
                    </li>
                    <li className="flex items-start gap-2 font-mono">
                      <CheckCircle2 size={13} className="shrink-0 text-emerald-600 mt-0.5" />
                      <span>Micro Servos & DC Motor Transistors</span>
                    </li>
                    <li className="flex items-start gap-2 font-mono">
                      <CheckCircle2 size={13} className="shrink-0 text-emerald-600 mt-0.5" />
                      <span>Bi-directional Logic Level Shifters (5V ⟷ 3.3V)</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==================================================================== */}
        {/* BOTTOM CALL TO ACTION BANNER */}
        {/* ==================================================================== */}
        <section className="border-t border-line bg-gradient-to-r from-brand-600 to-teal-700 py-12 sm:py-14 text-white">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
            <h2 className="text-xl min-[480px]:text-2xl sm:text-3xl font-bold tracking-tight">
              {t("Ready to Master Hardware + Software?")}
            </h2>
            <p className="mt-3 text-xs sm:text-sm md:text-base text-teal-100">
              {t("No hardware to buy, no components to burn out. Run complete interactive circuits right in your browser.")}
            </p>
            <div className="mt-6 sm:mt-7 flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3">
              <Button
                size="lg"
                variant="secondary"
                icon={<Play size={16} fill="currentColor" />}
                onClick={() => navigate('/campaign')}
                className="w-full sm:w-auto bg-white text-brand-700 hover:bg-slate-100 font-bold"
              >
                {t("Enter the Campaign")}
              </Button>
              <Button
                size="lg"
                variant="secondary"
                icon={<Wrench size={16} />}
                onClick={() => navigate('/sandbox')}
                className="w-full sm:w-auto bg-teal-800 text-white hover:bg-teal-900 border-teal-600"
              >
                {t("Start Freeform Project")}
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* ==================================================================== */}
      {/* FOOTER */}
      {/* ==================================================================== */}
      <footer className="border-t border-line bg-white py-8 text-xs text-slate-500">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 font-medium text-ink">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-brand-600 text-white">
                <Zap size={12} fill="currentColor" />
              </span>
              <span>VoltQuest</span>
              <span className="text-slate-400">•</span>
              <span className="text-xxs text-slate-500">{t("Hardware + Software Laboratory")}</span>
            </div>

            <nav aria-label="Footer navigation" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs">
              <Link to="/campaign" className="py-1 hover:text-brand-600">{t("Campaign")}</Link>
              <Link to="/tutorials" className="py-1 hover:text-brand-600">{t("Tutorials")}</Link>
              <Link to="/ai-agents" className="py-1 hover:text-brand-600">{t("AI agent learning path")}</Link>
              <Link to="/computer-architecture" className="py-1 hover:text-brand-600">{t('Computer architecture & assembly')}</Link>
              <Link to="/qt" className="py-1 hover:text-brand-600">{t('Qt / C++ desktop apps')}</Link>
              <Link to="/winui" className="py-1 hover:text-brand-600">{t('C++ / WinUI desktop apps')}</Link>
              <Link to="/sandbox" className="py-1 hover:text-brand-600">{t("Sandbox")}</Link>
              <Link to="/showcase" className="py-1 hover:text-brand-600">{t("Showcase")}</Link>
              <Link to="/community" className="py-1 hover:text-brand-600">{t("Community")}</Link>
              <Link to="/leaderboard" className="py-1 hover:text-brand-600">{t("Leaderboard")}</Link>
              <Link to="/profile" className="py-1 hover:text-brand-600">{t("Profile")}</Link>
            </nav>
          </div>

          <div className="mt-6 border-t border-line pt-4 text-center text-xxs text-slate-400">
            {t("VoltQuest • Built with deterministic simulation, cooperative VM runtime, and MCP coding agent tools.")}
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
