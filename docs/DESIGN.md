# VoltQuest visual design — "clean lab notebook"

Goal: simple **light** theme, not over-decorated, but highly interactive and informational. Every pixel of decoration
must carry information (state, value, affordance). No gradients on surfaces, no glassmorphism, no heavy shadows.

## Tokens (Tailwind theme in `frontend/tailwind.config.js` — already configured, do not edit)
- Surfaces: page `#F8FAFC`, panel `#FFFFFF`, sunken `#F1F5F9`. Borders `#E2E8F0` (`border-line`), strong `#CBD5E1`.
- Text: primary `#0F172A` (`text-ink`), secondary `#475569` (`text-ink-secondary`), informational-muted **`#64748B`** (slate-500, WCAG AA) — `#94A3B8` (`text-ink-muted`) only for decorative/disabled text.
- Brand (actions, links, active tabs): teal `brand-600 #0D9488` (hover 700). Volt (XP, stars, energy): amber `volt-400/500`.
- Success emerald-600 / bg emerald-50; Warning amber-600 / amber-50; Danger rose-600 / rose-50; Info blue-600 / blue-50.
- Canvas: white with a faint 24 px dot grid `#E2E8F0`; breadboard body `#F5F5F4`, border `#D6D3D1`; holes `#64748B` rings with `#1E293B` centers; strip hover `rgba(16,185,129,0.25)`; rails red `rgba(244,63,94,0.18)` / blue `rgba(59,130,246,0.18)`.
- Wires: red `#EF4444`, black `#1F2937`, yellow `#F59E0B`, green `#10B981`, blue `#3B82F6`, orange `#F97316`, white `#E5E7EB` (gray outline), purple `#8B5CF6`; neon palette `#FF3D71 #00E5FF #FFEA00 #00FF9C #7C4DFF`.
- Radius 6 px controls, 10 px panels/cards. `shadow-sm` only on floating elements. Inter 14 px base; JetBrains Mono for code/serial; tabular numbers. Panel titles 11–12 px uppercase tracking-wide slate-500.
- Motion 150 ms hover, 250 ms panels/modals, effects ≤ 2 s; respect `prefers-reduced-motion`. Focus ring `ring-2 ring-brand-500 ring-offset-1`. Hit targets ≥ 28 px.

## Header shell (all modes, 48 px)
Left: logo mark (bolt in rounded teal square) + "VoltQuest" (→ `/`), nav SegmentedControl **Campaign · Tutorials · Sandbox · Showcase**. On small screens, replace the segments with a labeled native navigation select to avoid header overflow.
Centre (mode-specific): campaign = `codeName · title` + board Badge (5 V / 3.3 V) + ⓘ (re-open briefing); sandbox = editable project name + save state ("Saved 2 min ago" / "Unsaved") + Export menu (JSON · PNG · .ino · BOM) + Publish; showcase = "by {owner}" + views/forks + **Fork** (primary).
Right: board switcher Select (campaign: only when `level.boardSwitcher === 'enabled'`), Power toggle (Badge "USB 5 V ●" / "Power off"), Hint button ("Hint 1/3" with tier dots; disabled at 3), Reset sim (↺, tooltip "Clears damage, serial and timers; keeps your circuit"), overflow menu (Restart level, Shortcuts `?`), **Run/Stop** primary (Stop is rose), avatar chip (display name + level) → menu: Profile, Claim account / Log in, Log out, Audio.

