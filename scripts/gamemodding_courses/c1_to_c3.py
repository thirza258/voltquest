"""Courses 1 to 3 for the Game Modding curriculum."""

COURSES_1_TO_3 = [
    {
        "id": "mod-architecture",
        "version": 1,
        "order": 1,
        "title": "1. Game Architecture & Modding Foundations",
        "summary": "Understand game engine execution loops, tick cycles, ECS and OOP object models, the taxonomy of game mods (asset, script, bytecode, binary), and ethical boundaries with anti-cheat systems.",
        "difficulty": "Fundamental",
        "minutes": 25,
        "codeExt": "cpp",
        "code": """// Game Engine Architecture & Mod Hooking Pipeline (C++17)
// Demonstrates the main game loop, entity tick cycles, and an event-driven
// mod subscriber interface that allows mods to intercept gameplay events.

#include <iostream>
#include <vector>
#include <string>
#include <functional>
#include <memory>
#include <cstdint>

// Forward declarations
struct DamageEvent {
    uint32_t targetEntityId;
    uint32_t sourceEntityId;
    float rawDamage;
    float modifiedDamage;
    bool cancelled;
};

// Mod Hook Interface: Mods register callbacks to observe or alter events
class ModHookBus {
public:
    using DamageCallback = std::function<void(DamageEvent&)>;
    using TickCallback = std::function<void(float deltaSeconds)>;

    void subscribePreTick(TickCallback cb) { preTickHooks.push_back(cb); }
    void subscribePostTick(TickCallback cb) { postTickHooks.push_back(cb); }
    void subscribeDamage(DamageCallback cb) { damageHooks.push_back(cb); }

    void dispatchPreTick(float dt) {
        for (auto& hook : preTickHooks) hook(dt);
    }

    void dispatchPostTick(float dt) {
        for (auto& hook : postTickHooks) hook(dt);
    }

    void dispatchDamage(DamageEvent& ev) {
        for (auto& hook : damageHooks) {
            hook(ev);
            if (ev.cancelled) break;
        }
    }

private:
    std::vector<TickCallback> preTickHooks;
    std::vector<TickCallback> postTickHooks;
    std::vector<DamageCallback> damageHooks;
};

// Basic Entity in the game engine
struct Entity {
    uint32_t id;
    std::string name;
    float health;
    float maxHealth;
    bool isAlive;
};

// Game Engine World State
class GameWorld {
public:
    GameWorld(ModHookBus& bus) : hookBus(bus), nextId(1) {}

    uint32_t spawnEntity(const std::string& name, float hp) {
        entities.push_back({nextId, name, hp, hp, true});
        return nextId++;
    }

    Entity* getEntity(uint32_t id) {
        for (auto& e : entities) {
            if (e.id == id) return &e;
        }
        return nullptr;
    }

    void applyDamage(uint32_t targetId, uint32_t sourceId, float amount) {
        DamageEvent ev{targetId, sourceId, amount, amount, false};
        
        // Dispatch to registered mod hooks before applying to state
        hookBus.dispatchDamage(ev);

        if (ev.cancelled) {
            std::cout << "[Engine] Damage cancelled by mod hook! Target ID: " << targetId << "\\n";
            return;
        }

        Entity* target = getEntity(targetId);
        if (target && target->isAlive) {
            target->health -= ev.modifiedDamage;
            std::cout << "[Engine] Entity " << target->name << " took " 
                      << ev.modifiedDamage << " damage (HP: " << target->health << "/" << target->maxHealth << ")\\n";
            if (target->health <= 0.0f) {
                target->health = 0.0f;
                target->isAlive = false;
                std::cout << "[Engine] Entity " << target->name << " has perished!\\n";
            }
        }
    }

    void tick(float deltaSeconds) {
        hookBus.dispatchPreTick(deltaSeconds);
        // Simulation updates: physics, AI, animations
        hookBus.dispatchPostTick(deltaSeconds);
    }

private:
    ModHookBus& hookBus;
    uint32_t nextId;
    std::vector<Entity> entities;
};

// Example Mod: GodMode & Damage Multiplier Mod
class DamageModifierMod {
public:
    DamageModifierMod(ModHookBus& bus, uint32_t playerEntityId) 
        : playerId(playerEntityId) {
        bus.subscribeDamage([this](DamageEvent& ev) {
            // GodMode logic: cancel all incoming damage to player
            if (ev.targetEntityId == playerId) {
                std::cout << "[Mod:DamageModifier] Blocking damage to player ID " << playerId << "\\n";
                ev.cancelled = true;
                return;
            }
            // Outgoing damage buff: double player's damage to enemies
            if (ev.sourceEntityId == playerId) {
                ev.modifiedDamage *= 2.0f;
                std::cout << "[Mod:DamageModifier] Buffed player damage to " << ev.modifiedDamage << "\\n";
            }
        });
    }

private:
    uint32_t playerId;
};

int main() {
    ModHookBus bus;
    GameWorld world(bus);

    uint32_t player = world.spawnEntity("PlayerHero", 100.0f);
    uint32_t boss = world.spawnEntity("DragonBoss", 500.0f);

    // Initialize custom mod
    DamageModifierMod mod(bus, player);

    // Run simulated game loop
    std::cout << "--- Game Loop Starting ---\\n";
    world.tick(0.016f); // 60 FPS tick

    // Boss attacks player (should be cancelled by mod)
    world.applyDamage(player, boss, 50.0f);

    // Player attacks boss (should be doubled by mod: 40 -> 80)
    world.applyDamage(boss, player, 40.0f);

    return 0;
}
""",
        "expected": "Compiles with C++17 (`g++ -std=c++17 mod-architecture.cpp`). Output shows the game loop dispatching events, the mod intercepting incoming damage to PlayerHero and cancelling it (GodMode), and doubling outgoing damage against DragonBoss from 40 to 80.",
        "lessons": [
            {
                "id": "mod-arch-gameloop",
                "title": "The game loop & tick lifecycle",
                "paragraphs": [
                    "At the core of every interactive game is the game loop. Unlike event-driven desktop software that sleeps until an OS event occurs, a game engine continuously loops through input processing, state updates, physics simulation, audio generation, and rendering. Updates typically occur on a fixed timestep (e.g., 50 or 60 Hz for physics) or variable timestep (rendering at the monitor's refresh rate).",
                    "Mod authors must understand when their hooks execute relative to the tick cycle. Intercepting input before physics calculation allows aim assists and movement modifications; intercepting post-physics state allows telemetry logging, camera smoothing, and UI overlays. Modifying state outside the designated tick thread can lead to race conditions, synchronization desyncs, and immediate crashes."
                ],
                "example": "while (running) { processInput(); updatePhysics(fixedDt); updateGameLogic(dt); render(frameAlpha); }",
                "pitfall": "Executing heavy blocking operations (such as synchronous network requests or disk I/O) inside the tick loop causes severe frame rate stuttering and physics instability.",
                "question": {
                    "id": "mod-arch-loop-q",
                    "prompt": "Why is game logic typically calculated using a fixed timestep (delta time) rather than raw frame rates?",
                    "options": [
                        {"id": "a", "text": "To prevent GPU overheating during menu screens"},
                        {"id": "b", "text": "To ensure physics and gameplay behave deterministically across different hardware and frame rates"},
                        {"id": "c", "text": "Because C++ compilers do not support floating-point arithmetic at high frame rates"}
                    ],
                    "answerId": "b",
                    "explanation": "Fixed timesteps decouple game physics and logic from hardware rendering speed, ensuring characters jump the same distance regardless of whether the game runs at 30 FPS or 240 FPS.",
                    "lessonId": "mod-arch-gameloop"
                }
            },
            {
                "id": "mod-arch-ecs-oop",
                "title": "Entities, components & memory locality",
                "paragraphs": [
                    "Older game engines relied on deep Object-Oriented Programming (OOP) inheritance hierarchies (e.g., Actor -> Pawn -> Character -> Player). Modern engines frequently adopt the Entity-Component-System (ECS) architectural pattern, where Entities are lightweight integer IDs, Components are pure plain-old-data (POD) structs, and Systems contain the iterative logic that processes matching components.",
                    "For modders, ECS engines store components in contiguous memory arrays (archetypes or sparse sets) for cache locality. Instead of navigating complex virtual pointer tables to find an object's health, an ECS mod can query the HealthComponent array directly, significantly simplifying memory scanning and batch modifications."
                ],
                "example": "OOP: entity->getComponent<Health>()->takeDamage(10); vs ECS: for (auto [id, hp, pos] : view) { hp.value -= 10; }",
                "pitfall": "Assuming all game objects have continuous virtual method tables; in pure ECS architectures, entities have no vtables and methods live in separate stateless systems.",
                "question": {
                    "id": "mod-arch-ecs-q",
                    "prompt": "In an Entity-Component-System (ECS) architecture, what is an Entity?",
                    "options": [
                        {"id": "a", "text": "A polymorphic C++ base class containing virtual update functions"},
                        {"id": "b", "text": "A unique numeric identifier (ID) that groups associated component data"},
                        {"id": "c", "text": "A GPU compute shader that handles matrix multiplications"}
                    ],
                    "answerId": "b",
                    "explanation": "In ECS, an entity is merely an identifier (often a 32-bit or 64-bit integer) used to index into data tables holding components.",
                    "lessonId": "mod-arch-ecs-oop"
                }
            },
            {
                "id": "mod-arch-taxonomy",
                "title": "Taxonomy of game mods",
                "paragraphs": [
                    "Game modifications span a spectrum of technical complexity. Content and data mods replace existing assets (textures, 3D meshes, audio, localization text) or tweak declarative tables (JSON, XML, SQLite, YAML) without changing executable code. Script mods hook into exposed runtime engines (Lua, Python, Unreal Blueprints) via official or community mod loaders.",
                    "At the deepest level, bytecode and binary mods modify the game's executable instructions. In managed environments (Unity/C#, Java), modders decompile and rewrite Intermediate Language (IL) bytecode using frameworks like BepInEx and Harmony. In native environments (C/C++), modders use dynamic binary instrumentation, DLL injection, and memory detours to patch machine code at runtime."
                ],
                "example": "Asset Mod: replacing skin.png; Script Mod: adding quest.lua; Binary Mod: hooking TakeDamage() in game.exe.",
                "pitfall": "Modifying game executables on disk triggers hash-based integrity checks and anti-piracy validations; runtime memory patching is cleaner and non-destructive.",
                "question": {
                    "id": "mod-arch-tax-q",
                    "prompt": "Which type of mod modifies executable machine instructions in the running game's memory space rather than swapping asset files?",
                    "options": [
                        {"id": "a", "text": "Texture pack mod"},
                        {"id": "b", "text": "Binary/runtime hook mod"},
                        {"id": "c", "text": "Localization string mod"}
                    ],
                    "answerId": "b",
                    "explanation": "Binary or runtime hook mods alter process memory by injecting code, hooking functions, or patching machine instructions at runtime.",
                    "lessonId": "mod-arch-taxonomy"
                }
            },
            {
                "id": "mod-arch-ethics-ac",
                "title": "Anti-cheat systems & ethical boundaries",
                "paragraphs": [
                    "Modding single-player and cooperative sandbox games enriches player creativity and extends game longevity (e.g., Skyrim, Minecraft, Factorio). However, applying modding techniques in competitive multiplayer games undermines fair play, degrades user trust, and violates Terms of Service. Anti-cheat software operates across user space and kernel space to detect unauthorized memory access and binary tampering.",
                    "User-mode anti-cheats (like Valve Anti-Cheat / VAC) inspect process memory modules, scan for known cheat signatures, verify code section checksums, and detect unauthorized thread injection. Kernel-level anti-cheats (such as Easy Anti-Cheat, BattlEye, Vanguard) install kernel drivers to monitor process handles (`OpenProcess`), intercept page manipulation (`VirtualProtect`), and enforce hypervisor-protected code integrity (HVCI)."
                ],
                "example": "Single-player modding: creative sandboxes and offline debugging. Multiplayer anti-cheat: kernel drivers blocking OpenProcess and memory writes.",
                "pitfall": "Running debugger or memory scanner tools while connected to VAC-secured or kernel-anti-cheat multiplayer servers can result in irreversible account bans.",
                "question": {
                    "id": "mod-arch-ac-q",
                    "prompt": "What technique do user-mode anti-cheat systems frequently use to detect binary code tampering?",
                    "options": [
                        {"id": "a", "text": "Calculating cryptographic hashes of executable code sections (.text) and comparing them against disk copies"},
                        {"id": "b", "text": "Disabling the computer's graphics card drivers during gameplay"},
                        {"id": "c", "text": "Replacing all game C++ classes with interpreted Python scripts"}
                    ],
                    "answerId": "a",
                    "explanation": "Anti-cheat software periodically scans the `.text` executable code section of loaded game modules, checking if bytes have been modified by patches or detour jumps.",
                    "lessonId": "mod-arch-ethics-ac"
                }
            }
        ],
        "steps": [
            "Inspect the game loop architecture in `mod-architecture.cpp`: locate where `GameWorld::tick` dispatches `preTick` and `postTick` events.",
            "Review the `ModHookBus` class to understand how subscriber callbacks are registered and triggered when a `DamageEvent` occurs.",
            "Compile the sample code with `g++ -std=c++17 mod-architecture.cpp -o mod_arch` and execute it.",
            "Verify the console output: observe that the mod successfully cancelled incoming damage to the player and doubled outgoing attack damage."
        ],
        "challenge": {
            "task": "Add a new event type `HealEvent` to `ModHookBus` with fields `entityId`, `healAmount`, and `isOverhealAllowed`. Implement a mod listener that caps maximum healing to 50 HP per event.",
            "acceptance": [
                "Definition of `HealEvent` struct with cancellation and value modification support",
                "Registration of a healing hook subscriber on `ModHookBus`",
                "Execution test verifying that healing amounts exceeding 50 HP are clamped to 50 HP"
            ]
        },
        "sources": [
            {
                "title": "Game Programming Patterns: The Game Loop",
                "url": "https://gameprogrammingpatterns.com/game-loop.html"
            },
            {
                "title": "Component-Based Architecture in Game Development",
                "url": "https://gameprogrammingpatterns.com/component.html"
            }
        ],
        "exam": {
            "passPercent": 80,
            "questions": [
                {
                    "id": "mod-arch-e1",
                    "prompt": "What happens if a mod executes a slow, synchronous network call inside the primary game tick callback?",
                    "options": [
                        {"id": "a", "text": "The game immediately compiles the call into multi-threaded GPU shaders"},
                        {"id": "b", "text": "The entire game freezes or drops frames until the network request completes"},
                        {"id": "c", "text": "The OS automatically boosts CPU clock speeds to compensate"}
                    ],
                    "answerId": "b",
                    "explanation": "Because game loops execute synchronously on the main thread, any blocking call in a tick hook blocks the entire simulation and rendering pipeline.",
                    "lessonId": "mod-arch-gameloop"
                },
                {
                    "id": "mod-arch-e2",
                    "prompt": "Why do modern game engines use Entity-Component-System (ECS) instead of deep OOP inheritance trees?",
                    "options": [
                        {"id": "a", "text": "ECS improves CPU cache locality by packing component data contiguously in memory"},
                        {"id": "b", "text": "ECS prevents players from ever using memory scanning tools"},
                        {"id": "c", "text": "ECS eliminates the need for 3D graphics rendering"}
                    ],
                    "answerId": "a",
                    "explanation": "By storing components contiguously in memory arrays, CPU cache misses are dramatically reduced compared to pointer-chasing in polymorphic OOP hierarchies.",
                    "lessonId": "mod-arch-ecs-oop"
                },
                {
                    "id": "mod-arch-e3",
                    "prompt": "Which modding category operates by replacing texture images, audio files, or 3D models without altering executable code?",
                    "options": [
                        {"id": "a", "text": "Kernel hook mod"},
                        {"id": "b", "text": "Content / asset mod"},
                        {"id": "c", "text": "Bytecode IL transpiler"}
                    ],
                    "answerId": "b",
                    "explanation": "Content/asset mods only swap resources (like textures and audio) packaged in game archives without changing compiled logic.",
                    "lessonId": "mod-arch-taxonomy"
                },
                {
                    "id": "mod-arch-e4",
                    "prompt": "Why is runtime in-memory hooking generally preferred over patching game binaries directly on disk?",
                    "options": [
                        {"id": "a", "text": "It leaves original game files intact, avoiding file integrity failures and simplifying uninstallation"},
                        {"id": "b", "text": "Hard drives cannot physically store modified game files"},
                        {"id": "c", "text": "Disk patching requires re-installing the operating system"}
                    ],
                    "answerId": "a",
                    "explanation": "Runtime patching alters only the process memory of the active game session, leaving the on-disk installation clean and preventing checksum corruption.",
                    "lessonId": "mod-arch-taxonomy"
                },
                {
                    "id": "mod-arch-e5",
                    "prompt": "What capability distinguishes kernel-level anti-cheat drivers from user-mode anti-cheat systems?",
                    "options": [
                        {"id": "a", "text": "Kernel drivers run at Ring 0, allowing them to monitor process memory access and driver handles system-wide"},
                        {"id": "b", "text": "Kernel drivers run inside the web browser JavaScript engine"},
                        {"id": "c", "text": "Kernel drivers can only run on 8-bit microcontrollers"}
                    ],
                    "answerId": "a",
                    "explanation": "Kernel-level anti-cheat drivers execute with Ring 0 privileges, giving them oversight over all processes, memory mappings, and system calls.",
                    "lessonId": "mod-arch-ethics-ac"
                }
            ]
        }
    },
    {
        "id": "mod-memory-internals",
        "version": 1,
        "order": 2,
        "title": "2. Memory Layout, Virtual Addresses & Pointer Chains",
        "summary": "Master process virtual address spaces, ASLR base addresses, dynamic heap allocations, multi-level pointer dereferencing, and memory scanning algorithms.",
        "difficulty": "Fundamental",
        "minutes": 25,
        "codeExt": "cpp",
        "code": """// Process Memory Layout & Multi-Level Pointer Resolver (C++17)
// Demonstrates how game data is arranged across dynamic heap allocations,
// and how multi-level pointer chains resolve static module offsets to dynamic variables.

#include <iostream>
#include <vector>
#include <cstdint>
#include <cstring>
#include <memory>
#include <stdexcept>

// Simulated game data structures in process memory
struct PlayerStats {
    float moveSpeed;
    int32_t health;
    int32_t maxHealth;
    int32_t mana;
    int32_t gold;
};

struct PlayerController {
    uint32_t playerId;
    PlayerStats* stats; // Pointer to dynamically allocated stats
};

struct GameInstance {
    uint32_t sessionToken;
    PlayerController* localPlayer; // Pointer to dynamically allocated controller
};

// Represents a global/module base structure with a static pointer to GameInstance
struct EngineModule {
    GameInstance* activeGameInstance;
};

// Simulated Process Memory Scanner & Pointer Resolver
class MemoryResolver {
public:
    // Resolves a multi-level pointer path: baseAddress -> [offset1] -> [offset2] -> target
    static uintptr_t resolvePointerChain(uintptr_t baseAddress, const std::vector<uintptr_t>& offsets) {
        uintptr_t currentAddress = baseAddress;
        std::cout << "[Resolver] Starting at Base Address: 0x" << std::hex << currentAddress << std::dec << "\\n";

        for (size_t i = 0; i < offsets.size(); ++i) {
            uintptr_t offset = offsets[i];
            
            // Read pointer stored at (currentAddress + offset)
            uintptr_t* pointerLocation = reinterpret_cast<uintptr_t*>(currentAddress + offset);
            
            if (pointerLocation == nullptr || *pointerLocation == 0) {
                throw std::runtime_error("Null pointer dereference encountered in pointer chain at index " + std::to_string(i));
            }

            currentAddress = *pointerLocation;
            std::cout << "[Resolver] Step " << (i + 1) << ": dereferenced +0x" 
                      << std::hex << offset << " -> next address 0x" << currentAddress << std::dec << "\\n";
        }

        return currentAddress;
    }

    // Pattern/Value Scanner: Scans a buffer for an int32 value
    static std::vector<uintptr_t> scanInt32(const uint8_t* buffer, size_t bufferSize, int32_t targetValue) {
        std::vector<uintptr_t> foundOffsets;
        for (size_t i = 0; i <= bufferSize - sizeof(int32_t); ++i) {
            int32_t value;
            std::memcpy(&value, buffer + i, sizeof(int32_t));
            if (value == targetValue) {
                foundOffsets.push_back(i);
            }
        }
        return foundOffsets;
    }
};

int main() {
    std::cout << "=== Memory Layout & Pointer Chain Simulation ===\\n";

    // Allocate dynamic game hierarchy on the heap
    auto stats = std::make_unique<PlayerStats>();
    stats->moveSpeed = 7.5f;
    stats->health = 100;
    stats->maxHealth = 100;
    stats->mana = 50;
    stats->gold = 2500;

    auto controller = std::make_unique<PlayerController>();
    controller->playerId = 42;
    controller->stats = stats.get();

    auto gameInstance = std::make_unique<GameInstance>();
    gameInstance->sessionToken = 0xDEADBEEF;
    gameInstance->localPlayer = controller.get();

    // Module base address holding pointer to gameInstance
    EngineModule moduleBase;
    moduleBase.activeGameInstance = gameInstance.get();

    uintptr_t staticModuleAddress = reinterpret_cast<uintptr_t>(&moduleBase);

    // Calculate offsets based on C++ struct layout:
    uintptr_t off1 = offsetof(EngineModule, activeGameInstance);
    uintptr_t off2 = offsetof(GameInstance, localPlayer);
    uintptr_t off3 = offsetof(PlayerController, stats);

    std::cout << "Original Player Health: " << stats->health << " | Gold: " << stats->gold << "\\n";

    // Resolve pointer chain: &moduleBase -> activeGameInstance -> localPlayer -> stats
    try {
        uintptr_t resolvedStatsAddr = MemoryResolver::resolvePointerChain(
            staticModuleAddress, 
            {off1, off2, off3}
        );

        PlayerStats* targetStats = reinterpret_cast<PlayerStats*>(resolvedStatsAddr);
        std::cout << "[Mod] Successfully resolved target PlayerStats struct at 0x" 
                  << std::hex << resolvedStatsAddr << std::dec << "\\n";

        // Modify game variables via resolved pointer
        targetStats->health = 9999;
        targetStats->gold = 999999;
        std::cout << "[Mod] Injected custom values! New Health: " << stats->health 
                  << " | New Gold: " << stats->gold << "\\n";

    } catch (const std::exception& ex) {
        std::cerr << "Resolution error: " << ex.what() << "\\n";
        return 1;
    }

    // Demonstrate memory scanning for gold value (999999)
    uint8_t* rawMemory = reinterpret_cast<uint8_t*>(stats.get());
    auto matches = MemoryResolver::scanInt32(rawMemory, sizeof(PlayerStats), 999999);
    std::cout << "[Scanner] Found target gold value at " << matches.size() << " offset within PlayerStats buffer.\\n";

    return 0;
}
""",
        "expected": "Compiles with C++17 (`g++ -std=c++17 mod-memory-internals.cpp`). Output displays the multi-step pointer chain traversal through EngineModule -> GameInstance -> PlayerController -> PlayerStats, successfully overwriting health and gold, followed by scanner identification.",
        "lessons": [
            {
                "id": "mod-mem-address-space",
                "title": "Virtual memory space & ASLR",
                "paragraphs": [
                    "Operating systems grant every modern process an isolated virtual address space (up to 4 GB in 32-bit x86, and 128 TB+ in 64-bit x64). Virtual addresses do not correspond to physical RAM chips directly; the CPU's Memory Management Unit (MMU) translates virtual pages to physical frames via page tables.",
                    "Address Space Layout Randomization (ASLR) is an OS security mitigation that randomizes the base memory address of executables and shared libraries (DLLs / .so files) every time the game launches. Modders cannot hardcode absolute addresses (e.g., `0x00401234`). Instead, they determine the module's dynamic base address at runtime and compute relative virtual addresses (RVA): `EffectiveAddress = ModuleBase + RVA`."
                ],
                "example": "uintptr_t moduleBase = (uintptr_t)GetModuleHandleA(\"game.exe\"); uintptr_t playerPtr = *(uintptr_t*)(moduleBase + 0x145A80);",
                "pitfall": "Hardcoding absolute memory addresses found during one game session causes instant crashes on subsequent launches due to ASLR base shifting.",
                "question": {
                    "id": "mod-mem-aslr-q",
                    "prompt": "Why do memory addresses found in one game session change when the game is restarted?",
                    "options": [
                        {"id": "a", "text": "Operating systems wipe all RAM tables when games exit"},
                        {"id": "b", "text": "Address Space Layout Randomization (ASLR) assigns a different base address to executable modules on each launch"},
                        {"id": "c", "text": "Game compilers generate different machine code opcodes on every computer restart"}
                    ],
                    "answerId": "b",
                    "explanation": "ASLR randomizes module base addresses to prevent memory-corruption exploits, meaning modders must use relative offsets from module bases.",
                    "lessonId": "mod-mem-address-space"
                }
            },
            {
                "id": "mod-mem-scanning",
                "title": "Memory scanning techniques",
                "paragraphs": [
                    "Memory scanners (such as Cheat Engine or custom memory utilities) locate variables by scanning readable pages of a process. The process starts with an initial scan for a known value (e.g., current player ammo = 30). Because thousands of memory addresses may hold the integer 30, the scanner records all matching addresses in a candidate list.",
                    "The player then alters the in-game value (fires a bullet -> ammo becomes 29) and performs a subsequent 'filter scan' on the candidate list. Subsequent scans can filter for decreased values, increased values, exact values, or unchanged values. For floating-point variables (such as health or coordinates), scanners apply tolerance ranges (e.g. ±0.01) to account for floating-point inaccuracies."
                ],
                "example": "Scan 1: Health = 100 (5,000 matches) -> Take damage -> Scan 2: Health = 84 (2 matches) -> Take damage -> Scan 3: Health = 68 (1 match).",
                "pitfall": "Scanning with the wrong data type (e.g. searching for a 4-byte integer when the game stores health as a 32-bit single-precision float) produces zero results.",
                "question": {
                    "id": "mod-mem-scan-q",
                    "prompt": "How does a memory scanner narrow down thousands of candidate addresses to find a player's ammo count?",
                    "options": [
                        {"id": "a", "text": "By performing subsequent filter scans on candidate addresses after the in-game ammo value changes"},
                        {"id": "b", "text": "By resetting the computer's CPU registers to zero"},
                        {"id": "c", "text": "By deleting all non-game background processes"}
                    ],
                    "answerId": "a",
                    "explanation": "Changing the in-game value and filtering the previous candidate list for the new value quickly eliminates unrelated memory addresses.",
                    "lessonId": "mod-mem-scanning"
                }
            },
            {
                "id": "mod-mem-pointer-chains",
                "title": "Multilevel pointer offsets",
                "paragraphs": [
                    "Most game variables (such as player entities, enemies, and inventory items) are dynamically allocated on the heap at runtime with `new` or `malloc`. Their memory addresses change every time a new level loads. To reliably access dynamic objects across sessions, modders construct multi-level pointer paths starting from a static base address.",
                    "A static base address resides within a loaded module's data section (`.data` or `.bss`) and maintains a fixed offset from the module base. This static pointer points to a GameInstance, which contains an offset pointing to a PlayerController, which contains an offset pointing to the PlayerState. By dereferencing each pointer and adding the corresponding struct offset, the mod reliably finds the dynamic variable."
                ],
                "example": "TargetVariable = *(*(*(ModuleBase + 0x2A10) + 0x48) + 0x100) + 0x24;",
                "pitfall": "Dereferencing a pointer chain without checking for null intermediate pointers triggers an access violation (SIGSEGV / 0xC0000005) when loading screens or transitions occur.",
                "question": {
                    "id": "mod-mem-ptr-q",
                    "prompt": "What is the primary purpose of finding a multi-level pointer chain in game modding?",
                    "options": [
                        {"id": "a", "text": "To double the speed of network packet transmissions"},
                        {"id": "b", "text": "To reliably reach dynamic heap variables from a static module offset across game restarts and level loads"},
                        {"id": "c", "text": "To bypass the need for an operating system kernel"}
                    ],
                    "answerId": "b",
                    "explanation": "Pointer chains link a reliable, static module base address to dynamically allocated heap entities that change locations between level transitions.",
                    "lessonId": "mod-mem-pointer-chains"
                }
            },
            {
                "id": "mod-mem-protection",
                "title": "Page protection & memory permissions",
                "paragraphs": [
                    "Process memory is partitioned into 4 KB virtual pages, each marked with access permission flags: `PAGE_READONLY`, `PAGE_READWRITE`, `PAGE_EXECUTE_READ`, or `PAGE_NOACCESS`. By default, game code sections (`.text`) are executable and readable, but write-protected to prevent code corruption and buffer-overflow exploits.",
                    "When a mod needs to patch machine instructions or write to write-protected pages, it must call the OS memory API (such as `VirtualProtect` on Windows or `mprotect` on POSIX). The mod changes the page permission to `PAGE_EXECUTE_READWRITE`, writes the patch, and immediately restores the original permissions to preserve process stability and avoid tripping integrity scanners."
                ],
                "example": "DWORD oldProtect; VirtualProtect(targetAddr, size, PAGE_EXECUTE_READWRITE, &oldProtect); *patch = 0x90; VirtualProtect(targetAddr, size, oldProtect, &oldProtect);",
                "pitfall": "Leaving memory pages permanently marked as `PAGE_EXECUTE_READWRITE` (RWX) is a major red flag for anti-cheat and security software, as normal game code sections should never remain writable.",
                "question": {
                    "id": "mod-mem-prot-q",
                    "prompt": "What OS API function is used on Windows to temporarily make executable memory writable for patching?",
                    "options": [
                        {"id": "a", "text": "VirtualProtect"},
                        {"id": "b", "text": "CreateWindowEx"},
                        {"id": "c", "text": "RegOpenKeyEx"}
                    ],
                    "answerId": "a",
                    "explanation": "VirtualProtect allows modifying page access permissions (such as granting write access to code pages) and retrieving original protection flags.",
                    "lessonId": "mod-mem-protection"
                }
            }
        ],
        "steps": [
            "Examine `mod-memory-internals.cpp` to see how `PlayerStats`, `PlayerController`, and `GameInstance` are dynamically linked.",
            "Inspect the `resolvePointerChain` implementation and observe how each offset is applied before dereferencing the pointer.",
            "Compile and run the program: `g++ -std=c++17 mod-memory-internals.cpp -o mod_mem`.",
            "Verify that the pointer chain successfully resolves to the heap struct and overwrites player gold and health."
        ],
        "challenge": {
            "task": "Enhance `resolvePointerChain` with safe boundary checking that validates pointer addresses against a minimum user-mode threshold (e.g., > 0x10000 on 64-bit systems) before dereferencing, throwing an exception on invalid memory.",
            "acceptance": [
                "Address validation check implemented for every step in the chain",
                "Simulated null pointer test confirming clean exception handling without segmentation faults",
                "Successful resolution of valid pointer paths"
            ]
        },
        "sources": [
            {
                "title": "Virtual Memory Architecture (Microsoft Learn)",
                "url": "https://learn.microsoft.com/en-us/windows/win32/memory/virtual-memory"
            },
            {
                "title": "Address Space Layout Randomization (ASLR) in Modern Operating Systems",
                "url": "https://learn.microsoft.com/en-us/windows/win32/memory/address-space-layout-randomization"
            }
        ],
        "exam": {
            "passPercent": 80,
            "questions": [
                {
                    "id": "mod-mem-e1",
                    "prompt": "What does ASLR stand for in modern operating systems?",
                    "options": [
                        {"id": "a", "text": "Address Space Layout Randomization"},
                        {"id": "b", "text": "Asynchronous System Logic Routing"},
                        {"id": "c", "text": "Automated Shader Lighting Renderer"}
                    ],
                    "answerId": "a",
                    "explanation": "ASLR stands for Address Space Layout Randomization, which randomizes executable and library base memory locations.",
                    "lessonId": "mod-mem-address-space"
                },
                {
                    "id": "mod-mem-e2",
                    "prompt": "If a game module has a base address of 0x7FF650000000 and the Relative Virtual Address (RVA) of the player pointer is 0x2A1400, what is the effective memory address?",
                    "options": [
                        {"id": "a", "text": "0x7FF6502A1400"},
                        {"id": "b", "text": "0x2A1400000000"},
                        {"id": "c", "text": "0x7FF650000000"}
                    ],
                    "answerId": "a",
                    "explanation": "The effective address is calculated by adding the relative virtual address to the module base: 0x7FF650000000 + 0x2A1400 = 0x7FF6502A1400.",
                    "lessonId": "mod-mem-address-space"
                },
                {
                    "id": "mod-mem-e3",
                    "prompt": "When searching for a character's current health value in a memory scanner, why might an exact integer scan return zero results?",
                    "options": [
                        {"id": "a", "text": "The game may store health as a floating-point number (float) rather than an integer"},
                        {"id": "b", "text": "Memory scanners can only read hard disk drives"},
                        {"id": "c", "text": "C++ games do not store player data in RAM"}
                    ],
                    "answerId": "a",
                    "explanation": "Health is frequently represented as a 32-bit single-precision float (e.g., 100.0f) or double to support fractional damage calculations.",
                    "lessonId": "mod-mem-scanning"
                },
                {
                    "id": "mod-mem-e4",
                    "prompt": "What error occurs if your mod attempts to dereference a memory address of 0x00000000?",
                    "options": [
                        {"id": "a", "text": "Null pointer dereference (access violation crash)"},
                        {"id": "b", "text": "Successful read of BIOS firmware"},
                        {"id": "c", "text": "Automatic restart of the graphics driver"}
                    ],
                    "answerId": "a",
                    "explanation": "The zero address (NULL) resides in unmapped guard pages, triggering an immediate access violation (segmentation fault) if read or written.",
                    "lessonId": "mod-mem-pointer-chains"
                },
                {
                    "id": "mod-mem-e5",
                    "prompt": "Why must a mod restore original page protection flags after modifying executable memory?",
                    "options": [
                        {"id": "a", "text": "To prevent accidental corruption and avoid alerting security tools to writable code sections"},
                        {"id": "b", "text": "Because CPUs automatically halt if memory stays writable for more than 1 millisecond"},
                        {"id": "c", "text": "To delete the mod's compiled binary from disk"}
                    ],
                    "answerId": "a",
                    "explanation": "Leaving code pages with write permissions violates standard executable memory policies and is easily flagged by anti-cheat and security audits.",
                    "lessonId": "mod-mem-protection"
                }
            ]
        }
    },
    {
        "id": "mod-reverse-engineering",
        "version": 1,
        "order": 3,
        "title": "3. Static Analysis, Disassembly & Decompilation",
        "summary": "Reverse engineer game binaries with Ghidra and IDA: x86-64 calling conventions, function prologues, virtual method tables (VMT), and pattern signature scanning.",
        "difficulty": "Intermediate",
        "minutes": 30,
        "codeExt": "cpp",
        "code": """// Static Analysis, Vtable Analysis & Pattern Signature Scanner (C++17)
// Demonstrates how C++ virtual method tables (VMT) are organized in memory,
// how VMT hooking operates, and how Array-of-Bytes (AoB) signature scanning locates functions.

#include <iostream>
#include <vector>
#include <string>
#include <cstring>
#include <cstdint>
#include <memory>

// Simulated polymorphic game class hierarchy
class IGameActor {
public:
    virtual ~IGameActor() = default;
    virtual void onUpdate(float dt) = 0;
    virtual void takeDamage(float amount) = 0;
    virtual const char* getName() const = 0;
};

class Monster : public IGameActor {
public:
    Monster(std::string name, float hp) : name(std::move(name)), hp(hp) {}

    void onUpdate(float dt) override {
        std::cout << "[Game] " << name << " updated for dt=" << dt << "\\n";
    }

    void takeDamage(float amount) override {
        hp -= amount;
        std::cout << "[Game] " << name << " took " << amount << " damage. HP left: " << hp << "\\n";
    }

    const char* getName() const override {
        return name.c_str();
    }

    float getHealth() const { return hp; }

private:
    std::string name;
    float hp;
};

// Global original function pointer for VMT hook
using TakeDamageFn = void(*)(IGameActor* thisPtr, float amount);
TakeDamageFn originalTakeDamage = nullptr;

// Hook function to replace the virtual method
void hookedTakeDamage(IGameActor* thisPtr, float amount) {
    std::cout << "[Mod:VMTHook] Intercepted takeDamage call on actor: " << thisPtr->getName() << "\\n";
    std::cout << "[Mod:VMTHook] Original damage: " << amount << " -> Reduced to 0 (Invulnerability active!)\\n";
    // Call original function with modified parameter (0.0f damage)
    if (originalTakeDamage) {
        originalTakeDamage(thisPtr, 0.0f);
    }
}

// Array-of-Bytes (AoB) / Pattern Scanner
class PatternScanner {
public:
    static uintptr_t findPattern(const uint8_t* moduleData, size_t moduleSize, 
                                 const char* pattern, const char* mask) {
        size_t patternLen = std::strlen(mask);
        if (patternLen == 0 || moduleSize < patternLen) return 0;

        for (size_t i = 0; i <= moduleSize - patternLen; ++i) {
            bool found = true;
            for (size_t j = 0; j < patternLen; ++j) {
                if (mask[j] != '?' && moduleData[i + j] != static_cast<uint8_t>(pattern[j])) {
                    found = false;
                    break;
                }
            }
            if (found) {
                return reinterpret_cast<uintptr_t>(moduleData + i);
            }
        }
        return 0;
    }
};

int main() {
    std::cout << "=== Reverse Engineering & VMT Hooking Demo ===\\n";

    auto monster = std::make_unique<Monster>("OgreChieftain", 250.0f);

    // In C++, the first pointer-sized member of a polymorphic object is the vptr
    uintptr_t* objectRawPtr = reinterpret_cast<uintptr_t*>(monster.get());
    uintptr_t* originalVtable = reinterpret_cast<uintptr_t*>(*objectRawPtr);

    std::cout << "[Inspection] Monster Object Address: 0x" << std::hex << objectRawPtr << "\\n";
    std::cout << "[Inspection] Vtable (vptr) Address: 0x" << originalVtable << std::dec << "\\n";

    // Vtable indices:
    // [0] destructor
    // [1] onUpdate(float)
    // [2] takeDamage(float)
    // [3] getName()
    size_t takeDamageIndex = 2;
    originalTakeDamage = reinterpret_cast<TakeDamageFn>(originalVtable[takeDamageIndex]);
    std::cout << "[Inspection] Original takeDamage() Method Pointer: 0x" 
              << std::hex << reinterpret_cast<uintptr_t>(originalTakeDamage) << std::dec << "\\n";

    // Perform legitimate game call before hooking
    monster->takeDamage(50.0f);

    // VMT Shadow Hooking: Clone the vtable, replace the function pointer, and swap vptr
    // (This avoids writing into read-only .rdata section where original vtable lives)
    std::vector<uintptr_t> customVtable;
    for (size_t i = 0; i < 4; ++i) {
        customVtable.push_back(originalVtable[i]);
    }
    // Swap the takeDamage method pointer to our hook function
    customVtable[takeDamageIndex] = reinterpret_cast<uintptr_t>(&hookedTakeDamage);

    // Point the object's vptr to our shadow vtable
    *objectRawPtr = reinterpret_cast<uintptr_t>(customVtable.data());
    std::cout << "[Mod] Installed VMT Shadow Hook! vptr redirected to custom vtable.\\n";

    // Perform game call after hooking (invulnerability mod should activate)
    monster->takeDamage(75.0f);

    // Demonstrate pattern scanning: Find a signature with wildcard bytes
    // Simulated executable code section
    uint8_t fakeCodeSection[] = {
        0x55,                         // push rbp
        0x48, 0x89, 0xE5,             // mov rbp, rsp
        0x48, 0x83, 0xEC, 0x20,       // sub rsp, 0x20
        0x48, 0x8B, 0x05, 0x34, 0x12, 0x00, 0x00 // mov rax, [rip + 0x1234]
    };
    const char pattern[] = "\\x48\\x8B\\x05\\x00\\x00\\x00\\x00";
    const char mask[] = "xxx????"; // Wildcard offset bytes

    uintptr_t match = PatternScanner::findPattern(fakeCodeSection, sizeof(fakeCodeSection), pattern, mask);
    if (match) {
        std::cout << "[Scanner] Found signature match at offset +0x" 
                  << std::hex << (match - reinterpret_cast<uintptr_t>(fakeCodeSection)) << std::dec << "\\n";
    }

    // Restore original vtable before exit
    *objectRawPtr = reinterpret_cast<uintptr_t>(originalVtable);
    return 0;
}
""",
        "expected": "Compiles with C++17 (`g++ -std=c++17 mod-reverse-engineering.cpp`). Output shows inspection of the monster's vtable, successful VMT shadow hooking intercepting `takeDamage`, reducing damage to 0, and finding an instruction signature using pattern scanning with wildcards.",
        "lessons": [
            {
                "id": "mod-rev-disasm-patterns",
                "title": "Disassembly patterns & x86-64 assembly",
                "paragraphs": [
                    "Static analysis begins by loading game binaries into disassemblers like Ghidra, IDA Pro, or Binary Ninja. The disassembler converts raw machine bytes into x86-64 assembly mnemonics. Modders quickly learn to recognize standard function structures: the function prologue (allocating the stack frame and preserving registers), the function body, and the epilogue (`ret`).",
                    "In 64-bit binaries, compilers use RIP-relative addressing (relative to the instruction pointer) for accessing global variables and string literals (`mov rax, [rip + 0x12345]`). To reconstruct the target address, a modder calculates: `Target = CurrentInstructionAddress + InstructionLength + Displacement`."
                ],
                "example": "push rbp; mov rbp, rsp; sub rsp, 0x40; ... ; mov rax, [rip + 0x2A10]; ... ; add rsp, 0x40; pop rbp; ret;",
                "pitfall": "Assuming stack frame sizes are uniform across compiler optimization levels; release builds often omit frame pointers (`-fomit-frame-pointer`) and reorder instructions aggressively.",
                "question": {
                    "id": "mod-rev-disasm-q",
                    "prompt": "How does RIP-relative addressing locate global variables in 64-bit x86-64 binaries?",
                    "options": [
                        {"id": "a", "text": "By querying a centralized cloud DNS server"},
                        {"id": "b", "text": "By adding a signed 32-bit displacement to the address of the next machine instruction"},
                        {"id": "c", "text": "By resetting the CPU accumulators on every loop iteration"}
                    ],
                    "answerId": "b",
                    "explanation": "RIP-relative addressing computes target locations as a relative offset from the RIP register (the address of the next sequential instruction).",
                    "lessonId": "mod-rev-disasm-patterns"
                }
            },
            {
                "id": "mod-rev-call-conv",
                "title": "Calling conventions & ABIs",
                "paragraphs": [
                    "Calling conventions dictate how parameters are passed to functions, how return values are received, and who cleans up the call stack. On 64-bit Windows, the Microsoft x64 calling convention passes the first four integer/pointer arguments in `RCX, RDX, R8, R9` (with `XMM0-XMM3` for floating-point values) and requires a 32-byte shadow space (homing space) allocated on the stack.",
                    "In C++ non-static member functions (`__thiscall`), the implicit `this` pointer pointing to the current object instance is always passed as the first argument (in `RCX` on Windows, or `RDI` on Linux System V AMD64). Modders writing native hook functions must match the target function's exact calling convention, parameter types, and register layout, or the stack will become corrupted upon return."
                ],
                "example": "Windows x64: rcx = this, rdx = param1, r8 = param2, r9 = param3; return value in rax.",
                "pitfall": "Calling a member function without passing the valid object instance in the `this` register causes an instant crash when the function attempts to access member variables.",
                "question": {
                    "id": "mod-rev-call-q",
                    "prompt": "In the Microsoft 64-bit calling convention, which CPU register receives the implicit 'this' pointer when calling a C++ member function?",
                    "options": [
                        {"id": "a", "text": "RCX"},
                        {"id": "b", "text": "RAX"},
                        {"id": "c", "text": "R15"}
                    ],
                    "answerId": "a",
                    "explanation": "On 64-bit Windows, the first argument (which is the implicit `this` pointer in C++ member functions) is passed in `RCX`.",
                    "lessonId": "mod-rev-call-conv"
                }
            },
            {
                "id": "mod-rev-vmt-tables",
                "title": "Virtual method tables (VMT / Vtable)",
                "paragraphs": [
                    "C++ implements dynamic polymorphism via Virtual Method Tables (VMTs). Any class containing virtual functions has an implicit pointer (`vptr`) placed as its very first 64-bit field. The `vptr` points to an array of function pointers stored in the read-only `.rdata` section of the binary.",
                    "To intercept virtual function calls, modders use Virtual Method Table Hooking. In VMT Shadowing, the mod allocates a heap copy of the target class's vtable array, replaces specific function pointers with custom hook functions, and overwrites the object's `vptr` to point to the shadow table. Because this technique avoids modifying the game's original `.rdata` section, it easily evades page-integrity anti-cheat scans."
                ],
                "example": "vptr = *(uintptr_t**)object; originalFn = vptr[methodIndex]; shadowVtable[methodIndex] = &myHook; *(uintptr_t*)object = &shadowVtable;",
                "pitfall": "Overwriting function pointers directly inside the original vtable without calling VirtualProtect triggers an access violation because the vtable resides in read-only memory.",
                "question": {
                    "id": "mod-rev-vmt-q",
                    "prompt": "What advantage does VMT Shadow Hooking provide over directly overwriting pointers in the original vtable?",
                    "options": [
                        {"id": "a", "text": "It leaves the original read-only .rdata code section untouched, avoiding memory integrity detection"},
                        {"id": "b", "text": "It automatically converts 32-bit executables into 64-bit binaries"},
                        {"id": "c", "text": "It removes all assembly instructions from the target game"}
                    ],
                    "answerId": "a",
                    "explanation": "Shadow vtables reside on the mod's own heap, leaving original module memory completely unmodified and clean against checksum scanners.",
                    "lessonId": "mod-rev-vmt-tables"
                }
            },
            {
                "id": "mod-rev-signatures",
                "title": "Pattern scanning & byte signatures",
                "paragraphs": [
                    "When a game updates or patches, compiler optimizations re-align functions, shifting memory offsets and making hardcoded RVAs obsolete. To build resilient mods that survive game updates, modders use Pattern Scanning (Array of Bytes / AoB scanning).",
                    "A pattern signature is a unique sequence of machine code bytes representing a function's prologue or unique instruction sequence. Bytes that change between builds (such as memory offsets, global addresses, or register indices) are designated as wildcards (`?`). At startup, the mod scans the game's executable memory for the pattern and dynamically resolves the function's new address."
                ],
                "example": "Signature: \"48 8B 05 ? ? ? ? 48 85 C0 74 12\" (wildcards match any bytes in relative displacements).",
                "pitfall": "Choosing a pattern signature that is too short can produce false-positive matches elsewhere in the executable.",
                "question": {
                    "id": "mod-rev-sig-q",
                    "prompt": "Why do pattern scanners use wildcard bytes ('?') in signature strings?",
                    "options": [
                        {"id": "a", "text": "To skip variable offsets and addresses that change across game updates or builds"},
                        {"id": "b", "text": "To tell the CPU to execute random instructions"},
                        {"id": "c", "text": "Because C++ string literals cannot store hex characters"}
                    ],
                    "answerId": "a",
                    "explanation": "Wildcards allow signatures to match fixed opcode instructions while ignoring variable displacement bytes that change when the game is recompiled.",
                    "lessonId": "mod-rev-signatures"
                }
            }
        ],
        "steps": [
            "Examine `mod-reverse-engineering.cpp` to understand how the `vptr` is located at offset 0 of the polymorphic `Monster` object.",
            "Inspect the shadow vtable creation: notice how the method pointer at index 2 (`takeDamage`) is redirected to `hookedTakeDamage`.",
            "Compile and run the program: `g++ -std=c++17 mod-reverse-engineering.cpp -o mod_rev`.",
            "Verify that the hook successfully intercepts damage, reduces it to 0, and that the pattern scanner locates the bytecode sequence."
        ],
        "challenge": {
            "task": "Create a signature parsing function that accepts an IDA-style signature string (e.g. `\"48 89 E5 48 83 ? 20\"`) and automatically generates the pattern byte array and mask string for `PatternScanner::findPattern`.",
            "acceptance": [
                "Function parsing space-separated hex bytes and question marks",
                "Correct generation of pattern bytes and mask strings (`x` for byte, `?` for wildcard)",
                "Verification scan against a byte buffer confirming match"
            ]
        },
        "sources": [
            {
                "title": "Microsoft x64 Calling Convention and Stack Frame Usage",
                "url": "https://learn.microsoft.com/en-us/cpp/build/x64-calling-convention"
            },
            {
                "title": "Ghidra Software Reverse Engineering Framework",
                "url": "https://ghidra-sre.org/"
            }
        ],
        "exam": {
            "passPercent": 80,
            "questions": [
                {
                    "id": "mod-rev-e1",
                    "prompt": "What assembly mnemonic instruction marks the return from a subfunction in x86-64 machine code?",
                    "options": [
                        {"id": "a", "text": "RET"},
                        {"id": "b", "text": "NOP"},
                        {"id": "c", "text": "HLT"}
                    ],
                    "answerId": "a",
                    "explanation": "The `RET` instruction pops the return address off the stack and transfers CPU control back to the caller.",
                    "lessonId": "mod-rev-disasm-patterns"
                },
                {
                    "id": "mod-rev-e2",
                    "prompt": "In 64-bit Windows, how many bytes of 'shadow space' (homing space) must a caller allocate on the stack before invoking a function?",
                    "options": [
                        {"id": "a", "text": "32 bytes (4 pointer slots)"},
                        {"id": "b", "text": "0 bytes"},
                        {"id": "c", "text": "128 bytes"}
                    ],
                    "answerId": "a",
                    "explanation": "Microsoft x64 ABI requires 32 bytes of shadow space on the stack immediately preceding any function call for saving RCX, RDX, R8, R9.",
                    "lessonId": "mod-rev-call-conv"
                },
                {
                    "id": "mod-rev-e3",
                    "prompt": "Where is the implicit virtual method table pointer (vptr) located inside a standard C++ polymorphic object instance?",
                    "options": [
                        {"id": "a", "text": "At offset +0x0 (the very beginning of the object)"},
                        {"id": "b", "text": "In the Windows Registry"},
                        {"id": "c", "text": "At the very end of the computer's physical RAM"}
                    ],
                    "answerId": "a",
                    "explanation": "C++ compilers place the `vptr` as the first member variable (offset 0) of any class containing virtual functions.",
                    "lessonId": "mod-rev-vmt-tables"
                },
                {
                    "id": "mod-rev-e4",
                    "prompt": "What is the primary benefit of Array-of-Bytes (AoB) pattern scanning compared to hardcoding function addresses?",
                    "options": [
                        {"id": "a", "text": "Pattern scanning reliably locates functions even after minor game updates and recompilations"},
                        {"id": "b", "text": "Pattern scanning compresses the game's executable by 50%"},
                        {"id": "c", "text": "Pattern scanning enables multi-GPU ray tracing"}
                    ],
                    "answerId": "a",
                    "explanation": "Pattern scanning searches for unique machine code instructions rather than static addresses, remaining resilient across minor game updates.",
                    "lessonId": "mod-rev-signatures"
                },
                {
                    "id": "mod-rev-e5",
                    "prompt": "If a pattern signature produces multiple identical matches in an executable, what should the modder do?",
                    "options": [
                        {"id": "a", "text": "Lengthen the signature by including additional adjacent unique opcode bytes"},
                        {"id": "b", "text": "Replace all wildcards with zeroes"},
                        {"id": "c", "text": "Delete the disassembler software"}
                    ],
                    "answerId": "a",
                    "explanation": "Extending the pattern length with additional distinguishing opcode bytes ensures a unique, single match across the entire executable.",
                    "lessonId": "mod-rev-signatures"
                }
            ]
        }
    }
]
