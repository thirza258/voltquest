// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LandingPage } from './LandingPage.jsx'
import { LocaleProvider } from '../../i18n/index.jsx'
import { installMemoryStorage } from '../../test-utils/localStorage.js'

beforeEach(() => {
  installMemoryStorage()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('LandingPage', () => {
  it('renders the core thesis headline about AI and hardware + software', () => {
    render(
      <LocaleProvider>
        <MemoryRouter initialEntries={['/']}>
          <LandingPage />
        </MemoryRouter>
      </LocaleProvider>,
    )

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toBeTruthy()
    expect(heading.textContent).toMatch(/In the age of AI, the future lies not on software, not on hardware, but\s+hardware \+ software/i)
    expect(screen.getByText(/VoltQuest is an interactive in-browser lab/i)).toBeTruthy()
  })

  it('provides direct action links to Campaign, Tutorials, and Sandbox', () => {
    render(
      <LocaleProvider>
        <MemoryRouter initialEntries={['/']}>
          <LandingPage />
        </MemoryRouter>
      </LocaleProvider>,
    )

    expect(screen.getByRole('button', { name: /Start Campaign Quests/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Explore Tutorials/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Open Sandbox/i })).toBeTruthy()

    const campaignLinks = screen.getAllByRole('link', { name: /Campaign/i })
    expect(campaignLinks.length).toBeGreaterThan(0)
    expect(campaignLinks.some((l) => l.getAttribute('href') === '/campaign')).toBe(true)
  })

  it('features an interactive simulation demo that updates live electrical readings on interaction', () => {
    render(
      <LocaleProvider>
        <MemoryRouter initialEntries={['/']}>
          <LandingPage />
        </MemoryRouter>
      </LocaleProvider>,
    )

    // Check presence of interactive tabs
    expect(screen.getByRole('tab', { name: /1\. Sensor & PWM Feedback/i })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /2\. Virtual IoT Web Server/i })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /3\. 1 kHz Quad Drone PID/i })).toBeTruthy()

    // Interactive slider change
    const potSlider = screen.getByLabelText(/Analog Light Sensor \/ Pot/i)
    fireEvent.change(potSlider, { target: { value: '80' } })
    expect(screen.getByText(/3276 ADC \(80%\)/i)).toBeTruthy()

    // Switch to IoT tab
    const iotTab = screen.getByRole('tab', { name: /2\. Virtual IoT Web Server/i })
    fireEvent.click(iotTab)
    expect(screen.getByText(/Smart Home Actuator/i)).toBeTruthy()

    const toggleBtn = screen.getByRole('button', { name: /Toggle Switch \(HTTP\)/i })
    fireEvent.click(toggleBtn)
    expect(screen.getByText(/2 req/i)).toBeTruthy()

    // Switch to Drone tab
    const droneTab = screen.getByRole('tab', { name: /3\. 1 kHz Quad Drone PID/i })
    fireEvent.click(droneTab)
    expect(screen.getByText(/Quad-X 5" Frame/i)).toBeTruthy()
    expect(screen.getByText(/1,000 Hz/i)).toBeTruthy()
  })

  it('renders all 6 feature pillars and hardware ecosystem matrix', () => {
    render(
      <LocaleProvider>
        <MemoryRouter initialEntries={['/']}>
          <LandingPage />
        </MemoryRouter>
      </LocaleProvider>,
    )

    expect(screen.getByText(/True Circuit Physics & Component Safety/i)).toBeTruthy()
    expect(screen.getByText(/6 Supported Board Architectures/i)).toBeTruthy()
    expect(screen.getByText(/Connected IoT & Virtual Smartphone Browser/i)).toBeTruthy()
    expect(screen.getByText(/Custom Quad Drone Engineering/i)).toBeTruthy()
    expect(screen.getByText(/AI Circuit Guide & Coding Agent MCP/i)).toBeTruthy()
    expect(screen.getByText(/Monaco C\+\+ & Visual Blockly Editors/i)).toBeTruthy()

    expect(screen.getByText(/Arduino Uno R3/i)).toBeTruthy()
    expect(screen.getAllByText(/ESP32-S3/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Raspberry Pi 4 & Pi 5/i).length).toBeGreaterThan(0)
  })

  it('includes mobile-friendly responsive layout classes on call-to-action buttons and grids', () => {
    const { container } = render(
      <LocaleProvider>
        <MemoryRouter initialEntries={['/']}>
          <LandingPage />
        </MemoryRouter>
      </LocaleProvider>,
    )

    // Hero buttons stack vertically on small screens (w-full sm:w-auto)
    const heroCampaignBtn = screen.getByRole('button', { name: /Start Campaign Quests/i })
    expect(heroCampaignBtn.className).toContain('w-full')
    expect(heroCampaignBtn.className).toContain('sm:w-auto')

    // Quick specs grid has 2 columns on mobile and 4 on sm screens
    const specsGrid = container.querySelector('.grid.grid-cols-2')
    expect(specsGrid).toBeTruthy()
    expect(specsGrid.className).toContain('sm:grid-cols-4')

    // Header narrow-viewport navigation select element includes Home option. It hides at md:, not
    // sm:, because five nav segments plus the logo and right cluster overflow a 640 px header.
    const mobileSelect = screen.getByRole('combobox', { name: /Section navigation/i })
    expect(mobileSelect).toBeTruthy()
    expect(mobileSelect.className).toContain('md:hidden')
    expect(mobileSelect.className).toContain('max-w-[110px]')
    const homeOption = screen.getByRole('option', { name: /Home/i })
    expect(homeOption).toBeTruthy()
    expect(homeOption.value).toBe('')

    // Check bottom CTA buttons have full width on mobile
    const bottomCampaignBtn = screen.getByRole('button', { name: /Enter the Campaign/i })
    expect(bottomCampaignBtn.className).toContain('w-full')
    expect(bottomCampaignBtn.className).toContain('sm:w-auto')
  })

  it('renders interactive demo with responsive mobile adaptations for drone motors and button override', () => {
    const { container } = render(
      <LocaleProvider>
        <MemoryRouter initialEntries={['/']}>
          <LandingPage />
        </MemoryRouter>
      </LocaleProvider>,
    )

    // Sensor mode: Override button has mobile-first width classes
    const overrideBtn = screen.getByRole('button', { name: /Hold Pushbutton/i })
    expect(overrideBtn.className).toContain('w-full')
    expect(overrideBtn.className).toContain('min-[440px]:w-auto')

    // Switch to drone tab: 4 motors arranged in 2x2 grid on mobile and 4 columns on sm
    const droneTab = screen.getByRole('tab', { name: /3\. 1 kHz Quad Drone PID/i })
    fireEvent.click(droneTab)

    const motorGrid = container.querySelector('.grid.grid-cols-2.sm\\:grid-cols-4')
    expect(motorGrid).toBeTruthy()
    expect(screen.getByText('M1 (CW)')).toBeTruthy()
    expect(screen.getByText('M4 (CW)')).toBeTruthy()
  })

  it('renders bullet characters correctly without raw unescaped &bull entities', () => {
    const { container } = render(
      <LocaleProvider>
        <MemoryRouter initialEntries={['/']}>
          <LandingPage />
        </MemoryRouter>
      </LocaleProvider>,
    )

    expect(container.innerHTML).not.toContain('&amp;bull')
    expect(container.innerHTML).not.toContain('&bull;')
    expect(container.innerHTML).not.toContain('&bull')
    expect(screen.getByText(/• No physical agency • Disconnected from matter/i)).toBeTruthy()
    expect(screen.getByText(/Uno • Nano • ESP32 • Pi/i)).toBeTruthy()
  })
})