## Workspace body
Three resizable columns (left 300 px, right 420 px; min 220 / max 50 %), 6 px drag handles, sizes persisted.
Left tabs: **Objectives | Parts | Inspect | Learn** (sandbox/showcase: Parts | Inspect | Learn). Selecting a component switches to Inspect. Inspect empty state: "Select a part to see live values".
- Objectives: live checklist (check icon + "Done" text, `aria-live="polite"`), per-objective Chip SpeechBubble for tier-1 hints, footer "★ Complete all steps · ★★ No smoke or shorts · ★★★ {threeText}" with live ticks. Damage/short → auto-switch to this tab, pulse badge, Chip callout (`level.chipOnSmoke ?? warning.hint`) with actions "Show me why" (select part → Inspect) and "Replace part".
- Parts: registry cards grouped by category, search, draggable (`application/x-voltquest-component`), click-to-add fallback, filtered by `allowedComponents`; ESP32 group shows a 3.3 V badge.
- Inspect: props editors (resistor value with live color bands), live Stats V / I / P, state Badge, Learn card (summary, pinout, tips, formulas with live numbers, pitfalls), control widgets (hold button, pot slider, sensor sliders, touch toggle).
- Learn: level.learn text + **Circuit Insights**: nets table (label, voltage, terminal count), supply current meter vs 500 mA USB budget, warnings list with cause + fix.
Centre: canvas with bottom-left toolbar (zoom −/+/fit/100 %, grid toggle, breadboard layout SegmentedControl Half · Full · Dual — sandbox or `boardSwitcher: enabled`), wire color palette (1–5) floating top-right, tool toggle Select/Wire.
Right tabs: **Code | Phone | IoT** (Phone/IoT hidden for AVR boards). Code has a SegmentedControl **Text | Blocks**. Serial Monitor docked below (collapsible, 180 px): timestamps toggle, baud Select (300…115200; mismatch with `Serial.begin` renders `⸮` glyphs + Callout "Baud mismatch — sketch uses 115200" with a fix button), autoscroll, input + Send, clear, copy.
Footer 32 px: XP ProgressBar + level, audio Switch, offline pill ("Offline — saving on this device") when applicable, sim status pill (Idle · Compiling · Running 12.3 s · Error), warnings count.

## Campaign map (`/`)
Hero: ChipMascot + primary CTA "Continue → {next level}" (first level without stars), player summary (level, XP, stars). Worlds as sections tinted by `theme` with board Badge; level Cards: codeName, title, summary, minutes, Stars row, state locked (lock icon + "Finish 1-2 first" + small "Skip ahead") / available / completed. Sandbox card always present. World intro shown once (Chip bubble at the top of the world section).

## Tutorial learning lab (`/tutorials`)
The hub uses a clean card grid with board/language badges, difficulty, duration, concepts and an
Open tutorial action. Board, topic and difficulty filters persist in the URL. Default order is
**Easy → Intermediate → Hard**. A visible shortcut opens the Arduino/ESP32 C++ programming path.

The tutorial detail page combines numbered, checkable steps, an interactive prepared circuit and
editable source with serial/Python output. Desktop uses three columns; smaller screens stack panels.
Run/Stop and Reset remain separate from lesson completion. Program concepts and Hardware concepts
appear below, followed by exact component placement and cable endpoint tables derived from the live
CircuitDoc. Clicking Show cable highlights the endpoints. Long wiring tables scroll within their own
panel on mobile; they must not widen the page. Source lines scroll horizontally instead of wrapping.

Explain both what happens and why. Every lesson includes an experiment, polarity/voltage or relevant
hardware constraints, and program reasoning. Code-only examples explicitly say no cables are needed.
Raspberry Pi lessons show BCM and physical pin numbers and disclose the restricted GPIO/Python
learning model. Do not imply a full Linux computer or arbitrary Python packages are simulated.

## Self-study courses

The tutorial hub links to course tracks. Use light cards, teal links and labelled native search,
track and difficulty filters. Details have an outline beside readable lessons on desktop and stack
on mobile. Radio groups use fieldsets, legends and full clickable labels. Submission focuses results
or the first missing answer. Feedback uses text and colour, and links back to lessons. Separate
practice from exams, explain the 80% pass threshold and offer retries. Show best/last scores and
the browser-local progress scope. Language changes preserve choices and checked lessons.

## Modals
Briefing (Chip + bubbles, Start). Dual breadboard prompt: title "This board covers all available pin rows.", body "Snap a second breadboard alongside it?", primary "Add second breadboard", secondary "Keep one board". Success: Stars animate one by one, XP counts up, star reasons for missed stars, "Level up! Unlocked: Neon wires" when applicable, buttons "Next level" (or "Back to map" on the last level) / "Replay" / "Open in Sandbox"; "Best ★★ · +0 XP (already earned)" when nothing new. Shortcuts modal (`?`) lists all keys with `Kbd`.

