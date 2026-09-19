# Course learning rewards, streaks and freezes

The course/tutorial hubs and all self-study paths show **Your learning journey**, a browser-local
motivational layer separate from campaign XP, accounts, cosmetics, leaderboards and certification.
Existing course progress/exam schemas remain unchanged. No backend endpoints, identity sync,
notifications, purchases or paid rewards are added.

`features/courses/learningRewards.js` owns deterministic calendar/reward rules and persistence.
`CourseRewards.jsx` shows learning level, daily goal, streak, freeze bank, recent days and seven
milestone badges. It refreshes on learning/storage events, focus, visibility changes and a one-minute
timer. Controls and descriptions support English and Indonesian.

## Activity and rewards

| Activity | Learning XP | Daily step |
| --- | --- | --- |
| First read check for a section/version | 10 once | One for that new section |
| Complete practice/checkpoint set | 5 once when all correct | One per set per local day, including complete wrong attempts |
| Complete course exam | 50 for first pass/version; 25 extra for first 100% | One per course/version per local day, including complete failed attempts |
| Page view, incomplete submission, uncheck/recheck rewarded section | 0 | None |

One qualifying step makes a study day. The daily goal is three distinct steps, visually capped at
3/3. Retries improve scores but cannot farm steps or repeated XP. Practice identity includes canonical
question ids, section ids and prompts because older catalogues reuse short ids. Activity is recorded
only after all answers are valid. Existing assessment duplicate-submission guards remain in effect.

Levels use `1 + floor(XP/100)`. Badges recognize first section, ten sections, first passed exam,
perfect exam, seven-study-day streak, five passed exams and thirty-study-day streak. Badges grant no
extra XP and do not gate access. `saveCourseProgress` snapshots prior reward/progress state, saves
course progress, then records new reads/exams. Failed progress writes grant no activity. The shared
Assessment records completed practice. Storage failures are disclosed.

## Calendar and freeze rules

Dates follow the device’s **local calendar and timezone**. YYYY-MM-DD comparisons use civil day
numbers, not elapsed 24-hour periods, so DST does not change the day boundaries. Today remains open
until local midnight. Streak length counts active study days in a connected chain; protected days
keep it connected but add **no study days or XP**.

- Start with one automatic freeze; bank capacity is two.
- Every seven active study days, including across restarted streaks, earns one freeze up to capacity.
  Frozen days do not count and awards beyond capacity are not banked elsewhere.
- On return, spend one freeze per closed missed day if the entire uncovered gap fits the bank.
  Reconcile before earning a new freeze, preventing retroactive rescue with that day’s award.
- If the gap exceeds the bank, restart the current streak and retain unused freezes. Keep best
  streak and earned XP/badges. Previously consumed freezes from an earlier visit are not refunded.
- Viewing/focusing a learning page persists reconciliation; reloading never spends twice.
- Backwards device dates grant no historical activity and show a clock notice. This is personal
  progress, not tamper-resistant timekeeping or exam certification.

Example: study Monday (streak 1), miss Tuesday with one freeze, return Wednesday. Tuesday is Frozen;
streak stays 1 before Wednesday’s first learning action and becomes 2 after it. The bank is empty.
Returning Thursday without studying Wednesday breaks the chain.

## Storage and migration

`vq.learning.v1` contains `version`, `earned` milestone keys, `streak`, `bestStreak`, `activeDays`,
`freezes`, `frozenTotal`, `lastStudyDay`, `coveredThrough` and `days`. Retained days store distinct
`actions` and `frozen`. Keep 35 calendar days and at most 256 actions/day; lifetime counters and
earned keys remain. Notebook imports cannot provide this state or grant rewards.

First use recognizes saved section checks and valid passed/perfect exams as milestone XP. Older
progress has no dates, so migration creates no historical streak/daily steps and no past practice
awards. Existing scores, attempts and versions are preserved. Invalid reward data recovers safely
from available course progress. All persistence uses guarded localStorage helpers.

History is shared by users of the browser profile, not account identity. Storage events refresh
tabs; truly simultaneous independent writes retain localStorage’s last-writer behavior (no server
transaction or multi-device synchronization). Clearing browser storage removes this local history.

Tests cover retries, read toggles, incomplete/failed work, migration, first/perfect-pass rewards,
one/two-day freeze use, exhausted banks, persisted reconciliation, refill/cap, leap/year/DST civil
dates, backwards dates, storage errors and interface updates.
