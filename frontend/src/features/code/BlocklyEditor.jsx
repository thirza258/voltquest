import { useEffect, useRef, useState } from 'react'
import * as Blockly from 'blockly'
import 'blockly/blocks'
import { buildToolbox, defineVoltQuestBlocks, STARTER_BLOCKLY_XML } from './blocks.js'
import { generateArduinoFromWorkspace } from './generator.js'

defineVoltQuestBlocks()

export function codeFromXml(xml) {
  const workspace = new Blockly.Workspace()
  try {
    Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(xml || STARTER_BLOCKLY_XML), workspace)
    return generateArduinoFromWorkspace(workspace)
  } finally { workspace.dispose() }
}

export default function BlocklyEditor({ xml, onChange, esp32 = false, readOnly = false }) {
  const host = useRef(null)
  const callback = useRef(onChange)
  callback.current = onChange
  const initialXml = useRef(xml)
  const [error, setError] = useState('')
  useEffect(() => {
    const workspace = Blockly.inject(host.current, { toolbox: readOnly ? undefined : buildToolbox({ esp32 }), readOnly, trashcan: !readOnly, sounds: false, media: '/blockly-media/', zoom: { controls: true, wheel: true, startScale: 0.8 }, move: { scrollbars: true, drag: true, wheel: true } })
    const emit = () => {
      try {
        callback.current?.(Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(workspace)), generateArduinoFromWorkspace(workspace))
      } catch (e) { setError(e.message) }
    }
    try { Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(initialXml.current || STARTER_BLOCKLY_XML), workspace) }
    catch (e) { setError(`Cannot load blocks: ${e.message}`) }
    const listener = (event) => { if (!event.isUiEvent && !readOnly) emit() }
    workspace.addChangeListener(listener)
    if (!readOnly) emit()
    const resize = () => Blockly.svgResize(workspace)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
    observer?.observe(host.current)
    resize()
    return () => { observer?.disconnect(); workspace.removeChangeListener(listener); workspace.dispose() }
  }, [esp32, readOnly])
  return <div className="relative h-full min-h-[280px]" data-keyboard-passthrough>
    {error && <p role="alert" className="absolute left-2 top-2 z-10 bg-rose-50 p-2 text-xs text-rose-700">{error}</p>}
    <div ref={host} className="h-full w-full" aria-label="Visual code workspace" />
  </div>
}