## Keyboard
Global (ignored while typing in inputs/Monaco): `Ctrl/Cmd+Enter` Run/Stop, `Ctrl/Cmd+Z` / `Shift+Ctrl/Cmd+Z` undo/redo, `Ctrl/Cmd+S` save (sandbox), `H` hint, `?` shortcuts. Canvas (focus inside canvas or body): `V` select, `W` wire, `R` rotate, `Delete/Backspace`, `1–5` wire colors, `Esc`, `+ − 0` zoom, `F` fit.

## Information density rules
Tooltips with real numbers on everything on the canvas (V, mA, Ω, net name). Warnings always say cause + fix ("Pin 13 sources 91 mA (max 40). Add a 220 Ω resistor in series."). Colors are also named in text ("Red LED", "green wire"). Empty/loading/error/offline states are explicit and friendly.

## Chip the mascot
Friendly retro robot: rounded head, round eyes, antenna with a bolt tip, teal body, amber accents. Moods change eyes/mouth only; gentle 2 s float at most.

## Localization and assistant extension (2026-09-12)

The shared header includes a compact native Language / Bahasa selector, English by default and
Indonesian optional. Language changes preserve circuit, editor and simulation state. Translate UI
labels and instructional prose; retain code, program output, pin names and user-entered content.

The circuit sidebar adds an AI tab, with Ask AI above the canvas. Use existing brand/line/surface
tokens, a visible context and selection summary, suggested questions, labelled textarea, response
log and retry/clear controls. Provider configuration errors do not hide agent setup. A disclosure
explains what is shared. Answers render as escaped text with readable fenced code, never executable
HTML. Under the same section, a details element groups Claude Code/Codex configuration, token
creation/replacement/revocation and explicit context sharing. Code blocks scroll within the panel.

Tutorials show the guide below their prepared circuit. Selected parts expose the same inspector;
selection and live controls remain active while circuit editing stays read-only. At mobile widths
panels stack and long configuration/code lines scroll locally, with no page-level horizontal scroll.

## Custom Drone Builder

Use the same light notebook palette and shared header, with a LiPo cell-count power label for drone
projects. At desktop width retain three resizable columns: Build/Objectives, Bench/Flight, Code/Tune.
Below 1280 px, keep those panels mounted behind Build, Bench/flight and Code/tune tabs. The center
has a scrolling view area and a fixed compact transmitter below it so controls stay reachable at
390 px. Every axis also has a labelled native range input; modes and arm have explicit controls.

The bench uses named mount targets, typed selectable connectors, motor indices/directions and
visible damage. Invalid moves show a reason; the inspector provides a keyboard placement alternative.
The flight SVG uses an orbit projection of 3D state, gate progress colors and numerical HUD values;
render interpolation never advances simulation. The blackbox labels trace colors, units and scales
and allows sample inspection. Show feasibility numbers before wiring, and causes/fixes for failures.
Edits to presets/FC assembly and replacement code use existing confirmation modals. The export includes
model limits and real-build checklist; it must never present simulator helpers as certified firmware.

## Robotics and computer vision study labs

Advanced paths are linked from Tutorials and Courses. Use the shared header, teal learning accents,
white bordered cards, readable formula text and persistent self-study progress. On desktop the robot
world, message graph and controller form three columns; on mobile they stack. The SVG world has a
numerical telemetry equivalent. Run/Step/Stop remain real buttons. JSON edits show a confirmation before
replacing the applied project; save/export describe which version they use.

Vision shows source and result side by side, with controls stacked above on mobile. Heatmap patches
have keyboard buttons plus a full-sized query-index select for touch users. Native range/select controls
change the generated scene and pipeline. Do not label attention weights as detection confidence.
Current device response panels display measured HTTP, ESC and robot state, not just constructed payloads.
Keep the model and transport boundaries visible where they affect an experiment or hardware interpretation.
