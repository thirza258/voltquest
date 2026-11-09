// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LocaleProvider, translate } from '../../i18n/index.jsx'
import dictionary from '../../i18n/id.json'
import { installMemoryStorage } from '../../test-utils/localStorage.js'
import { COURSES, COURSE_TRACKS } from './content.js'
import { ALL_COURSES } from './coursesDirectory.js'
import { ALL_SANDBOXES } from '../sandbox/sandboxDirectory.js'
import { TUTORIALS } from '../../content/index.js'
import robotics from '@content/robotics.json'
import vision from '@content/vision.json'
import networking from '@content/networking.json'
import cybersecurity from '@content/cybersecurity.json'
import RoboticsPage from '../robotics/RoboticsPage.jsx'
import VisionPage from '../vision/VisionPage.jsx'
import TutorialPage from '../tutorials/TutorialPage.jsx'
import NetworkingPage from '../networking/NetworkingPage.jsx'
import CybersecurityPage from '../cybersecurity/CybersecurityPage.jsx'
import CoursesPage from './CoursesPage.jsx'
import CoursePage from './CoursePage.jsx'
import ConnectedMap from './ConnectedMap.jsx'
import LessonConnections from './LessonConnections.jsx'
import {
  FOUNDATION_LINKS, MAP_BRIDGES, MAP_TOPICS, SECURITY_BRIDGES, STEP_KIND_LABELS, bridgeBetween, bridgesOf, connectionsAt,
  foundationLinksOf, getTopic, hasConnections, topicForTrack,
} from './learningMap.js'

vi.mock('../../canvas/BreadboardCanvas.jsx', () => ({ BreadboardCanvas: () => <div>Interactive circuit</div> }))

beforeEach(() => installMemoryStorage())
afterEach(() => cleanup())

const APPLIED = MAP_TOPICS.filter(topic => topic.layer === 'applied').map(topic => topic.id)
const FOUNDATIONS = MAP_TOPICS.filter(topic => topic.layer === 'foundation').map(topic => topic.id)
const CONTENT = {
  course: COURSES,
  robotics: robotics.tutorials,
  vision: vision.tutorials,
  tutorial: TUTORIALS,
  networking: networking.courses,
  cyber: cybersecurity.courses,
}
const PREFIX = { course: '/courses', robotics: '/robotics', vision: '/vision', tutorial: '/tutorials', networking: '/networking', cyber: '/cybersecurity' }
const allRefs = () => [
  ...MAP_TOPICS.map(topic => topic.start),
  ...MAP_BRIDGES.flatMap(bridge => bridge.steps),
  ...SECURITY_BRIDGES.flatMap(bridge => bridge.steps),
  ...FOUNDATION_LINKS.flatMap(link => [link.course, link.lesson]),
]
const map = current => render(<LocaleProvider><MemoryRouter><ConnectedMap current={current} /></MemoryRouter></LocaleProvider>)
const mapRegion = () => screen.getByRole('region', { name: 'Connected learning map' })
const topicButton = name => within(mapRegion()).getByRole('button', { name: new RegExp(`^${name}\\s*(You are here)?$`) })
function at(path, routes) {
  return render(<LocaleProvider><MemoryRouter initialEntries={[path]}><Routes>{routes}</Routes></MemoryRouter></LocaleProvider>)
}

it('connects every pair of applied topics with exactly one bridge, and foundations to all four', () => {
  expect(APPLIED).toEqual(['robotics', 'vision', 'iot', 'drone'])
  expect(FOUNDATIONS).toEqual(['electronics', 'programming'])
  expect(new Set(MAP_BRIDGES.map(bridge => bridge.id)).size).toBe(MAP_BRIDGES.length)
  for (const [i, a] of APPLIED.entries()) {
    expect(bridgesOf(a)).toHaveLength(APPLIED.length - 1)
    for (const b of APPLIED.slice(i + 1)) {
      expect(MAP_BRIDGES.filter(bridge => bridge.between.includes(a) && bridge.between.includes(b))).toHaveLength(1)
      expect(bridgeBetween(a, b)).toBe(bridgeBetween(b, a))
    }
    for (const foundation of FOUNDATIONS) {
      expect(FOUNDATION_LINKS.some(link => link.topic === a && link.foundation === foundation), `${foundation} → ${a}`).toBe(true)
    }
  }
  for (const foundation of FOUNDATIONS) expect(bridgesOf(foundation)).toEqual([])
  expect(bridgeBetween('robotics', 'robotics')).toBeNull()
  for (const link of FOUNDATION_LINKS) {
    expect(FOUNDATIONS).toContain(link.foundation)
    expect(APPLIED).toContain(link.topic)
    expect(link.course.kind).toBe('course')
  }
  expect(foundationLinksOf('electronics')).toHaveLength(FOUNDATION_LINKS.filter(link => link.foundation === 'electronics').length)
})

