// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LocaleProvider, translate } from '../../i18n/index.jsx'
import { installMemoryStorage } from '../../test-utils/localStorage.js'
import { downloadJson, downloadText } from '../../lib/download.js'
import { readCourseProgress } from '../courses/progress.js'
import { learningSummary, readLearning, newLearningState, applyLearning, LEARNING_KEY } from '../courses/learningRewards.js'
import ComputerPage from './ComputerPage.jsx'
import ComputerPromo from './ComputerPromo.jsx'
import { COMPUTER_COURSES, createProject, STORAGE_PREFIX } from './project.js'

vi.mock('../../lib/download.js',()=>({downloadJson:vi.fn(),downloadText:vi.fn()}))
beforeEach(()=>{installMemoryStorage();vi.clearAllMocks()})
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.useRealTimers()})
const click=name=>fireEvent.click(screen.getByRole('button',{name,exact:true}))
const change=(label,value)=>fireEvent.change(screen.getByLabelText(label),{target:{value}})
function page(path='/computer-architecture') {
  return render(<LocaleProvider><MemoryRouter initialEntries={[path]}><Routes><Route path="/computer-architecture" element={<ComputerPage/>}/><Route path="/computer-architecture/:lessonId" element={<ComputerPage/>}/><Route path="/sandbox" element={<ComputerPage sandbox/>}/></Routes></MemoryRouter></LocaleProvider>)
}
const observation=()=>{click('Export observation');return downloadJson.mock.calls.at(-1)[0].observation}

