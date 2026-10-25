"""Courses 1 to 3 for the Embedded IoT in C track."""

COURSE_1 = {
    "id": "iot-c-architecture",
    "version": 1,
    "order": 1,
    "title": "Embedded C Foundations & IoT System Architecture",
    "summary": "Master microcontroller memory architecture (Flash, SRAM, stack, heap), cross-compilation toolchains, fixed-width types, bit manipulation, and non-blocking SysTick event loop design in pure C99/C11.",
    "difficulty": "Fundamental",
    "minutes": 45,
    "codeExt": "c",
    "lessons": [
        {
            "id": "iot-c-arch-memory",
            "title": "Microcontroller Memory Architecture: Flash, SRAM, Stack & Heap",
            "paragraphs": [
                "Unlike desktop computing where virtual memory gives applications gigabytes of uniform address space, microcontrollers operate in a physical memory map with strictly segregated Flash (ROM) and Static RAM (SRAM). In typical IoT microcontrollers like the STM32 (ARM Cortex-M) or ESP32 (Xtensa), Flash holds executable machine instructions (.text segment) and constant strings (.rodata), while SRAM stores initialized variables (.data), zero-initialized globals (.bss), the execution call stack, and the dynamic heap.",
                "RAM is severely constrained—often between 2 KB on small microcontrollers and 320 KB on an ESP32. Uncontrolled dynamic heap allocation (`malloc`/`free`) causes heap fragmentation, leading to unpredictable allocation failures after weeks in the field. Production IoT firmware avoids the heap, instead using static buffer pools and tracking stack high-watermarks to prevent catastrophic stack collisions."
            ],
            "example": "// Static memory pool avoiding heap fragmentation\n#define POOL_BLOCKS 8\n#define BLOCK_SIZE  64\nstatic uint8_t s_memory_pool[POOL_BLOCKS][BLOCK_SIZE];\nstatic uint8_t s_allocation_bitmap = 0;\n\nvoid *pool_alloc(void) {\n    for (int i = 0; i < POOL_BLOCKS; i++) {\n        if (!(s_allocation_bitmap & (1U << i))) {\n            s_allocation_bitmap |= (1U << i);\n            return s_memory_pool[i];\n        }\n    }\n    return NULL; // Out of static memory\n}",
            "pitfall": "Calling malloc() and free() repeatedly with varying payload sizes in long-running edge devices leads to heap fragmentation where plenty of total free RAM exists, but no single contiguous block is large enough for incoming network packets.",
            "question": {
                "id": "q-iot-c-arch-1",
                "prompt": "Why do safety-critical and long-running IoT embedded systems strictly avoid dynamic heap allocation (malloc/free)?",
                "options": [
                    {"id": "a", "text": "Heap memory cannot be accessed via 32-bit pointers on ARM microcontrollers."},
                    {"id": "b", "text": "Repeated allocations and deallocations cause heap fragmentation, causing allocation failures even when total free memory is sufficient."},
                    {"id": "c", "text": "Flash memory sectors must be physically erased on every single malloc() call."}
                ],
                "answerId": "b",
                "explanation": "Heap fragmentation breaks memory into non-contiguous blocks over time. In a device running uninterrupted for months, this causes malloc() to return NULL even if total free bytes exceed the requested size."
            }
        },
        {
            "id": "iot-c-arch-toolchain",
            "title": "Cross-Compilation Toolchains, Linker Scripts & Startup Code",
            "paragraphs": [
                "Developing IoT firmware requires cross-compilation: your workstation (host architecture, e.g., x86_64) compiles source code into machine instructions for a different target microcontroller (e.g., ARM Cortex-M or Xtensa) using toolchains such as `arm-none-eabi-gcc` or `xtensa-esp32-elf-gcc`. The compiler translates C into assembly object files, while the linker organizes those sections into physical memory addresses according to a Linker Script (`.ld`).",
                "The Linker Script defines exact memory boundaries via `MEMORY { FLASH (rx): ORIGIN = 0x08000000, LENGTH = 512K ... }` and maps sections via `SECTIONS`. When power is applied, the CPU executes the reset vector in startup code (`crt0.s` or `startup.c`), which initializes the Main Stack Pointer (MSP), copies initial values from Flash into the `.data` segment in RAM, zeroes out the `.bss` section, and branches to `main()`."
            ],
            "example": "/* Excerpt from an ARM Cortex-M linker script (*.ld) */\nMEMORY {\n  FLASH (rx) : ORIGIN = 0x08000000, LENGTH = 512K\n  RAM  (rwx) : ORIGIN = 0x20000000, LENGTH = 128K\n}\nSECTIONS {\n  .text : { *(.isr_vector) *(.text*) *(.rodata*) } > FLASH\n  .data : { _sdata = .; *(.data*) _edata = .; } > RAM AT > FLASH\n  .bss  : { _sbss = .; *(.bss*) _ebss = .; } > RAM\n}",
            "pitfall": "Assuming global variables retain their values without power or that uninitialized globals default to non-zero values. The startup code only zeroes `.bss` and copies Flash initializers to `.data` on boot.",
            "question": {
                "id": "q-iot-c-arch-2",
                "prompt": "What critical initialization tasks does the C runtime startup code (crt0) perform before jumping to main()?",
                "options": [
                    {"id": "a", "text": "Initializes the stack pointer, copies .data from Flash to RAM, and zeroes out the .bss RAM segment."},
                    {"id": "b", "text": "Transmits an initial DHCP network request and establishes an MQTT TLS socket."},
                    {"id": "c", "text": "Erases the entire Flash memory chip to prepare for new application binaries."}
                ],
                "answerId": "a",
                "explanation": "Before main() executes, the hardware reset vector configures the stack pointer, copies initialized global/static variables from Flash into RAM (.data), and sets uninitialized variables to zero (.bss)."
            }
        },
        {
            "id": "iot-c-arch-types",
            "title": "Fixed-Width Types, Bit Manipulation & Endianness",
            "paragraphs": [
                "In embedded C, ambiguous types like `int` and `long` cause dangerous portability bugs because their widths differ between 8-bit, 16-bit, 32-bit, and 64-bit platforms. IoT developers mandate `<stdint.h>`, using explicit fixed-width integers: `uint8_t`, `int16_t`, `uint32_t`, and `uint64_t`. Peripheral registers and telemetry protocols rely on exact bit widths and bit positions.",
                "Bitwise operations allow atomic control of hardware pins and protocol flags without altering neighboring bits. Using bitmask idioms: set bit `REG |= (1U << PIN)`, clear bit `REG &= ~(1U << PIN)`, toggle bit `REG ^= (1U << PIN)`, and test bit `if (REG & (1U << PIN))`. Furthermore, network protocols use Big-Endian (Network Byte Order) while most microcontrollers are Little-Endian; functions like `htons()` and `htonl()` guarantee deterministic byte order on the wire."
            ],
            "example": "#include <stdint.h>\n\n#define STATUS_FLAG_CONNECTED (1U << 0)\n#define STATUS_FLAG_ALARM     (1U << 1)\n#define STATUS_FLAG_BATTERY   (1U << 2)\n\nstatic uint32_t s_device_status = 0;\n\nvoid set_alarm(void)    { s_device_status |= STATUS_FLAG_ALARM; }\nvoid clear_alarm(void)  { s_device_status &= ~STATUS_FLAG_ALARM; }\nbool is_alarm_on(void)  { return (s_device_status & STATUS_FLAG_ALARM) != 0; }",
            "pitfall": "Using signed integers for bitwise shifts, such as `1 << 31` instead of `1U << 31`. Shifting a signed 1 into the sign bit triggers undefined behavior in C.",
            "question": {
                "id": "q-iot-c-arch-3",
                "prompt": "Which C bitwise expression safely clears the 4th bit of a 32-bit register without modifying any other bit?",
                "options": [
                    {"id": "a", "text": "REG = REG ^ (1U << 4);"},
                    {"id": "b", "text": "REG &= ~(1U << 4);"},
                    {"id": "c", "text": "REG |= ~(1U << 4);"}
                ],
                "answerId": "b",
                "explanation": "Bitwise NOT `~(1U << 4)` produces a mask with all 1s except a 0 at bit 4. Bitwise AND `&=` preserves all bits where the mask is 1 and clears bit 4 to 0."
            }
        },
        {
            "id": "iot-c-arch-eventloop",
            "title": "SysTick Timers & Non-Blocking State Machine Loops",
            "paragraphs": [
                "Beginner sketches often use blocking delay functions like `delay(1000)`. In a connected IoT device, blocking the CPU freezes network keep-alives, drops incoming UART packets from GPS or sensors, and prevents sleep-mode power management. Real-world bare-metal firmware uses a monotonic hardware system tick timer (SysTick) that increments a counter on every millisecond interrupt.",
                "With SysTick, periodic tasks execute inside a non-blocking super-loop (or event loop). Tasks compare the current tick counter against their last execution timestamp: `if ((uint32_t)(current_ticks - last_ticks) >= interval)`. Combined with an explicit Finite State Machine (FSM) utilizing `enum` states and `switch` statements, the device samples sensors, processes buffers, and handles communication concurrently without multi-threading overhead."
            ],
            "example": "typedef enum {\n    STATE_BOOT,\n    STATE_SAMPLE_SENSORS,\n    STATE_TRANSMIT_DATA,\n    STATE_LOW_POWER_SLEEP\n} DeviceState;\n\nstatic DeviceState s_state = STATE_BOOT;\nstatic uint32_t s_last_sample = 0;\n\nvoid app_run_step(uint32_t now) {\n    switch (s_state) {\n        case STATE_BOOT:\n            s_state = STATE_SAMPLE_SENSORS;\n            break;\n        case STATE_SAMPLE_SENSORS:\n            if (now - s_last_sample >= 1000) {\n                s_last_sample = now;\n                s_state = STATE_TRANSMIT_DATA;\n            }\n            break;\n        case STATE_TRANSMIT_DATA:\n            s_state = STATE_LOW_POWER_SLEEP;\n            break;\n        case STATE_LOW_POWER_SLEEP:\n            s_state = STATE_SAMPLE_SENSORS;\n            break;\n    }\n}",
            "pitfall": "Calculating elapsed time with `if (now >= last_run + interval)` instead of `if ((uint32_t)(now - last_run) >= interval)`. The former fails when the 32-bit tick counter rolls over back to 0 (~49.7 days), while unsigned subtraction correctly handles rollover.",
            "question": {
                "id": "q-iot-c-arch-4",
                "prompt": "Why is unsigned tick arithmetic `(uint32_t)(now - last_run) >= interval` essential for timing intervals in embedded systems?",
                "options": [
                    {"id": "a", "text": "It guarantees correct elapsed time calculations even when the 32-bit tick counter overflows back to zero."},
                    {"id": "b", "text": "It instructs the compiler to execute the loop inside hardware DSP registers."},
                    {"id": "c", "text": "It automatically disables interrupts during the arithmetic subtraction."}
                ],
                "answerId": "a",
                "explanation": "Because unsigned integer arithmetic in C is defined modulo 2^32, `now - last_run` produces the exact elapsed interval even across the 32-bit integer rollover boundary."
            }
        }
    ],
    "steps": [
        "Study the physical memory segregation between Flash (.text, .rodata) and SRAM (.data, .bss, stack).",
        "Inspect the static memory pool allocator and bitmask allocation tracking routines in C.",
        "Trace the non-blocking SysTick event scheduler and state machine transition callbacks.",
        "Compile the standalone program with GCC: `gcc -std=c11 -Wall -Wextra iot-c-architecture.c -o iot-c-architecture` and verify zero heap allocations."
    ],
    "expected": "The program executes a deterministic 1000-tick event loop simulation, manages memory allocations through static pools, tracks peak allocation watermarks, and reports scheduled task dispatches with zero memory leaks.",
    "code": """#include <stdio.h>
#include <stdint.h>
#include <stdbool.h>
#include <string.h>

#define MEMORY_POOL_BLOCKS 8
#define MEMORY_BLOCK_SIZE  64
#define SCHEDULER_MAX_TASKS 4

typedef struct {
    uint8_t raw_memory[MEMORY_POOL_BLOCKS][MEMORY_BLOCK_SIZE];
    uint8_t alloc_bitmap;
    uint8_t peak_allocated;
} StaticMemoryPool;

typedef void (*TaskCallback)(uint32_t now);

typedef struct {
    const char *name;
    uint32_t interval_ticks;
    uint32_t last_run_tick;
    TaskCallback callback;
    uint32_t execution_count;
} ScheduledTask;

typedef enum {
    SYSTEM_STATE_INITIALIZING,
    SYSTEM_STATE_ACTIVE,
    SYSTEM_STATE_FAULT
} SystemState;

static StaticMemoryPool s_pool;
static ScheduledTask s_tasks[SCHEDULER_MAX_TASKS];
static uint8_t s_task_count = 0;
static uint32_t s_system_ticks = 0;
static SystemState s_system_state = SYSTEM_STATE_INITIALIZING;

void pool_init(void) {
    memset(&s_pool, 0, sizeof(s_pool));
}

void *pool_alloc(void) {
    for (uint8_t i = 0; i < MEMORY_POOL_BLOCKS; i++) {
        if (!(s_pool.alloc_bitmap & (1U << i))) {
            s_pool.alloc_bitmap |= (1U << i);
            uint8_t active_count = 0;
            for (uint8_t b = 0; b < MEMORY_POOL_BLOCKS; b++) {
                if (s_pool.alloc_bitmap & (1U << b)) active_count++;
            }
            if (active_count > s_pool.peak_allocated) {
                s_pool.peak_allocated = active_count;
            }
            return s_pool.raw_memory[i];
        }
    }
    return NULL;
}

bool pool_free(void *ptr) {
    if (!ptr) return false;
    for (uint8_t i = 0; i < MEMORY_POOL_BLOCKS; i++) {
        if (s_pool.raw_memory[i] == ptr) {
            s_pool.alloc_bitmap &= ~(1U << i);
            return true;
        }
    }
    return false;
}

bool scheduler_add(const char *name, uint32_t interval, TaskCallback cb) {
    if (s_task_count >= SCHEDULER_MAX_TASKS) return false;
    s_tasks[s_task_count].name = name;
    s_tasks[s_task_count].interval_ticks = interval;
    s_tasks[s_task_count].last_run_tick = 0;
    s_tasks[s_task_count].callback = cb;
    s_tasks[s_task_count].execution_count = 0;
    s_task_count++;
    return true;
}

void scheduler_dispatch(uint32_t now) {
    for (uint8_t i = 0; i < s_task_count; i++) {
        if ((uint32_t)(now - s_tasks[i].last_run_tick) >= s_tasks[i].interval_ticks) {
            s_tasks[i].last_run_tick = now;
            s_tasks[i].execution_count++;
            if (s_tasks[i].callback) {
                s_tasks[i].callback(now);
            }
        }
    }
}

static void on_sensor_sample(uint32_t now) {
    void *sample_buf = pool_alloc();
    if (sample_buf) {
        snprintf((char *)sample_buf, MEMORY_BLOCK_SIZE, "SENSOR_SAMPLE@tick=%u", now);
        pool_free(sample_buf);
    }
}

static void on_heartbeat_led(uint32_t now) {
    (void)now;
}

int main(void) {
    pool_init();
    scheduler_add("sensor_poll", 100, on_sensor_sample);
    scheduler_add("heartbeat", 250, on_heartbeat_led);
    s_system_state = SYSTEM_STATE_ACTIVE;

    printf("[BOOT] Static memory pool initialized: %d blocks of %d bytes\\n",
           MEMORY_POOL_BLOCKS, MEMORY_BLOCK_SIZE);
    printf("[BOOT] System state: ACTIVE. Running 1000-tick event loop...\\n");

    for (s_system_ticks = 0; s_system_ticks <= 1000; s_system_ticks++) {
        scheduler_dispatch(s_system_ticks);
    }

    printf("[REPORT] Simulation complete. Ticks elapsed: %u\\n", s_system_ticks - 1);
    for (uint8_t i = 0; i < s_task_count; i++) {
        printf("  Task '%s': dispatched %u times\\n",
               s_tasks[i].name, s_tasks[i].execution_count);
    }
    printf("[MEMORY] Peak pool allocation: %u / %u blocks. Remaining bitmap: 0x%02X\\n",
           s_pool.peak_allocated, MEMORY_POOL_BLOCKS, s_pool.alloc_bitmap);

    if (s_pool.alloc_bitmap != 0) {
        printf("[ERROR] Memory leak detected in static pool!\\n");
        return 1;
    }
    printf("[STATUS] Zero memory leaks. Clean architecture verification passed.\\n");
    return 0;
}
""",
    "challenge": {
        "task": "Extend the event scheduler with a task execution watchdog and track the maximum consecutive tick latency.",
        "acceptance": [
            "Add a watchdog timeout threshold to assert a fault if any task interval exceeds 500ms without dispatch.",
            "Record and display the maximum static pool watermark during heavy simulated sensor bursts.",
            "Verify all bitwise shifts use unsigned literals (1U) to maintain strict MISRA-C compliance."
        ]
    },
    "sources": [
        {"title": "ARM Cortex-M Embedded C Memory Map & Architecture", "url": "https://developer.arm.com/documentation/dui0552/a"},
        {"title": "GNU Arm Embedded Toolchain & Linker Scripts", "url": "https://sourceware.org/binutils/docs/ld/"}
    ],
    "exam": {
        "passPercent": 80,
        "questions": [
            {
                "id": "q-iot-c-arch-exam-1",
                "prompt": "Which physical memory region holds constant string literals and read-only lookup tables on a microcontroller?",
                "options": [
                    {"id": "a", "text": "Flash memory (.rodata segment)"},
                    {"id": "b", "text": "SRAM call stack"},
                    {"id": "c", "text": "Uninitialized RAM (.bss segment)"},
                    {"id": "d", "text": "Dynamic heap buffer"}
                ],
                "answerId": "a",
                "explanation": "Constant data marked 'const' is placed in the read-only data section (.rodata) located in Flash memory, saving precious RAM."
            },
            {
                "id": "q-iot-c-arch-exam-2",
                "prompt": "What happens if a developer shifts a signed 32-bit integer into its sign bit using (1 << 31)?",
                "options": [
                    {"id": "a", "text": "It invokes Undefined Behavior in standard C; the unsigned literal (1U << 31) must be used instead."},
                    {"id": "b", "text": "It automatically converts the microcontroller to big-endian mode."},
                    {"id": "c", "text": "The compiler allocates 64 bits on the stack to prevent overflow."},
                    {"id": "d", "text": "The SysTick interrupt vector table is permanently corrupted."}
                ],
                "answerId": "a",
                "explanation": "Shifting a 1 into the sign bit of a signed integer causes undefined behavior in standard C99/C11. Embedded standards mandate (1U << 31)."
            },
            {
                "id": "q-iot-c-arch-exam-3",
                "prompt": "Why is static pool allocation superior to dynamic malloc() for long-running IoT edge nodes?",
                "options": [
                    {"id": "a", "text": "It guarantees deterministic O(1) allocation time and eliminates runtime heap fragmentation."},
                    {"id": "b", "text": "It doubles the physical clock frequency of the CPU."},
                    {"id": "c", "text": "It allows the microcontroller to bypass the Linker Script entirely."},
                    {"id": "d", "text": "It encrypts RAM memory blocks using AES-128 hardware keys."}
                ],
                "answerId": "a",
                "explanation": "Fixed-size static memory pools allocate and free in deterministic time and prevent fragmentation, ensuring the device never runs out of contiguous memory."
            },
            {
                "id": "q-iot-c-arch-exam-4",
                "prompt": "What is the primary role of the Linker Script (.ld) in an embedded C project?",
                "options": [
                    {"id": "a", "text": "It maps compiled object code and data sections to specific physical Flash and RAM addresses."},
                    {"id": "b", "text": "It serializes JSON payloads for cloud transmission."},
                    {"id": "c", "text": "It controls the Wi-Fi connection handshake during boot."},
                    {"id": "d", "text": "It converts C source code directly into Python scripts."}
                ],
                "answerId": "a",
                "explanation": "The Linker Script defines the memory map of the microcontroller and directs the linker on where to place code, constants, data, and stack in physical memory."
            },
            {
                "id": "q-iot-c-arch-exam-5",
                "prompt": "How does non-blocking SysTick timing prevent issues during 32-bit tick counter rollover?",
                "options": [
                    {"id": "a", "text": "By evaluating elapsed time with unsigned subtraction: `(uint32_t)(now - last_run) >= interval`."},
                    {"id": "b", "text": "By resetting the microcontroller hardware whenever the tick counter reaches maximum value."},
                    {"id": "c", "text": "By disabling the SysTick timer when the device enters active state."},
                    {"id": "d", "text": "By using floating point variables for all timestamp counters."}
                ],
                "answerId": "a",
                "explanation": "Modulo 2^32 unsigned subtraction correctly resolves elapsed duration across the overflow boundary without requiring counter resets."
            }
        ]
    }
}

