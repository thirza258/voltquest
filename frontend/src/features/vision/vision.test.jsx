// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LocaleProvider, translate } from '../../i18n/index.jsx'
import { installMemoryStorage } from '../../test-utils/localStorage.js'
import { DEFAULT_VISION, validateVision } from '../../engine/vision/model.js'
import { loadOpenCv } from './opencvLoader.js'
import { processOpenCv } from '../../engine/vision/opencv.js'
import { downloadJson } from '../../lib/download.js'
import VisionPage, { VISION_TUTORIALS } from './VisionPage.jsx'
import { VISION_EXAMPLES } from './examples.js'
import VisionLab, { VISION_STORAGE_KEY } from './VisionLab.jsx'

vi.mock('./opencvLoader.js', () => ({ loadOpenCv: vi.fn(async () => ({ cv: {} })) }))
vi.mock('../../engine/vision/opencv.js', () => ({ processOpenCv: vi.fn((_cv, scene, config) => ({ ...scene, metrics: { count: config.threshold === 255 ? 0 : 517, fraction: 0.03, centroid: config.threshold === 255 ? null : { x: 64 + config.offset, y: 64 }, errorX: config.threshold === 255 ? null : config.offset / 64, iou: 1 } })) }))
vi.mock('./VisionIntegration.jsx', () => ({ default: ({ observation }) => <div data-testid="integrated" data-observation={JSON.stringify(observation)} /> }))
vi.mock('../../lib/download.js', () => ({ downloadJson: vi.fn(), downloadText: vi.fn() }))
beforeEach(() => {
  installMemoryStorage(); vi.clearAllMocks(); loadOpenCv.mockResolvedValue({ cv: {} })
  vi.stubGlobal('ImageData', class { constructor(data, width, height) { Object.assign(this, { data, width, height }) } })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ putImageData: vi.fn() })
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
const lab = props => render(<LocaleProvider><VisionLab {...props} /></LocaleProvider>)

