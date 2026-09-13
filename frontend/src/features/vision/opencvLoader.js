// Vite emits the pinned dependency as a separate local asset. It is never loaded by the campaign.
import opencvUrl from '@techstark/opencv-js/dist/opencv.js?url'
let pending
export function loadOpenCv() {
  if (pending) return pending
  pending = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = opencvUrl; script.async = true
    const timer = setTimeout(() => { script.remove(); pending = null; reject(new Error('OpenCV could not initialize. Reload this lab to try again.')) }, 30000)
    script.onerror = () => { clearTimeout(timer); script.remove(); pending = null; reject(new Error('The local OpenCV asset could not load. Reload this lab to try again.')) }
    script.onload = () => {
      const module = window.cv
      const ready = () => {
        if (!module?.Mat) { clearTimeout(timer); pending = null; reject(new Error('OpenCV is unavailable.')); return }
        clearTimeout(timer)
        // Emscripten's legacy module is a self-resolving thenable: never resolve/await it directly.
        resolve({ cv: module })
      }
      if (module?.Mat) ready()
      else if (module) module.onRuntimeInitialized = ready
      else ready()
    }
    document.head.appendChild(script)
  })
  return pending
}
