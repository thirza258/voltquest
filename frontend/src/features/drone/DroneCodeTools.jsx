import { useState } from 'react'
import { useI18n } from '../../i18n/index.jsx'
import { ASSISTED_CODE, BENCH_CODE, IMU_CODE, RATE_CODE } from '../../engine/drone/examples.js'
import { Button, Modal } from '../../ui/index.js'

export default function DroneCodeTools({ code, onCode, readOnly, board }) {
  const { t } = useI18n(), [example, setExample] = useState(null)
  const examples = { 'Assisted flight': ASSISTED_CODE, 'ESC bench test': board === 'esp32s3' ? BENCH_CODE.replace('attach(18)', 'attach(4)') : BENCH_CODE, 'Read the IMU': IMU_CODE, 'Write a rate PID': RATE_CODE }
  const gains = /Flight\.setGains\(([^)]+)\)/.exec(code)
  return <div className="space-y-2 border-b border-line p-2 text-xs"><details><summary className="cursor-pointer font-medium">{t('Flight code and tuning')}</summary><p className="my-2 text-slate-600">{t('Your sketch runs in the worker. Read the connected IMU and receiver, calculate a correction, then write ESC pulses. Run again after changing code or gains.')}</p><select className="w-full rounded border p-2" aria-label={t('Flight code example')} value="" disabled={readOnly} onChange={e => setExample(e.target.value)}><option value="">{t('Load a code example…')}</option>{Object.keys(examples).map(name => <option key={name}>{name}</option>)}</select>
    {gains && <div className="mt-2 flex gap-2">{['P', 'I', 'D'].map((label, i) => <label key={label} className="min-w-0 flex-1">{label}<input type="number" step="0.0001" min="0" max="0.1" className="w-full rounded border p-1" value={Number(gains[1].split(',')[i])} disabled={readOnly} onChange={e => { const values = gains[1].split(',').map(Number); if (e.target.valueAsNumber >= 0 && e.target.valueAsNumber <= .1) { values[i] = e.target.valueAsNumber; onCode(code.replace(gains[0], `Flight.setGains(${values.join(', ')})`)) } }} /></label>)}</div>}
    <p className="mt-2 text-slate-600">{t('PWM: 1000–2000 µs. Hold 1000 µs for 1 second before spin-up. MPU6050 getGyroX/Y/Z returns deg/s; getAccX/Y/Z returns m/s²; getMotion6 uses integer sensor units. VoltRC channels: 0 throttle, 1 roll, 2 pitch, 3 yaw, 4 arm, 5 mode.')}</p></details>
    <Modal open={!!example} title={t('Replace the current sketch?')} description={t('The selected example replaces the code in this editor. Copy or export any code you want to keep.')} onClose={() => setExample(null)} footer={<><Button variant="secondary" onClick={() => setExample(null)}>{t('Cancel')}</Button><Button onClick={() => { onCode(examples[example]); setExample(null) }}>{t('Load example')}</Button></>} />
  </div>
}