it('provides six complete courses, a distinct integration capstone, and valid companion examples', () => {
  expect(VISION_TUTORIALS).toHaveLength(6); expect(VISION_TUTORIALS.filter(l => l.integrated)).toHaveLength(1)
  for (const [i, lesson] of VISION_TUTORIALS.entries()) {
    expect(lesson.order).toBe(i + 1); expect(validateVision(lesson.config)).toEqual(lesson.config)
    expect(lesson.lessons).toHaveLength(3); expect(lesson.formulas).toHaveLength(2); expect(lesson.practice).toHaveLength(2); expect(lesson.exam.questions).toHaveLength(5)
    for (const id of lesson.exampleIds) expect(VISION_EXAMPLES[id].code).toBeTruthy()
    for (const q of [...lesson.practice, ...lesson.exam.questions]) {
      expect(q.options.filter(o => o.id === q.answerId)).toHaveLength(1)
      expect(lesson.lessons.some(l => l.id === q.lessonId)).toBe(true)
    }
  }
})
it('renders the complete course hub and integration entry point', () => {
  render(<MemoryRouter initialEntries={['/vision']}><Routes><Route path="/vision" element={<VisionPage />} /></Routes></MemoryRouter>)
  expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(6)
  expect(screen.getByRole('link', { name: 'Open the integration capstone' }).getAttribute('href')).toBe('/vision/vision-integration')
})
it('processes changed settings and saves/exports only the current validated configuration', async () => {
  lab(); await screen.findByLabelText('Vision measurements')
  fireEvent.change(screen.getByLabelText('Target horizontal offset (px)'), { target: { value: '25' } })
  await waitFor(() => expect(processOpenCv.mock.lastCall[2].offset).toBe(25))
  fireEvent.click(screen.getByRole('button', { name: 'Save vision settings' }))
  expect(JSON.parse(localStorage.getItem(VISION_STORAGE_KEY)).offset).toBe(25)
  fireEvent.click(screen.getByRole('button', { name: 'Export vision settings' })); expect(downloadJson).toHaveBeenCalledWith({ ...DEFAULT_VISION, offset: 25 }, 'voltquest-vision.json')
})
it('shows normalized attention, query selection and quadratic token growth without loading OpenCV', () => {
  lab({ initialConfig: { ...DEFAULT_VISION, mode: 'attention' } })
  expect(loadOpenCv).not.toHaveBeenCalled(); expect(screen.getByLabelText('Attention measurements').textContent).toContain('N = 64 · N² = 4096')
  fireEvent.click(screen.getByRole('button', { name: 'Query patch 0', exact: true })); expect(screen.getByRole('button', { name: 'Query patch 0', exact: true }).getAttribute('aria-pressed')).toBe('true')
  fireEvent.change(screen.getByLabelText('Patch size (px)'), { target: { value: '8' } })
  expect(screen.getByLabelText('Attention measurements').textContent).toContain('N = 256 · N² = 65536')
})
it('does not forward stale masks while a new result is pending or use attention weights as detections', async () => {
  lab({ integrated: true }); await screen.findByTestId('integrated'); await screen.findByLabelText('Vision measurements')
  expect(JSON.parse(screen.getByTestId('integrated').dataset.observation).detected).toBe(true)
  let resolve; loadOpenCv.mockReturnValueOnce(new Promise(r => { resolve = r }))
  fireEvent.change(screen.getByLabelText('Binary threshold'), { target: { value: '255' } }); expect(screen.getByTestId('integrated').dataset.observation).toBe('null')
  await act(async () => resolve({ cv: {} })); expect(JSON.parse(screen.getByTestId('integrated').dataset.observation).detected).toBe(false)
  fireEvent.change(screen.getByLabelText('Vision pipeline'), { target: { value: 'attention' } }); expect(screen.getByTestId('integrated').dataset.observation).toBe('null')
})
it('confirms stored settings, rejects malformed files, and reports storage failures', async () => {
  lab(); await screen.findByLabelText('Vision measurements')
  localStorage.setItem(VISION_STORAGE_KEY, JSON.stringify({ ...DEFAULT_VISION, theme: 'drone' }))
  fireEvent.click(screen.getByRole('button', { name: 'Load vision settings' })); expect(screen.getByRole('dialog')).toBeTruthy()
  expect(screen.getByLabelText('Vision theme').value).toBe('iot')
  fireEvent.click(screen.getByRole('button', { name: 'Apply vision settings' })); expect(screen.getByLabelText('Vision theme').value).toBe('drone')
  localStorage.setItem(VISION_STORAGE_KEY, '{}'); fireEvent.click(screen.getByRole('button', { name: 'Load vision settings' })); expect(screen.getByRole('alert').textContent).toContain('version 1')
  vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota') }); fireEvent.click(screen.getByRole('button', { name: 'Save vision settings' })); expect(screen.getByRole('alert').textContent).toContain('storage')
})
it('ignores late initialization after disposal and exposes loader failures', async () => {
  let reject; loadOpenCv.mockReturnValueOnce(new Promise((_r, fail) => { reject = fail }))
  const view = lab(); view.unmount(); await act(async () => reject(new Error('load failed'))); expect(processOpenCv).not.toHaveBeenCalled()
  loadOpenCv.mockRejectedValueOnce(new Error('load failed')); lab(); expect((await screen.findByRole('alert')).textContent).toBe('load failed')
})
it('keeps edited scene and attention query when language changes', () => {
  render(<LocaleProvider><MemoryRouter initialEntries={['/vision/vision-transformers']}><Routes><Route path="/vision/:lessonId" element={<VisionPage />} /></Routes></MemoryRouter></LocaleProvider>)
  fireEvent.change(screen.getByLabelText('Target horizontal offset (px)'), { target: { value: '20' } }); fireEvent.click(screen.getByRole('button', { name: 'Query patch 0', exact: true }))
  fireEvent.change(screen.getByLabelText('Language / Bahasa'), { target: { value: 'id' } })
  expect(screen.getByLabelText(translate('id', 'Target horizontal offset (px)')).value).toBe('20')
  expect(screen.getByRole('button', { name: translate('id', 'Query patch {number}', { number: 0 }), exact: true }).getAttribute('aria-pressed')).toBe('true')
})
