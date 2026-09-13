# Self-study courses

`/courses` lists the curriculum and `/courses/:courseId` opens a course. The tutorial hub links to
the tracks. Courses complement the runnable tutorials; they do not award campaign XP or certification.

`content/courses.json` is shared by the frontend and public API. It contains `tracks: [{id,title,summary}]`
and `courses: [{id,version,track,order,title,summary,difficulty,minutes,prerequisites,lessons,workedExample,
application,lab,practice,exam,sources}]`. Lessons are `{id,title,text}`. Questions are
`{id,prompt,options:[{id,text}],answerId,explanation,lessonId}`. Each course has three lessons, one worked
example and application, two practice questions and a five-question exam with `passPercent:80`.
Every question has one correct option and a valid lesson review target. Prerequisites are recommendations,
not unlock gates. The frontend imports course content only from lazy course routes.

Both assessment forms require all answers before submission, preserve incomplete choices, and show
correct answers, explanations and lesson links after grading. Exams pass with four of five correct.
There is no timer or retry limit. Practice never affects exam results. A retry clears choices and
feedback, preserving the best score. Duplicate submissions do not increase the attempt count.

Browser-local progress uses `vq.courses.v1`, mapping course id to `{version,read:[lessonId],attempts,
bestPercent,lastPercent}`. It is shared by people using the browser profile, independent of account
identity. Invalid/different-version progress is ignored. Storage failure leaves the visit usable and
shows a notice. Unsubmitted choices and detailed reviews last only while the course remains mounted.
Language switching preserves choices and lesson checks. Content and assessments are translated into
Indonesian; identifiers and technical source titles retain their canonical form.

The public JSON contains answer keys: this is voluntary self-study, not a tamper-proof assessment.
Related labs open separately to preserve choices. Each lab task explains its scope: analytical RC,
battery charging, BLE/LoRa and real RF propagation are not added simulation models. Pi remains the
restricted GPIO/Python model. Hardware exercises use low-voltage circuits and verified part requirements.

The delivered catalogue contains 10 electrical courses, 10 IoT parts courses, an IoT/Arduino foundation
course and a drone foundation course: 22 total, 66 theory sections, 154 questions and 22 exams.
`formulas` is an array of `{title,equation,symbols,assumptions,example}` cards with explicit units,
assumptions and worked calculations; there are 46 cards. A course may contain `extraLabs` alongside
its primary lab. IoT and drone foundations each link to three new runnable experiments.
Robotics and computer vision use dedicated catalogues and `StudyLesson`, reusing the same grading
and local progress behavior. Their ids are unique across catalogues. See ROBOTICS.md and VISION.md.