it('claims a joined lab only where the vision capstone passes data from one side to the other', () => {
  for (const bridge of MAP_BRIDGES) {
    expect(new Set(bridge.steps.map(step => step.href)).size).toBe(bridge.steps.length)
    expect(bridge.steps.length).toBeGreaterThanOrEqual(3)
    expect(bridge.joined).toBe(bridge.between.includes('vision'))
    if (bridge.joined) expect(bridge.steps.at(-1).href).toBe('/vision/vision-integration')
    expect(bridge.tryIt.length).toBeGreaterThan(40)
  }
})

it('links only lessons, labs, hubs and benches that exist, with their authored titles', () => {
  for (const step of allRefs()) {
    const entry = CONTENT[step.kind]?.find(item => item.id === step.id)
    expect(entry, `${step.kind}/${step.id}`).toBeTruthy()
    expect(step.title, step.href).toBe(entry.title)
    expect(step.href).toBe(`${PREFIX[step.kind]}/${step.id}`)
    expect(STEP_KIND_LABELS[step.kind]).toBeTruthy()
  }
  for (const topic of MAP_TOPICS) {
    const track = new URL(topic.hub, 'http://x').searchParams.get('track')
    if (track) expect(COURSE_TRACKS.map(item => item.id)).toContain(track)
    else expect(['/robotics', '/vision', '/networking', '/cybersecurity']).toContain(topic.hub)
    const bench = new URL(topic.bench, 'http://x').searchParams.get('bench')
    const sandbox = ALL_SANDBOXES.find(item => item.bench === bench)
    expect(sandbox, topic.bench).toBeTruthy()
    expect(topic.benchLabel).toBe(sandbox.title)
    if (topic.deeper) expect(ALL_COURSES.find(course => course.href === topic.deeper.href)?.title).toBe(topic.deeper.title)
  }
})

it('maps course tracks to topics and answers what passes through one lesson', () => {
  for (const track of COURSE_TRACKS.filter(item => item.id !== 'ethics')) expect(getTopic(topicForTrack(track.id))).toBeTruthy()
  expect(topicForTrack('drone-foundations')).toBe('drone')
  expect(topicForTrack('ethics')).toBeNull()
  expect(topicForTrack('not-a-track')).toBeNull()
  expect(topicForTrack('')).toBe('electronics')

  const capstone = connectionsAt('/vision/vision-integration')
  expect(capstone.bridges.map(item => item.bridge.id).sort()).toEqual(['drone-vision', 'iot-vision', 'robotics-drone', 'robotics-vision'])
  expect(capstone.bridges.every(item => item.next === null)).toBe(true)
  const topics = connectionsAt('/robotics/ros2-topics')
  expect(topics.bridges.map(item => [item.bridge.id, item.index])).toEqual([['robotics-vision', 0], ['robotics-iot', 0]])
  expect(topics.builtOn.map(link => link.course.id)).toEqual(['programming-time'])
  expect(connectionsAt('/courses/ee-power').usedIn.map(link => link.lesson.href)).toEqual(['/robotics/robot-motion', '/courses/drone-foundations'])
  expect(hasConnections('/courses/ethics-risk')).toBe(false)
})

