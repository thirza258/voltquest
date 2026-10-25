# Game Modding & Reverse Engineering track

`/game-modding` and `/game-modding/:lessonId` provide ten comprehensive game reverse engineering and mod development courses (`content/gamemodding.json`), rendered by the shared `features/courses/ReadingTrack.jsx` component and configured by `features/gamemodding/GameModdingPage.jsx`. Each course includes four sections with a checkpoint practice question, a guided lab with expected results, a complete compilable/runnable program (C++, C#, or Python), an applied challenge, and a five-question 80% passing exam integrated into the shared progress and certificate systems.

## Courses

1. `mod-architecture`: **1. Game Architecture & Modding Foundations** — Game loops, fixed timesteps, delta time, Entity-Component-System (ECS) vs Object-Oriented Programming (OOP), modding taxonomy (assets, scripts, bytecode, runtime hooks), and ethical boundaries with user/kernel anti-cheat systems. Complete C++17 engine loop with event bus mod listeners.
2. `mod-memory-internals`: **2. Memory Layout, Virtual Addresses & Pointer Chains** — Process virtual memory, Address Space Layout Randomization (ASLR), base addresses, Relative Virtual Addresses (RVA), multi-level pointer dereferencing, and memory scanning algorithms. Complete C++17 pointer chain resolver and memory scanner.
3. `mod-reverse-engineering`: **3. Static Analysis, Disassembly & Decompilation** — x86-64 assembly patterns, stack frames, calling conventions (Microsoft x64 vs System V), virtual method tables (VMT), and Array-of-Bytes (AoB) pattern signatures with wildcards. Complete C++17 VMT shadow hooker and signature scanner.
4. `mod-native-hooking`: **4. Native Code Injection & API Hooking** — DLL injection techniques (LoadLibrary, Manual Mapping), inline detour hooks, 64-bit far jumps (`FF 25`), trampoline allocation, CPU cache flushing (`FlushInstructionCache`), and DirectX `IDXGISwapChain::Present` interception. Complete C++17 64-bit detour hook engine.
5. `mod-unity-bepinex`: **5. Managed Modding: Unity, C# & BepInEx** — Unity runtime architectures (Mono JIT vs IL2CPP Ahead-Of-Time `GameAssembly.dll`), decompiling `Assembly-CSharp.dll` with dnSpy/ILSpy, BepInEx 5 plugin lifecycles (`BaseUnityPlugin`, `Awake`, `Update`), config binding, and in-game Immediate Mode GUI (`OnGUI`). Complete C# BepInEx plugin.
6. `mod-harmony-patching`: **6. Dynamic Runtime Patching with Harmony** — The Harmony library architecture, Prefix patches with boolean short-circuiting, Postfix patches with `ref __result` return modification, and Transpilers manipulating Common Intermediate Language (CIL) opcodes (`CodeInstruction`). Complete C# Harmony patch collection.
7. `mod-unreal-engine`: **7. Unreal Engine Modding & Reflection Systems** — Unreal Engine 4/5 reflection architecture: `UObject`, `UClass`, `FProperty`, `UFunction`, traversing `GUObjectArray`, hooking the universal dispatcher `UObject::ProcessEvent`, and SDK generation with UE4SS. Complete C++17 ProcessEvent hook.
8. `mod-lua-scripting`: **8. Embedded Scripting Engines & Lua Mods** — Why games embed scripting runtimes (Factorio, WoW, Civilization), the Lua C API, the virtual stack, registering C++ host functions (`lua_CFunction`), sandbox protection (stripping `io` and `os`), and event dispatchers. Complete C++17 embedded Lua bridge.
9. `mod-assets-savefiles`: **9. Asset Pipelines, PAK Archives & Save Game Engineering** — Asset virtualization and priority mount points, PAK archive headers, zlib compression, index tables, binary save serialization (little-endian structs), and CRC32 checksum recalculation. Complete Python 3 PAK packer/unpacker and save game CRC32 editor.
10. `mod-capstone`: **10. Production Mod Capstone: Architecture, ImGui & Distribution** — Complete production mod suite: DLL attach/detach lifecycles, thread synchronization between render and worker loops, Dear ImGui in-game overlay menu, Windows Structured Exception Handling (SEH `0xC0000005`), and Thunderstore/Nexus mod packaging. Complete C++17 production mod suite.

## Curriculum Alignment & Learning Outcomes

Learners who complete this track master the exact tools, methodologies, and engineering principles used by leading game modders and reverse engineers:
- **Binary & Memory Instrumentation**: Navigating process memory spaces, calculating ASLR rebasing, dereferencing pointer chains, and managing page protection flags (`VirtualProtect`).
- **Hooking & Trampolines**: Writing robust 64-bit inline detours that preserve CPU registers, execute displaced prologues via trampolines, and cleanly unhook on exit.
- **Managed Game Modification**: Building extensible plugins for Unity using BepInEx and writing surgical runtime patches with Harmony without touching game files on disk.
- **Engine Reflection**: Interrogating Unreal Engine's internal object arrays (`GUObjectArray`) and intercepting high-level gameplay through `ProcessEvent`.
- **Mod UI & Packaging**: Designing in-game overlays with Dear ImGui, safely handling hardware access violations, and packaging mods with semantic versioning.

### VoltQuest Course Certificates
Every course includes a five-question 80% passing exam. Learners who score ≥80% can issue a signed, tamper-evident PDF certificate with a permanent public verification URL at `/certificates/:certificateId` and automatic portfolio tracking under `/certificates`.

## Honesty and Verification

Nothing runs in the browser. VoltQuest does not execute native game binaries, hook running processes, or bypass multiplayer anti-cheat in client JavaScript:
- `backend/tests/test_gamemodding_content.py` validates the entire curriculum, parses the Python code using `ast.parse`, and syntax-checks all C++ sample code using `g++ -std=c++17 -fsyntax-only`.
- All 10 courses provide 4 lessons with questions and a 5-question 80% passing exam (9 unique questions per course, 90 questions total with zero ID collisions).
- All 10 courses are registered in the backend certificate catalogue (`gamemodding.json`), issuing and verifying exact PDFs.
- The hub disclosure clearly states that studying and taking exams works in any browser, while compiling C++ hooks or running BepInEx requires the learner's own local development environment and games.
- Lab step checkboxes record user self-checks for this visit only and verify nothing.

## Wiring

- Route in `frontend/src/App.jsx` (`/game-modding` and `/game-modding/:lessonId`).
- Nav active section in `frontend/src/features/workspace/AppHeader.jsx`.
- Landing page footer in `frontend/src/features/landing/LandingPage.jsx`.
- Course directory card in `frontend/src/features/courses/coursesDirectory.js` (`desktop` domain, `ALL_COURSES` count at 18).
- Sitemap generation in `frontend/vite-sitemap.js` and regenerated `frontend/public/sitemap.xml` (528 URLs).
- Certificate catalogue entry in `backend/app/services/certificates.py` (`gamemodding.json`, 234 total courses).
- Indonesian translations in `frontend/src/i18n/id.json`.
- Test suites: `frontend/src/features/gamemodding/gamemodding.test.jsx`, `frontend/src/features/sandbox/sandboxNav.test.jsx`, `frontend/vite-sitemap.test.js`, `backend/tests/test_gamemodding_content.py`, `backend/tests/test_certificates.py`.
