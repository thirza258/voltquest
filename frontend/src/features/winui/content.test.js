import { describe, expect, it } from 'vitest'
import { JSDOM } from 'jsdom'
import { WINUI_COURSES, WINUI_STAGES, filterWinuiCourses } from './content.js'
import { getWinuiFiles } from './samples.js'

describe('WinUI learning content', () => {
  it('provides a sequenced thirteen-course path with substantial sections and independent assessments', () => {
    expect(WINUI_COURSES).toHaveLength(13)
    expect(WINUI_STAGES.map(stage => WINUI_COURSES.filter(course => course.stage === stage.id).length)).toEqual([3, 6, 4])
    const ids = new Set(), questionIds = new Set(), prompts = new Set()
    for (const [index, course] of WINUI_COURSES.entries()) {
      expect(course.order).toBe(index + 1)
      expect(course.version).toBe(1)
      expect(course.prerequisites).toEqual(index ? [WINUI_COURSES[index - 1].id] : [])
      expect(ids.has(course.id)).toBe(false)
      ids.add(course.id)
      expect(course.lessons).toHaveLength(4)
      expect(course.steps).toHaveLength(4)
      expect(course.expected.length).toBeGreaterThan(80)
      expect(course.challenge.acceptance.length).toBeGreaterThanOrEqual(3)
      expect(course.exam.passPercent).toBe(80)
      expect(course.exam.questions).toHaveLength(5)
      for (const section of course.lessons) {
        expect(section.paragraphs).toHaveLength(2)
        expect(section.paragraphs.join(' ').length).toBeGreaterThan(400)
        expect(section.example.length).toBeGreaterThan(50)
        expect(section.pitfall.length).toBeGreaterThan(50)
        expect(section.question.lessonId).toBe(section.id)
      }
      for (const question of [...course.lessons.map(section => section.question), ...course.exam.questions]) {
        expect(questionIds.has(question.id)).toBe(false)
        expect(prompts.has(question.prompt)).toBe(false)
        questionIds.add(question.id)
        prompts.add(question.prompt)
        expect(course.lessons.some(section => section.id === question.lessonId)).toBe(true)
        expect(question.options).toHaveLength(3)
        expect(new Set(question.options.map(option => option.text)).size).toBe(3)
        expect(question.options.filter(option => option.id === question.answerId)).toHaveLength(1)
        expect(question.explanation.trim()).not.toBe('')
      }
      expect(course.sources.length).toBeGreaterThanOrEqual(2)
      for (const source of course.sources) expect(new URL(source.url).hostname).toBe('learn.microsoft.com')
    }
    expect(questionIds.size).toBe(117)
  })

  it('searches title, summary and sections and combines stage and difficulty filters', () => {
    expect(filterWinuiCourses('win ui')).toHaveLength(13)
    expect(filterWinuiCourses('MSIX').map(course => course.id)).toContain('winui-packaging')
    expect(filterWinuiCourses('fetch').map(course => course.id)).toContain('winui-api')
    expect(filterWinuiCourses('HTTP').map(course => course.id)).toContain('winui-api')
    expect(filterWinuiCourses('', 'application', 'Intermediate')).toHaveLength(6)
    expect(filterWinuiCourses('', 'foundations', 'Intermediate')).toHaveLength(0)
    expect(filterWinuiCourses('missing-xyz')).toEqual([])
  })
})

describe('Windows source pack structure (not a Windows compiler)', () => {
  for (const course of WINUI_COURSES) it(`pairs XAML names and event handlers with authored C++ for ${course.id}`, () => {
    const files = getWinuiFiles(course)
    const doc = new JSDOM(files['MainWindow.xaml'], { contentType: 'application/xml' }).window.document
    expect(doc.documentElement.getAttribute('x:Class')).toBe('VoltQuestDesktop.MainWindow')
    const handlers = [...doc.querySelectorAll('*')].flatMap(element => [...element.attributes]
      .filter(attribute => ['Click', 'Closed', 'SelectionChanged'].includes(attribute.name)).map(attribute => attribute.value))
    for (const handler of handlers) {
      expect(files['MainWindow.xaml.h']).toContain(`${handler}(`)
      expect(files['MainWindow.xaml.cpp']).toContain(`MainWindow::${handler}(`)
    }
    const named = new Set([...doc.querySelectorAll('*')].map(element => element.getAttribute('x:Name')).filter(Boolean))
    const accessed = [...files['MainWindow.xaml.cpp'].matchAll(/\b(TitleInput|StatusText|RootPanel|TaskList|EditingPanel|DestinationText|DocumentText|RequestPanel|EndpointChoice)\(\)/g)].map(match => match[1])
    for (const name of accessed) expect(named.has(name), name).toBe(true)
    expect(files['MainWindow.idl']).toContain('runtimeclass MainWindow : Microsoft.UI.Xaml.Window')
    expect(files['MainWindow.xaml.cpp']).toContain('InitializeComponent();')
    expect(files['MainWindow.xaml.cpp'].replace(/\bweak\.get\(\)/g, '')).not.toMatch(/\.get\(\)/)
    expect(files['MainWindow.xaml.cpp']).not.toContain('Windows::UI::Xaml')
    expect(files['README.md']).toContain('Keep TaskRules.test.cpp OUT of the WinUI project')
    expect(files['README.md']).toContain('No Windows native build or installation was executed')
    expect(files['README.md']).toContain(course.expected)
    expect(files['RELEASE-CHECKLIST.md']).toContain('NOT RUN')
  })

  it('states precise async, storage and native verification boundaries in the actual downloads', () => {
    const files = id => getWinuiFiles(WINUI_COURSES.find(course => course.id === id))
    const async = files('winui-async')['MainWindow.xaml.cpp']
    expect(async).toContain('co_await ui;')
    expect(async).toContain('m_closed || request != m_generation')
    expect(async).toContain('it does not stop existing timers')
    const capstone = files('winui-capstone')
    expect(capstone['MainWindow.xaml.cpp']).toContain('title.c_str(), title.size()')
    expect(capstone['MainWindow.xaml.cpp']).toContain('vq::valid_selection')
    expect(capstone['MainWindow.xaml.cpp']).toContain('m_tasks.ReplaceAll(candidate)')
    expect(capstone['TextFile.h']).toContain('size > 64 * 1024')
    expect(capstone['TextFile.h']).toContain('reader.LoadAsync(static_cast<std::uint32_t>(size))')
    expect(capstone['README.md']).toContain('not a crash-proof database')
  })
})
