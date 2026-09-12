import { useEffect, useRef, useState } from 'react'
import Editor, { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import 'monaco-editor/esm/vs/editor/editor.all'
import 'monaco-editor/esm/vs/basic-languages/python/python.contribution'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import { diagnosticsToMarkers, LANGUAGE_ID, registerArduinoLanguage, THEME_ID } from './arduinoLanguage.js'

// This module is loaded only with the editor. Every asset and worker is served by our own build.
globalThis.MonacoEnvironment = { getWorker: () => new EditorWorker() }
loader.config({ monaco })
registerArduinoLanguage(monaco)

export default function MonacoEditor({ value, onChange, readOnly = false, language = 'cpp', diagnostics = [], label = 'Sketch code' }) {
  const editorRef = useRef(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const model = editorRef.current?.getModel()
    if (model) monaco.editor.setModelMarkers(model, 'voltquest', diagnosticsToMarkers(diagnostics, monaco, model))
  }, [diagnostics, ready])
  return <Editor
    height="100%"
    language={language === 'python' ? 'python' : LANGUAGE_ID}
    theme={THEME_ID}
    value={value}
    onChange={(next) => onChange?.(next ?? '')}
    onMount={(editor) => { editorRef.current = editor; setReady(true) }}
    loading={<p role="status" className="p-3 text-sm text-slate-600">Loading code editor…</p>}
    options={{ readOnly, ariaLabel: label, automaticLayout: true, minimap: { enabled: false }, fontSize: 13, tabSize: 2, scrollBeyondLastLine: false, wordWrap: 'off', padding: { top: 12 }, bracketPairColorization: { enabled: true }, formatOnPaste: true }}
  />
}