it('links networking and web-security courses without claiming a shared lab', () => {
  expect(MAP_TOPICS.filter(topic => topic.layer === 'security').map(topic => topic.id)).toEqual(['networking', 'cybersecurity'])
  expect(new Set(SECURITY_BRIDGES.map(bridge => bridge.id)).size).toBe(SECURITY_BRIDGES.length)
  for (const bridge of SECURITY_BRIDGES) {
    expect(bridge.between).toEqual(['networking', 'cybersecurity'])
    expect(bridge.joined, bridge.id).toBe(false)
    expect(bridge.steps.some(step => step.kind === 'networking') && bridge.steps.some(step => step.kind === 'cyber'), bridge.id).toBe(true)
    expect(new Set(bridge.steps.map(step => step.href)).size, bridge.id).toBe(bridge.steps.length)
  }
  expect(connectionsAt('/cybersecurity/cyber-ssrf').bridges.map(item => item.bridge.id)).toEqual(['segmentation-ssrf', 'names-and-origins'])
  expect(connectionsAt('/networking/net-acl').bridges.map(item => item.bridge.id)).toEqual(['filter-then-fix', 'segmentation-ssrf'])
  // The hardware square is unchanged by the security layer.
  expect(bridgesOf('networking')).toEqual([])
})

it('shows the networking ↔ security bridges on both hubs and on linked course pages', () => {
  at('/networking', <Route path="/networking" element={<NetworkingPage />} />)
  const panel = screen.getByRole('region', { name: 'Networking ↔ cybersecurity' })
  expect(within(panel).getByRole('link', { name: 'Open the cybersecurity courses' }).getAttribute('href')).toBe('/cybersecurity')
  fireEvent.click(within(panel).getByRole('button', { name: 'NAT hides addresses, not authorization' }))
  expect(within(panel).getByRole('heading', { level: 3, name: 'NAT hides addresses, not authorization' })).toBeTruthy()
  expect(within(panel).getByRole('link', { name: '02. Find broken object authorization' }).getAttribute('href')).toBe('/cybersecurity/cyber-idor')
  cleanup()
  at('/cybersecurity', <Route path="/cybersecurity" element={<CybersecurityPage />} />)
  expect(screen.getByRole('region', { name: 'Networking ↔ cybersecurity' })).toBeTruthy()
  cleanup()
  at('/cybersecurity/cyber-ssrf', <Route path="/cybersecurity/:lessonId" element={<CybersecurityPage />} />)
  const cyber = screen.getByRole('region', { name: 'Connected courses' })
  expect(within(cyber).getAllByRole('heading', { level: 3 }).map(heading => heading.textContent)).toEqual(['Segmentation limits what a tricked server can reach', 'Names, addresses and the parsed origin'])
  cleanup()
  at('/networking/net-acl', <Route path="/networking/:lessonId" element={<NetworkingPage />} />)
  expect(within(screen.getByRole('region', { name: 'Connected courses' })).getByRole('link', { name: '04. Find and repair SQL injection' }).getAttribute('href')).toBe('/cybersecurity/cyber-sql')
})

it('marks the current topic, opens its first bridge and keeps a bridge open when jumping to its other end', () => {
  map('robotics')
  expect(topicButton('Robotics').getAttribute('aria-pressed')).toBe('true')
  expect(within(topicButton('Robotics')).getByText('You are here')).toBeTruthy()
  expect(mapRegion().querySelectorAll('svg line')).toHaveLength(MAP_BRIDGES.length + 2)
  const picker = within(mapRegion()).getByRole('group', { name: 'Connects to' })
  expect(within(picker).getAllByRole('button')).toHaveLength(3)
  const route = () => within(within(mapRegion()).getByRole('list', { name: 'Bridge route' })).getAllByRole('link')
  expect(within(mapRegion()).getByRole('heading', { level: 4, name: 'Camera-guided steering' })).toBeTruthy()
  expect(route().map(link => link.getAttribute('href'))).toEqual(bridgeBetween('robotics', 'vision').steps.map(step => step.href))
  expect(within(mapRegion()).getByText('The vision capstone passes data between these two topics')).toBeTruthy()

  fireEvent.click(within(picker).getByRole('button', { name: /Robot telemetry and remote commands/ }))
  expect(within(mapRegion()).getByRole('heading', { level: 4, name: 'Robot telemetry and remote commands' })).toBeTruthy()
  expect(within(mapRegion()).getByText('No lab passes messages between these two yet')).toBeTruthy()

  fireEvent.click(topicButton('IoT'))
  expect(topicButton('IoT').getAttribute('aria-pressed')).toBe('true')
  expect(within(mapRegion()).getByRole('heading', { level: 3, name: 'IoT devices' })).toBeTruthy()
  expect(within(mapRegion()).getByRole('heading', { level: 4, name: 'Robot telemetry and remote commands' })).toBeTruthy()
  expect(within(mapRegion()).getByRole('link', { name: 'Open topic' }).getAttribute('href')).toBe('/courses?track=iot-parts')
  expect(within(mapRegion()).getByRole('link', { name: 'Embedded IoT & Edge Systems in C' }).getAttribute('href')).toBe('/iot-c')
})

