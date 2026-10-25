"""Courses 4 to 6 for the Game Modding curriculum."""

COURSES_4_TO_6 = [
    {
        "id": "mod-native-hooking",
        "version": 1,
        "order": 4,
        "title": "4. Native Code Injection & API Hooking",
        "summary": "Implement native DLL injection, inline 64-bit detour hooks, trampoline generation, memory protection toggling, and graphics swapchain interception.",
        "difficulty": "Intermediate",
        "minutes": 30,
        "codeExt": "cpp",
        "code": """// Native 64-bit Inline Detour Hooking & Trampoline Architecture (C++17)
// Demonstrates how inline detour hooks overwrite a function's prologue with a jump,
// allocate a trampoline to preserve displaced instructions, and achieve safe unhooking.

#include <iostream>
#include <vector>
#include <cstring>
#include <cstdint>
#include <memory>

#if defined(_WIN32)
#include <windows.h>
#else
#include <sys/mman.h>
#include <unistd.h>
#endif

// Target function simulating a native game damage calculation
int calculateDamage(int baseDamage, int armor) {
    int finalDamage = baseDamage - (armor / 2);
    if (finalDamage < 1) finalDamage = 1;
    std::cout << "  [Game:Native] calculateDamage(" << baseDamage << ", " << armor 
              << ") -> raw result = " << finalDamage << "\\n";
    return finalDamage;
}

// Function pointer signature
using DamageFn = int(*)(int, int);
DamageFn originalDamageTrampoline = nullptr;

// Custom mod hook function that intercepts the game's calculation
int hookedCalculateDamage(int baseDamage, int armor) {
    std::cout << "[Mod:Hook] Intercepted calculateDamage! Applying 3x Critical Strike Buff!\\n";
    // Call the original game function through the preserved trampoline
    int originalResult = originalDamageTrampoline(baseDamage, armor);
    int modifiedResult = originalResult * 3;
    std::cout << "[Mod:Hook] Returning modified damage: " << modifiedResult << "\\n";
    return modifiedResult;
}

// Inline Hooking Engine (x86-64 14-byte absolute far jump: FF 25 00 00 00 00 [8-byte target])
class InlineDetour {
public:
    static constexpr size_t HOOK_SIZE = 14;

    bool install(void* targetFunction, void* hookFunction) {
        target = reinterpret_cast<uint8_t*>(targetFunction);
        hook = reinterpret_cast<uint8_t*>(hookFunction);

        // 1. Allocate executable memory for the trampoline
        trampoline = allocateExecutableMemory(HOOK_SIZE + HOOK_SIZE);
        if (!trampoline) return false;

        // 2. Backup original prologue bytes
        originalBytes.resize(HOOK_SIZE);
        std::memcpy(originalBytes.data(), target, HOOK_SIZE);

        // 3. Populate trampoline: copied prologue bytes + far jump back to (target + HOOK_SIZE)
        std::memcpy(trampoline, target, HOOK_SIZE);
        writeFarJump(trampoline + HOOK_SIZE, target + HOOK_SIZE);

        // 4. Overwrite target function prologue with far jump to our hookFunction
        makeMemoryWritable(target, HOOK_SIZE);
        writeFarJump(target, hook);
        restoreMemoryProtection(target, HOOK_SIZE);

        originalDamageTrampoline = reinterpret_cast<DamageFn>(trampoline);
        installed = true;
        return true;
    }

    void uninstall() {
        if (!installed) return;
        makeMemoryWritable(target, HOOK_SIZE);
        std::memcpy(target, originalBytes.data(), HOOK_SIZE);
        restoreMemoryProtection(target, HOOK_SIZE);
        installed = false;
        std::cout << "[Mod:Hook] Detour cleanly uninstalled. Original bytes restored.\\n";
    }

    ~InlineDetour() { uninstall(); }

private:
    uint8_t* target = nullptr;
    uint8_t* hook = nullptr;
    uint8_t* trampoline = nullptr;
    std::vector<uint8_t> originalBytes;
    bool installed = false;

    static void writeFarJump(uint8_t* location, uint8_t* destination) {
        // x86-64 absolute jump: JMP [RIP + 0] -> FF 25 00 00 00 00 followed by 64-bit pointer
        location[0] = 0xFF;
        location[1] = 0x25;
        location[2] = 0x00;
        location[3] = 0x00;
        location[4] = 0x00;
        location[5] = 0x00;
        std::memcpy(location + 6, &destination, sizeof(uint8_t*));
    }

    static uint8_t* allocateExecutableMemory(size_t size) {
#if defined(_WIN32)
        return reinterpret_cast<uint8_t*>(VirtualAlloc(nullptr, size, MEM_COMMIT | MEM_RESERVE, PAGE_EXECUTE_READWRITE));
#else
        void* ptr = mmap(nullptr, size, PROT_READ | PROT_WRITE | PROT_EXEC, MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
        return ptr == MAP_FAILED ? nullptr : reinterpret_cast<uint8_t*>(ptr);
#endif
    }

    static void makeMemoryWritable(void* addr, size_t size) {
#if defined(_WIN32)
        DWORD oldProtect;
        VirtualProtect(addr, size, PAGE_EXECUTE_READWRITE, &oldProtect);
#else
        uintptr_t pageStart = reinterpret_cast<uintptr_t>(addr) & ~static_cast<uintptr_t>(4095);
        mprotect(reinterpret_cast<void*>(pageStart), 4096, PROT_READ | PROT_WRITE | PROT_EXEC);
#endif
    }

    static void restoreMemoryProtection(void* addr, size_t size) {
#if defined(_WIN32)
        DWORD oldProtect;
        VirtualProtect(addr, size, PAGE_EXECUTE_READ, &oldProtect);
#else
        uintptr_t pageStart = reinterpret_cast<uintptr_t>(addr) & ~static_cast<uintptr_t>(4095);
        mprotect(reinterpret_cast<void*>(pageStart), 4096, PROT_READ | PROT_EXEC);
#endif
    }
};

int main() {
    std::cout << "=== Native Code Hooking & Trampoline Demonstration ===\\n";

    // Call unhooked game function
    std::cout << "[Step 1] Calling original calculateDamage before hook:\\n";
    int dmg1 = calculateDamage(50, 20);
    std::cout << "Result: " << dmg1 << "\\n\\n";

    // Install inline detour hook
    InlineDetour detour;
    if (detour.install(reinterpret_cast<void*>(&calculateDamage), reinterpret_cast<void*>(&hookedCalculateDamage))) {
        std::cout << "[Step 2] Inline hook installed successfully!\\n";
        
        // Call function through the hook
        int dmg2 = calculateDamage(50, 20);
        std::cout << "Result: " << dmg2 << "\\n\\n";

        // Uninstall hook
        std::cout << "[Step 3] Restoring original prologue bytes:\\n";
        detour.uninstall();

        // Call function again to verify restoration
        int dmg3 = calculateDamage(50, 20);
        std::cout << "Result: " << dmg3 << "\\n";
    }

    return 0;
}
""",
        "expected": "Compiles with C++17 (`g++ -std=c++17 mod-native-hooking.cpp`). Output shows the unhooked damage calculation returning 40, the hooked execution intercepting the call and returning 120 (3x critical buff) via the trampoline, followed by clean unhooking and return to 40.",
        "lessons": [
            {
                "id": "mod-hook-injection-types",
                "title": "DLL injection mechanisms",
                "paragraphs": [
                    "Native modding begins with DLL injection, the process of forcing a target game process to load a dynamic link library authored by the modder. Once inside the game's address space, the DLL shares the game's virtual memory, privileges, and thread execution contexts.",
                    "Common injection methods include `CreateRemoteThread` with `LoadLibrary` (writing the DLL path into the target process and triggering a remote thread), Windows hook injection via `SetWindowsHookEx`, and Manual Mapping. Manual mapping parses the PE header, maps sections into memory, resolves import address tables (IAT), and executes the entry point manually, evading tools that monitor `LoadLibrary` events."
                ],
                "example": "HANDLE hThread = CreateRemoteThread(hProcess, NULL, 0, (LPTHREAD_START_ROUTINE)LoadLibraryA, remoteStr, 0, NULL);",
                "pitfall": "Using standard CreateRemoteThread in games with anti-cheat software immediately triggers injection alerts because anti-cheats hook or block OpenProcess handles.",
                "question": {
                    "id": "mod-hook-inj-q",
                    "prompt": "What distinguishes Manual Mapping injection from standard LoadLibrary injection?",
                    "options": [
                        {"id": "a", "text": "Manual mapping resolves imports and maps PE sections manually without registering the DLL in the OS loaded module list"},
                        {"id": "b", "text": "Manual mapping only works on floppy disks"},
                        {"id": "c", "text": "Manual mapping requires rebooting the computer into safe mode"}
                    ],
                    "answerId": "a",
                    "explanation": "Manual mapping avoids OS loader APIs, preventing the mod DLL from appearing in the process PEB (Process Environment Block) module list.",
                    "lessonId": "mod-hook-injection-types"
                }
            },
            {
                "id": "mod-hook-inline-detours",
                "title": "Inline hooking & trampolines",
                "paragraphs": [
                    "Inline hooking (also known as detour hooking) intercepts a function by overwriting its first few machine instructions (the prologue) with an unconditional jump instruction targeting the mod's hook function. When the game calls the function, control transfers immediately to the mod.",
                    "To allow the mod to invoke the original game functionality without infinite recursion, the hook engine constructs a 'trampoline'. The trampoline is a dynamically allocated executable buffer containing the stolen prologue instructions followed by an unconditional jump back into the original function immediately after the overwritten hook bytes."
                ],
                "example": "Game Function: [JMP Hook] -> Hook Function executes -> [JMP Trampoline] -> Trampoline: [Stolen Prologue] -> [JMP Game + Offset].",
                "pitfall": "Overwriting a partial instruction when writing a 5-byte or 14-byte jump corrupts adjacent instructions, causing the CPU to execute illegal opcodes and crash.",
                "question": {
                    "id": "mod-hook-det-q",
                    "prompt": "What is the function of a 'trampoline' in inline detour hooking?",
                    "options": [
                        {"id": "a", "text": "It executes the original stolen prologue instructions and jumps back to the original function, avoiding infinite recursion"},
                        {"id": "b", "text": "It compresses the game's audio assets"},
                        {"id": "c", "text": "It shuts down the operating system when the game closes"}
                    ],
                    "answerId": "a",
                    "explanation": "A trampoline preserves the overwritten prologue bytes and jumps back to the original function body, enabling the hook to call the original logic safely.",
                    "lessonId": "mod-hook-inline-detours"
                }
            },
            {
                "id": "mod-hook-relay-alloc",
                "title": "64-bit far jumps & memory allocation",
                "paragraphs": [
                    "In 32-bit x86 systems, an unconditional relative jump instruction (`E9 xx xx xx xx`) requires only 5 bytes and can reach anywhere in the 4 GB address space. In 64-bit systems, relative jumps are limited to a signed 32-bit offset (within ±2 GB of the current RIP). Because the 64-bit address space spans 128 TB, jumping further requires either a 14-byte absolute jump (`FF 25 00 00 00 00 [8-byte address]`) or a nearby relay trampoline.",
                    "Hooking libraries (such as MinHook and Detours) scan memory pages within ±2 GB of the target function to allocate 5-byte relay stubs, minimizing the number of prologue bytes that must be overwritten. If a function is shorter than 14 bytes, an absolute jump cannot fit without clobbering adjacent functions.",
                    "Modders must also flush the CPU instruction cache with `FlushInstructionCache` after modifying code bytes to ensure multi-core processors do not execute stale cached instructions."
                ],
                "example": "14-byte jump: FF 25 00 00 00 00 <64-bit target address>; 5-byte jump: E9 <32-bit RIP-relative offset>.",
                "pitfall": "Failing to flush the CPU instruction cache (`FlushInstructionCache`) leads to multi-core synchronization issues where some CPU cores execute old instructions while others execute the new jump.",
                "question": {
                    "id": "mod-hook-relay-q",
                    "prompt": "Why can a standard 5-byte relative jump (E9) instruction fail to reach a hook function in 64-bit processes?",
                    "options": [
                        {"id": "a", "text": "The 32-bit relative displacement in the E9 opcode can only branch within ±2 GB of the current instruction pointer"},
                        {"id": "b", "text": "64-bit CPUs do not support jumps"},
                        {"id": "c", "text": "Modern RAM does not allow more than 5 bytes of code"}
                    ],
                    "answerId": "a",
                    "explanation": "In x86-64, the E9 opcode takes a 32-bit signed offset, limiting relative jumps to ±2 GB; addresses beyond that range require 14-byte far jumps or relay stubs.",
                    "lessonId": "mod-hook-relay-alloc"
                }
            },
            {
                "id": "mod-hook-graphics-present",
                "title": "Graphics API interception (DirectX & Vulkan)",
                "paragraphs": [
                    "To draw in-game user interfaces, menus, radars, and custom text overlays, mods hook into the game's graphics rendering pipeline. In DirectX 11 and 12, the canonical hook point is `IDXGISwapChain::Present`, which is called at the end of every frame to swap the back buffer to the screen.",
                    "When the hook intercepts `Present`, it obtains the Direct3D device context, binds render targets, draws custom UI elements (often using the Dear ImGui library), and then calls the original `Present` to finish displaying the frame. For OpenGL, modders hook `wglSwapBuffers`; for Vulkan, they hook `vkQueuePresentKHR`."
                ],
                "example": "HRESULT __stdcall HookedPresent(IDXGISwapChain* pSwapChain, UINT SyncInterval, UINT Flags) { DrawImGui(); return OriginalPresent(pSwapChain, SyncInterval, Flags); }",
                "pitfall": "Drawing complex UI elements inside `Present` without restoring original render states (rasterizer, blend, depth-stencil states) causes game textures to flicker or turn transparent.",
                "question": {
                    "id": "mod-hook-gfx-q",
                    "prompt": "Which DirectX function is most commonly hooked by game mods to render in-game menus and overlays at the end of each frame?",
                    "options": [
                        {"id": "a", "text": "IDXGISwapChain::Present"},
                        {"id": "b", "text": "CreateFileW"},
                        {"id": "c", "text": "socket()"}
                    ],
                    "answerId": "a",
                    "explanation": "IDXGISwapChain::Present is invoked once per frame to present the rendered back buffer, providing the perfect synchronization point for mod UI overlays.",
                    "lessonId": "mod-hook-graphics-present"
                }
            }
        ],
        "steps": [
            "Review `mod-native-hooking.cpp` to examine how `InlineDetour::install` allocates an executable trampoline and writes the 14-byte far jump.",
            "Observe how `originalDamageTrampoline` executes the displaced instructions before returning to the original function body.",
            "Compile and run the program: `g++ -std=c++17 mod-native-hooking.cpp -o mod_hook`.",
            "Verify that the hook intercepts the call, multiplies the damage output by 3, and that `uninstall()` restores original behavior."
        ],
        "challenge": {
            "task": "Implement an execution counter inside `InlineDetour` that tracks how many times the hooked function has been invoked, and automatically uninstalls the hook after exactly 5 invocations.",
            "acceptance": [
                "Atomic invocation counter in the hook handler",
                "Automatic uninstallation trigger when count reaches 5",
                "Verification that the 6th call executes original code without hook intervention"
            ]
        },
        "sources": [
            {
                "title": "MinHook: The Minimalistic x86/x64 API Hooking Library",
                "url": "https://github.com/TsudaKageyu/minhook"
            },
            {
                "title": "Microsoft Detours: Binary Interception of Win32 Functions",
                "url": "https://github.com/microsoft/Detours"
            }
        ],
        "exam": {
            "passPercent": 80,
            "questions": [
                {
                    "id": "mod-hook-e1",
                    "prompt": "What is the primary mechanism of an inline detour hook?",
                    "options": [
                        {"id": "a", "text": "Overwriting the target function's prologue instructions with an unconditional jump to a hook function"},
                        {"id": "b", "text": "Overclocking the computer processor"},
                        {"id": "c", "text": "Replacing all hard drives with solid state drives"}
                    ],
                    "answerId": "a",
                    "explanation": "Inline hooks patch the initial instructions of a function with a JMP instruction that redirects CPU execution to the custom hook.",
                    "lessonId": "mod-hook-inline-detours"
                },
                {
                    "id": "mod-hook-e2",
                    "prompt": "Why must modders call FlushInstructionCache after modifying machine code in process memory?",
                    "options": [
                        {"id": "a", "text": "To clear CPU instruction caches and ensure all cores execute the newly written jump instructions"},
                        {"id": "b", "text": "To format the Windows registry"},
                        {"id": "c", "text": "To terminate all background audio processes"}
                    ],
                    "answerId": "a",
                    "explanation": "CPUs cache instructions; flushing the instruction cache forces processor cores to fetch the newly written opcodes from RAM.",
                    "lessonId": "mod-hook-relay-alloc"
                },
                {
                    "id": "mod-hook-e3",
                    "prompt": "How many bytes does an x86-64 absolute far jump (FF 25 00 00 00 00 + 64-bit address) require?",
                    "options": [
                        {"id": "a", "text": "14 bytes"},
                        {"id": "b", "text": "2 bytes"},
                        {"id": "c", "text": "64 bytes"}
                    ],
                    "answerId": "a",
                    "explanation": "The opcode `FF 25 00 00 00 00` takes 6 bytes, followed by the 8-byte 64-bit target address, totaling 14 bytes.",
                    "lessonId": "mod-hook-relay-alloc"
                },
                {
                    "id": "mod-hook-e4",
                    "prompt": "What Win32 API function allocates memory with execute, read, and write permissions for a trampoline?",
                    "options": [
                        {"id": "a", "text": "VirtualAlloc"},
                        {"id": "b", "text": "MessageBoxA"},
                        {"id": "c", "text": "GetSystemMetrics"}
                    ],
                    "answerId": "a",
                    "explanation": "VirtualAlloc reserves and commits virtual memory pages with specific protection flags like `PAGE_EXECUTE_READWRITE`.",
                    "lessonId": "mod-hook-inline-detours"
                },
                {
                    "id": "mod-hook-e5",
                    "prompt": "In graphics API hooking, why is the swapchain Present function hooked instead of individual draw calls?",
                    "options": [
                        {"id": "a", "text": "Present is called once per frame when the scene is complete, allowing UI overlays to be drawn on top of the entire image"},
                        {"id": "b", "text": "Present converts 2D games into virtual reality"},
                        {"id": "c", "text": "Individual draw calls cannot render colors"}
                    ],
                    "answerId": "a",
                    "explanation": "Hooking Present guarantees that all game world objects have already been rendered, allowing mod UI to sit cleanly on top.",
                    "lessonId": "mod-hook-graphics-present"
                }
            ]
        }
    },
    {
        "id": "mod-unity-bepinex",
        "version": 1,
        "order": 5,
        "title": "5. Managed Modding: Unity, C# & BepInEx",
        "summary": "Mod Unity engine games running Mono or IL2CPP: decompile assemblies with dnSpy/ILSpy, build BepInEx 5 plugins, bind persistent configs, and draw in-game IMGUI overlays.",
        "difficulty": "Intermediate",
        "minutes": 25,
        "codeExt": "cs",
        "code": """// Managed Unity Game Modding with BepInEx 5 (C# 10)
// Demonstrates a complete BepInEx plugin architecture: metadata declarations,
// persistent configuration binding, hotkey event polling, and IMGUI overlay rendering.

using System;
using System.IO;

namespace VoltQuest.GameMod
{
    // Mock attributes representing BepInEx metadata
    [AttributeUsage(AttributeTargets.Class)]
    public class BepInPlugin : Attribute
    {
        public string GUID { get; }
        public string Name { get; }
        public string Version { get; }
        public BepInPlugin(string guid, string name, string version)
        {
            GUID = guid; Name = name; Version = version;
        }
    }

    // Simulated BepInEx Configuration Entry
    public class ConfigEntry<T>
    {
        public string Section { get; }
        public string Key { get; }
        public T Value { get; set; }
        public string Description { get; }

        public ConfigEntry(string section, string key, T defaultValue, string description)
        {
            Section = section; Key = key; Value = defaultValue; Description = description;
        }
    }

    // Simulated BaseUnityPlugin base class
    public abstract class BaseUnityPlugin
    {
        public void Log(string message) => Console.WriteLine($"[BepInEx:Log] {message}");
    }

    // Production BepInEx Mod Plugin Definition
    [BepInPlugin("com.voltquest.mod.speedbooster", "SpeedBooster Mod", "1.0.0")]
    public class SpeedBoosterPlugin : BaseUnityPlugin
    {
        // Persistent Configuration entries
        public ConfigEntry<float> SpeedMultiplier { get; private set; }
        public ConfigEntry<bool> GodModeEnabled { get; private set; }
        public ConfigEntry<string> ActivationHotkey { get; private set; }

        private bool isMenuVisible = true;
        private float currentWorldTimeScale = 1.0f;

        public void Awake()
        {
            // Bind configuration settings with defaults
            SpeedMultiplier = new ConfigEntry<float>("Movement", "SpeedMultiplier", 2.5f, "Multiplier applied to player run speed.");
            GodModeEnabled = new ConfigEntry<bool>("Cheats", "GodMode", false, "Prevents all incoming player damage when enabled.");
            ActivationHotkey = new ConfigEntry<string>("Hotkeys", "ToggleKey", "F5", "Keyboard hotkey to toggle menu visibility.");

            Log("SpeedBoosterPlugin v1.0.0 initialized successfully!");
            Log($"Loaded configuration: SpeedMultiplier={SpeedMultiplier.Value}x, GodMode={GodModeEnabled.Value}");
        }

        public void Update(string pressedKey)
        {
            // Poll for hotkey press
            if (pressedKey == ActivationHotkey.Value)
            {
                isMenuVisible = !isMenuVisible;
                Log($"Menu visibility toggled: {(isMenuVisible ? "VISIBLE" : "HIDDEN")}");
            }

            if (pressedKey == "F6")
            {
                GodModeEnabled.Value = !GodModeEnabled.Value;
                Log($"GodMode state changed: {GodModeEnabled.Value}");
            }
        }

        public void RenderOnGUI()
        {
            if (!isMenuVisible) return;

            Console.WriteLine("------------------------------------------");
            Console.WriteLine("|       VOLTQUEST IN-GAME MOD MENU       |");
            Console.WriteLine("------------------------------------------");
            Console.WriteLine($"|  Speed Multiplier: {SpeedMultiplier.Value,5:F1}x               |");
            Console.WriteLine($"|  GodMode Active:   {(GodModeEnabled.Value ? "YES " : "NO  "),5}                |");
            Console.WriteLine($"|  Toggle Menu: [{ActivationHotkey.Value}] | Toggle GodMode: [F6] |");
            Console.WriteLine("------------------------------------------");
        }
    }

    class Program
    {
        static void Main()
        {
            Console.WriteLine("=== BepInEx Managed Plugin Simulation ===");
            var plugin = new SpeedBoosterPlugin();

            // Simulate Unity lifecycle: Awake
            plugin.Awake();

            // Simulate Unity frames: Update & Render
            Console.WriteLine("\\n--- Frame 1 ---");
            plugin.Update("None");
            plugin.RenderOnGUI();

            Console.WriteLine("\\n--- Frame 2 (User presses F6) ---");
            plugin.Update("F6");
            plugin.RenderOnGUI();

            Console.WriteLine("\\n--- Frame 3 (User presses F5 to hide menu) ---");
            plugin.Update("F5");
            plugin.RenderOnGUI();
        }
    }
}
""",
        "expected": "Compiles with modern C# (`csc` or `dotnet run`). Demonstrates the BepInEx lifecycle: plugin initialization in `Awake()`, dynamic hotkey detection in `Update()`, and UI menu rendering in `OnGUI()`.",
        "lessons": [
            {
                "id": "mod-unity-mono-il2cpp",
                "title": "Unity architecture: Mono vs IL2CPP",
                "paragraphs": [
                    "Unity games compile game logic through one of two backends: Mono or IL2CPP. In the Mono scripting backend, C# code is compiled into standard Common Intermediate Language (CIL) bytecode packaged into `.dll` files (predominantly `Assembly-CSharp.dll`). When the game runs, the Mono runtime Just-In-Time (JIT) compiles bytecode into machine code.",
                    "In the IL2CPP (Intermediate Language to C++) backend, Unity converts CIL bytecode into native C++ source code before compiling it directly into a native platform binary (`GameAssembly.dll`). While Mono games are trivial to decompile and modify, IL2CPP games require metadata restoration tools (such as Il2CppDumper or Cpp2IL) to recover class definitions and method signatures."
                ],
                "example": "Mono: Managed assemblies in `Managed/Assembly-CSharp.dll`. IL2CPP: Native `GameAssembly.dll` paired with `global-metadata.dat`.",
                "pitfall": "Attempting to open an IL2CPP game's `GameAssembly.dll` in a C# decompiler like dnSpy will fail because it contains native machine code, not CIL bytecode.",
                "question": {
                    "id": "mod-unity-mono-q",
                    "prompt": "What file in a Unity Mono game contains the developer's primary compiled game logic?",
                    "options": [
                        {"id": "a", "text": "Assembly-CSharp.dll"},
                        {"id": "b", "text": "boot.config"},
                        {"id": "c", "text": "unity_builtin_extra"}
                    ],
                    "answerId": "a",
                    "explanation": "In Unity Mono builds, the game's custom scripts and game logic are compiled into `Assembly-CSharp.dll` inside the `Managed` directory.",
                    "lessonId": "mod-unity-mono-il2cpp"
                }
            },
            {
                "id": "mod-unity-decompilation",
                "title": "Decompiling managed binaries with dnSpy",
                "paragraphs": [
                    "Because CIL bytecode retains rich metadata—including type names, field names, method signatures, and parameter labels—managed Unity games can be decompiled back into nearly original C# source code using tools like dnSpy, ILSpy, or dotPeek.",
                    "Using dnSpy, a modder can open `Assembly-CSharp.dll`, search for terms like `PlayerHealth`, `TakeDamage`, or `AddCurrency`, read the exact C# implementation, set breakpoints for live debugging, or directly edit IL instructions. This provides total visibility into game mechanics without having to guess struct offsets."
                ],
                "example": "Opening Assembly-CSharp.dll -> Searching for 'CalculateSpeed' -> Inspecting original C# implementation and class variables.",
                "pitfall": "Modifying and recompiling `Assembly-CSharp.dll` directly on disk breaks mod interoperability, as multiple mods cannot overwrite the same DLL without overwriting each other.",
                "question": {
                    "id": "mod-unity-dec-q",
                    "prompt": "Why can C# Unity Mono games be decompiled into high-level readable source code so easily?",
                    "options": [
                        {"id": "a", "text": "CIL bytecode preserves complete metadata including class names, method signatures, and variable types"},
                        {"id": "b", "text": "Unity automatically uploads the developer's original C# source code to GitHub"},
                        {"id": "c", "text": "Managed games do not use compiled code"}
                    ],
                    "answerId": "a",
                    "explanation": "CIL bytecode is a high-level intermediate representation containing comprehensive metadata, allowing decompilers to reconstruct the original C# code structure.",
                    "lessonId": "mod-unity-decompilation"
                }
            },
            {
                "id": "mod-unity-bepinex-arch",
                "title": "BepInEx plugin architecture",
                "paragraphs": [
                    "BepInEx (Bepis Injector Extensible) is the industry-standard mod loader for Unity games across both Mono and IL2CPP runtimes. BepInEx acts as a bootstrap hook by placing a custom `winhttp.dll` or `version.dll` in the game root, hijacking the OS DLL search order during game launch.",
                    "Once loaded, BepInEx initializes a plugin manager that scans the `BepInEx/plugins` folder for mod assemblies. Every BepInEx mod inherits from `BaseUnityPlugin` and specifies metadata using the `[BepInPlugin(\"guid\", \"name\", \"version\")]` attribute. Plugins participate in standard Unity MonoBehaviour lifecycles (`Awake`, `Start`, `Update`, `OnGUI`)."
                ],
                "example": "[BepInPlugin(\"com.author.mymod\", \"MyMod\", \"1.0.0\")] public class MyMod : BaseUnityPlugin { void Awake() { ... } }",
                "pitfall": "Omitting the `[BepInPlugin]` attribute prevents BepInEx from recognizing the class as an active plugin, resulting in the mod failing to load.",
                "question": {
                    "id": "mod-unity-bep-q",
                    "prompt": "How does BepInEx ensure its mod loader executes when the Unity game starts up?",
                    "options": [
                        {"id": "a", "text": "By placing a proxy DLL (such as winhttp.dll) in the game root to exploit OS DLL search order hijacking"},
                        {"id": "b", "text": "By editing the computer's motherboard BIOS firmware"},
                        {"id": "c", "text": "By executing a background cloud cron job"}
                    ],
                    "answerId": "a",
                    "explanation": "BepInEx uses proxy DLLs like `winhttp.dll` in the game folder, which the game executable loads automatically before loading standard system DLLs.",
                    "lessonId": "mod-unity-bepinex-arch"
                }
            },
            {
                "id": "mod-unity-config-ui",
                "title": "Configuration systems & IMGUI overlays",
                "paragraphs": [
                    "High-quality mods allow players to customize gameplay settings through configuration files rather than requiring code edits. BepInEx provides a built-in configuration manager via `Config.Bind<T>(section, key, defaultValue, description)`, which automatically generates and synchronizes a clean `.cfg` file under `BepInEx/config`.",
                    "For in-game interfaces, Unity mods frequently utilize Unity's legacy Immediate Mode GUI (`OnGUI`) system. `OnGUI` is invoked multiple times per frame, allowing modders to draw windows (`GUI.Window`), labels (`GUI.Label`), and buttons (`GUI.Button`) with zero external asset dependencies or canvas setups."
                ],
                "example": "var speed = Config.Bind(\"Player\", \"Speed\", 5.0f, \"Movement speed\"); void OnGUI() { if (GUI.Button(new Rect(10,10,100,30), \"Boost\")) { ... } }",
                "pitfall": "Creating new texture or font resources inside `OnGUI` leaks memory rapidly because `OnGUI` executes dozens of times per second.",
                "question": {
                    "id": "mod-unity-cfg-q",
                    "prompt": "Why is Unity's Immediate Mode GUI (OnGUI) popular for rapid mod interface development?",
                    "options": [
                        {"id": "a", "text": "It can be rendered directly from code without needing Unity Editor prefabs, asset bundles, or Canvas hierarchy setups"},
                        {"id": "b", "text": "It runs exclusively on 3dfx Voodoo graphics cards"},
                        {"id": "c", "text": "It makes C# code execute 10 times faster"}
                    ],
                    "answerId": "a",
                    "explanation": "OnGUI allows UI buttons, boxes, and text to be drawn purely through code statements in `BaseUnityPlugin`, requiring no external prefab assets.",
                    "lessonId": "mod-unity-config-ui"
                }
            }
        ],
        "steps": [
            "Inspect `mod-unity-bepinex.cs` to understand how `BaseUnityPlugin` handles `Awake()` and `Update()` lifecycle events.",
            "Review how `ConfigEntry<T>` encapsulates persistent mod settings such as `SpeedMultiplier` and `GodModeEnabled`.",
            "Compile and run the simulation using modern C# or review the structured output.",
            "Observe the simulated frame sequence: hotkey F6 toggles GodMode, and F5 toggles the in-game GUI menu."
        ],
        "challenge": {
            "task": "Add a new configuration setting `JumpForceMultiplier` of type `float` with default value `1.5f`. Add a button to the `RenderOnGUI` menu that resets all configurations back to their default values.",
            "acceptance": [
                "Definition of `JumpForceMultiplier` ConfigEntry",
                "Reset button implemented in `RenderOnGUI`",
                "Execution verifying values return to defaults upon triggering the reset"
            ]
        },
        "sources": [
            {
                "title": "BepInEx: Bepis Injector Extensible Documentation",
                "url": "https://docs.bepinex.dev/"
            },
            {
                "title": "Unity Scripting API: MonoBehaviour Lifecycle",
                "url": "https://docs.unity3d.com/ScriptReference/MonoBehaviour.html"
            }
        ],
        "exam": {
            "passPercent": 80,
            "questions": [
                {
                    "id": "mod-unity-e1",
                    "prompt": "What tool is commonly used to inspect and decompile compiled C# assemblies in Unity Mono games?",
                    "options": [
                        {"id": "a", "text": "dnSpy or ILSpy"},
                        {"id": "b", "text": "Adobe Photoshop"},
                        {"id": "c", "text": "Audacity"}
                    ],
                    "answerId": "a",
                    "explanation": "dnSpy and ILSpy are specialized .NET assembly decompilers and debuggers designed to inspect CIL bytecode.",
                    "lessonId": "mod-unity-decompilation"
                },
                {
                    "id": "mod-unity-e2",
                    "prompt": "In Unity's IL2CPP backend, what binary file contains the converted C++ game logic?",
                    "options": [
                        {"id": "a", "text": "GameAssembly.dll"},
                        {"id": "b", "text": "Assembly-CSharp.dll"},
                        {"id": "c", "text": "index.html"}
                    ],
                    "answerId": "a",
                    "explanation": "IL2CPP compiles all managed C# assemblies into a single native C++ binary named `GameAssembly.dll`.",
                    "lessonId": "mod-unity-mono-il2cpp"
                },
                {
                    "id": "mod-unity-e3",
                    "prompt": "Where do compiled BepInEx mod DLL plugins reside in a modded Unity game directory?",
                    "options": [
                        {"id": "a", "text": "BepInEx/plugins"},
                        {"id": "b", "text": "C:/Windows/System32"},
                        {"id": "c", "text": "Managed/UnityEngine.dll"}
                    ],
                    "answerId": "a",
                    "explanation": "BepInEx scans the `BepInEx/plugins` folder and subfolders to discover and load mod plugin assemblies.",
                    "lessonId": "mod-unity-bepinex-arch"
                },
                {
                    "id": "mod-unity-e4",
                    "prompt": "Which Unity lifecycle method is executed once per rendered frame and is ideal for polling keyboard hotkeys in a mod?",
                    "options": [
                        {"id": "a", "text": "Update()"},
                        {"id": "b", "text": "Awake()"},
                        {"id": "c", "text": "OnDestroy()"}
                    ],
                    "answerId": "a",
                    "explanation": "The `Update()` method is invoked once every frame, making it the standard location for polling player input and hotkeys.",
                    "lessonId": "mod-unity-bepinex-arch"
                },
                {
                    "id": "mod-unity-e5",
                    "prompt": "What is the primary advantage of using BepInEx's Config.Bind over hardcoded variables?",
                    "options": [
                        {"id": "a", "text": "It automatically persists settings to an editable text config file on disk across game sessions"},
                        {"id": "b", "text": "It bypasses CPU thermal limits"},
                        {"id": "c", "text": "It turns off all in-game sound effects"}
                    ],
                    "answerId": "a",
                    "explanation": "Config.Bind synchronizes variables with a configuration file (`.cfg`) on disk, allowing players to tweak settings without recompiling the mod.",
                    "lessonId": "mod-unity-config-ui"
                }
            ]
        }
    },
    {
        "id": "mod-harmony-patching",
        "version": 1,
        "order": 6,
        "title": "6. Dynamic Runtime Patching with Harmony",
        "summary": "Master the Harmony patching library: intercept methods with Prefix short-circuiting, modify return values with Postfix and ref __result, and manipulate CIL opcodes using Transpilers.",
        "difficulty": "Intermediate",
        "minutes": 30,
        "codeExt": "cs",
        "code": """// Dynamic Runtime Patching with Harmony (C# 10)
// Demonstrates Prefix interception, Postfix return modification,
// and Transpiler CIL bytecode instruction rewriting without touching game files on disk.

using System;
using System.Collections.Generic;
using System.Reflection;

namespace VoltQuest.HarmonyEngine
{
    // Simulated target game class in Assembly-CSharp.dll
    public class PlayerCombat
    {
        public string PlayerName { get; set; } = "ValiantHero";
        public int Durability { get; set; } = 100;
        public int BaseDamage { get; set; } = 30;

        public int ExecuteAttack(int targetArmor, bool isCritical)
        {
            Console.WriteLine($"  [Game:ExecuteAttack] Calculating attack for {PlayerName}...");
            // Durability decrements by 10 on each swing
            Durability -= 10;
            
            int damage = BaseDamage - targetArmor;
            if (isCritical) damage *= 2;
            if (damage < 1) damage = 1;

            return damage;
        }
    }

    // Harmony Patch Collection
    public static class CombatPatches
    {
        public static bool InfiniteDurability = true;
        public static float GlobalDamageMultiplier = 2.5f;

        // 1. PREFIX PATCH:
        // Executes before the target method.
        // Can inspect/modify arguments with 'ref'.
        // Returning FALSE short-circuits the original method entirely.
        public static bool Prefix(PlayerCombat __instance, ref int targetArmor, ref bool isCritical)
        {
            Console.WriteLine($"[Harmony:Prefix] Intercepted ExecuteAttack! Target armor={targetArmor}");

            if (InfiniteDurability)
            {
                // Preserve durability by reversing anticipated decrement or setting flag
                Console.WriteLine("[Harmony:Prefix] Durability protection active! Preventing wear.");
            }

            // Armor shred mod: reduce effective armor by half
            targetArmor /= 2;
            // Force critical strike
            isCritical = true;

            return true; // Return true to allow original method to run with modified arguments
        }

        // 2. POSTFIX PATCH:
        // Executes after the target method finishes.
        // Can read the return value and alter it using 'ref __result'.
        public static void Postfix(PlayerCombat __instance, ref int __result)
        {
            int originalDmg = __result;
            // Apply custom damage multiplier to final result
            __result = (int)(__result * GlobalDamageMultiplier);
            Console.WriteLine($"[Harmony:Postfix] Modified attack result: {originalDmg} -> {__result} damage!");
        }

        // 3. TRANSPILER PATCH (Conceptual demonstration):
        // Rewrites CIL (Common Intermediate Language) instructions dynamically.
        public static IEnumerable<string> Transpiler(IEnumerable<string> instructions)
        {
            Console.WriteLine("[Harmony:Transpiler] Scanning instruction stream for ldc.i4.10 (durability decrement)...");
            foreach (var inst in instructions)
            {
                // In real Harmony: if (inst.opcode == OpCodes.Ldc_I4_S && (sbyte)inst.operand == 10)
                if (inst == "ldc.i4.10")
                {
                    Console.WriteLine("[Harmony:Transpiler] Replaced durability decrement instruction with ldc.i4.0!");
                    yield return "ldc.i4.0"; // Replace 10 with 0!
                }
                else
                {
                    yield return inst;
                }
            }
        }
    }

    class Program
    {
        static void Main()
        {
            Console.WriteLine("=== Dynamic Harmony Runtime Patching Demo ===\\n");
            var combat = new PlayerCombat();

            // 1. Unpatched Attack Execution
            Console.WriteLine("[Run 1] Unpatched Game Execution:");
            int dmg1 = combat.ExecuteAttack(10, false);
            Console.WriteLine($"Final Damage Dealt: {dmg1} | Durability remaining: {combat.Durability}/100\\n");

            // 2. Simulated Harmony Patch Attachment
            Console.WriteLine("[Harmony] Hooking PlayerCombat.ExecuteAttack via HarmonyInstance.PatchAll()...");
            
            // Simulating Prefix execution
            int targetArmor = 10;
            bool isCritical = false;
            CombatPatches.Prefix(combat, ref targetArmor, ref isCritical);

            // Execute method with modified parameters
            int dmg2 = combat.ExecuteAttack(targetArmor, isCritical);

            // Simulating Postfix execution
            CombatPatches.Postfix(combat, ref dmg2);

            Console.WriteLine($"Final Damage Dealt: {dmg2} | Durability remaining: {combat.Durability}/100\\n");

            // 3. Transpiler Demonstration
            Console.WriteLine("[Run 3] Simulating CIL Bytecode Transpiler:");
            var simulatedIlStream = new List<string> { "ldarg.0", "ldc.i4.10", "sub", "stfld Durability" };
            var patchedIlStream = CombatPatches.Transpiler(simulatedIlStream);
            Console.WriteLine("Patched IL Instructions: " + string.Join(" -> ", patchedIlStream));
        }
    }
}
""",
        "expected": "Compiles with modern C#. Output demonstrates unpatched damage calculation (20 damage, durability drops to 90), followed by Harmony Prefix altering armor and critical hit flags, and Harmony Postfix buffing final damage to 125, ending with a simulated CIL Transpiler replacing the durability opcode.",
        "lessons": [
            {
                "id": "mod-harm-concepts",
                "title": "The Harmony patching framework",
                "paragraphs": [
                    "Harmony is an open-source library that allows C# developers to alter and extend methods in third-party .NET applications and Unity games at runtime. Unlike traditional modding approaches that patch DLL files on disk, Harmony injects modifications dynamically in process memory using DynamicMethod and JIT compilation.",
                    "Because Harmony does not alter files on disk, multiple independent mods can patch the same method simultaneously. Harmony maintains an internal patch registry, chaining prefixes, transpilers, and postfixes from multiple mods into a unified, conflict-free runtime wrapper."
                ],
                "example": "var harmony = new Harmony(\"com.myname.mod\"); harmony.PatchAll();",
                "pitfall": "Modifying assembly files on disk while Harmony is active creates duplicate patch conflicts and breaks game integrity checks.",
                "question": {
                    "id": "mod-harm-con-q",
                    "prompt": "What major advantage does Harmony offer when multiple different mods need to alter the same game function?",
                    "options": [
                        {"id": "a", "text": "Harmony coordinates runtime patches from multiple mods without them overwriting the physical DLL file on disk"},
                        {"id": "b", "text": "Harmony deletes all other mods automatically"},
                        {"id": "c", "text": "Harmony forces all mods to run in single-threaded mode"}
                    ],
                    "answerId": "a",
                    "explanation": "Harmony chains multiple patches together in memory at runtime, allowing numerous mods to extend the same method without disk conflicts.",
                    "lessonId": "mod-harm-concepts"
                }
            },
            {
                "id": "mod-harm-prefix",
                "title": "Prefix patches & short-circuiting",
                "paragraphs": [
                    "A Harmony Prefix patch executes before the original target method begins. Prefixes are annotated with `[HarmonyPrefix]`. They can read the invoking object instance via `__instance`, inspect and alter incoming arguments using the `ref` keyword, and store state across to the postfix using `__state`.",
                    "A critical feature of Prefix patches is 'short-circuiting'. If a Prefix method returns `bool`, returning `true` allows the original method to proceed normally. However, returning `false` skips the original method completely, allowing the mod to substitute custom logic or prevent an event entirely (such as blocking player death or cancelling a weapon cooldown)."
                ],
                "example": "static bool Prefix(ref int damage) { if (GodMode) return false; damage *= 2; return true; }",
                "pitfall": "Returning false in a Prefix without setting `ref __result` for non-void methods causes the method to return default uninitialized values (such as null or 0).",
                "question": {
                    "id": "mod-harm-pref-q",
                    "prompt": "What happens when a Harmony Prefix method returns false?",
                    "options": [
                        {"id": "a", "text": "The original game method is skipped (short-circuited), jumping directly to postfixes"},
                        {"id": "b", "text": "The game crashes immediately with an unhandled exception"},
                        {"id": "c", "text": "The computer restarts"}
                    ],
                    "answerId": "a",
                    "explanation": "Returning false from a boolean Prefix prevents the original game method from running, effectively replacing its execution with the mod's logic.",
                    "lessonId": "mod-harm-prefix"
                }
            },
            {
                "id": "mod-harm-postfix",
                "title": "Postfix patches & result modification",
                "paragraphs": [
                    "A Harmony Postfix patch executes immediately after the original target method finishes. Postfixes are annotated with `[HarmonyPostfix]`. Because the original method has already executed, Postfixes are ideal for reacting to completed events, logging outcomes, or modifying the return value.",
                    "To modify what the caller receives from the method, the Postfix includes a parameter named `ref __result` matching the method's return type. For example, if a game function `CalculateSellPrice()` returns `100`, a Postfix can alter `__result = __result * 2` to grant double gold to the merchant."
                ],
                "example": "static void Postfix(ref int __result) { __result = (int)(__result * 1.5f); }",
                "pitfall": "Attempting to change incoming method arguments inside a Postfix has no effect on the method's calculations because the method has already completed.",
                "question": {
                    "id": "mod-harm-post-q",
                    "prompt": "How does a Harmony Postfix patch modify the return value of a game method?",
                    "options": [
                        {"id": "a", "text": "By accepting a parameter named ref __result and assigning a new value to it"},
                        {"id": "b", "text": "By editing the Windows pagefile"},
                        {"id": "c", "text": "By calling Console.ReadLine()"}
                    ],
                    "answerId": "a",
                    "explanation": "Harmony recognizes the special parameter `ref __result` and passes the method's return value by reference so the Postfix can modify it.",
                    "lessonId": "mod-harm-postfix"
                }
            },
            {
                "id": "mod-harm-transpiler",
                "title": "Transpilers & CIL instruction rewriting",
                "paragraphs": [
                    "Transpilers are the most surgical and performant type of Harmony patch. Instead of wrapping a method in prefix/postfix logic, a Transpiler receives the method's raw Common Intermediate Language (CIL) instruction stream (`IEnumerable<CodeInstruction>`), rewrites specific opcodes, and emits a modified instruction list before the method is JIT-compiled.",
                    "Using Transpilers, a modder can replace a single numeric constant (e.g. replacing `ldc.i4.s 10` with `ldc.i4.0` to disable stamina consumption), insert new method calls (`call` or `callvirt`), or redirect conditional branch jumps. Because changes are baked directly into the JIT-compiled machine code, Transpilers incur zero runtime function call overhead."
                ],
                "example": "if (instruction.opcode == OpCodes.Ldc_I4_5) yield return new CodeInstruction(OpCodes.Ldc_I4, 20);",
                "pitfall": "Emitting an invalid sequence of CIL instructions that desynchronizes the evaluation stack results in an `InvalidProgramException` when the CLR attempts to JIT-compile the method.",
                "question": {
                    "id": "mod-harm-tran-q",
                    "prompt": "Why are Harmony Transpilers considered more performant than heavy Prefix/Postfix wrappers for small logic tweaks?",
                    "options": [
                        {"id": "a", "text": "They rewrite CIL instructions before JIT compilation, resulting in optimized native code with zero wrapper call overhead"},
                        {"id": "b", "text": "They run directly on the graphics card without using the CPU"},
                        {"id": "c", "text": "They disable .NET garbage collection entirely"}
                    ],
                    "answerId": "a",
                    "explanation": "Transpilers modify the bytecode instructions directly prior to JIT compilation, eliminating the call overhead of external wrapper methods.",
                    "lessonId": "mod-harm-transpiler"
                }
            }
        ],
        "steps": [
            "Inspect `mod-harmony-patching.cs` to understand the differences between `Prefix`, `Postfix`, and `Transpiler` patch designs.",
            "Review how `CombatPatches.Prefix` alters incoming arguments (`targetArmor` and `isCritical`) via reference parameters.",
            "Observe how `CombatPatches.Postfix` uses `ref __result` to scale the final output damage.",
            "Run the program to verify that damage increases from 20 to 125 and observe the CIL instruction stream modification."
        ],
        "challenge": {
            "task": "Create a Prefix patch on a simulated `TakeDamage(int amount)` method that checks if `amount > 50` and cancels the damage entirely by returning `false` if the player is in defensive stance.",
            "acceptance": [
                "Prefix signature accepting `__instance` and `ref int amount`",
                "Short-circuit condition returning `false` when amount > 50 and defensive stance is true",
                "Execution test verifying that lethal damage is successfully blocked"
            ]
        },
        "sources": [
            {
                "title": "Harmony: Dynamic Runtime Patching for .NET and Mono",
                "url": "https://harmony.pardeike.net/"
            },
            {
                "title": "Common Intermediate Language (CIL) OpCodes Reference",
                "url": "https://learn.microsoft.com/en-us/dotnet/api/system.reflection.emit.opcodes"
            }
        ],
        "exam": {
            "passPercent": 80,
            "questions": [
                {
                    "id": "mod-harm-e1",
                    "prompt": "What special parameter name does Harmony use in Prefix and Postfix patches to pass the current instance of the patched class?",
                    "options": [
                        {"id": "a", "text": "__instance"},
                        {"id": "b", "text": "thisPointer"},
                        {"id": "c", "text": "__caller"}
                    ],
                    "answerId": "a",
                    "explanation": "Harmony injects the target class instance into any patch parameter named `__instance`.",
                    "lessonId": "mod-harm-prefix"
                },
                {
                    "id": "mod-harm-e2",
                    "prompt": "What must a Prefix method return if it wants the original method to execute normally?",
                    "options": [
                        {"id": "a", "text": "true"},
                        {"id": "b", "text": "false"},
                        {"id": "c", "text": "null"}
                    ],
                    "answerId": "a",
                    "explanation": "Returning `true` from a boolean Prefix allows the original method to continue executing.",
                    "lessonId": "mod-harm-prefix"
                },
                {
                    "id": "mod-harm-e3",
                    "prompt": "What data type does a Harmony Transpiler method accept and return?",
                    "options": [
                        {"id": "a", "text": "IEnumerable<CodeInstruction>"},
                        {"id": "b", "text": "string[]"},
                        {"id": "c", "text": "List<int>"}
                    ],
                    "answerId": "a",
                    "explanation": "Harmony Transpilers operate as generator pipelines that consume and yield `IEnumerable<CodeInstruction>` sequences.",
                    "lessonId": "mod-harm-transpiler"
                },
                {
                    "id": "mod-harm-e4",
                    "prompt": "How does a Postfix patch access information passed from a corresponding Prefix patch in the same mod?",
                    "options": [
                        {"id": "a", "text": "By using the special __state parameter in both the Prefix (as ref) and Postfix"},
                        {"id": "b", "text": "By writing the data to a temporary text file on the desktop"},
                        {"id": "c", "text": "State cannot be shared between Prefix and Postfix"}
                    ],
                    "answerId": "a",
                    "explanation": "The `__state` parameter allows a Prefix to pass contextual data (like start times or initial values) directly to the Postfix.",
                    "lessonId": "mod-harm-postfix"
                },
                {
                    "id": "mod-harm-e5",
                    "prompt": "Why are Harmony patches preferred over editing Assembly-CSharp.dll directly in dnSpy?",
                    "options": [
                        {"id": "a", "text": "They patch memory at runtime without altering game files, allowing multiple mods to coexist without conflict"},
                        {"id": "b", "text": "They bypass CPU floating-point registers"},
                        {"id": "c", "text": "dnSpy is illegal to install on Windows"}
                    ],
                    "answerId": "a",
                    "explanation": "Harmony patches are applied dynamically at runtime in memory, avoiding file collisions and simplifying mod installation and removal.",
                    "lessonId": "mod-harm-concepts"
                }
            ]
        }
    }
]
