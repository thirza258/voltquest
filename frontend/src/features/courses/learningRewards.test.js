import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { installMemoryStorage } from '../../test-utils/localStorage.js'
import { applyLearning, dayNumber, learningSummary, localDay, newLearningState, readLearning, reconcileLearning, recordPracticeLearning, synchronizeLearning, LEARNING_KEY } from './learningRewards.js'
import { saveCourseProgress, readCourseProgress, COURSE_PROGRESS_KEY } from './progress.js'

beforeEach(()=>{ installMemoryStorage(); vi.useFakeTimers(); vi.setSystemTime(new Date(2026,8,19,12)) })
afterEach(()=>vi.useRealTimers())
const course={id:'rewards-test',version:1,lessons:[{id:'one'},{id:'two'}],exam:{passPercent:80}}
const learn=(state, day, action='study')=>applyLearning(state,{actions:[action],rewards:[]},day)
const dayDate=day=>new Date(`${day}T12:00:00`)

it('counts local civil dates correctly across year, leap day and DST boundaries',()=>{
  expect(localDay(new Date(2026,8,19,0,1))).toBe('2026-09-19')
  expect(dayNumber('2027-01-01')-dayNumber('2026-12-31')).toBe(1)
  expect(dayNumber('2024-03-01')-dayNumber('2024-02-28')).toBe(2)
  expect(dayNumber('2026-03-09')-dayNumber('2026-03-08')).toBe(1)
  expect(dayNumber('2026-11-02')-dayNumber('2026-11-01')).toBe(1)
  expect(dayNumber('2026-02-29')).toBeNull()
})
it('deduplicates same-day study and continues on the next day',()=>{
  let state=learn(newLearningState(),'2026-09-19')
  state=learn(state,'2026-09-19')
  expect(state.streak).toBe(1); expect(state.days['2026-09-19'].actions).toHaveLength(1)
  expect(reconcileLearning(state,'2026-09-20')).toMatchObject({streak:1,freezes:1})
  state=learn(state,'2026-09-20')
  expect(state).toMatchObject({streak:2,activeDays:2,bestStreak:2})
})
it('protects one missed day and does not count it as study or reward',()=>{
  const before=learn(newLearningState(),'2026-09-19')
  const protectedState=reconcileLearning(before,'2026-09-21')
  expect(protectedState).toMatchObject({streak:1,activeDays:1,freezes:0,frozenTotal:1})
  expect(protectedState.days['2026-09-20']).toEqual({frozen:true,actions:[]})
  const continued=learn(protectedState,'2026-09-21')
  expect(continued).toMatchObject({streak:2,activeDays:2,bestStreak:2})
  expect(learningSummary(continued,dayDate('2026-09-21')).xp).toBe(0)
  expect(before.freezes).toBe(1)
})
it('spends two freezes for two missed days and preserves the bank for an unbridgeable gap',()=>{
  const before={...learn(newLearningState(),'2026-09-19'),freezes:2}
  expect(learn(before,'2026-09-22')).toMatchObject({streak:2,freezes:0,frozenTotal:2})
  expect(learn(before,'2026-09-23')).toMatchObject({streak:1,bestStreak:1,freezes:2,frozenTotal:0})
})
it('replenishes every seven active days, caps inventory and never earns on frozen days',()=>{
  let state=newLearningState()
  for(let i=1;i<=21;i++) state=learn(state,`2026-09-${String(i).padStart(2,'0')}`)
  expect(state).toMatchObject({streak:21,freezes:2,activeDays:21})
  state=learn(state,'2026-09-23')
  expect(state).toMatchObject({streak:22,freezes:1,activeDays:22})
  for(let i=24;i<=29;i++) state=learn(state,`2026-09-${i}`)
  expect(state).toMatchObject({streak:28,freezes:2,activeDays:28})
})
it('persistently consumes freezes during viewing and never consumes twice on reload',()=>{
  localStorage.setItem(LEARNING_KEY,JSON.stringify(learn(newLearningState(),'2026-09-19')))
  expect(synchronizeLearning(dayDate('2026-09-21')).state.freezes).toBe(0)
  expect(synchronizeLearning(dayDate('2026-09-21')).state.frozenTotal).toBe(1)
  expect(synchronizeLearning(dayDate('2026-09-22')).state).toMatchObject({streak:0,freezes:0,frozenTotal:1})
})
it('recognizes existing milestones without inventing dated activity',()=>{
  localStorage.setItem(COURSE_PROGRESS_KEY,JSON.stringify({old:{version:1,read:['one','one','two'],attempts:1,bestPercent:100,lastPercent:100}}))
  const state=readLearning()
  expect(learningSummary(state).xp).toBe(95)
  expect(state).toMatchObject({streak:0,activeDays:0,freezes:1,lastStudyDay:null})
})
it('awards new reads and exams once, preserves prior progress and does not farm toggles',()=>{
  const original=readCourseProgress(course)
  expect(saveCourseProgress(course,{...original,read:['one']})).toBe(true)
  expect(learningSummary(readLearning()).xp).toBe(10)
  saveCourseProgress(course,{...original,read:[]}); saveCourseProgress(course,{...original,read:['one']})
  expect(learningSummary(readLearning())).toMatchObject({xp:10,todayActions:1})
  const passed={read:['one'],attempts:1,bestPercent:80,lastPercent:80}
  saveCourseProgress(course,passed); saveCourseProgress(course,passed)
  expect(learningSummary(readLearning())).toMatchObject({xp:60,todayActions:2})
  saveCourseProgress(course,{...passed,attempts:2,bestPercent:100,lastPercent:100})
  saveCourseProgress(course,{...passed,attempts:3,bestPercent:100,lastPercent:100})
  expect(learningSummary(readLearning())).toMatchObject({xp:85,todayActions:2})
})
it('counts a complete failed exam as effort without rewarding a pass',()=>{
  saveCourseProgress(course,{...readCourseProgress(course),attempts:1,bestPercent:20,lastPercent:20})
  expect(learningSummary(readLearning())).toMatchObject({xp:0,todayActions:1})
  expect(readLearning().streak).toBe(1)
})
it('counts complete practice daily and rewards correctness once across retries and dates',()=>{
  const questions=[{id:'q',lessonId:'s',prompt:'Which bit?'}]
  recordPracticeLearning(questions,{complete:false,percent:100})
  expect(readLearning().streak).toBe(0)
  recordPracticeLearning(questions,{complete:true,percent:0})
  recordPracticeLearning(questions,{complete:true,percent:100})
  recordPracticeLearning(questions,{complete:true,percent:100})
  expect(learningSummary(readLearning())).toMatchObject({xp:5,todayActions:1})
  vi.setSystemTime(new Date(2026,8,20,12))
  recordPracticeLearning(questions,{complete:true,percent:100})
  expect(readLearning().streak).toBe(2); expect(learningSummary(readLearning()).xp).toBe(5)
})
it('does not grant historical days when the clock moves backward',()=>{
  const state=learn(newLearningState(),'2026-09-19')
  expect(learn(state,'2026-09-18')).toEqual(state)
  expect(learningSummary(state,dayDate('2026-09-18')).clockIssue).toBe(true)
})
it('recovers malformed saved state and reports storage failure without changing scores',()=>{
  localStorage.setItem(LEARNING_KEY,JSON.stringify({version:1,earned:{},streak:99}))
  expect(readLearning().streak).toBe(0)
  const old=readCourseProgress(course)
  const spy=vi.spyOn(localStorage,'setItem').mockImplementation(()=>{throw new Error('quota')})
  expect(saveCourseProgress(course,{...old,read:['one']})).toBe(false)
  expect(readCourseProgress(course)).toEqual(old)
  spy.mockRestore()
})