COURSE_2 = {
    "id": "iot-c-peripherals",
    "version": 1,
    "order": 2,
    "title": "Hardware Register Abstraction & Peripheral Drivers in C",
    "summary": "Master memory-mapped I/O (MMIO), the `volatile` qualifier, atomic bit set/reset operations, hardware interrupt service routines (ISRs), and timer PWM signal generation.",
    "difficulty": "Fundamental",
    "minutes": 50,
    "codeExt": "c",
    "lessons": [
        {
            "id": "iot-c-peri-mmio",
            "title": "Memory-Mapped I/O & the Volatile Qualifier",
            "paragraphs": [
                "Microcontrollers interact with physical hardware through Memory-Mapped I/O (MMIO): hardware peripheral registers (timers, UARTs, GPIO controllers) are assigned specific addresses within the CPU's memory map. Writing a 32-bit word to an address like `0x40020014` physically charges a pin, while reading it samples an external sensor pin.",
                "The C compiler’s optimizer assumes memory contents only change if the code explicitly writes to it. Without the `volatile` keyword, an aggressive optimizer (e.g. `-O2` or `-O3`) will cache a register read into a CPU register or optimize away polling loops like `while (!(UART->STATUS & RXNE))`. Tagging pointers as `volatile` forces the compiler to emit a physical load or store instruction on every single access, preventing silent hardware deadlocks."
            ],
            "example": "// CMSIS-style peripheral register struct definition\ntypedef struct {\n    volatile uint32_t MODER;   // Mode register: input, output, alternate\n    volatile uint32_t OTYPER;  // Output type: push-pull, open-drain\n    volatile uint32_t OSPEEDR; // Output speed\n    volatile uint32_t PUPDR;   // Pull-up / pull-down\n    volatile uint32_t IDR;     // Input data register\n    volatile uint32_t ODR;     // Output data register\n    volatile uint32_t BSRR;    // Bit set / reset register (atomic)\n} GPIO_TypeDef;\n\n#define GPIOA_BASE 0x40020000UL\n#define GPIOA ((GPIO_TypeDef *)GPIOA_BASE)",
            "pitfall": "Omitting the `volatile` qualifier when defining peripheral register structs. The compiler will optimize away repeated reads or reorder register access sequence, corrupting hardware peripheral initialization.",
            "question": {
                "id": "q-iot-c-peri-1",
                "prompt": "What does the `volatile` keyword tell the C compiler regarding peripheral register pointers?",
                "options": [
                    {"id": "a", "text": "It forces the compiler to read or write directly to physical memory on every access without optimizing or caching in registers."},
                    {"id": "b", "text": "It stores the variable permanently inside encrypted Flash memory."},
                    {"id": "c", "text": "It tells the compiler that the variable is protected by an RTOS mutex lock."}
                ],
                "answerId": "a",
                "explanation": "`volatile` tells the compiler that the value can change outside the program's control (e.g. by hardware), forbidding the optimizer from caching or eliminating memory accesses."
            }
        },
        {
            "id": "iot-c-peri-gpio",
            "title": "GPIO Modes: Push-Pull, Open-Drain & Atomic BSRR Control",
            "paragraphs": [
                "General-Purpose Input/Output (GPIO) pins can be configured into multiple electrical modes: Push-Pull (actively drives high to VDD and low to GND, ideal for LEDs and SPI), Open-Drain (actively pulls low to GND, but floats when high, requiring an external pull-up resistor, essential for shared multi-device buses like I2C), and Alternate Function (routing internal silicon peripherals like timers or UART to external pins).",
                "Modifying output pins via the Output Data Register (ODR) requires a Read-Modify-Write cycle: `ODR |= (1 << 5)`. If an interrupt occurs between the read and write steps, pin states modified by the interrupt will be overwritten! Modern microcontrollers provide an atomic Bit Set/Reset Register (BSRR): writing to the lower 16 bits sets pins high, while writing to the upper 16 bits resets pins low in a single clock cycle without race conditions."
            ],
            "example": "// Atomic pin control using BSRR register (no race conditions)\nvoid gpio_set_pin(GPIO_TypeDef *port, uint8_t pin) {\n    port->BSRR = (1U << pin);          // Write to lower 16 bits: sets pin HIGH\n}\n\nvoid gpio_reset_pin(GPIO_TypeDef *port, uint8_t pin) {\n    port->BSRR = (1U << (pin + 16));   // Write to upper 16 bits: resets pin LOW\n}",
            "pitfall": "Using read-modify-write `ODR |= (1 << PIN)` in main loops while an ISR toggles another pin on the same port. The ISR modification can be clobbered by the main loop, causing intermittent pin glitches.",
            "question": {
                "id": "q-iot-c-peri-2",
                "prompt": "Why is writing to the Bit Set/Reset Register (BSRR) safer than modifying the Output Data Register (ODR |= mask)?",
                "options": [
                    {"id": "a", "text": "BSRR writes are atomic single-cycle operations, eliminating read-modify-write race conditions with interrupts."},
                    {"id": "b", "text": "BSRR operations automatically reduce the electrical current draw of the pin."},
                    {"id": "c", "text": "BSRR converts analog voltage levels into digital 12-bit ADC numbers."}
                ],
                "answerId": "a",
                "explanation": "BSRR allows individual bits to be set or reset with a single write instruction without needing to read the port first, eliminating concurrency race conditions."
            }
        },
        {
            "id": "iot-c-peri-isrs",
            "title": "Hardware Interrupt Service Routines (ISRs) & NVIC",
            "paragraphs": [
                "Interrupts allow microcontrollers to react immediately to external physical events (pin voltage transitions, timer alarms, UART character arrivals) without polling in a loop. When an interrupt fires, the Nested Vectored Interrupt Controller (NVIC) pauses the main thread, pushes CPU core registers onto the stack, and jumps to the corresponding entry in the Interrupt Vector Table.",
                "Writing an Interrupt Service Routine (ISR) in C demands strict engineering hygiene: ISRs must be lightweight and non-blocking. An ISR must never call blocking functions (`delay`), allocate memory (`malloc`), perform heavy floating-point math, or acquire blocking mutexes. Instead, an ISR sets an atomic flag or pushes data into a lock-free ring buffer, clears the peripheral's pending interrupt bit, and exits."
            ],
            "example": "#include <stdatomic.h>\n\nstatic atomic_bool s_button_pressed = false;\n\n// Hardware ISR triggered on falling edge of GPIO button\nvoid EXTI0_IRQHandler(void) {\n    // 1. Check if interrupt pending flag is set\n    if (EXTI->PR & (1U << 0)) {\n        // 2. Clear pending flag by writing 1 (hardware clear rule)\n        EXTI->PR = (1U << 0);\n        // 3. Signal the main loop via atomic variable\n        atomic_store(&s_button_pressed, true);\n    }\n}",
            "pitfall": "Forgetting to clear the peripheral's interrupt pending flag inside the ISR. The NVIC will immediately re-trigger the ISR the moment it returns, locking the CPU in an infinite interrupt storm.",
            "question": {
                "id": "q-iot-c-peri-3",
                "prompt": "What is the critical rule for clearing peripheral interrupt flags inside an Interrupt Service Routine (ISR)?",
                "options": [
                    {"id": "a", "text": "The pending flag must be cleared before exiting the ISR to prevent immediate re-triggering of the interrupt."},
                    {"id": "b", "text": "The pending flag should only be cleared after a 500ms delay."},
                    {"id": "c", "text": "The pending flag is cleared automatically when malloc() is called."}
                ],
                "answerId": "a",
                "explanation": "If the peripheral pending flag is not cleared, the NVIC detects the interrupt line still active and immediately re-enters the ISR upon return, hanging the microcontroller."
            }
        },
        {
            "id": "iot-c-peri-pwm",
            "title": "Hardware Timers, Prescalers & Pulse-Width Modulation (PWM)",
            "paragraphs": [
                "Pulse-Width Modulation (PWM) generates variable analog-equivalent voltages and precise motor/LED control using digital hardware timers. An embedded hardware timer consists of a Prescaler (PSC), a Counter (CNT), an Auto-Reload Register (ARR), and one or more Capture/Compare Registers (CCR).",
                "The Prescaler divides the system clock: $f_{CNT} = \\frac{f_{CLK}}{PSC + 1}$. The Counter counts up to ARR, establishing the PWM period: $f_{PWM} = \\frac{f_{CNT}}{ARR + 1}$. The Compare Register (CCR) sets the duty cycle: when $CNT < CCR$, the output pin is HIGH; when $CNT \\ge CCR$, the pin drops to LOW. Duty cycle is precisely $\\frac{CCR}{ARR + 1} \\times 100\\%$, operated entirely by hardware without CPU intervention."
            ],
            "example": "// Configuring hardware timer for 1 kHz PWM with 50% duty cycle on 84 MHz clock\nvoid timer_pwm_init(TIM_TypeDef *tim) {\n    tim->PSC = 84 - 1;       // 84 MHz / 84 = 1 MHz timer clock (1 us tick)\n    tim->ARR = 1000 - 1;     // 1 MHz / 1000 = 1 kHz PWM frequency (1 ms period)\n    tim->CCR1 = 500;         // 500 / 1000 = 50% duty cycle\n    tim->CCMR1 |= 0x0060;    // PWM mode 1\n    tim->CCER |= 0x0001;     // Enable channel 1 output\n    tim->CR1 |= 0x0001;      // Enable counter\n}",
            "pitfall": "Forgetting that prescalers and reload registers are 0-indexed in many microcontrollers: setting PSC=84 divides by 85, skewing target frequencies unless written as `PSC = 84 - 1`.",
            "question": {
                "id": "q-iot-c-peri-4",
                "prompt": "If a timer counter ticks at 1 MHz (1 us per count) and the Auto-Reload Register (ARR) is set to 999, what CCR value sets a 25% PWM duty cycle?",
                "options": [
                    {"id": "a", "text": "CCR = 250"},
                    {"id": "b", "text": "CCR = 750"},
                    {"id": "c", "text": "CCR = 25"}
                ],
                "answerId": "a",
                "explanation": "The total period count is ARR + 1 = 1000. 25% of 1000 counts is 250, so CCR = 250."
            }
        }
    ],
    "steps": [
        "Review CMSIS-style peripheral register mapping and the `volatile` modifier.",
        "Inspect atomic Bit Set/Reset Register (BSRR) pin manipulation functions.",
        "Analyze the hardware timer prescaler, reload, and PWM compare duty cycle formulas.",
        "Compile and execute `iot-c-peripherals.c` with GCC: `gcc -std=c11 -Wall -Wextra iot-c-peripherals.c -o iot-c-peripherals`."
    ],
    "expected": "The program simulates register-level GPIO configuration, performs atomic BSRR pin manipulation, simulates an ISR clearing pending flags, and configures a simulated hardware timer producing verified 1 kHz PWM with 75% duty cycle.",
    "code": """#include <stdio.h>
#include <stdint.h>
#include <stdbool.h>
#include <string.h>

typedef struct {
    volatile uint32_t MODER;
    volatile uint32_t OTYPER;
    volatile uint32_t PUPDR;
    volatile uint32_t IDR;
    volatile uint32_t ODR;
    volatile uint32_t BSRR;
} Mock_GPIO_TypeDef;

typedef struct {
    volatile uint32_t CR1;
    volatile uint32_t PSC;
    volatile uint32_t ARR;
    volatile uint32_t CCR1;
    volatile uint32_t SR;
} Mock_TIM_TypeDef;

static Mock_GPIO_TypeDef s_gpioa;
static Mock_TIM_TypeDef  s_tim2;
static uint32_t s_isr_fired_count = 0;

void mock_gpio_set_mode(Mock_GPIO_TypeDef *port, uint8_t pin, uint8_t mode) {
    port->MODER &= ~(3U << (pin * 2));
    port->MODER |= ((uint32_t)mode << (pin * 2));
}

void mock_gpio_write_pin(Mock_GPIO_TypeDef *port, uint8_t pin, bool high) {
    if (high) {
        port->BSRR = (1U << pin);
        port->ODR |= (1U << pin);
    } else {
        port->BSRR = (1U << (pin + 16));
        port->ODR &= ~(1U << pin);
    }
}

void mock_tim_pwm_config(Mock_TIM_TypeDef *tim, uint32_t psc, uint32_t arr, uint32_t ccr) {
    tim->PSC = psc;
    tim->ARR = arr;
    tim->CCR1 = ccr;
    tim->CR1 |= 0x01; // Enable counter
}

float mock_tim_get_duty_cycle(const Mock_TIM_TypeDef *tim) {
    if (tim->ARR == 0) return 0.0f;
    return ((float)tim->CCR1 / (float)(tim->ARR + 1)) * 100.0f;
}

void mock_exti_isr(uint32_t interrupt_mask) {
    if (s_tim2.SR & interrupt_mask) {
        s_tim2.SR &= ~interrupt_mask; // Clear pending flag
        s_isr_fired_count++;
    }
}

int main(void) {
    memset(&s_gpioa, 0, sizeof(s_gpioa));
    memset(&s_tim2, 0, sizeof(s_tim2));

    printf("[PERIPHERAL] Initializing simulated GPIOA and TIM2 peripheral registers...\\n");

    // Configure Pin 5 as General Purpose Output (Mode 0x01)
    mock_gpio_set_mode(&s_gpioa, 5, 0x01);
    printf("[GPIO] Pin 5 mode configured: MODER = 0x%08X\\n", s_gpioa.MODER);

    // Atomic Set via BSRR
    mock_gpio_write_pin(&s_gpioa, 5, true);
    printf("[GPIO] BSRR write (HIGH): BSRR=0x%08X, ODR=0x%08X (Pin 5 = %d)\\n",
           s_gpioa.BSRR, s_gpioa.ODR, (s_gpioa.ODR & (1U << 5)) ? 1 : 0);

    // Atomic Reset via BSRR
    mock_gpio_write_pin(&s_gpioa, 5, false);
    printf("[GPIO] BSRR write (LOW):  BSRR=0x%08X, ODR=0x%08X (Pin 5 = %d)\\n",
           s_gpioa.BSRR, s_gpioa.ODR, (s_gpioa.ODR & (1U << 5)) ? 1 : 0);

    // Configure TIM2: 84 MHz / 84 = 1 MHz; ARR=999 (1 kHz); CCR1=750 (75% duty cycle)
    mock_tim_pwm_config(&s_tim2, 84 - 1, 1000 - 1, 750);
    printf("[PWM] TIM2 configured: PSC=%u, ARR=%u, CCR1=%u\\n",
           s_tim2.PSC, s_tim2.ARR, s_tim2.CCR1);
    printf("[PWM] Calculated Hardware Duty Cycle: %.2f%%\\n",
           mock_tim_get_duty_cycle(&s_tim2));

    // Simulate hardware interrupt triggering
    s_tim2.SR |= 0x01; // Hardware sets Update Interrupt Flag (UIF)
    printf("[ISR] Interrupt flag asserted in SR: 0x%08X. Invoking ISR...\\n", s_tim2.SR);
    mock_exti_isr(0x01);
    printf("[ISR] Post-ISR state: SR=0x%08X, Total ISR Executions=%u\\n",
           s_tim2.SR, s_isr_fired_count);

    if (s_tim2.SR != 0 || s_isr_fired_count != 1) {
        printf("[ERROR] ISR did not properly acknowledge pending status register!\\n");
        return 1;
    }
    printf("[STATUS] Peripheral drivers and register semantics verified cleanly.\\n");
    return 0;
}
""",
    "challenge": {
        "task": "Add software debouncing filtering to the interrupt handler using tick timestamps.",
        "acceptance": [
            "Implement a debounce threshold of 50ms preventing consecutive ISR executions within the debounce window.",
            "Add a register read function verifying that pin state matches expected logic levels after BSRR write.",
            "Verify all peripheral pointer definitions use explicit volatile qualification."
        ]
    },
    "sources": [
        {"title": "STM32 Cortex-M Reference Manual: GPIO and Timers", "url": "https://www.st.com/resource/en/reference_manual/rm0090.pdf"},
        {"title": "ARM CMSIS Core Peripheral Access Layer", "url": "https://arm-software.github.io/CMSIS_5/Core/html/index.html"}
    ],
    "exam": {
        "passPercent": 80,
        "questions": [
            {
                "id": "q-iot-c-peri-exam-1",
                "prompt": "Why must hardware peripheral registers always be accessed through pointers qualified with `volatile`?",
                "options": [
                    {"id": "a", "text": "To prevent the compiler optimizer from caching register reads or eliminating hardware polling loops."},
                    {"id": "b", "text": "To automatically convert single-ended signals into differential CAN bus signals."},
                    {"id": "c", "text": "To force the compiler to store the data inside the microcontroller's EEPROM."},
                    {"id": "d", "text": "To bypass the CPU stack pointer during function execution."}
                ],
                "answerId": "a",
                "explanation": "Hardware registers can change state independently of program flow. The `volatile` keyword guarantees that every access reads or writes directly to the physical hardware address."
            },
            {
                "id": "q-iot-c-peri-exam-2",
                "prompt": "What electrical GPIO mode is required for shared multi-drop buses like I2C?",
                "options": [
                    {"id": "a", "text": "Open-Drain with external pull-up resistors"},
                    {"id": "b", "text": "High-speed Push-Pull"},
                    {"id": "c", "text": "Analog input mode"},
                    {"id": "d", "text": "Floating tri-state without pull-up"}
                ],
                "answerId": "a",
                "explanation": "Open-drain configuration allows multiple devices to share the bus without electrical conflict: any device can pull the line LOW, while the pull-up resistor pulls it HIGH when idle."
            },
            {
                "id": "q-iot-c-peri-exam-3",
                "prompt": "How does the Bit Set/Reset Register (BSRR) eliminate race conditions in embedded software?",
                "options": [
                    {"id": "a", "text": "It performs pin modification in a single atomic bus cycle without a read-modify-write phase."},
                    {"id": "b", "text": "It halts all CPU interrupts for 100 milliseconds automatically."},
                    {"id": "c", "text": "It routes pin outputs through a hardware cryptographic hash unit."},
                    {"id": "d", "text": "It replaces digital GPIO pins with analog operational amplifiers."}
                ],
                "answerId": "a",
                "explanation": "BSRR allows individual pins to be set or reset with a single write, preventing interrupt routines from clobbering concurrent port modifications."
            },
            {
                "id": "q-iot-c-peri-exam-4",
                "prompt": "What happens if an interrupt flag in a peripheral status register is not cleared inside its ISR?",
                "options": [
                    {"id": "a", "text": "The NVIC immediately triggers the ISR again upon return, hanging the CPU in an interrupt storm."},
                    {"id": "b", "text": "The microcontroller executes a warm reboot to factory firmware."},
                    {"id": "c", "text": "The peripheral permanently switches its clock frequency to 32.768 kHz."},
                    {"id": "d", "text": "The compiler issues a runtime syntax error over the serial port."}
                ],
                "answerId": "a",
                "explanation": "If the interrupt flag remains asserted, the interrupt controller sees an active pending interrupt and immediately jumps back into the ISR, blocking all lower-priority and background code."
            },
            {
                "id": "q-iot-c-peri-exam-5",
                "prompt": "In an embedded timer with clock frequency 10 MHz, Prescaler (PSC) = 9, and Auto-Reload (ARR) = 999, what is the output PWM frequency?",
                "options": [
                    {"id": "a", "text": "1 kHz"},
                    {"id": "b", "text": "10 kHz"},
                    {"id": "c", "text": "100 Hz"},
                    {"id": "d", "text": "1 MHz"}
                ],
                "answerId": "a",
                "explanation": "Timer tick frequency = 10 MHz / (9 + 1) = 1 MHz. PWM period count = 999 + 1 = 1000 counts. PWM frequency = 1 MHz / 1000 = 1000 Hz (1 kHz)."
            }
        ]
    }
}

