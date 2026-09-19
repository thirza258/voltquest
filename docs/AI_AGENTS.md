# AI agent learning path

`/ai-agents` and `/ai-agents/:lessonId` teach model/agent/harness distinctions, Codex,
Claude Code, Google Antigravity, instructions, context, tokens and cost, tools, skills,
MCP, app integrations, security, retrieval, multimodal tools, delegation, durable
workflows, evaluation and a JavaScript-first CLI with a Python companion.

The curriculum is frontend-only, versioned in `content/ai-agents.json`. Each course
has four substantive sections with independent checkpoints, a guided tutorial and
a five-question 80% exam. Shared `vq.courses.v1` progress remains unchanged. Official
sources are linked per course and dated; product capabilities and availability are
not inferred from the deterministic lab. Prices in the lab are editable hypothetical
rates, never advertised provider prices. Interface translations use the existing
Indonesian catalog; curriculum prose has an explicitly disclosed English fallback.

## Browser experiments

`/sandbox?bench=ai-agents&lesson=<id>` uses a local scripted model fixture. Learners
edit JSON turn proposals, context, token/cost limits, tool permissions and SKILL.md.
Run/Step execute an actual bounded harness against an in-memory workspace, document
search, issue tracker and MCP protocol fixture. Approval and question pauses resume
the same run. Tool calls are validated before dispatch; tool output is untrusted data.
No LLM, shell, network, host filesystem, arbitrary JavaScript/Python, external app
mutation or credentials are available to browser experiments. Traces describe visible
events, not hidden model reasoning. The lab does not emulate vendor products.

`engine/agents/model.js` is pure and Node-compatible. Max 32 proposed turns, 64 KiB
configuration, bounded strings/context/results. Context uses a disclosed UTF-8-byte/4
token estimate, not a provider tokenizer. The cost ledger counts each modeled request,
input cache subset and output separately. Cached context still occupies the window.
Context and spend checks happen before a proposed turn; waiting/resuming does not
charge the same turn twice. Every edit to execution input invalidates old evidence.

Independent `voltquest-ai-agents` notebooks use `vq.ai-agents.v1.<lesson>`, preserving
unfinished JSON, skill text, JS/Python source and notes. Import/load/reset/preset changes
confirm replacement and discard claimed trace/approval/results. Reports contain only
observed run events and captured configuration. Notebook formats do not extend circuit
projects, public course APIs, account storage, assistant credentials, MCP or showcase.

## Native companions

Downloadable JavaScript and Python CLI programs run on the learner's own computer.
Offline mode uses a scripted provider and virtual tools. Optional live mode calls the
OpenAI Responses API with the learner's environment credentials and chosen model;
GitHub issue reading is a separate opt-in integration with a fixed API host and repository.
The programs enforce schemas, turn/request bounds and explicit write approval. Virtual
tool data remains in memory; this is an application boundary, not an OS/container sandbox.
They do not execute arbitrary shell commands. No API keys are stored in notebooks.

Automated verification must execute both downloadable CLI files offline, mock provider
and integration transports for live-loop tests, and verify actual browser harness flows,
assessment persistence, replacement confirmation, locale retention and mobile layout.
Live paid inference, real account integrations, vendor CLI sessions and cross-browser
performance require separate operator verification; never claim them from fixture tests.

## Verified on 2026-09-19

Full `make check` passed 1,496 frontend tests in 85 files and 104 backend tests, lint
and production build. A final control-validation refinement then passed 88 targeted
tests (including an added regression), lint and the production rebuild. Initial JavaScript
is 545.8 KiB gzipped; the course and harness modules remain lazy. The sitemap has 363 URLs.

Production Chrome with isolated SQLite ran all twenty presets and six regression cases.
The capstone paused for a question and an approval, wrote the draft and read it back.
Exact native source and trace downloads, notebook save/load/import confirmation,
incomplete-exam rejection, an 80% score restored after reload, reading progress,
locale retention and 390 px layouts passed. Both native offline demos completed using
terminal input, explicit write approval and artifact readback. Paid inference and real
GitHub account access were not exercised; transport tests use controlled fixtures.
