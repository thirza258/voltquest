import { describe, expect, it } from 'vitest'
import { COMPUTER_COURSES, createProject, parseProject, validateProject } from './project.js'
import { PRESETS } from '../../engine/computer/presets.js'
import { evaluateCircuit, parseCircuit } from '../../engine/computer/logic.js'
import { gradeQuestions } from '../courses/content.js'

it('ships eighteen courses with six assembly courses, unique ids and a real preset each', () => {
  expect(COMPUTER_COURSES).toHaveLength(18)
  expect(COMPUTER_COURSES.filter(course=>course.stage==='gates')).toHaveLength(8)
  expect(COMPUTER_COURSES.filter(course=>course.stage==='assembly')).toHaveLength(6)
  expect(COMPUTER_COURSES.map(course=>course.order)).toEqual(Array.from({length:18},(_,i)=>i+1))
  expect(new Set(COMPUTER_COURSES.map(course=>course.id)).size).toBe(18)
  expect(Object.keys(PRESETS)).toEqual(COMPUTER_COURSES.map(course=>course.id))
})
describe.each(COMPUTER_COURSES)('$id content',course=>{
  it('has substantial teaching, distinct questions, valid review anchors and a transferable build challenge',()=>{
    expect(course.lessons).toHaveLength(4); expect(course.steps).toHaveLength(4); expect(course.exam.questions).toHaveLength(5)
    for(const section of course.lessons) {
      expect(section.paragraphs.join(' ').split(/\s+/).length).toBeGreaterThan(60)
      expect(section.example.length).toBeGreaterThan(8); expect(section.pitfall.length).toBeGreaterThan(20)
    }
    const questions=[...course.lessons.map(section=>section.question),...course.exam.questions]
    expect(new Set(questions.map(question=>question.prompt)).size).toBe(9)
    expect(new Set(questions.map(question=>question.id)).size).toBe(9)
    for(const question of questions) {
      expect(question.options.filter(option=>option.id===question.answerId)).toHaveLength(1)
      expect(new Set(question.options.map(option=>option.text)).size).toBe(3)
      expect(course.lessons.some(section=>section.id===question.lessonId)).toBe(true)
    }
    expect(course.bridge.minecraft.length).toBeGreaterThan(90)
    expect(course.challenge.acceptance.length).toBeGreaterThanOrEqual(2)
    expect(course.sources.every(source=>new URL(source.url).protocol==='https:')).toBe(true)
    const answers=Object.fromEntries(course.exam.questions.map(question=>[question.id,question.answerId]))
    expect(gradeQuestions(course.exam.questions,answers)).toMatchObject({complete:true,percent:100})
    delete answers[course.exam.questions[0].id]
    expect(gradeQuestions(course.exam.questions,answers).complete).toBe(false)
  })
})
it('checks the authored initial observations through the actual gate model',()=>{
  const expected={
    'computer-bits':{bit0:1,bit1:0,bit2:1,bit3:0},
    'computer-gates':{NOT:0,AND:0,OR:1,XOR:1,NAND:1,NOR:0,XNOR:0},
    'computer-nand':{X:0},'computer-boolean':{Y:1},'computer-adders':{S:1,COUT:1},
    'computer-arithmetic':{S0:0,S1:0,S2:0,S3:1,COUT:0},
    'computer-routing':{W0:0,W1:1,W2:0,W3:0,Y:1},
    'computer-alu':{Y0:0,Y1:0,Y2:0,Y3:1,Z:0,C:0},
    'computer-registers':{Q0:0,Q1:0,Q2:0,Q3:0},'computer-memory':{DATA:0,Q0:0,Q1:0,Q2:0,Q3:0},
  }
  for(const [id,outputs] of Object.entries(expected)) expect(evaluateCircuit(parseCircuit(PRESETS[id].source),PRESETS[id].inputs).outputs).toEqual(outputs)
})
it('preserves unfinished notebook source but discards invented execution evidence',()=>{
  const draft={...createProject('assembly-loops'),source:'unfinished:\nLDI',notes:'Keep this draft',run:{a:15},xp:9999}
  const value=parseProject(JSON.stringify(draft))
  expect(value).toEqual({format:draft.format,version:1,lesson:draft.lesson,source:draft.source,inputs:{},notes:draft.notes})
  expect(()=>validateProject(value,'computer-bits')).toThrow(/another course/)
  expect(()=>parseProject(JSON.stringify({...value,lesson:'constructor'}))).toThrow(/supported/)
  expect(()=>parseProject(JSON.stringify({...value,inputs:{A:99}}))).toThrow(/bits/)
  expect(()=>parseProject(' '.repeat(98305))).toThrow(/96 KiB/)
  expect(()=>validateProject({...value,source:'\u0001'.repeat(16384)})).toThrow(/96 KiB/)
  const unicode = validateProject({...value,source:'🧱'.repeat(4000),notes:'電'.repeat(10000)})
  expect(parseProject(JSON.stringify(unicode,null,2))).toEqual(unicode)
})