it('shows where a foundation is used instead of bridges', () => {
  map('electronics')
  expect(within(mapRegion()).queryByRole('group', { name: 'Connects to' })).toBeNull()
  expect(within(mapRegion()).getByRole('heading', { level: 4, name: 'Used in' })).toBeTruthy()
  const used = FOUNDATION_LINKS.filter(link => link.foundation === 'electronics')
  const items = within(within(mapRegion()).getByRole('list', { name: 'Used in' })).getAllByRole('listitem')
  expect(items).toHaveLength(used.length)
  used.forEach((link, index) => expect(within(items[index]).getAllByRole('link').map(anchor => anchor.getAttribute('href')))
    .toEqual([link.course.href, link.lesson.href]))
  fireEvent.click(topicButton('Drones'))
  expect(within(mapRegion()).getByRole('heading', { level: 4, name: 'Built on' })).toBeTruthy()
  expect(within(mapRegion()).getByRole('link', { name: 'Serial protocols and systematic debugging' }).getAttribute('href')).toBe('/courses/programming-serial')
})

it.each([
  ['/courses', 'Electronics'],
  ['/courses?track=drone-foundations', 'Drones'],
  ['/courses?track=iot-parts', 'IoT'],
  ['/courses?track=programming', 'Programming'],
])('mounts the map on %s with the matching topic marked', (path, name) => {
  at(path, <Route path="/courses" element={<CoursesPage />} />)
  expect(within(topicButton(name)).getByText('You are here')).toBeTruthy()
})

it('marks no topic for a course track that is not on the map', () => {
  at('/courses?track=ethics', <Route path="/courses" element={<CoursesPage />} />)
  expect(within(mapRegion()).queryByText('You are here')).toBeNull()
  expect(topicButton('Electronics').getAttribute('aria-pressed')).toBe('true')
})

it.each([
  ['robotics', RoboticsPage, 'Robotics'],
  ['vision', VisionPage, 'Computer vision'],
])('mounts the map on the %s hub with that topic marked', (id, Page, name) => {
  at(`/${id}`, <Route path={`/${id}`} element={<Page />} />)
  expect(within(topicButton(name)).getByText('You are here')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'See how this topic connects to the others' }).getAttribute('href')).toBe('#connected-map')
  expect(mapRegion().id).toBe('connected-map')
})

it('shows connected courses on lesson pages with the neighbouring bridge steps', () => {
  at('/courses/drone-foundations', <Route path="/courses/:courseId" element={<CoursePage />} />)
  const panel = screen.getByRole('region', { name: 'Connected courses' })
  expect(screen.getByRole('link', { name: 'Connected courses' }).getAttribute('href')).toBe('#connected-courses')
  const steps = within(panel).getByRole('navigation', { name: 'Bridge steps: Visual landing-pad alignment' })
  expect(within(steps).getByRole('link').getAttribute('href')).toBe('/tutorials/drone-esc-basics')
  expect(within(panel).getByText('Step 1 of 4')).toBeTruthy()
  expect(within(panel).getByRole('link', { name: 'Power, energy and battery budgets' }).getAttribute('href')).toBe('/courses/ee-power')
  // Links open separately so unsaved lab code and exam choices on this page survive.
  for (const link of within(panel).getAllByRole('link')) {
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  }
  cleanup()

  at('/robotics/ros2-topics', <Route path="/robotics/:lessonId" element={<RoboticsPage />} />)
  const robot = screen.getByRole('region', { name: 'Connected courses' })
  expect(within(robot).getAllByRole('heading', { level: 3 }).map(heading => heading.textContent))
    .toEqual(['Camera-guided steering', 'Robot telemetry and remote commands', 'Built on'])
  cleanup()

  at('/tutorials/iot-web-control', <Route path="/tutorials/:tutorialId" element={<TutorialPage />} />)
  const lab = screen.getByRole('region', { name: 'Connected courses' })
  expect(within(lab).getByText('Step 3 of 4')).toBeTruthy()
  expect(within(lab).getByRole('link', { name: '1. OpenCV fundamentals for IoT visual sensors' }).getAttribute('href')).toBe('/vision/opencv-foundations')
  expect(within(lab).getByRole('link', { name: '12. Capstone: connect vision, IoT, drones and robotics' }).getAttribute('href')).toBe('/vision/vision-integration')
  expect(within(lab).getByRole('link', { name: 'ESP32 C++: Wi-Fi and HTTP device control' }).getAttribute('href')).toBe('/courses/programming-esp32')
})

