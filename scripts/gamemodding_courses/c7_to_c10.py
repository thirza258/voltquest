"""Courses 7 to 10 for the Game Modding curriculum."""

COURSES_7_TO_10 = [
    {
        "id": "mod-unreal-engine",
        "version": 1,
        "order": 7,
        "title": "7. Unreal Engine Modding & Reflection Systems",
        "summary": "Explore Unreal Engine 4/5 reflection: UObject hierarchies, GUObjectArray iteration, universal ProcessEvent hooking, C++ SDK generation, and UE4SS scripting.",
        "difficulty": "Advanced",
        "minutes": 35,
        "codeExt": "cpp",
        "code": """// Unreal Engine Reflection & ProcessEvent Hook Architecture (C++17)
// Demonstrates how Unreal Engine represents objects, classes, and functions,
// how GUObjectArray enables runtime introspection, and how hooking ProcessEvent intercepts all calls.

#include <iostream>
#include <vector>
#include <string>
#include <unordered_map>
#include <functional>
#include <memory>
#include <cstdint>

// Forward declaration
class UClass;

// Base UObject in Unreal Engine reflection
class UObject {
public:
    uint32_t internalIndex;
    UClass* classPrivate;
    std::string name;

    UObject(uint32_t index, const std::string& name, UClass* uclass)
        : internalIndex(index), classPrivate(uclass), name(name) {}

    virtual ~UObject() = default;

    std::string getFullName() const;
};

// Represents a reflected function in Unreal Engine
class UFunction : public UObject {
public:
    uint32_t functionFlags;
    size_t paramSize;

    UFunction(uint32_t index, const std::string& name, UClass* parentClass, size_t pSize)
        : UObject(index, name, nullptr), functionFlags(0), paramSize(pSize) {}
};

// Represents a reflected class
class UClass : public UObject {
public:
    std::unordered_map<std::string, UFunction*> functions;

    UClass(uint32_t index, const std::string& name)
        : UObject(index, name, nullptr) {}

    void addFunction(UFunction* fn) {
        functions[fn->name] = fn;
    }
};

std::string UObject::getFullName() const {
    return (classPrivate ? classPrivate->name + " " : "Object ") + name;
}

// Global Unreal Object Array (GUObjectArray)
class GlobalObjectArray {
public:
    static GlobalObjectArray& get() {
        static GlobalObjectArray instance;
        return instance;
    }

    void add(UObject* obj) {
        objects.push_back(obj);
    }

    UObject* findObject(const std::string& exactName) {
        for (auto* obj : objects) {
            if (obj && obj->name == exactName) return obj;
        }
        return nullptr;
    }

    size_t count() const { return objects.size(); }
    UObject* getByIndex(size_t i) { return objects[i]; }

private:
    std::vector<UObject*> objects;
};

// Universal Engine Dispatcher: ProcessEvent
// In Unreal Engine, almost all Blueprint and native RPC calls funnel through UObject::ProcessEvent
using ProcessEventFn = void(*)(UObject* context, UFunction* function, void* params);
ProcessEventFn originalProcessEvent = nullptr;

// Function parameter payload for "ReceiveDamage"
struct DamageParams {
    float damageAmount;
    uint32_t damageType;
};

// Engine's default ProcessEvent implementation
void engineProcessEvent(UObject* context, UFunction* function, void* params) {
    if (function->name == "ReceiveDamage") {
        auto* p = reinterpret_cast<DamageParams*>(params);
        std::cout << "  [UnrealEngine] Executing ReceiveDamage on " << context->name 
                  << " -> Applied Damage: " << p->damageAmount << "\\n";
    }
}

// Custom Mod Hook on ProcessEvent
void hookedProcessEvent(UObject* context, UFunction* function, void* params) {
    // Intercept specific reflected function
    if (function && function->name == "ReceiveDamage") {
        auto* p = reinterpret_cast<DamageParams*>(params);
        std::cout << "[Mod:UEProcessEvent] Intercepted " << function->name 
                  << " on " << context->name << " (Original damage: " << p->damageAmount << ")\\n";

        // GodMode mod logic: if target is PlayerCharacter, set damage to 0
        if (context->name == "BP_PlayerCharacter_C") {
            std::cout << "[Mod:UEProcessEvent] Target is Player! Nullifying damage to 0.0f!\\n";
            p->damageAmount = 0.0f;
        }
    }

    // Call original engine dispatcher
    originalProcessEvent(context, function, params);
}

int main() {
    std::cout << "=== Unreal Engine Reflection & ProcessEvent Demo ===\\n";

    // Setup simulated reflection objects
    auto characterClass = std::make_unique<UClass>(1, "BP_PlayerCharacter_C");
    auto damageFunc = std::make_unique<UFunction>(2, "ReceiveDamage", characterClass.get(), sizeof(DamageParams));
    characterClass->addFunction(damageFunc.get());

    auto playerInstance = std::make_unique<UObject>(3, "BP_PlayerCharacter_C", characterClass.get());
    auto enemyInstance = std::make_unique<UObject>(4, "BP_Goblin_C", characterClass.get());

    // Register into GUObjectArray
    GlobalObjectArray::get().add(characterClass.get());
    GlobalObjectArray::get().add(damageFunc.get());
    GlobalObjectArray::get().add(playerInstance.get());
    GlobalObjectArray::get().add(enemyInstance.get());

    std::cout << "[Reflection] Total objects registered in GUObjectArray: " 
              << GlobalObjectArray::get().count() << "\\n";

    // Call unhooked ProcessEvent
    originalProcessEvent = &engineProcessEvent;
    DamageParams enemyDamage{45.0f, 1};
    std::cout << "\\n[Run 1] Unhooked Call on Goblin:\\n";
    originalProcessEvent(enemyInstance.get(), damageFunc.get(), &enemyDamage);

    // Install ProcessEvent Hook
    std::cout << "\\n[Mod] Hooking UObject::ProcessEvent with custom detour...\\n";
    ProcessEventFn activeDispatcher = &hookedProcessEvent;

    // Call through hook: player damage should be nullified
    DamageParams playerDamage{100.0f, 1};
    std::cout << "\\n[Run 2] Hooked Call on PlayerCharacter (Lethal 100 Damage):\\n";
    activeDispatcher(playerInstance.get(), damageFunc.get(), &playerDamage);

    return 0;
}
""",
        "expected": "Compiles with C++17 (`g++ -std=c++17 mod-unreal-engine.cpp`). Demonstrates Unreal Engine reflection, iterating `GUObjectArray`, and hooking `ProcessEvent` to intercept `ReceiveDamage` calls, successfully neutralizing lethal player damage to 0.",
        "lessons": [
            {
                "id": "mod-ue-core-reflection",
                "title": "Unreal reflection: UObject, UClass & UFunction",
                "paragraphs": [
                    "Unreal Engine is built upon a proprietary, high-performance C++ reflection system. Because native C++ lacks built-in runtime reflection, Epic's Unreal Header Tool (UHT) parses macros (`UCLASS()`, `UFUNCTION()`, `UPROPERTY()`) during compilation to generate metadata structs describing every class, method, property, and memory offset.",
                    "Every reflected entity inherits from `UObject`. A `UClass` describes an object's type and contains a linked list of fields (`FProperty`) and functions (`UFunction`). By reading this reflection metadata at runtime, modders can discover private variables, inspect struct offsets, and invoke engine functions without needing game source code."
                ],
                "example": "UObject* obj = GUObjectArray->FindObject(\"BP_Hero_C\"); UFunction* fn = obj->Class->FindFunctionByName(\"SetInvincible\");",
                "pitfall": "Attempting to access non-reflected C++ classes through the reflection system will fail because only entities marked with `UCLASS()` are tracked in the reflection tables.",
                "question": {
                    "id": "mod-ue-ref-q",
                    "prompt": "What base class does every reflected entity in Unreal Engine inherit from?",
                    "options": [
                        {"id": "a", "text": "UObject"},
                        {"id": "b", "text": "MonoBehaviour"},
                        {"id": "c", "text": "std::vector"}
                    ],
                    "answerId": "a",
                    "explanation": "In Unreal Engine, all reflected classes, components, functions, and blueprints derive from `UObject`.",
                    "lessonId": "mod-ue-core-reflection"
                }
            },
            {
                "id": "mod-ue-object-array",
                "title": "GUObjectArray & runtime object discovery",
                "paragraphs": [
                    "All active `UObject` instances in an Unreal Engine game are registered in a global array known as `GUObjectArray`. The array is divided into fixed chunks (typically 65,536 objects per chunk) to avoid large single-heap reallocations during gameplay.",
                    "Modders locate `GUObjectArray` via AoB pattern scanning at startup. By iterating through the array, a mod can locate the active `GWorld`, find the local `APlayerController`, enumerate all spawned enemy actors, or dump the game's entire class hierarchy into complete C++ SDK headers."
                ],
                "example": "for (int i = 0; i < GUObjectArray->GetObjectArrayNum(); ++i) { UObject* obj = GUObjectArray->GetObjectPtr(i); }",
                "pitfall": "Dereferencing entries in GUObjectArray without checking the object's `Flags` for `RF_PendingKill` or `RF_BeginDestroyed` leads to access violations on garbage-collected objects.",
                "question": {
                    "id": "mod-ue-array-q",
                    "prompt": "What is the primary role of GUObjectArray in Unreal Engine modding?",
                    "options": [
                        {"id": "a", "text": "It provides a global lookup table of all active UObject instances, allowing modders to discover actors and reflection data at runtime"},
                        {"id": "b", "text": "It handles sound card mixing for Dolby Atmos"},
                        {"id": "c", "text": "It compiles C++ source files into Python bytecode"}
                    ],
                    "answerId": "a",
                    "explanation": "GUObjectArray tracks every instantiated UObject in memory, making it the gateway for discovering world state, players, and classes.",
                    "lessonId": "mod-ue-object-array"
                }
            },
            {
                "id": "mod-ue-processevent",
                "title": "The ProcessEvent hook",
                "paragraphs": [
                    "In Unreal Engine, `UObject::ProcessEvent(UFunction* Function, void* Parms)` is the universal execution bridge between native C++ and Blueprint scripting. Whenever a Blueprint node executes, an animation notify triggers, or a networked RPC arrives, the engine calls `ProcessEvent`.",
                    "Because nearly all high-level gameplay passes through this single function, hooking `ProcessEvent` provides unprecedented modding leverage. A single detour hook on `ProcessEvent` can log every function call in the game, intercept input commands, modify damage calculations, or cancel unwanted gameplay events entirely."
                ],
                "example": "void HookedProcessEvent(UObject* context, UFunction* function, void* parms) { if (function->GetName() == \"Die\") return; Original(context, function, parms); }",
                "pitfall": "Adding heavy string comparisons or logging to every `ProcessEvent` call tanks performance because the engine calls `ProcessEvent` thousands of times per second.",
                "question": {
                    "id": "mod-ue-pe-q",
                    "prompt": "Why is hooking UObject::ProcessEvent considered the most powerful single hook in Unreal Engine modding?",
                    "options": [
                        {"id": "a", "text": "Nearly all Blueprint functions, animation notifies, and gameplay events pass through ProcessEvent, enabling universal interception"},
                        {"id": "b", "text": "It unlocks hidden graphics settings in the monitor hardware"},
                        {"id": "c", "text": "It automatically translates game audio into text"}
                    ],
                    "answerId": "a",
                    "explanation": "ProcessEvent is the central dispatcher for Unreal's Blueprint virtual machine and reflected RPCs, making it a universal interception point.",
                    "lessonId": "mod-ue-processevent"
                }
            },
            {
                "id": "mod-ue-sdk-ue4ss",
                "title": "SDK generation & UE4SS",
                "paragraphs": [
                    "Reverse engineering every struct offset by hand is tedious. Instead, modders use SDK Generators (or tools like UE4SS - Unreal Engine 4/5 Scripting System) that traverse `GUObjectArray`, read `FProperty` offsets, and automatically generate compilable C++ header files reflecting the exact classes of the game.",
                    "UE4SS also embeds a Lua scripting engine directly into Unreal Engine games. Modders can author Lua scripts that bind to `UFunction` hooks, query `UObject` instances, and spawn custom Blueprint mods without writing or compiling a single line of C++."
                ],
                "example": "UE4SS Lua hook: RegisterHook(\"/Script/Engine.PlayerController:ClientTravel\", function(self, URL) print(URL) end)",
                "pitfall": "Using an SDK generated from an older version of a game causes memory offset shifts if the game developers added or reordered class properties.",
                "question": {
                    "id": "mod-ue-sdk-q",
                    "prompt": "What does a C++ SDK generator for Unreal Engine do?",
                    "options": [
                        {"id": "a", "text": "Dumps runtime reflection data from GUObjectArray to generate exact C++ class headers with member offsets"},
                        {"id": "b", "text": "Reinstalls the operating system"},
                        {"id": "c", "text": "Converts 3D models into MP3 audio files"}
                    ],
                    "answerId": "a",
                    "explanation": "An SDK generator iterates the engine's reflection structures and outputs accurate C++ headers with correct member offsets and virtual functions.",
                    "lessonId": "mod-ue-sdk-ue4ss"
                }
            }
        ],
        "steps": [
            "Examine `mod-unreal-engine.cpp` to understand how `UObject`, `UClass`, and `UFunction` represent reflection.",
            "Review how `GlobalObjectArray` registers objects and allows querying them at runtime.",
            "Observe the `hookedProcessEvent` function inspecting parameters and modifying `damageAmount` for `BP_PlayerCharacter_C`.",
            "Compile and run the program: `g++ -std=c++17 mod-unreal-engine.cpp -o mod_ue` to verify that player damage is nullified to 0.0f."
        ],
        "challenge": {
            "task": "Add a new reflected function `AddExperience(int xp)` to `BP_PlayerCharacter_C`. Update the `ProcessEvent` hook to intercept this call and double all granted experience points.",
            "acceptance": [
                "Definition of `AddExperience` UFunction and parameter struct",
                "ProcessEvent hook logic intercepting `AddExperience`",
                "Execution test verifying that granted XP is multiplied by 2"
            ]
        },
        "sources": [
            {
                "title": "Unreal Engine C++ Reflection System Architecture",
                "url": "https://dev.epicgames.com/documentation/en-us/unreal-engine/epic-cplusplus-coding-standard-for-unreal-engine"
            },
            {
                "title": "UE4SS: Unreal Engine Scripting System and Mod Loader",
                "url": "https://github.com/UE4SS-RE/RE-UE4SS"
            }
        ],
        "exam": {
            "passPercent": 80,
            "questions": [
                {
                    "id": "mod-ue-e1",
                    "prompt": "What tool does Epic Games use to generate C++ reflection metadata during Unreal Engine compilation?",
                    "options": [
                        {"id": "a", "text": "Unreal Header Tool (UHT)"},
                        {"id": "b", "text": "Webpack"},
                        {"id": "c", "text": "Babel"}
                    ],
                    "answerId": "a",
                    "explanation": "UHT parses macros like `UCLASS()` and `UPROPERTY()` to generate reflection metadata files.",
                    "lessonId": "mod-ue-core-reflection"
                },
                {
                    "id": "mod-ue-e2",
                    "prompt": "In Unreal Engine, what macro marks a C++ function as accessible to Blueprints and the reflection system?",
                    "options": [
                        {"id": "a", "text": "UFUNCTION()"},
                        {"id": "b", "text": "EXPORT()"},
                        {"id": "c", "text": "PUBLIC()"}
                    ],
                    "answerId": "a",
                    "explanation": "The `UFUNCTION()` macro registers the method with the reflection system, generating a corresponding `UFunction` object.",
                    "lessonId": "mod-ue-core-reflection"
                },
                {
                    "id": "mod-ue-e3",
                    "prompt": "What is the function signature of UObject::ProcessEvent?",
                    "options": [
                        {"id": "a", "text": "void ProcessEvent(UFunction* Function, void* Parms)"},
                        {"id": "b", "text": "int ProcessEvent(char* str)"},
                        {"id": "c", "text": "void ProcessEvent()"}
                    ],
                    "answerId": "a",
                    "explanation": "ProcessEvent accepts a pointer to the `UFunction` being invoked and a raw pointer to its parameter memory block.",
                    "lessonId": "mod-ue-processevent"
                },
                {
                    "id": "mod-ue-e4",
                    "prompt": "What popular community tool provides a Lua scripting mod loader and C++ header dumper for Unreal Engine games?",
                    "options": [
                        {"id": "a", "text": "UE4SS (Unreal Engine Scripting System)"},
                        {"id": "b", "text": "Cheat Engine 1.0"},
                        {"id": "c", "text": "Notepad"}
                    ],
                    "answerId": "a",
                    "explanation": "UE4SS is widely used across UE4 and UE5 games for dumping SDKs, Blueprint modding, and Lua script injection.",
                    "lessonId": "mod-ue-sdk-ue4ss"
                },
                {
                    "id": "mod-ue-e5",
                    "prompt": "How can a mod determine if an object found in GUObjectArray is an active Pawn vs a static asset?",
                    "options": [
                        {"id": "a", "text": "By inspecting obj->classPrivate->name or walking the UClass super-struct inheritance chain"},
                        {"id": "b", "text": "By checking the file size on the hard drive"},
                        {"id": "c", "text": "By deleting the object from memory"}
                    ],
                    "answerId": "a",
                    "explanation": "Every UObject has a pointer to its `UClass`, whose inheritance chain (`SuperStruct`) indicates whether it derives from `APawn` or `AActor`.",
                    "lessonId": "mod-ue-object-array"
                }
            ]
        }
    },
    {
        "id": "mod-lua-scripting",
        "version": 1,
        "order": 8,
        "title": "8. Embedded Scripting Engines & Lua Mods",
        "summary": "Integrate and mod embedded scripting runtimes: the Lua C API, virtual stack manipulation, exposing native C++ functions, environment sandboxing, and mod event dispatchers.",
        "difficulty": "Intermediate",
        "minutes": 25,
        "codeExt": "cpp",
        "code": """// Embedded Lua Scripting Engine & Modding Bridge (C++17)
// Demonstrates how game engines embed Lua, expose native C++ functions to scripts,
// sandbox the execution environment, and dispatch gameplay events to user mods.

#include <iostream>
#include <string>
#include <vector>
#include <unordered_map>
#include <functional>
#include <memory>
#include <cstdint>

// Simulated Lua Virtual Stack & State Machine
class LuaVirtualState {
public:
    using CFunction = int(*)(LuaVirtualState* L);

    void pushNumber(double num) { stack.push_back({Type::NUMBER, num, ""}); }
    void pushString(const std::string& str) { stack.push_back({Type::STRING, 0.0, str}); }
    void pushBoolean(bool b) { stack.push_back({Type::BOOLEAN, b ? 1.0 : 0.0, ""}); }

    double toNumber(int idx) {
        auto& item = getItem(idx);
        return item.numVal;
    }

    std::string toString(int idx) {
        auto& item = getItem(idx);
        return item.strVal;
    }

    int getTop() const { return static_cast<int>(stack.size()); }
    void pop(int count) {
        for (int i = 0; i < count && !stack.empty(); ++i) stack.pop_back();
    }

    void registerFunction(const std::string& name, CFunction fn) {
        globals[name] = fn;
    }

    bool callFunction(const std::string& name, int argCount) {
        auto it = globals.find(name);
        if (it != globals.end()) {
            it->second(this);
            return true;
        }
        return false;
    }

    // Sandboxing: Strip unsafe global capabilities
    void applySandbox() {
        std::cout << "[Sandbox] Stripping unsafe standard libraries (io, os, debug)...\\n";
        globals.erase("io");
        globals.erase("os");
        globals.erase("loadfile");
        globals.erase("dofile");
    }

private:
    enum class Type { NUMBER, STRING, BOOLEAN };
    struct StackItem {
        Type type;
        double numVal;
        std::string strVal;
    };
    std::vector<StackItem> stack;
    std::unordered_map<std::string, CFunction> globals;

    StackItem& getItem(int idx) {
        if (idx < 0) idx = static_cast<int>(stack.size()) + idx;
        return stack[idx];
    }
};

// Simulated Host Game Engine State
struct Player {
    std::string name = "Cadet";
    int health = 100;
    int gold = 50;
};
Player g_player;

// Native C++ Functions Exposed to Lua Scripts
int l_getPlayerHealth(LuaVirtualState* L) {
    L->pushNumber(g_player.health);
    return 1; // 1 return value pushed onto stack
}

int l_addGold(LuaVirtualState* L) {
    double amount = L->toNumber(-1);
    g_player.gold += static_cast<int>(amount);
    std::cout << "[Engine:Native] Added " << amount << " gold! New balance: " << g_player.gold << "\\n";
    L->pop(1);
    return 0;
}

int l_logMessage(LuaVirtualState* L) {
    std::string msg = L->toString(-1);
    std::cout << "[Lua:Mod] " << msg << "\\n";
    L->pop(1);
    return 0;
}

// User Mod Event Dispatcher
class ModEventBus {
public:
    using ModEventHandler = std::function<void(const std::string&, int)>;

    void subscribe(const std::string& eventName, ModEventHandler handler) {
        listeners[eventName].push_back(handler);
    }

    void trigger(const std::string& eventName, const std::string& context, int value) {
        std::cout << "[EventBus] Triggering event '" << eventName << "'...\\n";
        for (auto& handler : listeners[eventName]) {
            handler(context, value);
        }
    }

private:
    std::unordered_map<std::string, std::vector<ModEventHandler>> listeners;
};

int main() {
    std::cout << "=== Embedded Lua Scripting & Modding Demonstration ===\\n";

    LuaVirtualState L;

    // Register host game functions into Lua
    L.registerFunction("getPlayerHealth", l_getPlayerHealth);
    L.registerFunction("addGold", l_addGold);
    L.registerFunction("logMessage", l_logMessage);

    // Apply strict sandboxing to protect host machine
    L.applySandbox();

    // Setup event-driven mod pipeline
    ModEventBus bus;

    // Simulate a User Mod (script logic registered to event)
    std::cout << "\\n[ModLoader] Loading user mod: 'BountyHunter.lua'\\n";
    bus.subscribe("on_monster_killed", [&](const std::string& monsterType, int reward) {
        // Lua script callback execution
        L.pushString("Killed " + monsterType + "! Claiming bounty.");
        L.callFunction("logMessage", 1);

        // Grant gold via native engine bridge
        L.pushNumber(reward * 2); // 2x Bounty Mod feature!
        L.callFunction("addGold", 1);
    });

    // Simulate game event occurring
    std::cout << "\\n[Game] Player defeated a Skeleton Champion!\\n";
    bus.trigger("on_monster_killed", "Skeleton Champion", 25);

    std::cout << "\\n[Game] Final Player Status: Gold=" << g_player.gold << ", Health=" << g_player.health << "\\n";
    return 0;
}
""",
        "expected": "Compiles with C++17 (`g++ -std=c++17 mod-lua-scripting.cpp`). Demonstrates registering native C++ functions, enforcing sandbox restrictions against OS/IO libraries, and dispatching game events (`on_monster_killed`) into mod callback logic that doubles the bounty reward.",
        "lessons": [
            {
                "id": "mod-lua-embedding",
                "title": "Why games embed Lua scripting",
                "paragraphs": [
                    "Many of the most moddable games in history—including World of Warcraft, Factorio, Civilization, Garry's Mod, and Don't Starve—embed Lua as their scripting language. Lua is ultra-lightweight (entire compiler and VM under 300 KB), extremely fast, and designed from the ground up for seamless embedding inside host C and C++ engines.",
                    "By decoupling high-level game logic (quests, item definitions, UI behaviors, skill balancing) from the compiled C++ core, game designers and community modders can alter mechanics, iterate on designs, and reload scripts instantly without recompiling the executable."
                ],
                "example": "Game Engine (C++): Rendering, Physics, Networking <---> Lua Scripts: Quests, Spells, Item stats, Mod hooks.",
                "pitfall": "Executing complex tight loops (like pathfinding over thousands of nodes) in Lua can cause noticeable CPU bottlenecks compared to native C++ implementations.",
                "question": {
                    "id": "mod-lua-emb-q",
                    "prompt": "Why do game developers embed scripting languages like Lua instead of writing all game logic in C++?",
                    "options": [
                        {"id": "a", "text": "To allow rapid iteration, instant script reloading, and safe modding without needing full C++ recompilations"},
                        {"id": "b", "text": "Because C++ cannot run on modern 64-bit operating systems"},
                        {"id": "c", "text": "To automatically eliminate all 3D geometry from the game"}
                    ],
                    "answerId": "a",
                    "explanation": "Scripting languages decouple gameplay rules from the low-level engine, enabling rapid iteration and user modding without code recompilation.",
                    "lessonId": "mod-lua-embedding"
                }
            },
            {
                "id": "mod-lua-c-api",
                "title": "The Lua C API & virtual stack",
                "paragraphs": [
                    "Communication between the host C++ application and the Lua interpreter occurs through a shared virtual stack managed by `lua_State*`. Every function argument, return value, table access, and string passes through this stack.",
                    "Stack indexing operates in two directions: positive indices reference elements from the bottom of the stack up (`1` is the first element pushed), while negative indices reference elements from the top down (`-1` is the most recent element pushed). Functions adhere to strict stack discipline: C functions pop their inputs and return the exact count of return values pushed."
                ],
                "example": "lua_pushnumber(L, 42.0); lua_pushstring(L, \"hero\"); // -1 is \"hero\", -2 is 42.0",
                "pitfall": "Failing to balance the Lua stack by pushing values without popping them causes stack overflow crashes over extended gameplay sessions.",
                "question": {
                    "id": "mod-lua-stk-q",
                    "prompt": "In the Lua C API, what does a stack index of -1 represent?",
                    "options": [
                        {"id": "a", "text": "The top element of the stack (the most recently pushed value)"},
                        {"id": "b", "text": "An invalid error code indicating out-of-memory"},
                        {"id": "c", "text": "The bottom-most element of the stack"}
                    ],
                    "answerId": "a",
                    "explanation": "Negative indices index from the top of the stack downwards, where -1 is always the topmost (latest) item.",
                    "lessonId": "mod-lua-c-api"
                }
            },
            {
                "id": "mod-lua-c-bindings",
                "title": "Exposing engine functions to Lua",
                "paragraphs": [
                    "To allow mods to interact with the game world, the host engine registers native C functions with the Lua environment using `lua_register` or `lua_pushcfunction`. Functions must conform to the `lua_CFunction` typedef: `int (*lua_CFunction)(lua_State *L)`.",
                    "Inside the registered C function, the developer reads arguments from the stack using functions like `lua_tointeger` or `lua_tostring`, performs the engine logic (e.g. spawns an entity or changes player health), pushes any result values back onto the stack, and returns an integer specifying how many results were pushed."
                ],
                "example": "int MySpawn(lua_State* L) { const char* name = lua_tostring(L, 1); SpawnActor(name); return 0; }",
                "pitfall": "Assuming arguments passed from Lua are valid without calling type check functions (`lua_isstring`, `lua_isnumber`) causes memory corruption if a script passes unexpected types.",
                "question": {
                    "id": "mod-lua-bind-q",
                    "prompt": "What does the integer return value of a lua_CFunction represent?",
                    "options": [
                        {"id": "a", "text": "The number of return values the function pushed onto the Lua stack for the caller"},
                        {"id": "b", "text": "The execution time in milliseconds"},
                        {"id": "c", "text": "The exit status code of the operating system"}
                    ],
                    "answerId": "a",
                    "explanation": "In the Lua C API, the integer returned by a C-function tells the Lua runtime how many values on the stack should be returned to the script.",
                    "lessonId": "mod-lua-c-bindings"
                }
            },
            {
                "id": "mod-lua-sandboxing",
                "title": "Sandboxing & event dispatch",
                "paragraphs": [
                    "When allowing players to download community mods from mod repositories or Steam Workshop, security is paramount. A malicious mod script could attempt to read private user files, download malware, or execute arbitrary OS shell commands using standard Lua libraries.",
                    "Engine developers enforce sandboxing by stripping dangerous standard packages—specifically `io` (file access), `os` (command execution), `package` (loading arbitrary C modules), and `debug`. The game provides custom, safe replacement APIs and dispatches events via registered callback tables (e.g., `events.on_player_damaged`)."
                ],
                "example": "lua_pushnil(L); lua_setglobal(L, \"os\"); // Removes the OS package completely",
                "pitfall": "Leaving the `debug` library enabled in sandboxed Lua environments allows malicious scripts to extract upvalues and escape the sandbox environment.",
                "question": {
                    "id": "mod-lua-sand-q",
                    "prompt": "Why must game engines sandbox embedded Lua environments before loading community mods?",
                    "options": [
                        {"id": "a", "text": "To prevent malicious scripts from executing arbitrary OS shell commands or reading private files from the player's disk"},
                        {"id": "b", "text": "To reduce electricity consumption by the GPU"},
                        {"id": "c", "text": "Because Lua cannot run on computers connected to the Internet"}
                    ],
                    "answerId": "a",
                    "explanation": "Sandboxing strips unsafe capabilities like file I/O and process execution, ensuring downloaded mods cannot compromise the player's system.",
                    "lessonId": "mod-lua-sandboxing"
                }
            }
        ],
        "steps": [
            "Examine `mod-lua-scripting.cpp` to understand how the simulated Lua virtual stack operates.",
            "Review how `l_getPlayerHealth` and `l_addGold` are bound and exposed to the script environment.",
            "Observe the `applySandbox()` function removing dangerous global capabilities.",
            "Compile and run the program: `g++ -std=c++17 mod-lua-scripting.cpp -o mod_lua` and verify that the mod doubles the event reward from 25 to 50."
        ],
        "challenge": {
            "task": "Register a new native C function `l_teleportPlayer(x, y)` that takes two number arguments from the stack, updates player coordinates, and returns a boolean confirming success.",
            "acceptance": [
                "Implementation of `l_teleportPlayer` adhering to `lua_CFunction` conventions",
                "Registration of function in `LuaVirtualState`",
                "Script execution verification with coordinates updated and boolean result returned"
            ]
        },
        "sources": [
            {
                "title": "Lua 5.4 Reference Manual: The C API",
                "url": "https://www.lua.org/manual/5.4/manual.html#4"
            },
            {
                "title": "Lua Sandboxing and Safe Execution Best Practices",
                "url": "http://lua-users.org/wiki/SandBoxes"
            }
        ],
        "exam": {
            "passPercent": 80,
            "questions": [
                {
                    "id": "mod-lua-e1",
                    "prompt": "Which of the following games famously uses embedded Lua for its extensive user interface and add-on mod ecosystem?",
                    "options": [
                        {"id": "a", "text": "World of Warcraft"},
                        {"id": "b", "text": "Microsoft Excel 95"},
                        {"id": "c", "text": "Windows Notepad"}
                    ],
                    "answerId": "a",
                    "explanation": "World of Warcraft embeds Lua for its entire UI and add-on scripting ecosystem, allowing players to build custom interfaces.",
                    "lessonId": "mod-lua-embedding"
                },
                {
                    "id": "mod-lua-e2",
                    "prompt": "If a C++ function pushes 3 values onto the Lua stack, what number must it return?",
                    "options": [
                        {"id": "a", "text": "3"},
                        {"id": "b", "text": "0"},
                        {"id": "c", "text": "-1"}
                    ],
                    "answerId": "a",
                    "explanation": "The return value of a `lua_CFunction` specifies the count of return items pushed onto the stack.",
                    "lessonId": "mod-lua-c-bindings"
                },
                {
                    "id": "mod-lua-e3",
                    "prompt": "Which standard Lua library package provides functions for file reading and writing that should be removed during sandboxing?",
                    "options": [
                        {"id": "a", "text": "io"},
                        {"id": "b", "text": "math"},
                        {"id": "c", "text": "string"}
                    ],
                    "answerId": "a",
                    "explanation": "The `io` library provides file system operations (`io.open`, `io.read`) and must be removed to prevent unauthorized file access.",
                    "lessonId": "mod-lua-sandboxing"
                },
                {
                    "id": "mod-lua-e4",
                    "prompt": "In the Lua C API, what does lua_pop(L, 2) do?",
                    "options": [
                        {"id": "a", "text": "Removes the top 2 elements from the virtual stack"},
                        {"id": "b", "text": "Multiplies the top value by 2"},
                        {"id": "c", "text": "Closes 2 open files"}
                    ],
                    "answerId": "a",
                    "explanation": "`lua_pop(L, n)` removes `n` elements from the top of the stack.",
                    "lessonId": "mod-lua-c-api"
                },
                {
                    "id": "mod-lua-e5",
                    "prompt": "What happens if a mod script contains an infinite loop (`while true do end`) in a single-threaded game engine?",
                    "options": [
                        {"id": "a", "text": "The entire game freezes because the Lua execution thread never yields back to the host game loop"},
                        {"id": "b", "text": "Lua automatically launches a separate satellite process"},
                        {"id": "c", "text": "The computer converts the loop into machine code instantly"}
                    ],
                    "answerId": "a",
                    "explanation": "Because Lua scripts typically run synchronously on the main thread, an unyielding infinite loop blocks the entire host engine.",
                    "lessonId": "mod-lua-embedding"
                }
            ]
        }
    },
    {
        "id": "mod-assets-savefiles",
        "version": 1,
        "order": 9,
        "title": "9. Asset Pipelines, PAK Archives & Save Game Engineering",
        "summary": "Extract, modify, and repack game assets: Unreal PAK / Unity AssetBundles, texture and audio replacement, binary save file deserialization, and CRC32 checksum recalculation.",
        "difficulty": "Intermediate",
        "minutes": 30,
        "codeExt": "py",
        "code": """#!/usr/bin/env python3
# Asset Pipeline & Save File Engineering Utility (Python 3)
# Demonstrates unpacking/repacking custom PAK archives with zlib compression,
# and deserializing binary game save data with CRC32 integrity checksum recalculation.

import struct
import zlib
import binascii

class PakArchive:
    \"\"\"
    Custom PAK format:
    [Header: 4 bytes Magic 'VPAK', 4 bytes FileCount]
    [Index Table: For each file: 32 bytes Name, 4 bytes Offset, 4 bytes CompressedSize, 4 bytes UncompressedSize]
    [Payload Data: Compressed byte payloads]
    \"\"\"
    MAGIC = b'VPAK'

    @staticmethod
    def pack(files_dict: dict) -> bytes:
        file_count = len(files_dict)
        header = struct.pack('<4sI', PakArchive.MAGIC, file_count)

        index_entries = []
        payload_data = bytearray()
        
        # Calculate start of payload data
        index_size = file_count * (32 + 4 + 4 + 4)
        current_offset = len(header) + index_size

        for name, data in files_dict.items():
            compressed = zlib.compress(data)
            comp_size = len(compressed)
            uncomp_size = len(data)
            
            # Pad name to 32 bytes
            name_bytes = name.encode('utf-8')[:32].ljust(32, b'\\x00')
            index_entries.append(struct.pack('<32sIII', name_bytes, current_offset, comp_size, uncomp_size))
            
            payload_data.extend(compressed)
            current_offset += comp_size

        return header + b''.join(index_entries) + bytes(payload_data)

    @staticmethod
    def unpack(archive_bytes: bytes) -> dict:
        magic, file_count = struct.unpack_from('<4sI', archive_bytes, 0)
        if magic != PakArchive.MAGIC:
            raise ValueError("Invalid archive magic header")

        offset = 8
        files = {}
        for _ in range(file_count):
            name_raw, file_offset, comp_size, uncomp_size = struct.unpack_from('<32sIII', archive_bytes, offset)
            name = name_raw.decode('utf-8').rstrip('\\x00')
            
            compressed_data = archive_bytes[file_offset:file_offset + comp_size]
            decompressed_data = zlib.decompress(compressed_data)
            files[name] = decompressed_data
            
            offset += (32 + 4 + 4 + 4)

        return files


class SaveGameManager:
    \"\"\"
    Binary Save Format:
    [4 bytes Magic 'VQSV']
    [4 bytes PlayerLevel]
    [4 bytes PlayerXP]
    [4 bytes PlayerGold]
    [4 bytes CRC32 Checksum of preceding fields]
    \"\"\"
    MAGIC = b'VQSV'

    @staticmethod
    def create_save(level: int, xp: int, gold: int) -> bytes:
        payload = struct.pack('<4sIII', SaveGameManager.MAGIC, level, xp, gold)
        checksum = binascii.crc32(payload) & 0xFFFFFFFF
        return payload + struct.pack('<I', checksum)

    @staticmethod
    def read_and_verify(save_bytes: bytes) -> dict:
        if len(save_bytes) != 20:
            raise ValueError("Corrupt save file length")

        payload = save_bytes[:16]
        expected_crc = struct.unpack('<I', save_bytes[16:20])[0]
        actual_crc = binascii.crc32(payload) & 0xFFFFFFFF

        if actual_crc != expected_crc:
            raise ValueError(f"Save file corrupted or tampered! CRC mismatch: expected {expected_crc:#010x}, got {actual_crc:#010x}")

        magic, level, xp, gold = struct.unpack('<4sIII', payload)
        return {"level": level, "xp": xp, "gold": gold, "crc": hex(expected_crc)}

    @staticmethod
    def modify_gold(save_bytes: bytes, new_gold: int) -> bytes:
        magic, level, xp, _ = struct.unpack('<4sIII', save_bytes[:16])
        new_payload = struct.pack('<4sIII', magic, level, xp, new_gold)
        new_crc = binascii.crc32(new_payload) & 0xFFFFFFFF
        return new_payload + struct.pack('<I', new_crc)


def main():
    print("=== Asset Pipeline & Save File Engineering Demo ===\\n")

    # 1. Test PAK archive packing & unpacking
    original_assets = {
        "textures/player_skin.png": b"FAKE_TEXTURE_DATA_PNG_BYTES_8888",
        "configs/game_balance.json": b'{"hero_speed": 10.0, "gravity": 9.8}',
        "audio/laser_blast.wav": b"RIFF....WAVEfmt ....data..."
    }

    print("[PAK] Packing 3 assets into compressed archive...")
    pak_blob = PakArchive.pack(original_assets)
    print(f"[PAK] Created archive size: {len(pak_blob)} bytes")

    print("[PAK] Unpacking archive and inspecting balance config...")
    unpacked = PakArchive.unpack(pak_blob)
    print(f"[PAK] Extracted config content: {unpacked['configs/game_balance.json'].decode('utf-8')}\\n")

    # 2. Test Binary Save Game & Checksum Modification
    print("[SaveEngine] Generating legitimate player save file...")
    legit_save = SaveGameManager.create_save(level=5, xp=1200, gold=250)
    save_info = SaveGameManager.read_and_verify(legit_save)
    print(f"[SaveEngine] Verified save data: Level {save_info['level']}, Gold {save_info['gold']} (CRC: {save_info['crc']})")

    # Tampering test (naive byte edit without updating CRC)
    print("\\n[SaveEngine] Simulating naive hex edit (overwriting gold without updating CRC)...")
    tampered_bytes = bytearray(legit_save)
    tampered_bytes[12] = 0xFF # Corrupt gold byte
    try:
        SaveGameManager.read_and_verify(bytes(tampered_bytes))
    except ValueError as e:
        print(f"[SaveEngine] Anti-tamper triggered: {e}")

    # Proper Modder Modification (Recalculating CRC32)
    print("\\n[SaveEngine] Applying proper mod: Injecting 999,999 gold and recalculating valid CRC32...")
    modded_save = SaveGameManager.modify_gold(legit_save, 999999)
    modded_info = SaveGameManager.read_and_verify(modded_save)
    print(f"[SaveEngine] Successfully modified! New Gold: {modded_info['gold']} (New Valid CRC: {modded_info['crc']})")

if __name__ == '__main__':
    main()
""",
        "expected": "Executes with Python 3 (`python3 mod-assets-savefiles.py`). Demonstrates creating a compressed VPAK archive and extracting its contents, followed by validating a binary save file, demonstrating how anti-tamper CRC checks detect naive hex edits, and properly recalculating CRC32 for modified gold.",
        "lessons": [
            {
                "id": "mod-asset-replacement",
                "title": "Asset pipelines & virtual filesystems",
                "paragraphs": [
                    "Modern game engines organize game content (textures, meshes, audio, maps) through virtual filesystem (VFS) layers. Instead of reading directly from hard drive folders, engines query mounting points with prioritized search paths.",
                    "Asset modding works by injecting higher-priority mount points. For example, in Unreal Engine, `.pak` files in the `~mods` directory take precedence over base game archives. If a mod archive contains an asset at the exact relative path (`Content/Characters/Hero/Texture.uasset`), the engine loads the modded file without needing to touch original archives."
                ],
                "example": "VFS search order: 1. Game/Mods/*.pak (Priority 100) -> 2. Game/Content/*.pak (Priority 0).",
                "pitfall": "Failing to match the exact internal directory hierarchy and filename of the target asset prevents the VFS from associating the replacement with the original reference.",
                "question": {
                    "id": "mod-asset-vfs-q",
                    "prompt": "How do virtual filesystem (VFS) mounting priorities enable asset replacement mods?",
                    "options": [
                        {"id": "a", "text": "By allowing mod archives with higher mount priorities to intercept file path lookups before base game archives"},
                        {"id": "b", "text": "By compressing all texture files into text documents"},
                        {"id": "c", "text": "By converting 3D meshes into vector fonts"}
                    ],
                    "answerId": "a",
                    "explanation": "Virtual filesystems check high-priority mount directories (like `~mods`) first, returning the modded asset whenever paths match.",
                    "lessonId": "mod-asset-replacement"
                }
            },
            {
                "id": "mod-asset-pak-archives",
                "title": "Archive formats & compression",
                "paragraphs": [
                    "To minimize file fragmentation, load times, and disk space, games package thousands of individual files into monolithic archive containers (Unreal `.pak` / `.ucas` / `.utoc`, Unity AssetBundles, or custom ZIP containers).",
                    "A typical archive contains a header, an index table (recording filenames, offsets, and uncompressed/compressed sizes), and compressed data chunks. Common compression algorithms include zlib (deflate), LZ4 (optimized for lightning-fast decompression), and Zstandard (ZSTD). Understanding the archive header structure is required to unpack, modify, and repack game files."
                ],
                "example": "Archive Header -> Index: [File 'skin.dds', Offset 0x1000, Size 500 KB] -> Payload at 0x1000.",
                "pitfall": "Modifying an extracted file and repacking without recalculating the archive index table offsets causes files to be read from wrong memory boundaries, corrupting the game.",
                "question": {
                    "id": "mod-asset-pak-q",
                    "prompt": "Why must archive repacking tools update the index table offsets when replacing a compressed asset file?",
                    "options": [
                        {"id": "a", "text": "If the modified asset differs in byte size, all subsequent file offsets in the archive shift and must be updated"},
                        {"id": "b", "text": "Because game engines only accept files with even-numbered byte sizes"},
                        {"id": "c", "text": "To prevent the operating system from deleting the file"}
                    ],
                    "answerId": "a",
                    "explanation": "Changing a file's compressed size shifts the starting byte offsets of all subsequent files, requiring complete index table reconstruction.",
                    "lessonId": "mod-asset-pak-archives"
                }
            },
            {
                "id": "mod-save-serialization",
                "title": "Save file formats: binary vs structured",
                "paragraphs": [
                    "Game saves preserve player progress across sessions. Games utilize two primary paradigms: human-readable structured formats (JSON, XML, YAML) or binary serialized formats (custom binary structs, Protocol Buffers, FlatBuffers).",
                    "Binary save files pack raw C/C++ struct bytes directly to disk for speed and compactness. Modding binary saves requires understanding field order, data sizes (e.g. `uint32` vs `float64`), endianness (little-endian on x86/ARM), and struct alignment padding. Using Python's `struct` module allows precise unpacking and packing of binary format layouts."
                ],
                "example": "struct.unpack('<IIf', data[:12]) parses two little-endian unsigned ints and a 32-bit float.",
                "pitfall": "Overlooking struct memory alignment padding (such as 4-byte padding inserted after a 4-byte int before an 8-byte pointer) causes offset alignment errors when editing binary saves.",
                "question": {
                    "id": "mod-save-bin-q",
                    "prompt": "What Python standard library module is used to pack and unpack raw binary C structs when creating save game editors?",
                    "options": [
                        {"id": "a", "text": "struct"},
                        {"id": "b", "text": "tkinter"},
                        {"id": "c", "text": "math"}
                    ],
                    "answerId": "a",
                    "explanation": "Python's `struct` module translates between Python values and C structs represented as binary byte strings using format characters like `<I` or `<f`.",
                    "lessonId": "mod-save-serialization"
                }
            },
            {
                "id": "mod-save-checksums",
                "title": "Checksums, integrity & safe editing",
                "paragraphs": [
                    "To detect save corruption and prevent casual save file tampering, game developers append integrity checksums or cryptographic hashes (CRC32, Adler-32, MD5, SHA-256) to the end of save files.",
                    "When the game loads a save, it recalculates the checksum of the data payload and compares it against the stored checksum. If a modder uses a hex editor to change gold from 100 to 99999 without updating the checksum, the game flags the save as corrupt. Successful save editing tools replicate the checksum algorithm, re-signing the modified payload before saving."
                ],
                "example": "Payload = Level + XP + Gold; ExpectedCRC = crc32(Payload); Compare with saveBytes[16:20].",
                "pitfall": "Failing to exclude the checksum field itself when calculating the checksum hash causes an immediate verification mismatch.",
                "question": {
                    "id": "mod-save-crc-q",
                    "prompt": "Why does a game report 'Save File Corrupt' after a player changes their gold count using a standard hex editor?",
                    "options": [
                        {"id": "a", "text": "The stored integrity checksum (such as CRC32) no longer matches the recalculated hash of the altered save data"},
                        {"id": "b", "text": "Hex editors automatically delete save files"},
                        {"id": "c", "text": "The CPU refuses to load files edited by text editors"}
                    ],
                    "answerId": "a",
                    "explanation": "Changing values without recalculating the corresponding checksum causes the game's integrity check to fail, triggering corruption alerts.",
                    "lessonId": "mod-save-checksums"
                }
            }
        ],
        "steps": [
            "Review `mod-assets-savefiles.py` to inspect how `PakArchive.pack` compresses data with zlib and builds index tables.",
            "Inspect `SaveGameManager.read_and_verify` to see how CRC32 checksums validate payload integrity.",
            "Run the script: `python3 mod-assets-savefiles.py`.",
            "Observe the output: notice how the tampered byte edit triggers an anti-tamper exception, while `modify_gold` recalculates a valid CRC32."
        ],
        "challenge": {
            "task": "Extend `SaveGameManager` to include a new field `PlayerInventoryCount` (unsigned 32-bit int). Update the packing, unpacking, and checksum verification routines to support this field.",
            "acceptance": [
                "Updated struct format string incorporating `PlayerInventoryCount`",
                "Accurate CRC32 calculation across the expanded 20-byte payload",
                "Verification test asserting successful load and save of inventory counts"
            ]
        },
        "sources": [
            {
                "title": "Unreal Engine UnrealPak & Virtual Filesystem Mounting",
                "url": "https://dev.epicgames.com/documentation/en-us/unreal-engine/packaging-unreal-engine-projects"
            },
            {
                "title": "Python struct: Interpret bytes as packed binary data",
                "url": "https://docs.python.org/3/library/struct.html"
            }
        ],
        "exam": {
            "passPercent": 80,
            "questions": [
                {
                    "id": "mod-asset-e1",
                    "prompt": "What compression algorithm is widely used in game archives due to its extremely fast decompression speed?",
                    "options": [
                        {"id": "a", "text": "LZ4"},
                        {"id": "b", "text": "Bzip2"},
                        {"id": "c", "text": "AES-256"}
                    ],
                    "answerId": "a",
                    "explanation": "LZ4 provides multi-gigabyte/sec decompression speeds, making it ideal for streaming assets during gameplay.",
                    "lessonId": "mod-asset-pak-archives"
                },
                {
                    "id": "mod-asset-e2",
                    "prompt": "In Unreal Engine, what folder in the game's Paks directory is traditionally used to drop custom mod .pak files?",
                    "options": [
                        {"id": "a", "text": "~mods"},
                        {"id": "b", "text": "System32"},
                        {"id": "c", "text": "Temp"}
                    ],
                    "answerId": "a",
                    "explanation": "Unreal Engine searches the `~mods` subfolder in the Paks directory, giving archives inside it priority over base game files.",
                    "lessonId": "mod-asset-replacement"
                },
                {
                    "id": "mod-asset-e3",
                    "prompt": "What endianness is used by default on modern x86-64 and ARM processors when storing multi-byte integers in memory and save files?",
                    "options": [
                        {"id": "a", "text": "Little-endian (least significant byte first)"},
                        {"id": "b", "text": "Big-endian (most significant byte first)"},
                        {"id": "c", "text": "Base64"}
                    ],
                    "answerId": "a",
                    "explanation": "x86 and ARM processors use little-endian byte ordering, storing the least significant byte at the lowest memory address.",
                    "lessonId": "mod-save-serialization"
                },
                {
                    "id": "mod-asset-e4",
                    "prompt": "What is the primary function of a CRC32 checksum in a game save file?",
                    "options": [
                        {"id": "a", "text": "To verify that the file has not been accidentally corrupted or modified without authorization"},
                        {"id": "b", "text": "To encrypt the save with a military-grade password"},
                        {"id": "c", "text": "To upload the save file to cloud servers"}
                    ],
                    "answerId": "a",
                    "explanation": "CRC32 is an error-detecting code used to verify data integrity and detect corruption or un-recalculated modifications.",
                    "lessonId": "mod-save-checksums"
                },
                {
                    "id": "mod-asset-e5",
                    "prompt": "In Python's struct module, what character indicates standard little-endian byte ordering?",
                    "options": [
                        {"id": "a", "text": "<"},
                        {"id": "b", "text": ">"},
                        {"id": "c", "text": "!"}
                    ],
                    "answerId": "a",
                    "explanation": "The `<` prefix in Python struct format strings enforces standard little-endian byte interpretation.",
                    "lessonId": "mod-save-serialization"
                }
            ]
        }
    },
    {
        "id": "mod-capstone",
        "version": 1,
        "order": 10,
        "title": "10. Production Mod Capstone: Architecture, ImGui & Distribution",
        "summary": "Build a production-grade game mod suite: modular plugin lifecycles, Dear ImGui menu overlay hooked into the graphics pipeline, SEH crash handling, and Thunderstore/Nexus packaging.",
        "difficulty": "Advanced",
        "minutes": 35,
        "codeExt": "cpp",
        "code": """// Production Mod Architecture & In-Game UI Capstone (C++17)
// Demonstrates clean DLL lifecycles (Attach/Detach), thread-safe mod state queues,
// Dear ImGui graphics overlay hooks, structured exception safety, and configuration persistence.

#include <iostream>
#include <vector>
#include <string>
#include <mutex>
#include <queue>
#include <thread>
#include <atomic>
#include <chrono>

// Simulated Dear ImGui context and window controls
class ImGuiMock {
public:
    static void beginWindow(const char* title, bool* pOpen) {
        if (*pOpen) {
            std::cout << "\\n========================================\\n";
            std::cout << "  [ImGui Overlay] Window: " << title << "\\n";
            std::cout << "========================================\\n";
        }
    }

    static void text(const std::string& fmt) {
        std::cout << "  [ImGui Text] " << fmt << "\\n";
    }

    static bool checkbox(const char* label, bool* value) {
        std::cout << "  [ImGui Checkbox] " << label << " = [" << (*value ? "X" : " ") << "]\\n";
        return false;
    }

    static bool sliderFloat(const char* label, float* value, float min, float max) {
        std::cout << "  [ImGui Slider] " << label << " = " << *value << " (Range: " << min << " - " << max << ")\\n";
        return false;
    }

    static void endWindow() {
        std::cout << "========================================\\n\\n";
    }
};

// Mod Configuration State
struct ModSettings {
    bool godMode = false;
    bool infiniteAmmo = true;
    float playerSpeedMultiplier = 2.0f;
    float fovAdjustment = 105.0f;
};

// Thread-Safe Command & Telemetry Queue
class ModCommandBus {
public:
    void postCommand(const std::string& cmd) {
        std::lock_guard<std::mutex> lock(queueMutex);
        commandQueue.push(cmd);
    }

    bool fetchCommand(std::string& outCmd) {
        std::lock_guard<std::mutex> lock(queueMutex);
        if (commandQueue.empty()) return false;
        outCmd = commandQueue.front();
        commandQueue.pop();
        return true;
    }

private:
    std::mutex queueMutex;
    std::queue<std::string> commandQueue;
};

// Production Mod Controller Suite
class ProductionModSuite {
public:
    ProductionModSuite() : isRunning(false), showMenu(true) {}

    // 1. Lifecycle: OnAttach (invoked when DLL is injected)
    void onAttach() {
        isRunning = true;
        std::cout << "[ModSuite] Initializing Production Mod Core v2.4.0...\\n";
        std::cout << "[ModSuite] Allocating resources and hooking DirectX Present...\\n";
        
        // Start background worker thread for telemetry and async tasks
        workerThread = std::thread(&ProductionModSuite::workerLoop, this);
    }

    // 2. Lifecycle: OnDetach (invoked when DLL is unloaded)
    void onDetach() {
        std::cout << "[ModSuite] Detaching mod: unhooking functions and flushing threads...\\n";
        isRunning = false;
        if (workerThread.joinable()) {
            workerThread.join();
        }
        std::cout << "[ModSuite] Unhooking complete. DLL memory safely unmapped.\\n";
    }

    // 3. Render Hook: Simulating IDXGISwapChain::Present
    void renderOverlayHook() {
        if (!showMenu) return;

        // Structured Exception Handling protection wrapper
        try {
            ImGuiMock::beginWindow("VoltQuest Master Hack & Utility", &showMenu);
            ImGuiMock::checkbox("Invulnerability (GodMode)", &settings.godMode);
            ImGuiMock::checkbox("Infinite Magazine Ammo", &settings.infiniteAmmo);
            ImGuiMock::sliderFloat("Player Speed Multiplier", &settings.playerSpeedMultiplier, 1.0f, 5.0f);
            ImGuiMock::sliderFloat("Field of View (FOV)", &settings.fovAdjustment, 70.0f, 120.0f);
            ImGuiMock::text("Status: Thread-safe hooks active. Press [INSERT] to hide.");
            ImGuiMock::endWindow();
        } catch (const std::exception& e) {
            std::cerr << "[ModSuite:CrashGuard] Caught UI exception: " << e.what() << "\\n";
        }
    }

    void toggleMenu() {
        showMenu = !showMenu;
        std::cout << "[ModSuite] Overlay visibility toggled: " << (showMenu ? "OPEN" : "CLOSED") << "\\n";
    }

    ModSettings& getSettings() { return settings; }
    ModCommandBus& getCommandBus() { return commandBus; }

private:
    std::atomic<bool> isRunning;
    bool showMenu;
    ModSettings settings;
    ModCommandBus commandBus;
    std::thread workerThread;

    void workerLoop() {
        while (isRunning) {
            std::string cmd;
            while (commandBus.fetchCommand(cmd)) {
                std::cout << "[ModSuite:WorkerThread] Executed command: " << cmd << "\\n";
            }
            std::this_thread::sleep_for(std::chrono::milliseconds(20));
        }
    }
};

int main() {
    std::cout << "=== Production Game Mod Suite Capstone Demonstration ===\\n";

    ProductionModSuite modSuite;

    // Simulate DLL Injection (DLL_PROCESS_ATTACH)
    modSuite.onAttach();

    // Enqueue commands across threads
    modSuite.getCommandBus().postCommand("APPLY_FOV_PATCH");
    modSuite.getCommandBus().postCommand("UNLOCK_ALL_CAMERAS");

    // Simulate Graphics Pipeline Present Calls (Frame 1 & 2)
    std::cout << "\\n[Graphics] Rendering Frame 1 with ImGui Overlay:\\n";
    modSuite.renderOverlayHook();

    // User toggles menu key (e.g. INSERT key)
    modSuite.toggleMenu();

    std::cout << "[Graphics] Rendering Frame 2 (Menu hidden):\\n";
    modSuite.renderOverlayHook();

    // User re-opens menu and modifies speed
    modSuite.toggleMenu();
    modSuite.getSettings().playerSpeedMultiplier = 3.5f;
    modSuite.getSettings().godMode = true;

    std::cout << "[Graphics] Rendering Frame 3 (Modified settings):\\n";
    modSuite.renderOverlayHook();

    // Simulate DLL Ejection (DLL_PROCESS_DETACH)
    std::cout << "--- Game Shutting Down / Mod Ejecting ---\\n";
    modSuite.onDetach();

    return 0;
}
""",
        "expected": "Compiles with C++17 (`g++ -std=c++17 -pthread mod-capstone.cpp`). Demonstrates complete production mod lifecycle: initializing threads on attach, processing thread-safe command queues, rendering Dear ImGui overlays on graphics present, handling UI toggles, and cleanly terminating threads on detach.",
        "lessons": [
            {
                "id": "mod-cap-architecture",
                "title": "Production mod architecture",
                "paragraphs": [
                    "Production-grade game mods require clean, modular architecture. A commercial-quality mod is organized into decoupled layers: the Core Ingestion layer (hooks and memory scanners), the State/Data model, the Feature subsystems (aim assist, camera controls, stat buffs), the UI presentation layer, and the Configuration manager.",
                    "Thread synchronization is paramount. The graphics hook runs on the game's render thread, gameplay hooks run on the physics/tick thread, and mod background logic runs on dedicated worker threads. Access to shared state must be protected using mutexes, lock-free queues, or atomic variables to prevent race conditions and intermittent crashes."
                ],
                "example": "Architecture: [DirectX Hook] -> [ImGui Layer] <==> [Atomic Mod Settings] <==> [Detour Hooks on Tick Thread].",
                "pitfall": "Executing expensive memory allocations, file I/O, or blocking network calls directly on the graphics render thread causes noticeable FPS drops and stuttering.",
                "question": {
                    "id": "mod-cap-arch-q",
                    "prompt": "Why must mod settings and commands shared between the render thread and worker threads use atomic variables or mutex locks?",
                    "options": [
                        {"id": "a", "text": "To prevent concurrent read/write race conditions and data corruption across threads"},
                        {"id": "b", "text": "To ensure colors display with high dynamic range"},
                        {"id": "c", "text": "Because modern operating systems do not allow multiple threads"}
                    ],
                    "answerId": "a",
                    "explanation": "Synchronizing data access between render threads and worker threads prevents data races, memory corruption, and desynchronization.",
                    "lessonId": "mod-cap-architecture"
                }
            },
            {
                "id": "mod-cap-imgui",
                "title": "In-game overlays with Dear ImGui",
                "paragraphs": [
                    "Dear ImGui is the undisputed industry standard for creating in-game developer menus, mod settings overlays, and debug tools. ImGui is an immediate-mode C++ GUI library designed to be rendered directly inside existing 3D graphics swapchains (DirectX 9/11/12, Vulkan, OpenGL, Metal).",
                    "To enable keyboard and mouse interaction with the mod overlay without clicking through into the game, modders hook the game's window message handler (`WndProc`). When the mod menu is open, the hooked `WndProc` forwards mouse coordinates and key events to ImGui with `ImGui_ImplWin32_WndProcHandler` and blocks the message from reaching the underlying game."
                ],
                "example": "LRESULT CALLBACK HookedWndProc(HWND hWnd, UINT uMsg, WPARAM wParam, LPARAM lParam) { if (ImGuiOpen && ImGui_ImplWin32(hWnd, uMsg, wParam, lParam)) return 1; return CallWindowProc(OriginalWndProc, hWnd, uMsg, wParam, lParam); }",
                "pitfall": "Failing to pass input messages back to the original game `WndProc` when the mod menu is closed freezes the player's mouse and keyboard controls completely.",
                "question": {
                    "id": "mod-cap-gui-q",
                    "prompt": "How do game mods capture mouse and keyboard inputs for Dear ImGui menus without triggering in-game actions like firing weapons?",
                    "options": [
                        {"id": "a", "text": "By hooking the window procedure (WndProc) and intercepting input messages when the mod menu is open"},
                        {"id": "b", "text": "By disconnecting the player's physical keyboard"},
                        {"id": "c", "text": "By pausing the computer's CPU clock"}
                    ],
                    "answerId": "a",
                    "explanation": "Hooking the window procedure (WndProc) allows the mod to intercept Windows mouse/keyboard messages and consume them before the game receives them.",
                    "lessonId": "mod-cap-imgui"
                }
            },
            {
                "id": "mod-cap-safety-crashes",
                "title": "Crash resilience & exception handling",
                "paragraphs": [
                    "A mod that crashes the game ruins the player's experience. In native C++, dereferencing an invalid or null pointer triggers a hardware access violation (code `0xC0000005`). Standard C++ `try/catch(...)` blocks do not catch hardware access violations on Windows.",
                    "To make hooks resilient against invalid pointers during loading screens or unexpected game states, modders wrap memory-reading code in Structured Exception Handling (`__try / __except` on Windows) or register vectored exception handlers (`AddVectoredExceptionHandler`). If an invalid address is read, the exception handler catches it cleanly, logs an error, and prevents the game process from crashing."
                ],
                "example": "__try { float hp = *(float*)(actor + 0x120); } __except (EXCEPTION_EXECUTE_HANDLER) { LogError(\"Invalid actor pointer\"); }",
                "pitfall": "Using SEH to hide persistent bugs instead of fixing underlying null pointer validations leads to undefined behavior and corrupted state over time.",
                "question": {
                    "id": "mod-cap-crash-q",
                    "prompt": "Why is Windows Structured Exception Handling (__try / __except) used in native mod hooks?",
                    "options": [
                        {"id": "a", "text": "It catches hardware access violations (like reading null or invalid pointers) that standard C++ try/catch blocks miss, preventing process crashes"},
                        {"id": "b", "text": "It accelerates CPU clock frequencies"},
                        {"id": "c", "text": "It compresses compiled binaries into ZIP archives"}
                    ],
                    "answerId": "a",
                    "explanation": "Structured Exception Handling (SEH) catches OS-level hardware exceptions like access violations (0xC0000005), preventing crashes during pointer dereferencing.",
                    "lessonId": "mod-cap-safety-crashes"
                }
            },
            {
                "id": "mod-cap-distribution",
                "title": "Mod distribution, packaging & versioning",
                "paragraphs": [
                    "Publishing a mod for the public requires packaging according to community mod manager standards (Nexus Mods, Thunderstore, CurseForge, Steam Workshop). Standard distribution packages include the compiled mod binary, a `manifest.json` describing dependencies and versioning, default configuration files, and an informative `README.md`.",
                    "Mods must follow Semantic Versioning (`MAJOR.MINOR.PATCH`). A major bump indicates breaking changes (such as new save file formats or incompatible config files); minor bumps introduce backward-compatible features; patch bumps resolve bugs. Declaring explicit dependencies in `manifest.json` ensures players install prerequisite mod loaders (like BepInEx or UE4SS) automatically."
                ],
                "example": "manifest.json: { \"name\": \"VoltBoost\", \"version_number\": \"1.2.0\", \"dependencies\": [\"denikson-BepInExPack-5.4.2100\"] }",
                "pitfall": "Distributing original copyrighted game assets inside your mod package violates copyright laws; distribution packages should contain only the modder's code and original creations.",
                "question": {
                    "id": "mod-cap-dist-q",
                    "prompt": "In Semantic Versioning (MAJOR.MINOR.PATCH), what type of release warrants incrementing the MAJOR version number?",
                    "options": [
                        {"id": "a", "text": "A breaking release that introduces incompatible API changes or breaking configuration/save requirements"},
                        {"id": "b", "text": "A minor bug fix that changes no features"},
                        {"id": "c", "text": "A simple typo correction in the readme file"}
                    ],
                    "answerId": "a",
                    "explanation": "Semantic Versioning increments MAJOR version when incompatible API or architecture changes are introduced that break previous versions.",
                    "lessonId": "mod-cap-distribution"
                }
            }
        ],
        "steps": [
            "Review `mod-capstone.cpp` to understand the lifecycle of `ProductionModSuite`: initialization on attach, background worker thread, and cleanup on detach.",
            "Inspect how `ImGuiMock` renders in-game checkboxes, sliders, and status text during the graphics Present hook.",
            "Observe the thread-safe `ModCommandBus` coordinating commands between the main thread and background worker.",
            "Compile and run `g++ -std=c++17 -pthread mod-capstone.cpp -o mod_capstone` and verify console output displaying overlay rendering, menu toggling, and clean shutdown on detach."
        ],
        "challenge": {
            "task": "Add a new slider control to the Dear ImGui overlay for `EnemySpawnRate` ranging from 0.5x to 4.0x. Ensure any changes made by the user are safely posted to `ModCommandBus`.",
            "acceptance": [
                "Addition of `enemySpawnRate` in `ModSettings`",
                "Dear ImGui slider control in `renderOverlayHook`",
                "Event posted to `ModCommandBus` and received by worker thread"
            ]
        },
        "sources": [
            {
                "title": "Dear ImGui: Bloat-free Graphical User Interface for C++",
                "url": "https://github.com/ocornut/imgui"
            },
            {
                "title": "Thunderstore Modding Community Package Standards",
                "url": "https://thunderstore.io/package/create/docs/"
            }
        ],
        "exam": {
            "passPercent": 80,
            "questions": [
                {
                    "id": "mod-cap-e1",
                    "prompt": "What C++ GUI library is universally favored for developing in-game debug overlays and mod menus?",
                    "options": [
                        {"id": "a", "text": "Dear ImGui"},
                        {"id": "b", "text": "Swing"},
                        {"id": "c", "text": "JavaFX"}
                    ],
                    "answerId": "a",
                    "explanation": "Dear ImGui is the preeminent immediate-mode C++ GUI library for real-time graphics rendering in games and tools.",
                    "lessonId": "mod-cap-imgui"
                },
                {
                    "id": "mod-cap-e2",
                    "prompt": "What must a mod DLL do when it receives a DLL_PROCESS_DETACH notification from the operating system?",
                    "options": [
                        {"id": "a", "text": "Unhook all installed detours, terminate worker threads, restore WndProc, and free allocated memory"},
                        {"id": "b", "text": "Format the user's hard drive"},
                        {"id": "c", "text": "Delete the game's executable"}
                    ],
                    "answerId": "a",
                    "explanation": "On detach, a mod must cleanly restore original bytes, terminate background threads, and free resources to avoid crashing the game.",
                    "lessonId": "mod-cap-architecture"
                },
                {
                    "id": "mod-cap-e3",
                    "prompt": "What is the consequence of failing to synchronize shared mod data between the graphics thread and gameplay threads?",
                    "options": [
                        {"id": "a", "text": "Data race conditions, memory corruption, and intermittent crashes"},
                        {"id": "b", "text": "The computer converts from Windows to Linux"},
                        {"id": "c", "text": "Audio plays at twice the normal speed"}
                    ],
                    "answerId": "a",
                    "explanation": "Concurrent access without locks or atomic primitives leads to data race conditions and memory corruption.",
                    "lessonId": "mod-cap-architecture"
                },
                {
                    "id": "mod-cap-e4",
                    "prompt": "What Windows exception code represents an illegal hardware memory access violation (such as dereferencing a null pointer)?",
                    "options": [
                        {"id": "a", "text": "0xC0000005"},
                        {"id": "b", "text": "0x00000000"},
                        {"id": "c", "text": "0xFFFFFFFF"}
                    ],
                    "answerId": "a",
                    "explanation": "`0xC0000005` is the standard NTSTATUS code for `EXCEPTION_ACCESS_VIOLATION` on Windows systems.",
                    "lessonId": "mod-cap-safety-crashes"
                },
                {
                    "id": "mod-cap-e5",
                    "prompt": "What file in a standard Thunderstore mod package declares the mod's name, version, and dependencies?",
                    "options": [
                        {"id": "a", "text": "manifest.json"},
                        {"id": "b", "text": "mod.exe"},
                        {"id": "c", "text": "kernel.sys"}
                    ],
                    "answerId": "a",
                    "explanation": "`manifest.json` is the standard metadata file used by mod managers like Thunderstore and r2modman to resolve mod dependencies and versioning.",
                    "lessonId": "mod-cap-distribution"
                }
            ]
        }
    }
]
