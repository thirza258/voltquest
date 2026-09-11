# VoltQuest UI kit (package J)

Import everything from the barrel: `import { Button, Panel } from '@/ui/index.js'`.
Light theme, flat surfaces, Tailwind classes only. Every component takes `className`;
unknown props are spread onto the root element.

## Conventions

- **Callbacks are value-first, never the event**: `Switch onChange(checked)`, `Slider`/`NumberField onChange(number)`,
  `Select`/`SegmentedControl onChange(value)`, `Tabs onChange(tabId)`. Only `TextInput` passes the raw event.
- **Controlled** components hold no internal state (`Tabs`, `Switch`, `Slider`, `Select`, `Modal`, `SegmentedControl`).
  Uncontrolled state exists only in `Panel` (collapse), `Menu` (open) and `Tooltip` (open).
- **Tones** (`neutral brand success warning danger volt info`) are shared by `Badge`, `Callout`, `ProgressBar`,
  `Stat`, `SpeechBubble` and toasts — see `tokens.js`.
- **Sizes** are `sm | md | lg`; every hit target is ≥ 28 px. Focus is `ring-2 ring-brand-500 ring-offset-1`.
- Informational text uses `text-slate-500`; `text-ink-muted` is decorative/disabled only.
- Motion: 150 ms hover, 250 ms modal/stars, 2 s Chip float — all disabled under `prefers-reduced-motion`.

## Cheat-sheet

```jsx
<Button variant="primary|secondary|ghost|danger|success" size="md" icon={<Play/>} iconRight loading disabled block>Run</Button>
<IconButton icon={<X/>} label="Close" size="sm" variant="ghost" active={false} />
<Panel title="Objectives" subtitle="3 steps" actions={<IconButton …/>} collapsible defaultOpen padded footer={…}>…</Panel>
<Tabs tabs={[{ id:'parts', label:'Parts', icon, badge: 3, panelId:'parts-panel' }]} value={tab} onChange={setTab} size="md" />
<Modal open={open} onClose={close} title="Briefing" description="…" size="sm|md|lg|xl" footer={<Button…/>} closeOnOverlay />
<Tooltip content="Pin 13 · 4.8 V · 12 mA" side="top|bottom|left|right"><IconButton …/></Tooltip>
<Badge tone="volt" dot>USB 5 V</Badge>
<ProgressBar value={xp} max={200} tone="brand" label="XP" showValue size="md" />
<Toaster />                            // mount once near the app root
const { push, dismiss } = useToast()
push({ title:'Saved', message:'Sketch stored', tone:'success', timeoutMs: 5000, action:{ label:'Undo', onClick } })
<Kbd>Ctrl</Kbd> <Stat label="Current" value="12.4" unit="mA" hint="max 40" tone="warning" />
<EmptyState icon={<Cpu/>} title="No part selected" description="Select a part to see live values" action={<Button…/>} />
<Spinner size="sm" /> <Divider /> <Divider vertical />
<Switch checked={audio} onChange={setAudio} label="Audio" />
<Select label="Baud" value={baud} onChange={setBaud} options={[{ value:'9600', label:'9600' }]} size="md" disabled />
<NumberField label="Resistance" value={ohms} onChange={setOhms} min={0} max={1e6} step={10} unit="Ω" />
<Slider label="Light" value={lux} onChange={setLux} min={0} max={100} step={1} unit="%" marks={[0,50,100]} />
<TextInput label="Project" value={name} onChange={(e) => setName(e.target.value)} />
<Field label="Baud" hint="Must match Serial.begin" error={err}>{({ id, describedBy }) => <input id={id} aria-describedby={describedBy} />}</Field>
<Stars value={2} max={3} size="lg" animated />       // aria-label "2 of 3 stars"
<ChipMascot mood="happy|thinking|alert|celebrate|sleepy" size={64} />
<SpeechBubble tone="warning">Pin 13 sources 91 mA (max 40). Add a 220 Ω resistor.</SpeechBubble>
<Card hover onClick={open}>…</Card>                  // with onClick it renders a <button>
<SegmentedControl options={[{ value:'text', label:'Text', icon }]} value={mode} onChange={setMode} size="sm" />
<Callout tone="warning" title="Baud mismatch" icon={<Info/>} action={<Button size="sm">Fix</Button>}>Sketch uses 115200.</Callout>
<Menu trigger="Export" items={[{ label:'JSON', icon, onSelect }, { label:'Delete', danger:true, onSelect }]} align="right" />
```

## Accessibility notes

- `Modal` traps Tab, closes on Escape, restores focus to the opener, and sets `aria-labelledby` only when `title` is given.
- `Tabs` is a roving-tabindex `tablist` with **automatic activation** (Arrow/Home/End select as they move). It renders
  no `tabpanel` — the consumer owns the panel and should set `id={panelId}`, `role="tabpanel"`,
  `aria-labelledby={'tab-' + id}`.
- `Menu` owns its trigger button: pass a label/icon as `trigger`, never a `<button>` (nested buttons are invalid).
- `Toaster` is an always-mounted `role="status" aria-live="polite"` region; `push` is callable from non-React code.
- `Tooltip` opens on hover and focus after 200 ms and links via `aria-describedby` — never put a control's only name in it.
- Use **`Field` or a control's own `label` prop, never both** — two labels for one control. With plain children
  `Field` renders no `htmlFor`, so the child must carry its own accessible name; the render-prop form wires
  `id` + `aria-describedby` for you.
- `Modal` renders through a portal into `document.body`, so a transformed or clipped ancestor cannot break it.
- `Switch` is a real checkbox with `role="switch"`; `Stars` is `role="img"` with an "N of M stars" label.