it('leaves lessons that are not on the map unchanged', () => {
  at('/courses/ethics-risk', <Route path="/courses/:courseId" element={<CoursePage />} />)
  expect(screen.queryByRole('region', { name: 'Connected courses' })).toBeNull()
  expect(screen.queryByRole('link', { name: 'Connected courses' })).toBeNull()
  cleanup()
  render(<LocaleProvider><MemoryRouter><LessonConnections href="/vision/vision-transformers" /></MemoryRouter></LocaleProvider>)
  expect(screen.queryByRole('region')).toBeNull()
})

it('translates every authored map string into Indonesian without changing code, numbers or units', () => {
  const authored = [
    // Deeper-track names stay as the course directory shows them; their notes are translated.
    ...MAP_TOPICS.flatMap(topic => [topic.title, topic.short, topic.benchLabel, ...(topic.deeper ? [topic.deeper.note] : [])]),
    ...MAP_BRIDGES.flatMap(bridge => [bridge.title, bridge.flow, bridge.summary, bridge.tryIt, ...bridge.steps.map(step => step.note)]),
    ...FOUNDATION_LINKS.map(link => link.note),
    ...SECURITY_BRIDGES.flatMap(bridge => [bridge.title, bridge.flow, bridge.summary, bridge.tryIt, ...bridge.steps.map(step => step.note)]),
    ...Object.values(STEP_KIND_LABELS),
    'Connected learning map', 'Robotics, computer vision, drones and IoT each connect to the other three. Electronics and programming sit under all four. Choose a topic to see how it connects.',
    'You are here', 'Open topic', 'Resources for {stage}', 'Start: {title}', 'Go deeper', 'Foundations under every topic',
    'Solid line: one lab passes data between the two topics', 'Dashed line: compare each topic in its own labs', 'Connects to',
    'The vision capstone passes data between these two topics', 'No lab passes messages between these two yet', 'Bridge route', 'Try it',
    'Work through each side in its own lab, then compare. The exercise is a written comparison, not a combined simulation.',
    'Used in', 'Built on', 'Connected courses', 'This lesson is part of the connected learning map. Follow a bridge to see the same idea from another topic.',
    'Step {number} of {total}', 'Bridge steps: {title}', 'Previous step', 'Next step', 'Last step of this bridge',
    'See how this topic connects to the others', 'Links open in a new tab, so your work on this page stays as it is.',
    'Networking ↔ cybersecurity', 'Open the cybersecurity courses', 'Open the networking courses', 'Networking and security bridges',
    'Each bridge pairs networking courses with web-security courses that look at the same traffic from another layer: who can connect, and what a permitted request may do.',
  ]
  const sameInIndonesian = new Set(['IoT'])
  const missing = [...new Set(authored)].filter(text => !dictionary[text] || (dictionary[text] === text && !sameInIndonesian.has(text)))
  expect(missing).toEqual([])
  const protectedTokens = text => [...text.matchAll(/[A-Za-z0-9_]*[/._][A-Za-z0-9_]+(?:[/._][A-Za-z0-9_]+)*|\d+(?:\.\d+)?|\{\w+\}/g)].map(match => match[0])
  for (const text of new Set(authored)) {
    for (const token of protectedTokens(text)) expect(dictionary[text], `${token} in "${text}"`).toContain(token)
  }
  // Lesson titles come from the curricula and keep their existing translations; vision, networking
  // and cybersecurity narratives are English-only for now.
  for (const step of allRefs().filter(item => !['vision', 'networking', 'cyber'].includes(item.kind))) expect(translate('id', step.title), step.title).not.toBe(step.title)
})
