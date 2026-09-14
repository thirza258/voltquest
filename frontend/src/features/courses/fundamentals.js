import content from '@content/tutorial-fundamentals.json'

// Keep explanations separate from the full course catalog and its answer keys.
export const TUTORIAL_FUNDAMENTALS = content.tutorials
export const getTutorialFundamentals = id => TUTORIAL_FUNDAMENTALS.find(guide => guide.tutorialId === id) ?? null
export const fundamentalsForCourse = id => TUTORIAL_FUNDAMENTALS.filter(guide => guide.readings.some(reading => reading.courseId === id))

