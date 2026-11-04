// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { afterEach, beforeEach, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LocaleProvider, translate } from '../../i18n/index.jsx'
import { installMemoryStorage } from '../../test-utils/localStorage.js'
import { COURSES } from './content.js'
import RoboticsPage from '../robotics/RoboticsPage.jsx'
import VisionPage from '../vision/VisionPage.jsx'
import ConnectedPath from './ConnectedPath.jsx'
import CoursesPage from './CoursesPage.jsx'
import { CONNECTED_PATH, getPathStage, nextStepOf, prerequisiteOf } from './learningPath.js'
import robotics from '@content/robotics.json'
import vision from '@content/vision.json'

beforeEach(() => installMemoryStorage())
afterEach(() => cleanup())

const currentStage = () => within(screen.getByRole('region', { name: 'Connected learning path' }))
  .getAllByRole('listitem').find(item => item.getAttribute('aria-current') === 'step')
function path(stageId) {
  return render(<LocaleProvider><MemoryRouter><ConnectedPath current={stageId} /></MemoryRouter></LocaleProvider>)
}
function hub(Page) {
  return render(<LocaleProvider><MemoryRouter initialEntries={['/']}><Routes><Route path="/" element={<Page />} /></Routes></MemoryRouter></LocaleProvider>)
}
const lastSegment = href => href.split('/').pop()

it('orders three stages whose prerequisite is always the stage before', () => {
  expect(CONNECTED_PATH.map(stage => stage.id)).toEqual(['electronics', 'robotics', 'vision'])
  expect(prerequisiteOf('electronics')).toBeNull()
  expect(prerequisiteOf('robotics').id).toBe('electronics')
  expect(prerequisiteOf('vision').id).toBe('robotics')
  expect(nextStepOf('electronics').id).toBe('robotics')
  expect(nextStepOf('robotics').id).toBe('vision')
  expect(nextStepOf('vision')).toBeNull()
  expect(getPathStage('nope')).toBeNull()
  expect(new Set(CONNECTED_PATH.flatMap(stage => [stage.href, stage.startHref, stage.labHref])).size)
    .toBe(CONNECTED_PATH.length * 3)
})

it('only links starting courses and benches that actually exist', () => {
  expect(COURSES.some(course => course.id === lastSegment(CONNECTED_PATH[0].startHref))).toBe(true)
  expect(robotics.tutorials.some(lesson => lesson.id === lastSegment(CONNECTED_PATH[1].startHref))).toBe(true)
  expect(vision.tutorials.some(lesson => lesson.id === lastSegment(CONNECTED_PATH[2].startHref))).toBe(true)
  expect(CONNECTED_PATH[0].href).toBe('/courses?track=electrical')
  expect(CONNECTED_PATH[0].labHref).toBe('/sandbox')
  expect(CONNECTED_PATH[1].href).toBe('/robotics')
  expect(CONNECTED_PATH[2].href).toBe('/vision')
  for (const stage of CONNECTED_PATH) expect(stage.labHref.startsWith('/sandbox')).toBe(true)
})

it('marks the current stage, names its prerequisite, and points to the next step', () => {
  for (const [index, stage] of CONNECTED_PATH.entries()) {
    cleanup()
    path(stage.id)
    const region = screen.getByRole('region', { name: 'Connected learning path' })
    const items = within(region).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items.filter(item => item.getAttribute('aria-current') === 'step')).toEqual([items[index]])
    expect(within(items[index]).getByText('You are here')).toBeTruthy()
    expect(within(items[index]).getByRole('link', { name: stage.startLabel }).getAttribute('href')).toBe(stage.startHref)
    expect(within(items[index]).getByRole('link', { name: stage.labLabel }).getAttribute('href')).toBe(stage.labHref)
    const prerequisite = prerequisiteOf(stage.id)
    expect(within(items[index]).getByText(prerequisite ? `Prerequisite: ${prerequisite.title}` : 'Starting point')).toBeTruthy()
    for (const other of CONNECTED_PATH.filter(item => item.id !== stage.id)) {
      expect(within(items[CONNECTED_PATH.indexOf(other)]).getByRole('link', { name: 'Open stage' }).getAttribute('href')).toBe(other.href)
    }
    const next = nextStepOf(stage.id)
    if (next) expect(within(region).getByRole('link', { name: next.title }).getAttribute('href')).toBe(next.href)
    else expect(within(region).getByText(/End of the connected path/)).toBeTruthy()
  }
})

it.each([
  ['electronics', CoursesPage],
  ['robotics', RoboticsPage],
  ['vision', VisionPage],
])('mounts the connected path on the %s hub with that stage marked', (stageId, Page) => {
  hub(Page)
  expect(within(currentStage()).getByText(CONNECTED_PATH.find(stage => stage.id === stageId).title)).toBeTruthy()
})

it('translates the connected-path chrome into Indonesian', () => {
  for (const key of ['Connected learning path', 'Stage {number}', 'You are here', 'Open stage',
    'Prerequisite: {stage}', 'Starting point', 'Next step', 'Vision sandbox']) {
    expect(translate('id', key)).not.toBe(key)
  }
})