it('discovers eighteen courses and filters the six-course assembly sequence',()=>{
  page()
  expect(screen.getByRole('heading',{name:'From logic gates to your own computer'})).toBeTruthy()
  change('Learning stage','assembly')
  expect(screen.getByText(/6 courses found/)).toBeTruthy()
  change('Search computer courses','RISC-V')
  expect(screen.getByRole('heading',{name:'17. Transfer assembly skills to RISC-V'})).toBeTruthy()
  change('Search computer courses','nothing-zxy'); expect(screen.getByRole('heading',{name:'No courses match'})).toBeTruthy()
  click('Clear filters'); expect(screen.getByText(/18 courses found/)).toBeTruthy()
})
it('evaluates edited circuits, updates visible signals and generates real truth tables',()=>{
  page('/sandbox?bench=computer&lesson=computer-nand')
  click('Evaluate circuit'); expect(observation().result.outputs.X).toBe(0)
  click('B: 1'); expect(observation().result.outputs.X).toBe(1)
  click('Generate truth table'); expect(observation().table.map(row=>row.outputs.X)).toEqual([0,1,1,0])
  change('Circuit source','INPUT A B\nx = AND A B\nOUTPUT Y=x')
  expect(screen.queryByRole('region',{name:'Circuit results'})).toBeNull()
  click('Generate truth table'); expect(observation().table.map(row=>row.outputs.Y)).toEqual([0,0,0,1])
  expect(screen.getByRole('img',{name:'Live gate connections and values'})).toBeTruthy()
})
it('preserves register memory across input changes and captures only on an edge',()=>{
  page('/sandbox?bench=computer&lesson=computer-registers')
  click('Evaluate circuit'); expect(observation().result.outputs.Q0).toBe(0)
  click('Clock one edge'); expect(observation().result.outputs).toEqual({Q0:1,Q1:0,Q2:1,Q3:0})
  click('EN: 1');click('D0: 1');click('Clock one edge')
  expect(observation().result.outputs.Q0).toBe(1)
  click('RST: 0');expect(observation().result.outputs.Q0).toBe(1)
  click('Clock one edge');expect(observation().result.outputs.Q0).toBe(0)
})
it('keeps latch observations attached to applied inputs and handles forbidden release',()=>{
  page('/sandbox?bench=computer&lesson=computer-latches')
  click('S: 0');click('Apply latch inputs');expect(observation().state.q).toBe(1)
  click('R: 0');expect(screen.getByText('Inputs changed. Apply them to update the latch observation.')).toBeTruthy()
  click('Apply latch inputs');expect(observation().state.q).toBeNull()
  click('S: 1');click('R: 1');click('Apply latch inputs');expect(observation().state.q).toBeNull()
  click('R: 0');click('Apply latch inputs');expect(observation().state.q).toBe(0)
})
it('assembles, steps, runs edited assembly and exports the actual source and state',()=>{
  page('/sandbox?bench=computer&lesson=computer-cpu')
  click('Assemble');click('Step clock');expect(observation().state).toMatchObject({phase:'decode',a:0,ir:0x13})
  click('Run to halt');expect(observation().state).toMatchObject({a:8,out:8,halted:true,clocks:12})
  expect(screen.getByRole('button',{name:'Run to halt'}).disabled).toBe(true)
  const source='LDI 6\nADDI 2\nOUT\nHLT\n; exact draft'
  change('Assembly source',source);expect(screen.queryByRole('region',{name:'CPU state and trace'})).toBeNull()
  click('Run to halt');expect(observation().state.output).toEqual([8])
  click('Download source');expect(downloadText).toHaveBeenLastCalledWith(source,'computer-cpu.asm')
})
it('shows invalid source errors without executing and bounds infinite programs',()=>{
  page('/sandbox?bench=computer&lesson=assembly-loops')
  change('Assembly source','LDI 16');click('Assemble')
  expect(screen.getByRole('alert').textContent).toContain('0–15')
  expect(screen.queryByRole('region',{name:'CPU state and trace'})).toBeNull()
  change('Assembly source','loop: JMP loop');click('Run to halt')
  expect(observation().state).toMatchObject({clocks:768,halted:false})
  expect(screen.getByText(/Clock limit reached/)).toBeTruthy()
})
it('saves unfinished drafts and confirms load, reset and preset replacements',()=>{
  page('/sandbox?bench=computer&lesson=assembly-loops')
  change('Assembly source','LDI');change('Experiment notes','Preserve me');click('Save notebook')
  const saved=JSON.parse(localStorage.getItem(STORAGE_PREFIX+'assembly-loops'))
  expect(saved).toMatchObject({source:'LDI',notes:'Preserve me'})
  change('Experiment notes','Unsaved');click('Load saved notebook');click('Cancel')
  expect(screen.getByLabelText('Experiment notes').value).toBe('Unsaved')
  click('Load saved notebook');click('Replace notebook');expect(screen.getByLabelText('Experiment notes').value).toBe('Preserve me')
  click('Export notebook');expect(downloadJson).toHaveBeenLastCalledWith(saved,'assembly-loops.json')
  change('Choose a computer experiment','computer-bits');click('Cancel');expect(screen.getByLabelText('Assembly source').value).toBe('LDI')
  click('Restore example');click('Replace notebook');expect(screen.getByLabelText('Assembly source').value).toContain('loop: OUT')
})
it('imports through confirmation and drops fabricated results',async()=>{
  page('/sandbox?bench=computer')
  const input=screen.getByLabelText('Import computer notebook file')
  const imported={...createProject('computer-capstone'),run:{a:999,halted:true},rewards:{xp:9999}}
  fireEvent.change(input,{target:{files:[{size:200,text:async()=>JSON.stringify(imported)}]}})
  await screen.findByRole('dialog');click('Replace notebook')
  expect(screen.queryByRole('region',{name:'CPU state and trace'})).toBeNull()
  click('Run to halt');expect(observation().state.output).toEqual([10])
  click('Export notebook');expect(downloadJson.mock.calls.at(-1)[0]).not.toHaveProperty('run')
  expect(learningSummary(readLearning()).xp).toBe(0)
})
it('grades complete exams, persists progress and rewards once while incomplete work stays uncredited',()=>{
  page('/computer-architecture/computer-bits')
  const course=COMPUTER_COURSES[0], form=screen.getByRole('form',{name:'Course exam'})
  fireEvent.submit(form);expect(readCourseProgress(course).attempts).toBe(0);expect(readLearning().streak).toBe(0)
  fireEvent.click(screen.getByLabelText('Mark lesson 1 as read'))
  course.exam.questions.forEach((question,index)=>fireEvent.click(within(form).getByLabelText(question.options.find(option=>index===4 ? option.id!==question.answerId : option.id===question.answerId).text)))
  fireEvent.submit(form);fireEvent.submit(form)
  expect(readCourseProgress(course)).toMatchObject({attempts:1,bestPercent:80,read:[course.lessons[0].id]})
  expect(learningSummary(readLearning())).toMatchObject({xp:60,todayActions:2})
  expect(within(screen.getByRole('region',{name:'Your learning journey'})).getByText('60')).toBeTruthy()
})
it('counts section checkpoints toward a live daily goal and preserves choices and CPU state across locale changes',()=>{
  page('/computer-architecture/computer-cpu')
  const course=COMPUTER_COURSES.find(item=>item.id==='computer-cpu')
  fireEvent.click(screen.getByLabelText('Mark lesson 1 as read'))
  fireEvent.click(screen.getByLabelText('Mark lesson 2 as read'))
  const section=document.getElementById(course.lessons[0].id), form=section.querySelector('form'), question=course.lessons[0].question
  fireEvent.click(within(form).getByLabelText(question.options.find(option=>option.id===question.answerId).text))
  fireEvent.submit(form)
  expect(learningSummary(readLearning())).toMatchObject({xp:25,todayActions:3})
  click('Run to halt');const before=observation().state
  change('Language / Bahasa','id')
  expect(screen.getByLabelText(translate('id','Mark lesson {number} as read',{number:1})).checked).toBe(true)
  click(translate('id','Export observation'));expect(downloadJson.mock.calls.at(-1)[0].observation.state).toEqual(before)
  expect(screen.getByText(translate('id','Daily goal complete. Your learning counts.'))).toBeTruthy()
  expect(form.querySelector('input:checked')).toBeTruthy()
})
it('shows a consumed freeze after a missed day and retains the best streak across reloads',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date(2026,8,21,12))
  const state=applyLearning(newLearningState(),{actions:['study']},'2026-09-19')
  localStorage.setItem(LEARNING_KEY,JSON.stringify(state));page()
  expect(JSON.parse(localStorage.getItem(LEARNING_KEY))).toMatchObject({streak:1,freezes:0,frozenTotal:1})
  expect(screen.getByText('Frozen')).toBeTruthy()
})
it('offers navigation-only promo links and handles unknown courses',()=>{
  const rendered=render(<LocaleProvider><MemoryRouter><ComputerPromo/></MemoryRouter></LocaleProvider>)
  expect(screen.getByRole('link',{name:'Assembly courses'}).getAttribute('href')).toBe('/computer-architecture?stage=assembly')
  rendered.unmount();page('/computer-architecture/missing')
  expect(screen.getByRole('heading',{name:'Course not found'})).toBeTruthy()
})

it('retrofits the computer bench with a working AVR assembler IDE',()=>{
  page('/sandbox?bench=computer&asm=1')
  expect(screen.getByLabelText('Editable AVR source').value.length).toBeGreaterThan(0)
  change('Editable AVR source','ldi r16, 0x2A\nout PORTB, r16')
  click('Assemble & run')
  fireEvent.click(screen.getByRole('tab',{name:'PORTB output'}))
  expect(screen.getByRole('region',{name:'PORTB output'}).textContent).toContain('0x2A')
  expect(screen.getByRole('table',{name:'Assembler listing'})).toBeTruthy()
  change('Editable AVR source','ldi r1, 5')
  fireEvent.click(screen.getByRole('tab',{name:/Problems/}))
  expect(screen.getByRole('alert').textContent).toContain('high register')
})