COURSE_3 = {
    "id": "iot-c-buses",
    "version": 1,
    "order": 3,
    "title": "Serial Bus Protocols in C: UART, I2C & SPI",
    "summary": "Implement high-reliability serial bus drivers in C using lock-free circular ring buffers, I2C master register state machines, full-duplex SPI transactions, and CRC-8 packet framing.",
    "difficulty": "Intermediate",
    "minutes": 55,
    "codeExt": "c",
    "lessons": [
        {
            "id": "iot-c-bus-uart",
            "title": "UART Framing & Lock-Free Circular Ring Buffers",
            "paragraphs": [
                "Universal Asynchronous Receiver-Transmitter (UART) is the ubiquitous point-to-point serial protocol for edge IoT debugging, GPS modules, and cellular modems. UART frames consist of 1 Start bit (low), 8 Data bits (LSB first), optional Parity, and 1 or 2 Stop bits (high). Because transmitter and receiver share no common clock, both sides must agree on baud rate (e.g. 115200 bps) with clock drift under 2%.",
                "When characters arrive at 115200 baud, a new byte arrives every 86.8 microseconds. If the CPU blocked waiting to read each byte, sensor processing would grind to a halt. The standard architecture couples a UART RX interrupt to a Single-Producer Single-Consumer (SPSC) Circular FIFO Ring Buffer: the ISR enqueues incoming bytes by incrementing the `head` pointer, while application code dequeues bytes by incrementing the `tail` pointer—completely lock-free."
            ],
            "example": "#define RING_BUFFER_SIZE 64 // Must be power of 2\n\ntypedef struct {\n    uint8_t buffer[RING_BUFFER_SIZE];\n    volatile uint32_t head;\n    volatile uint32_t tail;\n} RingBuffer;\n\nbool ring_buffer_push(RingBuffer *rb, uint8_t byte) {\n    uint32_t next = (rb->head + 1) & (RING_BUFFER_SIZE - 1);\n    if (next == rb->tail) return false; // Buffer Full\n    rb->buffer[rb->head] = byte;\n    rb->head = next;\n    return true;\n}\n\nbool ring_buffer_pop(RingBuffer *rb, uint8_t *byte) {\n    if (rb->head == rb->tail) return false; // Buffer Empty\n    *byte = rb->buffer[rb->tail];\n    rb->tail = (rb->tail + 1) & (RING_BUFFER_SIZE - 1);\n    return true;\n}",
            "pitfall": "Using non-power-of-two buffer sizes with modulo operator `%`. Modulo division uses multiple CPU clock cycles or library calls, whereas bitwise `& (SIZE - 1)` compiles to a single 1-cycle instruction.",
            "question": {
                "id": "q-iot-c-bus-1",
                "prompt": "Why are ring buffer capacities typically sized to powers of two (e.g. 64, 128, 256) in embedded C?",
                "options": [
                    {"id": "a", "text": "It allows index wrapping with a fast single-cycle bitwise AND `(idx + 1) & (SIZE - 1)` instead of expensive modulo division."},
                    {"id": "b", "text": "Hardware UART chips can only store powers of two in silicon registers."},
                    {"id": "c", "text": "It automatically enables AES hardware encryption across the serial channel."}
                ],
                "answerId": "a",
                "explanation": "When SIZE is a power of two, wrapping the index with `& (SIZE - 1)` produces identical results to `% SIZE` in a single fast bitwise instruction."
            }
        },
        {
            "id": "iot-c-bus-i2c",
            "title": "I2C Protocol Implementation: START, ACK/NACK & Register Access",
            "paragraphs": [
                "Inter-Integrated Circuit (I2C) is a synchronous, multi-device two-wire bus consisting of Serial Data (SDA) and Serial Clock (SCL) with open-drain pull-ups. I2C supports multiple sensor devices on a single bus using 7-bit device addressing. A master initiates communication with a START condition (SDA pulled LOW while SCL is HIGH), followed by the 7-bit address and a Read/Write bit (0 for Write, 1 for Read).",
                "The target slave acknowledges by pulling SDA LOW on the 9th clock pulse (ACK). If a slave is missing, damaged, or busy, SDA remains HIGH (NACK). Reading sensor registers typically requires a combined transaction: the master writes the target internal register address, issues a Repeated START condition, sends the slave address with Read bit set, clocks in the data bytes, sends NACK on the final byte, and concludes with a STOP condition."
            ],
            "example": "// Typical I2C master register read sequence in C\nbool i2c_read_sensor_register(uint8_t dev_addr, uint8_t reg_addr, uint8_t *data, uint16_t len) {\n    if (!i2c_start()) return false;\n    if (!i2c_write_byte((dev_addr << 1) | 0)) { i2c_stop(); return false; } // Write device addr\n    if (!i2c_write_byte(reg_addr))           { i2c_stop(); return false; } // Select register\n    if (!i2c_start()) return false;                                         // Repeated START\n    if (!i2c_write_byte((dev_addr << 1) | 1)) { i2c_stop(); return false; } // Read device addr\n    for (uint16_t i = 0; i < len; i++) {\n        bool send_ack = (i < len - 1); // NACK on last byte\n        data[i] = i2c_read_byte(send_ack);\n    }\n    i2c_stop();\n    return true;\n}",
            "pitfall": "Failing to send a NACK before the STOP condition on the final received byte in an I2C read transaction. The slave will continue driving SDA LOW, causing a bus lockup condition.",
            "question": {
                "id": "q-iot-c-bus-2",
                "prompt": "What must an I2C master send on the final received byte of a multi-byte read transaction before sending STOP?",
                "options": [
                    {"id": "a", "text": "A NACK (leaving SDA HIGH) to notify the slave that reception is terminating."},
                    {"id": "b", "text": "An ACK (pulling SDA LOW) followed by a 1-second delay."},
                    {"id": "c", "text": "A 9-bit parity checksum pulse."}
                ],
                "answerId": "a",
                "explanation": "The master signals the end of a read sequence by not acknowledging (NACK) the last byte. This releases the SDA line so the master can safely generate a STOP condition."
            }
        },
        {
            "id": "iot-c-bus-spi",
            "title": "High-Speed SPI: Modes, Shift Registers & Chip Selects",
            "paragraphs": [
                "Serial Peripheral Interface (SPI) is a synchronous, full-duplex 4-wire bus: Master Out Slave In (MOSI), Master In Slave Out (MISO), Serial Clock (SCK), and active-low Chip Select (CS). SPI achieves high data rates (10 MHz to 80 MHz), making it the primary choice for displays, SD cards, external Flash, and fast IMUs.",
                "SPI operates through synchronized shift registers: on every clock edge, the master shifts a bit out on MOSI while shifting a bit in from MISO. SPI defines four modes based on Clock Polarity (CPOL) and Clock Phase (CPHA): Mode 0 (CPOL=0, CPHA=0: clock idle LOW, sample on leading rising edge) and Mode 3 (CPOL=1, CPHA=1: clock idle HIGH, sample on trailing rising edge) are the most common in modern sensors."
            ],
            "example": "// Full-duplex SPI byte exchange in C\nuint8_t spi_transfer_byte(SPI_TypeDef *spi, uint8_t tx_byte) {\n    while (!(spi->SR & SPI_SR_TXE)); // Wait until transmit buffer empty\n    spi->DR = tx_byte;               // Write data to start transmission\n    while (!(spi->SR & SPI_SR_RXNE)); // Wait until receive buffer not empty\n    return (uint8_t)spi->DR;         // Read received byte from shift register\n}",
            "pitfall": "Leaving Chip Select (CS) asserted between independent sensor transactions. Multiple SPI slaves sharing the same MISO line will electrically contend and corrupt communications if CS lines overlap.",
            "question": {
                "id": "q-iot-c-bus-3",
                "prompt": "What defines SPI Mode 0 in terms of Clock Polarity (CPOL) and Clock Phase (CPHA)?",
                "options": [
                    {"id": "a", "text": "CPOL = 0 (clock idle LOW), CPHA = 0 (data sampled on leading/rising clock edge)"},
                    {"id": "b", "text": "CPOL = 1 (clock idle HIGH), CPHA = 1 (data sampled on trailing edge)"},
                    {"id": "c", "text": "CPOL = 0, CPHA = 1 (clock idle LOW, data sampled on falling edge)"}
                ],
                "answerId": "a",
                "explanation": "Mode 0 features CPOL=0 (clock line is LOW when idle) and CPHA=0 (data is sampled on the first/leading clock transition, which is the rising edge)."
            }
        },
        {
            "id": "iot-c-bus-dma",
            "title": "Packet Framing & CRC-8 Error Detection in C",
            "paragraphs": [
                "Raw serial streams are prone to byte drops, electrical noise spikes, and packet boundary ambiguity. Production IoT firmware encapsulates sensor telemetry into structured binary frames. A robust frame format includes: Start-of-Frame delimiter byte (e.g. `0xAA`), Payload Length, Sequence ID, Command/Type, Payload Data, Cyclic Redundancy Check (CRC), and End-of-Frame delimiter (`0x55`).",
                "Unlike a simple sum checksum (which fails to detect transposed bytes), a Cyclic Redundancy Check (CRC-8) uses polynomial division (such as CRC-8-CCITT $x^8 + x^2 + x + 1$, polynomial `0x07`). The transmitter appends the computed CRC byte to the message; the receiver recomputes the CRC over the received payload and rejects corrupted packets before executing commands."
            ],
            "example": "// Fast CRC-8 polynomial calculation in C\nuint8_t crc8_calculate(const uint8_t *data, size_t len) {\n    uint8_t crc = 0x00;\n    for (size_t i = 0; i < len; i++) {\n        crc ^= data[i];\n        for (uint8_t b = 0; b < 8; b++) {\n            if (crc & 0x80) {\n                crc = (crc << 1) ^ 0x07; // Polynomial x^8 + x^2 + x + 1\n            } else {\n                crc <<= 1;\n            }\n        }\n    }\n    return crc;\n}",
            "pitfall": "Using simple 8-bit sum checksums for mission-critical telemetry. Swapping two bytes in transit produces an identical sum, silently letting corrupted payloads pass validation.",
            "question": {
                "id": "q-iot-c-bus-4",
                "prompt": "Why is a polynomial CRC-8 significantly more reliable than a simple arithmetic sum checksum?",
                "options": [
                    {"id": "a", "text": "CRC detects byte transpositions, burst bit errors, and bit inversions that produce identical arithmetic sums."},
                    {"id": "b", "text": "CRC compresses the data payload by 50%."},
                    {"id": "c", "text": "CRC automatically requests retransmissions at the hardware PHY level."}
                ],
                "answerId": "a",
                "explanation": "Arithmetic addition is commutative ($A + B = B + A$), making it blind to byte order swaps. CRC polynomial division reliably flags bit shifts, bursts, and byte transpositions."
            }
        }
    ],
    "steps": [
        "Study the lock-free single-producer single-consumer (SPSC) circular ring buffer implementation.",
        "Examine the simulated I2C register transaction sequence with START/STOP and ACK/NACK signaling.",
        "Inspect the full-duplex SPI exchange routine and SPI clock mode parameters.",
        "Compile and run `iot-c-buses.c` with GCC: `gcc -std=c11 -Wall -Wextra iot-c-buses.c -o iot-c-buses`."
    ],
    "expected": "The program demonstrates lock-free ring buffer enqueue and dequeue operations, simulates multi-register I2C sensor reading, executes full-duplex SPI telemetry exchanges, and verifies CRC-8 framed packets.",
    "code": """#include <stdio.h>
#include <stdint.h>
#include <stdbool.h>
#include <string.h>

#define RING_BUF_SIZE 64
#define FRAME_SOF     0xAA
#define FRAME_EOF     0x55

typedef struct {
    uint8_t buffer[RING_BUF_SIZE];
    volatile uint32_t head;
    volatile uint32_t tail;
} RingBuffer;

typedef struct {
    uint8_t sof;
    uint8_t length;
    uint8_t cmd;
    uint8_t payload[16];
    uint8_t crc;
    uint8_t eof;
} TelemetryFrame;

uint8_t crc8_calc(const uint8_t *data, size_t len) {
    uint8_t crc = 0x00;
    for (size_t i = 0; i < len; i++) {
        crc ^= data[i];
        for (uint8_t b = 0; b < 8; b++) {
            if (crc & 0x80) crc = (crc << 1) ^ 0x07;
            else crc <<= 1;
        }
    }
    return crc;
}

void ring_init(RingBuffer *rb) {
    memset(rb, 0, sizeof(*rb));
}

bool ring_push(RingBuffer *rb, uint8_t val) {
    uint32_t next = (rb->head + 1) & (RING_BUF_SIZE - 1);
    if (next == rb->tail) return false;
    rb->buffer[rb->head] = val;
    rb->head = next;
    return true;
}

bool ring_pop(RingBuffer *rb, uint8_t *val) {
    if (rb->head == rb->tail) return false;
    *val = rb->buffer[rb->tail];
    rb->tail = (rb->tail + 1) & (RING_BUF_SIZE - 1);
    return true;
}

uint32_t ring_count(const RingBuffer *rb) {
    return (rb->head - rb->tail) & (RING_BUF_SIZE - 1);
}

// Simulate full-duplex SPI transaction
uint8_t mock_spi_transfer(uint8_t tx_byte) {
    // Return inverted byte as simulated slave response
    return (uint8_t)(~tx_byte);
}

int main(void) {
    RingBuffer rx_ring;
    ring_init(&rx_ring);

    printf("[BUS] Testing Lock-Free UART Ring Buffer (Capacity=%d)...\\n", RING_BUF_SIZE);
    for (uint8_t i = 0; i < 20; i++) {
        ring_push(&rx_ring, (uint8_t)(i + 10));
    }
    printf("[UART] Pushed 20 bytes. Items in queue: %u\\n", ring_count(&rx_ring));

    uint8_t drained = 0;
    while (ring_pop(&rx_ring, &drained)) {
        // Drained cleanly
    }
    printf("[UART] Drained all bytes. Items remaining: %u\\n", ring_count(&rx_ring));

    // Prepare a structured Telemetry Frame
    TelemetryFrame frame;
    frame.sof = FRAME_SOF;
    frame.cmd = 0x02; // CMD: Sensor Telemetry
    frame.length = 4;
    frame.payload[0] = 0x19; // Temp high byte (25 deg)
    frame.payload[1] = 0x04; // Temp low byte
    frame.payload[2] = 0x32; // Humidity (50%)
    frame.payload[3] = 0x00;

    // CRC computed over CMD + length + payload
    uint8_t crc_buffer[6];
    crc_buffer[0] = frame.cmd;
    crc_buffer[1] = frame.length;
    memcpy(&crc_buffer[2], frame.payload, 4);
    frame.crc = crc8_calc(crc_buffer, 6);
    frame.eof = FRAME_EOF;

    printf("[PACKET] Encoded Telemetry Frame: SOF=0x%02X, CMD=0x%02X, LEN=%u, CRC=0x%02X, EOF=0x%02X\\n",
           frame.sof, frame.cmd, frame.length, frame.crc, frame.eof);

    // Validate CRC verification logic
    uint8_t verify_crc = crc8_calc(crc_buffer, 6);
    if (verify_crc != frame.crc) {
        printf("[ERROR] CRC check failed!\\n");
        return 1;
    }
    printf("[PACKET] CRC validation check passed successfully (0x%02X == 0x%02X).\\n",
           verify_crc, frame.crc);

    // Test SPI Full-Duplex Transfer
    uint8_t spi_tx = 0x5A;
    uint8_t spi_rx = mock_spi_transfer(spi_tx);
    printf("[SPI] Full-Duplex Transfer: TX=0x%02X -> RX=0x%02X (Expected=0x%02X)\\n",
           spi_tx, spi_rx, (uint8_t)(~spi_tx));

    if (spi_rx != (uint8_t)(~spi_tx)) {
        printf("[ERROR] SPI full-duplex transfer mismatch!\\n");
        return 1;
    }
    printf("[STATUS] Serial buses, ring buffer, and CRC verification verified cleanly.\\n");
    return 0;
}
""",
    "challenge": {
        "task": "Add Consistent Overhead Byte Stuffing (COBS) framing to prevent delimiter bytes inside the payload.",
        "acceptance": [
            "Implement a COBS encode function that eliminates all 0x00 delimiter bytes from the framed packet.",
            "Add framing error counters for unexpected SOF/EOF delimiter sequences.",
            "Verify the ring buffer handles concurrent ISR push simulation during continuous draining."
        ]
    },
    "sources": [
        {"title": "I2C Bus Specification and User Manual (NXP UM10204)", "url": "https://www.nxp.com/docs/en/user-guide/UM10204.pdf"},
        {"title": "Motorola SPI Block Guide V04.01", "url": "https://web.archive.org/web/20150413003534/http://www.ee.nmt.edu/~teare/ee308l/spidrv.pdf"}
    ],
    "exam": {
        "passPercent": 80,
        "questions": [
            {
                "id": "q-iot-c-bus-exam-1",
                "prompt": "What ensures thread-safety in a Single-Producer Single-Consumer (SPSC) circular FIFO ring buffer without mutexes?",
                "options": [
                    {"id": "a", "text": "The producer exclusively writes the head pointer and the consumer exclusively writes the tail pointer."},
                    {"id": "b", "text": "The CPU halts execution while the buffer is being accessed."},
                    {"id": "c", "text": "The ring buffer is stored inside an SPI EEPROM chip."},
                    {"id": "d", "text": "The compiler disables interrupts for all functions that contain pointers."}
                ],
                "answerId": "a",
                "explanation": "Because only one thread modifies the head pointer and only the other modifies the tail pointer, a single-producer single-consumer ring buffer is lock-free."
            },
            {
                "id": "q-iot-c-bus-exam-2",
                "prompt": "What physical hardware characteristic allows multiple I2C slave devices to share the SDA and SCL lines?",
                "options": [
                    {"id": "a", "text": "Open-drain outputs with pull-up resistors preventing short circuits when multiple pins switch."},
                    {"id": "b", "text": "Differential high-voltage signaling at 48V."},
                    {"id": "c", "text": "Hardware radio-frequency modulation."},
                    {"id": "d", "text": "Dedicated physical chip select wires for every slave."}
                ],
                "answerId": "a",
                "explanation": "Open-drain drivers allow devices to pull lines LOW or let them float HIGH via resistors, preventing high-current short circuits when devices share the bus."
            },
            {
                "id": "q-iot-c-bus-exam-3",
                "prompt": "In SPI communication, what occurs on every single clock pulse?",
                "options": [
                    {"id": "a", "text": "A full-duplex simultaneous shift of one bit out on MOSI and one bit in from MISO."},
                    {"id": "b", "text": "The master checks for I2C START conditions."},
                    {"id": "c", "text": "The slave transmits an automatic 16-bit CRC response."},
                    {"id": "d", "text": "The UART baud rate generator is recalibrated."}
                ],
                "answerId": "a",
                "explanation": "SPI is fundamentally a circular shift register: on every SCK pulse, the master simultaneously transmits one bit on MOSI and samples one bit from MISO."
            },
            {
                "id": "q-iot-c-bus-exam-4",
                "prompt": "Why is CRC-8 preferred over an 8-bit additive checksum in serial telemetry protocols?",
                "options": [
                    {"id": "a", "text": "Polynomial division detects transposed bytes and burst bit flips that yield identical additive sums."},
                    {"id": "b", "text": "Additive checksums require 10 times more CPU RAM than CRC-8."},
                    {"id": "c", "text": "CRC-8 is required by the Linux operating system kernel for all GPIO pins."},
                    {"id": "d", "text": "Additive checksums cannot be compiled with GCC."}
                ],
                "answerId": "a",
                "explanation": "Addition is commutative, so swapping bytes produces the same sum. CRC polynomial division is position-dependent and catches burst and transposition errors."
            },
            {
                "id": "q-iot-c-bus-exam-5",
                "prompt": "What happens if an SPI master fails to de-assert Chip Select (CS) after communicating with a sensor?",
                "options": [
                    {"id": "a", "text": "The sensor keeps driving MISO, colliding with any other slave communicating on the shared SPI bus."},
                    {"id": "b", "text": "The microcontroller's internal SRAM is immediately erased."},
                    {"id": "c", "text": "The SPI clock polarity permanently flips from Mode 0 to Mode 3."},
                    {"id": "d", "text": "The UART baud rate automatically increases by 50%."}
                ],
                "answerId": "a",
                "explanation": "Active-low CS keeps the slave's MISO output driver active. If CS is not de-asserted (set HIGH), it will fight with other devices sharing the MISO line."
            }
        ]
    }
}

COURSES_1_TO_3 = [COURSE_1, COURSE_2, COURSE_3]
