// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { afterEach, beforeEach, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LocaleProvider } from '../../i18n/index.jsx'
import { installMemoryStorage } from '../../test-utils/localStorage.js'
import { labProject } from '../../engine/network/lab.js'
import NetworkLab, { NETWORK_STORAGE_KEY } from './NetworkLab.jsx'

beforeEach(() => installMemoryStorage())
afterEach(() => cleanup())

const TOPOLOGY = {
  devices: [
    { name: 'PC1', type: 'pc', x: 120, y: 300, host: { ip: '192.168.1.10', mask: '255.255.255.0', gateway: '192.168.1.1' } },
    { name: 'PC2', type: 'pc', x: 380, y: 300, host: { ip: '192.168.1.11', mask: '255.255.255.0', gateway: '192.168.1.1' } },
    { name: 'Server1', type: 'server', x: 640, y: 300, host: { ip: '192.168.2.10', mask: '255.255.255.0', gateway: '192.168.2.1' }, services: { http: { enabled: true, page: 'Hello from Server1' } } },
    { name: 'S1', type: 'switch', x: 250, y: 170 },
    { name: 'R1', type: 'router', x: 520, y: 170 },
  ],
  links: ['PC1 Fa0 S1 Fa0/1', 'PC2 Fa0 S1 Fa0/2', 'S1 Gi0/1 R1 Gi0/0', 'Server1 Fa0 R1 Gi0/1'],
}
const LAB = {
  goals: [{ type: 'ping', from: 'PC1', to: '192.168.1.11', label: 'PC1 reaches PC2' }, { type: 'http', from: 'PC1', url: 'http://192.168.2.10/', label: 'PC1 loads the server page' }],
  solution: [{ device: 'R1', cli: ['enable', 'configure terminal', 'interface g0/0', 'ip address 192.168.1.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 192.168.2.1 255.255.255.0', 'no shutdown', 'end'] }],
}
function lab(props = {}) {
  const project = labProject(TOPOLOGY).project
  return render(<LocaleProvider><MemoryRouter><NetworkLab initialProject={project} {...props} /></MemoryRouter></LocaleProvider>)
}
const choose = name => fireEvent.change(screen.getByLabelText('Selected device'), { target: { value: name.toLowerCase() } })
function type(label, line) {
  fireEvent.change(screen.getByLabelText(`Command for ${label}`), { target: { value: line } })
  fireEvent.submit(screen.getByLabelText(`Command for ${label}`).closest('form'))
}

it('runs desktop commands and replays every frame in simulation mode', () => {
  lab()
  expect(screen.getByRole('group', { name: 'Network topology' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'PC1, PC' }).getAttribute('aria-pressed')).toBe('true')
  type('PC1 command prompt', 'ping 192.168.1.11')
  const log = screen.getByRole('log', { name: 'PC1 command prompt' }).textContent
  expect(log).toContain('Reply from 192.168.1.11: bytes=32 time<1ms TTL=128')
  expect(log).toContain('Received = 4, Lost = 0')
  fireEvent.click(screen.getByRole('button', { name: 'Simulation' }))
  const events = screen.getByRole('region', { name: /Event list/ })
  expect(within(events).getAllByRole('row').length).toBeGreaterThan(8)
  expect(within(events).getByText('Headers, outermost first')).toBeTruthy()
  expect(within(events).getByText(/Who has 192\.168\.1\.11\? Tell 192\.168\.1\.10/)).toBeTruthy()
  fireEvent.click(within(events).getByRole('button', { name: 'Step' }))
  expect(within(events).getByText(/Arrived on Fa0 from S1/)).toBeTruthy()
  type('PC1 command prompt', 'bogus')
  expect(screen.getByRole('log', { name: 'PC1 command prompt' }).textContent).toContain('Invalid Command.')
})

it('configures a router from its command line and checks the lab goals', () => {
  lab({ lab: LAB })
  fireEvent.click(screen.getByRole('button', { name: 'Check results' }))
  expect(screen.getByText('1 of 2 goals met')).toBeTruthy()
  choose('R1')
  for (const line of LAB.solution[0].cli) type('R1 command line', line)
  const log = screen.getByRole('log', { name: 'R1 command line' }).textContent
  expect(log).toContain('R1(config-if)#ip address 192.168.2.1 255.255.255.0')
  expect(log).toContain('%LINK-5-CHANGED: Interface GigabitEthernet0/0, changed state to up')
  type('R1 command line', 'show ip interface brief')
  expect(screen.getByRole('log', { name: 'R1 command line' }).textContent).toMatch(/GigabitEthernet0\/1\s+192\.168\.2\.1\s+YES manual up/)
  fireEvent.click(screen.getByRole('button', { name: 'Check results' }))
  expect(screen.getByText('2 of 2 goals met')).toBeTruthy()
  expect(screen.getByText('Show a reference solution')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Reset lab' }))
  expect(screen.getByText('Not checked yet')).toBeTruthy()
  expect(screen.getByRole('log', { name: 'R1 command line' }).textContent).not.toContain('ip address')
})

it('edits host settings, browses the web and validates input', () => {
  lab()
  fireEvent.click(screen.getByRole('button', { name: 'IP Configuration' }))
  fireEvent.change(screen.getByLabelText('IPv4 address'), { target: { value: '192.168.1.300' } })
  fireEvent.click(screen.getByRole('button', { name: 'Apply settings' }))
  expect(screen.getByRole('alert').textContent).toContain('valid IPv4 address')
  fireEvent.change(screen.getByLabelText('IPv4 address'), { target: { value: '192.168.1.20' } })
  fireEvent.click(screen.getByRole('button', { name: 'Apply settings' }))
  expect(screen.getByText('PC1 settings applied.')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'PC1, PC' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Web Browser' }))
  fireEvent.submit(screen.getByLabelText('Address').closest('form'))
  expect(screen.getByText('Invalid URL.')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Address'), { target: { value: 'http://192.168.2.10/' } })
  fireEvent.submit(screen.getByLabelText('Address').closest('form'))
  expect(screen.getByText('Request Timeout')).toBeTruthy()
})

it('builds a network on the bench, cables it and saves it in this browser', () => {
  lab({ editable: true })
  fireEvent.click(screen.getByRole('button', { name: 'Add Router' }))
  expect(screen.getByLabelText('Selected device').value).toBe('router1')
  const cables = screen.getByText(/Cables \(4\)/).closest('details')
  const selects = within(cables).getAllByRole('combobox')
  fireEvent.change(selects[0], { target: { value: 'r1' } })
  fireEvent.change(selects[2], { target: { value: 'router1' } })
  fireEvent.click(within(cables).getByRole('button', { name: 'Connect' }))
  expect(screen.getByText(/Cables \(5\)/)).toBeTruthy()
  expect(within(cables).getByText(/R1 Gi0\/2 — R2 Gi0\/0/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Save network' }))
  expect(JSON.parse(localStorage.getItem(NETWORK_STORAGE_KEY)).devices).toHaveLength(6)
  fireEvent.click(screen.getByRole('button', { name: 'Remove R2' }))
  fireEvent.click(screen.getByRole('button', { name: 'Load network' }))
  fireEvent.click(screen.getByRole('button', { name: 'Replace network' }))
  expect(screen.getByText('Network loaded.')).toBeTruthy()
  expect(within(screen.getByLabelText('Selected device')).getAllByRole('option')).toHaveLength(6)
})
