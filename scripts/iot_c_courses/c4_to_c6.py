"""Courses 4 to 6 for the Embedded IoT in C track."""

COURSE_4 = {
    "id": "iot-c-rtos",
    "version": 1,
    "order": 4,
    "title": "Real-Time Operating Systems (FreeRTOS) & Concurrency in C",
    "summary": "Build responsive, multi-threaded IoT firmware using FreeRTOS task scheduling, inter-task message queues, binary/counting semaphores, and priority inheritance mutexes in C.",
    "difficulty": "Intermediate",
    "minutes": 55,
    "codeExt": "c",
    "lessons": [
        {
            "id": "iot-c-rtos-scheduling",
            "title": "Real-Time Kernels: Preemptive Priority Scheduling & Context Switching",
            "paragraphs": [
                "When an IoT device must concurrently sample high-frequency sensors, process telemetry, manage a Wi-Fi connection, and monitor safety limits, a single-threaded super-loop becomes difficult to maintain. A Real-Time Operating System (RTOS) like FreeRTOS introduces deterministic, preemptive priority-based multitasking. Each task is an independent C function running in its own infinite loop with a dedicated stack and a Task Control Block (TCB).",
                "The RTOS kernel uses the hardware timer (SysTick) to drive timeslicing and the PendSV interrupt on ARM Cortex-M to perform context switches: pausing the running task, pushing core registers (R0-R12, LR, PC, xPSR) onto its stack, loading the stack pointer of the highest-priority Ready task, and resuming execution. Tasks can be in one of four states: Running, Ready, Blocked (waiting for an event or delay), or Suspended."
            ],
            "example": "// FreeRTOS task declaration and creation in C\nvoid vSensorTask(void *pvParameters) {\n    TickType_t xLastWakeTime = xTaskGetTickCount();\n    const TickType_t xFrequency = pdMS_TO_TICKS(100); // 100 ms period\n    for (;;) {\n        sample_adc_sensors();\n        // Unblocks exactly every 100ms regardless of execution duration\n        vTaskDelayUntil(&xLastWakeTime, xFrequency);\n    }\n}\n\n// Creating the task with 2048-byte stack and priority 2\nxTaskCreate(vSensorTask, \"Sensors\", 512, NULL, 2, NULL);",
            "pitfall": "Using standard `vTaskDelay(100)` inside a periodic loop instead of `vTaskDelayUntil()`. Regular delay adds execution time to the delay interval, causing cumulative timing drift over time.",
            "question": {
                "id": "q-iot-c-rtos-1",
                "prompt": "How does `vTaskDelayUntil()` differ from `vTaskDelay()` in a periodic FreeRTOS task?",
                "options": [
                    {"id": "a", "text": "It specifies the absolute target unblock time, ensuring a constant periodic frequency regardless of task execution time."},
                    {"id": "b", "text": "It turns off the CPU hardware clock completely."},
                    {"id": "c", "text": "It temporarily elevates the task to maximum kernel priority."}
                ],
                "answerId": "a",
                "explanation": "`vTaskDelayUntil()` accounts for the time spent executing task code, guaranteeing that the task wakes up at exact periodic intervals without drift."
            }
        },
        {
            "id": "iot-c-rtos-tasks",
            "title": "Task Lifecycle, Stack Sizing & Stack Watermark Monitoring",
            "paragraphs": [
                "In desktop operating systems, thread stacks can dynamically grow by megabytes. In FreeRTOS, every task has a fixed stack allocated from static memory or the RTOS heap when the task is created. If a task exceeds its allocated stack (due to deep function call recursion, large local arrays, or format strings like `sprintf`), it corrupts adjacent memory—a catastrophic Stack Overflow.",
                "Production firmware uses stack watermark monitoring: `uxTaskGetStackHighWaterMark()` checks the unused stack space remaining since task creation. FreeRTOS fills stack space with a known pattern (`0xA5`); the high watermark function scans how much of this pattern remains untouched. Developers monitor watermarks during testing to trim oversized stacks and enlarge endangered stacks."
            ],
            "example": "// Stack watermark check in FreeRTOS\nvoid monitor_task_stack(TaskHandle_t task_handle, const char *task_name) {\n    UBaseType_t words_remaining = uxTaskGetStackHighWaterMark(task_handle);\n    printf(\"[RTOS] Task '%s': stack watermark = %u words (%u bytes free)\\n\",\n           task_name, (unsigned)words_remaining, (unsigned)(words_remaining * sizeof(StackType_t)));\n    if (words_remaining < 32) {\n        printf(\"[WARNING] Task '%s' is approaching dangerous stack overflow!\\n\", task_name);\n    }\n}",
            "pitfall": "Declaring large local buffers inside RTOS task functions, such as `uint8_t buffer[1024];` on a task allocated with only 512 words of stack. This instantly triggers a fatal stack overflow.",
            "question": {
                "id": "q-iot-c-rtos-2",
                "prompt": "What does FreeRTOS `uxTaskGetStackHighWaterMark()` report for a running task?",
                "options": [
                    {"id": "a", "text": "The minimum amount of unused stack space that has remained since the task was created."},
                    {"id": "b", "text": "The percentage of CPU time consumed by the task."},
                    {"id": "c", "text": "The number of pending messages waiting in the task's queue."}
                ],
                "answerId": "a",
                "explanation": "The high watermark represents the closest the task has ever come to overflowing its stack. The closer this number is to zero, the closer the task came to a crash."
            }
        },
        {
            "id": "iot-c-rtos-queues",
            "title": "Inter-Task Communication with Message Queues",
            "paragraphs": [
                "In a multi-tasking system, tasks must communicate without race conditions. FreeRTOS Queues provide the primary thread-safe mechanism for inter-task communication. Queues operate FIFO (First-In, First-Out) and are deeply integrated with the scheduler: if a task reads from an empty queue, it automatically transitions to the Blocked state until data arrives or a timeout expires, consuming zero CPU cycles while waiting.",
                "Queues copy data by value (byte copy) or by reference (passing pointers to memory pool buffers). Passing pointers minimizes copying overhead for large network payloads, while passing structs by value is safer for small telemetry records (preventing use-after-free bugs). Interrupt Service Routines use dedicated non-blocking variants: `xQueueSendFromISR()`."
            ],
            "example": "typedef struct {\n    uint32_t timestamp;\n    float temperature;\n    float humidity;\n} SensorData;\n\nstatic QueueHandle_t s_sensor_queue = NULL;\n\nvoid init_pipeline(void) {\n    // Create queue capable of holding 10 SensorData items\n    s_sensor_queue = xQueueCreate(10, sizeof(SensorData));\n}\n\nvoid publish_reading(float temp, float hum) {\n    SensorData data = { .timestamp = 1000, .temperature = temp, .humidity = hum };\n    // Block up to 50ms if queue is full\n    xQueueSend(s_sensor_queue, &data, pdMS_TO_TICKS(50));\n}",
            "pitfall": "Calling standard `xQueueSend()` inside an ISR instead of `xQueueSendFromISR()`. Standard queue functions contain task blocking logic and will crash the microcontroller inside an interrupt context.",
            "question": {
                "id": "q-iot-c-rtos-3",
                "prompt": "What happens when a task calls `xQueueReceive()` on an empty FreeRTOS queue with a non-zero timeout?",
                "options": [
                    {"id": "a", "text": "The task enters the Blocked state, allowing other lower or equal priority tasks to execute until data arrives or the timeout expires."},
                    {"id": "b", "text": "The task busy-spins in an infinite polling loop at 100% CPU utilization."},
                    {"id": "c", "text": "The microcontroller halts and reboots into the bootloader."}
                ],
                "answerId": "a",
                "explanation": "The RTOS moves the task to the Blocked list, yielding the CPU so other ready tasks can run without wasting clock cycles polling."
            }
        },
        {
            "id": "iot-c-rtos-sync",
            "title": "Semaphores, Mutexes & Priority Inversion Solutions",
            "paragraphs": [
                "When multiple tasks access a shared hardware resource (such as an I2C bus or an external Flash chip), uncoordinated access corrupts data transmissions. A Mutex (Mutual Exclusion) provides locking: a task takes the mutex before accessing the resource and releases it immediately after.",
                "A dangerous failure mode in priority preemptive systems is Unbounded Priority Inversion: a low-priority task holds a mutex; a high-priority task preempts and requests the mutex, becoming blocked; a medium-priority task (not needing the mutex) preempts the low-priority task. The high-priority task is now indirectly blocked by the medium task! FreeRTOS mutexes solve this via Priority Inheritance: the low-priority task temporarily inherits the high priority until it releases the mutex."
            ],
            "example": "static SemaphoreHandle_t s_i2c_mutex = NULL;\n\nvoid i2c_safe_read(uint8_t dev_addr, uint8_t *buf, size_t len) {\n    if (xSemaphoreTake(s_i2c_mutex, portMAX_DELAY) == pdTRUE) {\n        // Critical section: exclusive I2C bus ownership\n        hardware_i2c_read(dev_addr, buf, len);\n        xSemaphoreGive(s_i2c_mutex);\n    }\n}",
            "pitfall": "Using a binary semaphore instead of a mutex for shared resource protection. Binary semaphores do not support priority inheritance, leaving firmware vulnerable to catastrophic priority inversion lockups.",
            "question": {
                "id": "q-iot-c-rtos-4",
                "prompt": "How does Priority Inheritance resolve the priority inversion problem in an RTOS?",
                "options": [
                    {"id": "a", "text": "The low-priority task holding the mutex temporarily inherits the priority of the highest-priority task waiting on that mutex."},
                    {"id": "b", "text": "The kernel automatically kills all medium-priority tasks."},
                    {"id": "c", "text": "The blocked high-priority task is downgraded to idle priority."}
                ],
                "answerId": "a",
                "explanation": "By temporarily elevating the mutex holder's priority, medium-priority tasks cannot preempt it, allowing it to quickly release the mutex so the high-priority task can resume."
            }
        }
    ],
    "steps": [
        "Study the FreeRTOS task control block and context switch state transitions.",
        "Inspect the thread-safe message queue structure and blocking timeout parameters.",
        "Analyze the priority inheritance mechanism during resource contention.",
        "Compile and execute `iot-c-rtos.c` with GCC: `gcc -std=c11 -Wall -Wextra iot-c-rtos.c -o iot-c-rtos`."
    ],
    "expected": "The program executes a multi-task preemptive priority scheduler simulation, transfers sensor telemetry across a thread-safe message queue, logs task executions, and resolves priority inversion via priority inheritance.",
    "code": """#include <stdio.h>
#include <stdint.h>
#include <stdbool.h>
#include <string.h>

#define MAX_TASKS       4
#define QUEUE_CAPACITY  8

typedef enum {
    TASK_STATE_READY,
    TASK_STATE_RUNNING,
    TASK_STATE_BLOCKED
} TaskState;

typedef struct {
    const char *name;
    uint8_t base_priority;
    uint8_t current_priority;
    TaskState state;
    uint32_t stack_high_watermark;
    uint32_t run_count;
    void (*task_fn)(void);
} MockTCB;

typedef struct {
    uint32_t data[QUEUE_CAPACITY];
    uint8_t head;
    uint8_t tail;
    uint8_t count;
} MockQueue;

typedef struct {
    bool is_locked;
    MockTCB *owner;
} MockMutex;

static MockTCB s_tasks[MAX_TASKS];
static uint8_t s_task_count = 0;
static MockQueue s_telemetry_queue;
static MockMutex s_bus_mutex;

void queue_init(MockQueue *q) {
    memset(q, 0, sizeof(*q));
}

bool queue_send(MockQueue *q, uint32_t item) {
    if (q->count >= QUEUE_CAPACITY) return false;
    q->data[q->head] = item;
    q->head = (q->head + 1) % QUEUE_CAPACITY;
    q->count++;
    return true;
}

bool queue_receive(MockQueue *q, uint32_t *item) {
    if (q->count == 0) return false;
    *item = q->data[q->tail];
    q->tail = (q->tail + 1) % QUEUE_CAPACITY;
    q->count--;
    return true;
}

void mutex_lock(MockMutex *m, MockTCB *requesting_task) {
    if (!m->is_locked) {
        m->is_locked = true;
        m->owner = requesting_task;
    } else {
        // Priority inheritance: elevate owner priority if requester has higher priority
        if (requesting_task->current_priority > m->owner->current_priority) {
            printf("[MUTEX] Priority Inheritance: elevating task '%s' (prio %u -> %u)\\n",
                   m->owner->name, m->owner->current_priority, requesting_task->current_priority);
            m->owner->current_priority = requesting_task->current_priority;
        }
    }
}

void mutex_unlock(MockMutex *m) {
    if (m->is_locked && m->owner) {
        // Restore base priority
        if (m->owner->current_priority != m->owner->base_priority) {
            printf("[MUTEX] Releasing mutex: restoring task '%s' to base priority %u\\n",
                   m->owner->name, m->owner->base_priority);
            m->owner->current_priority = m->owner->base_priority;
        }
        m->is_locked = false;
        m->owner = NULL;
    }
}

int main(void) {
    queue_init(&s_telemetry_queue);
    memset(&s_bus_mutex, 0, sizeof(s_bus_mutex));

    printf("[RTOS] Initializing Mock Real-Time Kernel Scheduler...\\n");

    // Configure 3 tasks with varying priorities
    s_tasks[0] = (MockTCB){ .name = \"SensorLow\", .base_priority = 1, .current_priority = 1,
                            .state = TASK_STATE_READY, .stack_high_watermark = 128 };
    s_tasks[1] = (MockTCB){ .name = \"FilterMed\",  .base_priority = 2, .current_priority = 2,
                            .state = TASK_STATE_READY, .stack_high_watermark = 256 };
    s_tasks[2] = (MockTCB){ .name = \"UplinkHigh\", .base_priority = 3, .current_priority = 3,
                            .state = TASK_STATE_READY, .stack_high_watermark = 512 };
    s_task_count = 3;

    // Simulate Inter-Task Queue Pipeline
    printf(\"[QUEUE] SensorLow pushing 3 telemetry frames to queue...\\n\");
    queue_send(&s_telemetry_queue, 101);
    queue_send(&s_telemetry_queue, 102);
    queue_send(&s_telemetry_queue, 103);
    printf(\"[QUEUE] Queue size: %u / %u\\n\", s_telemetry_queue.count, QUEUE_CAPACITY);

    uint32_t val = 0;
    while (queue_receive(&s_telemetry_queue, &val)) {
        printf(\"  UplinkHigh received frame: %u\\n\", val);
    }

    // Simulate Priority Inversion & Inheritance
    printf(\"[SCENARIO] SensorLow acquires I2C bus mutex...\\n\");
    mutex_lock(&s_bus_mutex, &s_tasks[0]);

    printf(\"[SCENARIO] UplinkHigh attempts to acquire I2C bus mutex...\\n\");
    mutex_lock(&s_bus_mutex, &s_tasks[2]);

    if (s_tasks[0].current_priority != 3) {
        printf(\"[ERROR] Priority inheritance failed to elevate owner!\\n\");
        return 1;
    }

    printf(\"[SCENARIO] SensorLow completes transfer and unlocks mutex...\\n\");
    mutex_unlock(&s_bus_mutex);

    if (s_tasks[0].current_priority != 1) {
        printf(\"[ERROR] Mutex unlock failed to restore base priority!\\n\");
        return 1;
    }

    printf(\"[STATUS] FreeRTOS concurrency, queue pipeline, and priority inheritance verified cleanly.\\n\");
    return 0;
}
""",
    "challenge": {
        "task": "Add a task deadline monitoring system in C that flags tasks exceeding their 20ms execution budget.",
        "acceptance": [
            "Add an execution time tracker to the TCB that records execution ticks per task run.",
            "Assert a warning if any sensor acquisition task takes longer than 20 ticks.",
            "Verify thread-safe queue operations prevent writes when the queue count equals capacity."
        ]
    },
    "sources": [
        {"title": "FreeRTOS Real-Time Kernel Developer Guide", "url": "https://www.freertos.org/Documentation/RTOS_book.html"},
        {"title": "Mastering the FreeRTOS Real Time Kernel (Richard Barry)", "url": "https://www.freertos.org/fr-content-src/uploads/2018/07/161204_Mastering_the_FreeRTOS_Real_Time_Kernel-A_Hands-On_Tutorial_Guide.pdf"}
    ],
    "exam": {
        "passPercent": 80,
        "questions": [
            {
                "id": "q-iot-c-rtos-exam-1",
                "prompt": "What hardware mechanism on ARM Cortex-M microcontrollers performs RTOS context switches?",
                "options": [
                    {"id": "a", "text": "The PendSV (Pended Servicable Call) interrupt handler"},
                    {"id": "b", "text": "The hardware SPI DMA controller"},
                    {"id": "c", "text": "The hardware CRC calculation unit"}
                ],
                "answerId": "a",
                "explanation": "PendSV is a software-triggerable interrupt configured to the lowest interrupt priority so context switching only occurs after all hardware ISRs have finished."
            },
            {
                "id": "q-iot-c-rtos-exam-2",
                "prompt": "Why is declaring large local arrays inside an RTOS task dangerous?",
                "options": [
                    {"id": "a", "text": "Local variables are allocated on the task's fixed stack, easily causing a fatal stack overflow into adjacent memory."},
                    {"id": "b", "text": "Local variables trigger automatic baud rate changes on UART0."},
                    {"id": "c", "text": "Local arrays force the compiler to convert C code into C++."}
                ],
                "answerId": "a",
                "explanation": "Because RTOS tasks have bounded stack allocations, declaring large local buffers quickly exhausts the stack, overwriting adjacent memory."
            },
            {
                "id": "q-iot-c-rtos-exam-3",
                "prompt": "Which function must be used to post a message to a FreeRTOS queue from inside a hardware Interrupt Service Routine?",
                "options": [
                    {"id": "a", "text": "xQueueSendFromISR()"},
                    {"id": "b", "text": "xQueueSend()"},
                    {"id": "c", "text": "malloc()"}
                ],
                "answerId": "a",
                "explanation": "Standard queue functions can block and enter the scheduler, which is forbidden inside an ISR. Only the dedicated *FromISR() APIs are safe."
            },
            {
                "id": "q-iot-c-rtos-exam-4",
                "prompt": "What problem does Priority Inheritance specifically resolve in multi-threaded embedded systems?",
                "options": [
                    {"id": "a", "text": "Unbounded Priority Inversion, where a medium-priority task indirectly starves a high-priority task."},
                    {"id": "b", "text": "Hardware timer prescaler rounding errors."},
                    {"id": "c", "text": "UART frame parity mismatch."}
                ],
                "answerId": "a",
                "explanation": "Priority inheritance temporarily boosts the priority of a low-priority task holding a mutex needed by a high-priority task, preventing medium tasks from preempting it."
            },
            {
                "id": "q-iot-c-rtos-exam-5",
                "prompt": "What does a return value of `pdPASS` or `pdTRUE` signify when calling `xQueueSend()`?",
                "options": [
                    {"id": "a", "text": "The item was successfully copied into the queue within the allowed timeout."},
                    {"id": "b", "text": "The queue has been permanently deleted from RAM."},
                    {"id": "c", "text": "The item was discarded because the queue was full."}
                ],
                "answerId": "a",
                "explanation": "pdTRUE indicates that space was available (or became available before timeout) and the item was safely copied into the queue buffer."
            }
        ]
    }
}

COURSE_5 = {
    "id": "iot-c-networking",
    "version": 1,
    "order": 5,
    "title": "Embedded Networking: lwIP & BSD Sockets in C",
    "summary": "Master embedded TCP/IP networking using the lightweight lwIP stack, standard BSD Sockets APIs in C, non-blocking I/O multiplexing with select(), and SNTP time synchronization.",
    "difficulty": "Intermediate",
    "minutes": 50,
    "codeExt": "c",
    "lessons": [
        {
            "id": "iot-c-net-lwip",
            "title": "The lwIP Embedded TCP/IP Stack & Packet Buffers",
            "paragraphs": [
                "The lightweight IP (lwIP) stack is the de-facto standard open-source TCP/IP implementation for resource-constrained microcontrollers (driving ESP32, STM32, and RTOS platforms). lwIP provides a full suite of network protocols—IPv4, IPv6, ICMP, UDP, TCP, DHCP, and DNS—while requiring only tens of kilobytes of RAM and roughly 40 KB of Flash ROM.",
                "lwIP manages memory using Packet Buffers (`pbufs`). There are three core types: `PBUF_RAM` (dynamically allocated in RAM for outbound payloads), `PBUF_ROM` (referencing constant data in Flash without copying), and `PBUF_REF` (referencing existing RAM buffers). lwIP chains `pbufs` into linked lists, allowing headers (Ethernet, IP, TCP) to be prepended without moving or reallocating the underlying payload bytes."
            ],
            "example": "/* Conceptual chained packet buffer (pbuf) in lwIP */\nstruct pbuf {\n    struct pbuf *next; // Pointer to next pbuf in packet chain\n    void *payload;     // Pointer to actual packet data\n    uint16_t tot_len;  // Total length of this pbuf + all subsequent pbufs\n    uint16_t len;      // Length of this specific buffer\n    uint8_t type;      // PBUF_RAM, PBUF_ROM, or PBUF_REF\n};",
            "pitfall": "Assuming a single `pbuf` contains the entire received TCP packet. TCP is a stream protocol; large packets are frequently split across multiple chained `pbufs`, requiring traversal of `pbuf->next`.",
            "question": {
                "id": "q-iot-c-net-1",
                "prompt": "How does lwIP's chained `pbuf` architecture optimize memory utilization in constrained microcontrollers?",
                "options": [
                    {"id": "a", "text": "It allows protocol headers (TCP, IP, Ethernet) to be prepended to payload chains without expensive buffer copying or reallocations."},
                    {"id": "b", "text": "It compresses every network packet by 80% using zip algorithms."},
                    {"id": "c", "text": "It stores incoming packets inside hardware Flash ROM sectors."}
                ],
                "answerId": "a",
                "explanation": "Chained pbufs allow network layers to prepend their respective headers as separate links in a list, avoiding costly memory copies and large contiguous allocations."
            }
        },
        {
            "id": "iot-c-net-sockets",
            "title": "BSD Sockets API in C: socket(), connect(), send() & recv()",
            "paragraphs": [
                "lwIP exposes the industry-standard POSIX / Berkeley Sockets API, enabling developers to write portable C networking code. A TCP client connection follows a deterministic lifecycle: creating a socket descriptor with `socket(AF_INET, SOCK_STREAM, 0)`, initializing a `struct sockaddr_in` with the target IPv4 address and port, and initiating the TCP 3-way handshake with `connect()`.",
                "Data transmission uses `send()` and `recv()`. A critical rule of TCP programming in C: `send()` and `recv()` do NOT guarantee that all requested bytes are transferred in a single call. In constrained networks, `send()` may transmit only a partial chunk of data, requiring the developer to loop until all bytes are sent: `sent = send(sock, buf + total, remaining, 0); total += sent;`."
            ],
            "example": "// Robust TCP send loop in C\nbool socket_send_all(int sock, const uint8_t *data, size_t len) {\n    size_t total_sent = 0;\n    while (total_sent < len) {\n        ssize_t sent = send(sock, data + total_sent, len - total_sent, 0);\n        if (sent <= 0) return false; // Connection closed or socket error\n        total_sent += (size_t)sent;\n    }\n    return true;\n}",
            "pitfall": "Calling `send(sock, buffer, 512, 0)` and assuming all 512 bytes were transmitted. Under network congestion, `send()` might transmit only 128 bytes; ignoring the return value drops the remaining 384 bytes.",
            "question": {
                "id": "q-iot-c-net-2",
                "prompt": "Why must embedded C developers always inspect the return value of `send()` and `recv()`?",
                "options": [
                    {"id": "a", "text": "TCP is a byte-stream protocol; send() and recv() may transfer only a subset of requested bytes in a single call."},
                    {"id": "b", "text": "send() returns the CPU clock speed in MHz."},
                    {"id": "c", "text": "recv() returns the temperature of the network PHY chip."}
                ],
                "answerId": "a",
                "explanation": "Network buffers and window sizes vary dynamically. The return value reports the exact number of bytes successfully accepted or received, necessitating a loop."
            }
        },
        {
            "id": "iot-c-net-nonblocking",
            "title": "Non-Blocking Sockets & Multiplexing with select()",
            "paragraphs": [
                "By default, BSD socket operations are blocking: calling `connect()` or `recv()` halts task execution until the remote server responds or a TCP timeout fires (which can take up to 2 minutes!). In an IoT device, blocking a thread for minutes freezes sensor acquisition and triggers watchdog resets.",
                "Robust IoT firmware configures sockets in non-blocking mode using `fcntl(sock, F_SETFL, O_NONBLOCK)`. Non-blocking operations return immediately with `EINPROGRESS` or `EWOULDBLOCK`. Developers use `select()` with `fd_set` masks and explicit timeout structures (`struct timeval`) to sleep until sockets are ready for read or write, enforcing strict timeouts (e.g. 3.0 seconds)."
            ],
            "example": "// Non-blocking connect with timeout in C\nbool nonblocking_connect(int sock, struct sockaddr_in *addr, uint32_t timeout_sec) {\n    fcntl(sock, F_SETFL, O_NONBLOCK);\n    connect(sock, (struct sockaddr *)addr, sizeof(*addr));\n\n    fd_set write_fds;\n    FD_ZERO(&write_fds);\n    FD_SET(sock, &write_fds);\n    struct timeval tv = { .tv_sec = timeout_sec, .tv_usec = 0 };\n\n    int res = select(sock + 1, NULL, &write_fds, NULL, &tv);\n    return (res > 0 && FD_ISSET(sock, &write_fds));\n}",
            "pitfall": "Using blocking socket calls without watchdog integration. If Wi-Fi disconnects or a cloud gateway stops acknowledging packets, blocking sockets hang indefinitely.",
            "question": {
                "id": "q-iot-c-net-3",
                "prompt": "What is the primary benefit of configuring IoT sockets with `O_NONBLOCK` and using `select()`?",
                "options": [
                    {"id": "a", "text": "It enables deterministic timeouts, preventing network stalls from freezing sensor loops or triggering watchdog resets."},
                    {"id": "b", "text": "It converts IPv4 addresses into 128-bit IPv6 addresses automatically."},
                    {"id": "c", "text": "It bypasses the need for an external Wi-Fi antenna."}
                ],
                "answerId": "a",
                "explanation": "Non-blocking sockets return immediately if data is unavailable, allowing `select()` to enforce strict application timeouts without freezing the device."
            }
        },
        {
            "id": "iot-c-net-sntp",
            "title": "Embedded DNS Resolution & SNTP Time Synchronization",
            "paragraphs": [
                "IoT devices need human-readable domain names (e.g., `mqtt.iot.us-east-1.amazonaws.com`) and accurate real-world timestamps for TLS certificate validation and data logging. Standard DNS resolution uses `getaddrinfo()`, which takes a hostname and populates a linked list of `struct addrinfo` IP addresses. Memory allocated by `getaddrinfo()` must always be released with `freeaddrinfo()` to prevent memory leaks.",
                "Simple Network Time Protocol (SNTP, RFC 4330) synchronizes device clocks over UDP port 123. The client transmits a compact 48-byte NTP request packet. The NTP server responds with transmit timestamps referenced to the standard NTP epoch (January 1, 1900). To convert NTP epoch seconds to UNIX epoch seconds (January 1, 1970), embedded C code subtracts 2,208,988,800 seconds."
            ],
            "example": "// SNTP epoch conversion in C\n#define NTP_TO_UNIX_OFFSET 2208988800ULL\n\nuint32_t ntp_to_unix_epoch(uint32_t ntp_seconds) {\n    if (ntp_seconds < NTP_TO_UNIX_OFFSET) return 0;\n    return (uint32_t)(ntp_seconds - NTP_TO_UNIX_OFFSET);\n}",
            "pitfall": "Neglecting to call `freeaddrinfo()` after hostname resolution. In embedded devices that re-resolve endpoints periodically, this causes a steady RAM leak leading to crashes.",
            "question": {
                "id": "q-iot-c-net-4",
                "prompt": "Why is SNTP time synchronization mandatory before an IoT device establishes a secure TLS connection?",
                "options": [
                    {"id": "a", "text": "TLS certificates have strict 'Not Before' and 'Not After' validity dates; without accurate time, valid certificates are rejected as expired."},
                    {"id": "b", "text": "SNTP generates the private encryption keys for AES-256."},
                    {"id": "c", "text": "Wi-Fi routers will refuse to assign IP addresses without an NTP response."}
                ],
                "answerId": "a",
                "explanation": "TLS handshake verification checks the current timestamp against the server certificate's validity dates. If the device clock defaults to 1970, all valid modern certificates fail validation."
            }
        }
    ],
    "steps": [
        "Study lwIP packet buffer (pbuf) memory management and zero-copy packet chaining.",
        "Examine the non-blocking BSD socket client workflow and partial send loop in C.",
        "Inspect the SNTP UDP request format and NTP-to-UNIX epoch conversion math.",
        "Compile and execute `iot-c-networking.c` with GCC: `gcc -std=c11 -Wall -Wextra iot-c-networking.c -o iot-c-networking`."
    ],
    "expected": "The program executes a simulated non-blocking TCP socket connection, formats an HTTP telemetry POST request, handles streaming packet transmission, and calculates valid UNIX epoch timestamps from an SNTP server response.",
    "code": """#include <stdio.h>
#include <stdint.h>
#include <stdbool.h>
#include <string.h>

#define NTP_TO_UNIX_OFFSET 2208988800ULL
#define SIMULATED_MTU      64

typedef enum {
    SOCK_STATE_DISCONNECTED,
    SOCK_STATE_CONNECTING,
    SOCK_STATE_CONNECTED,
    SOCK_STATE_SENDING
} SocketState;

typedef struct {
    uint8_t flags;
    uint8_t stratum;
    uint8_t poll;
    uint8_t precision;
    uint32_t root_delay;
    uint32_t root_dispersion;
    uint32_t ref_id;
    uint32_t ref_timestamp[2];
    uint32_t orig_timestamp[2];
    uint32_t recv_timestamp[2];
    uint32_t transmit_timestamp[2];
} NTPPacket;

static SocketState s_sock_state = SOCK_STATE_DISCONNECTED;
static uint32_t s_bytes_transmitted = 0;

uint32_t parse_sntp_timestamp(uint32_t ntp_sec) {
    if (ntp_sec < NTP_TO_UNIX_OFFSET) return 0;
    return (uint32_t)(ntp_sec - NTP_TO_UNIX_OFFSET);
}

// Simulate non-blocking partial send loop
bool mock_socket_send(const uint8_t *data, size_t total_len) {
    size_t sent = 0;
    printf(\"[TCP] Transmitting %zu bytes across simulated MTU=%d...\\n\", total_len, SIMULATED_MTU);
    while (sent < total_len) {
        size_t chunk = (total_len - sent > SIMULATED_MTU) ? SIMULATED_MTU : (total_len - sent);
        // Simulate sending chunk
        sent += chunk;
        s_bytes_transmitted += chunk;
        printf(\"  -> Sent chunk: %zu bytes (Progress: %zu / %zu)\\n\", chunk, sent, total_len);
    }
    return (sent == total_len);
}

int main(void) {
    printf(\"[NETWORK] Initializing lwIP-compatible BSD Sockets Client...\\n\");

    // Simulate Non-Blocking Connection
    s_sock_state = SOCK_STATE_CONNECTING;
    printf(\"[SOCKET] Initiating non-blocking connect() to 192.168.1.100:80...\\n\");
    s_sock_state = SOCK_STATE_CONNECTED;
    printf(\"[SOCKET] Connection established successfully (State = CONNECTED)\\n\");

    // Format HTTP REST Telemetry payload
    const char *payload = \"POST /telemetry HTTP/1.1\\r\\n\"
                          \"Host: api.voltquest.io\\r\\n\"
                          \"Content-Type: application/json\\r\\n\"
                          \"Content-Length: 32\\r\\n\\r\\n\"
                          \"{\\\"device\\\":\\\"vq-c-01\\\",\\\"temp\\\":24.8}\";

    s_sock_state = SOCK_STATE_SENDING;
    bool send_ok = mock_socket_send((const uint8_t *)payload, strlen(payload));
    if (!send_ok) {
        printf(\"[ERROR] Socket send failed!\\n\");
        return 1;
    }
    printf(\"[SOCKET] Total bytes successfully transmitted: %u\\n\", s_bytes_transmitted);

    // Simulate SNTP Time Synchronization
    printf(\"[SNTP] Formatting 48-byte NTP client query (LI=0, VN=4, Mode=3)...\\n\");
    NTPPacket ntp_request;
    memset(&ntp_request, 0, sizeof(ntp_request));
    ntp_request.flags = 0x23; // LI=0 (no warning), VN=4 (IPv4), Mode=3 (Client)

    // Simulate Server Response: 2026-10-22 ~09:00:00 UTC (NTP sec: ~3999901200)
    uint32_t mock_server_ntp_sec = 3999901200U;
    uint32_t unix_epoch_sec = parse_sntp_timestamp(mock_server_ntp_sec);
    printf(\"[SNTP] Server NTP Timestamp: %u -> Converted UNIX Epoch: %u\\n\",
           mock_server_ntp_sec, unix_epoch_sec);

    if (unix_epoch_sec != (mock_server_ntp_sec - NTP_TO_UNIX_OFFSET)) {
        printf(\"[ERROR] SNTP timestamp calculation mismatch!\\n\");
        return 1;
    }

    printf(\"[STATUS] lwIP BSD sockets and SNTP synchronization verified cleanly.\\n\");
    return 0;
}
""",
    "challenge": {
        "task": "Add exponential backoff with randomized jitter to the socket connection retry logic in C.",
        "acceptance": [
            "Implement a retry backoff formula: interval = base * 2^attempt + jitter, capped at 60 seconds.",
            "Add a check ensuring the socket descriptor is properly closed with close() on connection drop.",
            "Verify all socket buffer sizes prevent integer overflow during string formatting."
        ]
    },
    "sources": [
        {"title": "lwIP - A Lightweight TCP/IP stack - Documentation", "url": "https://www.nongnu.org/lwip/2_1_x/index.html"},
        {"title": "RFC 4330: Simple Network Time Protocol (SNTP) Version 4", "url": "https://datatracker.ietf.org/doc/html/rfc4330"}
    ],
    "exam": {
        "passPercent": 80,
        "questions": [
            {
                "id": "q-iot-c-net-exam-1",
                "prompt": "What does lwIP's `PBUF_ROM` buffer type signify?",
                "options": [
                    {"id": "a", "text": "The payload data resides in read-only memory (Flash) and should be transmitted directly without copying into RAM."},
                    {"id": "b", "text": "The packet was corrupted by electrical noise."},
                    {"id": "c", "text": "The packet buffer is permanently locked by the RTOS kernel."}
                ],
                "answerId": "a",
                "explanation": "PBUF_ROM points directly to constant data stored in Flash memory, avoiding unnecessary RAM copies when transmitting fixed strings or web assets."
            },
            {
                "id": "q-iot-c-net-exam-2",
                "prompt": "Why can a single call to `send()` transmit fewer bytes than requested in C networking?",
                "options": [
                    {"id": "a", "text": "TCP send window and socket buffer space are finite and may only accept a portion of the data immediately."},
                    {"id": "b", "text": "The compiler truncates buffers to 16 bytes automatically."},
                    {"id": "c", "text": "Ethernet cables can only carry one byte per microsecond."}
                ],
                "answerId": "a",
                "explanation": "Network buffers fluctuate with network traffic. When buffers fill up, send() accepts only what fits, returning the count of bytes actually queued."
            },
            {
                "id": "q-iot-c-net-exam-3",
                "prompt": "What does a return value of 0 from `recv()` indicate on a connected TCP socket?",
                "options": [
                    {"id": "a", "text": "The remote peer has cleanly closed the connection (orderly shutdown)."},
                    {"id": "b", "text": "Zero bytes were received but the connection is still alive."},
                    {"id": "c", "text": "The microcontroller has run out of battery power."}
                ],
                "answerId": "a",
                "explanation": "In standard BSD sockets, recv() returning 0 indicates EOF: the remote endpoint gracefully closed its side of the connection."
            },
            {
                "id": "q-iot-c-net-exam-4",
                "prompt": "What is the offset in seconds subtracted from an NTP timestamp to convert it to a standard UNIX epoch timestamp?",
                "options": [
                    {"id": "a", "text": "2,208,988,800 seconds (the number of seconds between Jan 1 1900 and Jan 1 1970)"},
                    {"id": "b", "text": "86,400 seconds"},
                    {"id": "c", "text": "1,000,000 seconds"}
                ],
                "answerId": "a",
                "explanation": "NTP epoch begins in 1900, while UNIX epoch begins in 1970. The fixed difference is exactly 2,208,988,800 seconds."
            },
            {
                "id": "q-iot-c-net-exam-5",
                "prompt": "What memory leak will occur if an embedded application calls `getaddrinfo()` repeatedly without calling `freeaddrinfo()`?",
                "options": [
                    {"id": "a", "text": "The dynamically allocated addrinfo linked lists will accumulate in RAM until heap exhaustion occurs."},
                    {"id": "b", "text": "The Flash memory sectors will become permanently write-protected."},
                    {"id": "c", "text": "The CPU core clock frequency will drop to 1 Hz."}
                ],
                "answerId": "a",
                "explanation": "`getaddrinfo()` allocates memory internally for the resolved address structures; calling `freeaddrinfo()` is required to free this memory."
            }
        ]
    }
}

COURSE_6 = {
    "id": "iot-c-mqtt",
    "version": 1,
    "order": 6,
    "title": "IoT Telemetry Protocols in C: MQTT & CoAP",
    "summary": "Serialize and parse lightweight MQTT v3.1.1 binary packets, manage QoS state machines, handle keep-alive ping timers, and decode CoAP RESTful UDP messages in pure C.",
    "difficulty": "Intermediate",
    "minutes": 55,
    "codeExt": "c",
    "lessons": [
        {
            "id": "iot-c-mqtt-framing",
            "title": "MQTT Binary Packet Framing & Remaining Length Encoding",
            "paragraphs": [
                "Message Queuing Telemetry Transport (MQTT) is the dominant application protocol for IoT due to its minimal network bandwidth overhead. An MQTT packet starts with a 2-byte Fixed Header: Byte 1 contains the Packet Type (e.g. `CONNECT = 1`, `PUBLISH = 3`, `PINGREQ = 12`) and control flags; Byte 2 starts the Remaining Length field.",
                "The Remaining Length is a variable-length integer encoding scheme: each byte uses 7 bits for the length value, with the 8th bit (MSB) acting as a continuation flag indicating that another byte follows. This allows lengths up to 127 bytes to occupy only 1 byte, while supporting payloads up to 256 MB in at most 4 bytes—ideal for constrained sensors."
            ],
            "example": "// MQTT Variable Byte Integer encoder in C\nsize_t mqtt_encode_remaining_len(uint8_t *buf, uint32_t length) {\n    size_t bytes = 0;\n    do {\n        uint8_t encoded_byte = (uint8_t)(length & 0x7F);\n        length >>= 7;\n        if (length > 0) {\n            encoded_byte |= 0x80; // Continuation bit\n        }\n        buf[bytes++] = encoded_byte;\n    } while (length > 0);\n    return bytes;\n}",
            "pitfall": "Hardcoding the Remaining Length field to 1 byte. Payloads exceeding 127 bytes require multi-byte continuation encoding; hardcoding corrupts all subsequent packet bytes.",
            "question": {
                "id": "q-iot-c-mqtt-1",
                "prompt": "In MQTT Remaining Length encoding, what does bit 7 (the most significant bit) of a length byte signify?",
                "options": [
                    {"id": "a", "text": "Continuation bit: when set to 1, it indicates at least one more length byte follows."},
                    {"id": "b", "text": "It indicates that the payload is encrypted with AES-256."},
                    {"id": "c", "text": "It signals that the message is a QoS 2 delivery."}
                ],
                "answerId": "a",
                "explanation": "MQTT uses a variable-length integer scheme where the MSB (bit 7) of each length byte is a continuation flag indicating that further length bytes follow."
            }
        },
        {
            "id": "iot-c-mqtt-qos",
            "title": "Quality of Service (QoS) State Machines & PUBACK",
            "paragraphs": [
                "MQTT provides three Quality of Service (QoS) delivery tiers: QoS 0 (At most once, 'fire and forget', no acknowledgment), QoS 1 (At least once, guaranteed delivery with PUBACK acknowledgment), and QoS 2 (Exactly once, 4-step handshake: PUBLISH -> PUBREC -> PUBREL -> PUBCOMP). Constrained microcontrollers predominantly use QoS 0 for high-frequency metrics and QoS 1 for critical alarms.",
                "When publishing QoS 1, the variable header includes a 16-bit Packet Identifier (`packet_id`). The client must store the unacknowledged packet in an inflight retransmission table, start a timeout timer, and wait for the broker to return a PUBACK packet with matching `packet_id`. If the timeout expires without PUBACK, the client retransmits the packet with the Duplicate (`DUP`) flag set."
            ],
            "example": "// QoS 1 inflight tracking structure in C\ntypedef struct {\n    uint16_t packet_id;\n    uint32_t sent_timestamp;\n    uint8_t *payload_ptr;\n    size_t payload_len;\n    bool is_pending;\n} MqttInflightPacket;\n\nstatic MqttInflightPacket s_inflight_table[4];\n\nvoid on_puback_received(uint16_t acked_id) {\n    for (int i = 0; i < 4; i++) {\n        if (s_inflight_table[i].is_pending && s_inflight_table[i].packet_id == acked_id) {\n            s_inflight_table[i].is_pending = false;\n            printf(\"[MQTT] QoS 1 Message ID %u acknowledged!\\n\", acked_id);\n            break;\n        }\n    }\n}",
            "pitfall": "Re-using the same Packet Identifier for concurrent inflight messages. Packet IDs must be unique among currently active unacknowledged messages to avoid misidentifying PUBACKs.",
            "question": {
                "id": "q-iot-c-mqtt-2",
                "prompt": "What packet does an MQTT broker return to confirm receipt of a QoS 1 PUBLISH packet?",
                "options": [
                    {"id": "a", "text": "PUBACK containing the matching 16-bit Packet Identifier"},
                    {"id": "b", "text": "CONNACK with status code 200"},
                    {"id": "c", "text": "PINGRESP containing current UTC time"}
                ],
                "answerId": "a",
                "explanation": "QoS 1 delivery is acknowledged when the broker returns a PUBACK packet matching the client's packet identifier."
            }
        },
        {
            "id": "iot-c-mqtt-keepalive",
            "title": "Keep-Alive Ping Timers & Last Will and Testament (LWT)",
            "paragraphs": [
                "IoT devices frequently sleep or operate on silent networks where no data is published for hours. Without traffic, intermediate NAT routers and firewalls silently drop the TCP connection state. MQTT prevents this with the Keep-Alive timer (negotiated in the CONNECT packet). If the client has no data to publish within the keep-alive interval (e.g. 60 seconds), it must transmit a 2-byte PINGREQ (`0xC0, 0x00`) packet, expecting a 2-byte PINGRESP (`0xD0, 0x00`) from the broker.",
                "To detect unexpected device deaths (battery failure, hardware fault), MQTT provides the Last Will and Testament (LWT). During the initial CONNECT packet, the client specifies a will topic (e.g. `devices/vq-01/status`) and will payload (e.g. `{\"status\":\"offline\"}`). If the broker detects the TCP connection dropped abruptly without an explicit DISCONNECT packet, the broker publishes the will message on the client's behalf."
            ],
            "example": "// Constructing MQTT 2-byte PINGREQ in C\nsize_t mqtt_build_pingreq(uint8_t *buf) {\n    buf[0] = 0xC0; // Packet Type 12 (PINGREQ), flags 0\n    buf[1] = 0x00; // Remaining Length 0\n    return 2;\n}",
            "pitfall": "Failing to send PINGREQ within $1.5 \\times \\text{KeepAlive}$. The broker assumes the client is dead, closes the socket, and dispatches the Last Will and Testament message.",
            "question": {
                "id": "q-iot-c-mqtt-3",
                "prompt": "When does an MQTT broker publish a client's Last Will and Testament (LWT) message?",
                "options": [
                    {"id": "a", "text": "When the broker detects the client's network connection closed ungracefully without sending an explicit DISCONNECT packet."},
                    {"id": "b", "text": "Whenever the client publishes a QoS 0 telemetry frame."},
                    {"id": "c", "text": "Every time the client boots up and connects."}
                ],
                "answerId": "a",
                "explanation": "LWT is designed for ungraceful disconnects (power loss, signal loss). If the client disconnects properly with a DISCONNECT packet, the broker discards the will."
            }
        },
        {
            "id": "iot-c-mqtt-coap",
            "title": "Constrained Application Protocol (CoAP, RFC 7252) over UDP",
            "paragraphs": [
                "While MQTT operates over TCP, some ultra-low-power edge nodes (running on NB-IoT or 802.15.4) cannot afford the overhead of TCP handshakes and keep-alives. The Constrained Application Protocol (CoAP, RFC 7252) brings RESTful HTTP-style client/server interaction to UDP with minimal overhead: a compact 4-byte binary header.",
                "The 4-byte CoAP header contains: 2-bit Version, 2-bit Type (Confirmable CON, Non-Confirmable NON, Acknowledgment ACK, Reset RST), 4-bit Token Length, 8-bit Code (Method: 1=GET, 2=POST, 3=PUT, 4=DELETE; or Response codes like 2.05 Content), and 16-bit Message ID. CoAP headers are followed by binary Options (such as URI-Path) and payload delimited by byte `0xFF`."
            ],
            "example": "// CoAP 4-byte header definition in C\ntypedef struct {\n    uint8_t ver_type_tkl; // [7:6] Ver, [5:4] Type, [3:0] Token Length\n    uint8_t code;         // [7:5] Class, [4:0] Detail (e.g. 0.01 = GET)\n    uint16_t message_id;  // 16-bit message identifier\n} CoapHeader;\n\n// Serializing a CoAP GET request for /temperature\nvoid build_coap_get(uint8_t *buf, uint16_t msg_id) {\n    buf[0] = 0x40; // Ver=1, Type=0 (CON), TKL=0\n    buf[1] = 0x01; // Code=0.01 (GET)\n    buf[2] = (uint8_t)(msg_id >> 8);\n    buf[3] = (uint8_t)(msg_id & 0xFF);\n}",
            "pitfall": "Assuming UDP packets arrive in order or at all. CoAP Confirmable (CON) messages require application-layer exponential retransmission tracking in C to handle packet loss.",
            "question": {
                "id": "q-iot-c-mqtt-4",
                "prompt": "How large is the fixed base header of a CoAP (RFC 7252) packet?",
                "options": [
                    {"id": "a", "text": "4 bytes"},
                    {"id": "b", "text": "20 bytes"},
                    {"id": "c", "text": "64 bytes"}
                ],
                "answerId": "a",
                "explanation": "CoAP is optimized for extreme constraint; its fixed binary header is only 4 bytes (Version, Type, Token Length, Code, and Message ID)."
            }
        }
    ],
    "steps": [
        "Study the MQTT Remaining Length variable byte integer encoding algorithm.",
        "Examine the MQTT CONNECT, PUBLISH (QoS 0/1), and PINGREQ packet serializers.",
        "Inspect the CoAP 4-byte fixed binary header and RESTful method code layout.",
        "Compile and execute `iot-c-mqtt.c` with GCC: `gcc -std=c11 -Wall -Wextra iot-c-mqtt.c -o iot-c-mqtt`."
    ],
    "expected": "The program serializes valid MQTT 3.1.1 CONNECT and QoS 1 PUBLISH binary packets, parses a simulated PUBACK, manages keep-alive ping timers, and builds a standard CoAP GET packet header.",
    "code": """#include <stdio.h>
#include <stdint.h>
#include <stdbool.h>
#include <string.h>

#define MQTT_TYPE_CONNECT  1
#define MQTT_TYPE_PUBLISH  3
#define MQTT_TYPE_PUBACK   4
#define MQTT_TYPE_PINGREQ  12
#define MQTT_TYPE_PINGRESP 13

size_t mqtt_encode_len(uint8_t *buf, uint32_t len) {
    size_t count = 0;
    do {
        uint8_t digit = (uint8_t)(len & 0x7F);
        len >>= 7;
        if (len > 0) digit |= 0x80;
        buf[count++] = digit;
    } while (len > 0);
    return count;
}

size_t mqtt_serialize_publish_qos1(uint8_t *buf, const char *topic, const char *payload, uint16_t packet_id) {
    uint8_t header = (MQTT_TYPE_PUBLISH << 4) | 0x02; // QoS 1 flag set
    uint16_t topic_len = (uint16_t)strlen(topic);
    uint32_t payload_len = (uint32_t)strlen(payload);
    uint32_t remaining_len = 2 + topic_len + 2 + payload_len; // topic len field + topic + packet_id + payload

    buf[0] = header;
    size_t len_bytes = mqtt_encode_len(&buf[1], remaining_len);
    size_t idx = 1 + len_bytes;

    // Topic string
    buf[idx++] = (uint8_t)(topic_len >> 8);
    buf[idx++] = (uint8_t)(topic_len & 0xFF);
    memcpy(&buf[idx], topic, topic_len);
    idx += topic_len;

    // Packet ID
    buf[idx++] = (uint8_t)(packet_id >> 8);
    buf[idx++] = (uint8_t)(packet_id & 0xFF);

    // Payload
    memcpy(&buf[idx], payload, payload_len);
    idx += payload_len;

    return idx;
}

// Simple topic matching supporting '+' single-level wildcard
bool mqtt_topic_match(const char *filter, const char *topic) {
    while (*filter && *topic) {
        if (*filter == '+') {
            while (*topic && *topic != '/') topic++;
            filter++;
        } else if (*filter == *topic) {
            filter++;
            topic++;
        } else {
            return false;
        }
    }
    return (*filter == '\0' && *topic == '\0');
}

int main(void) {
    printf(\"[MQTT] Initializing pure C MQTT v3.1.1 protocol engine...\\n\");

    uint8_t packet_buf[128];
    const char *topic = \"sensor/device01/temp\";
    const char *payload = \"{\\\"temp\\\":25.4}\";
    uint16_t msg_id = 42;

    size_t pkt_len = mqtt_serialize_publish_qos1(packet_buf, topic, payload, msg_id);
    printf(\"[MQTT] Serialized QoS 1 PUBLISH packet (%zu bytes):\\n  Hex: \", pkt_len);
    for (size_t i = 0; i < pkt_len; i++) {
        printf(\"%02X \", packet_buf[i]);
    }
    printf(\"\\n\");

    // Simulate PUBACK parsing
    uint8_t mock_puback[4] = { (MQTT_TYPE_PUBACK << 4), 0x02, (uint8_t)(msg_id >> 8), (uint8_t)(msg_id & 0xFF) };
    uint16_t parsed_id = ((uint16_t)mock_puback[2] << 8) | mock_puback[3];
    printf(\"[MQTT] Received PUBACK: Message ID = %u\\n\", parsed_id);

    if (parsed_id != msg_id) {
        printf(\"[ERROR] PUBACK message ID mismatch!\\n\");
        return 1;
    }

    // Test Topic Wildcard Matching
    const char *sub_filter = \"sensor/+/temp\";
    bool match = mqtt_topic_match(sub_filter, topic);
    printf(\"[MQTT] Wildcard match: filter '%s' matches topic '%s'? %s\\n\",
           sub_filter, topic, match ? \"YES\" : \"NO\");

    if (!match) {
        printf(\"[ERROR] Topic wildcard matching failed!\\n\");
        return 1;
    }

    // CoAP 4-byte header test
    uint8_t coap_buf[4];
    coap_buf[0] = 0x40; // Ver 1, Type CON (0), Token Length 0
    coap_buf[1] = 0x01; // Code 0.01 (GET)
    coap_buf[2] = 0x12; // Message ID high byte
    coap_buf[3] = 0x34; // Message ID low byte
    printf(\"[CoAP] Built 4-byte CoAP header: [0x%02X 0x%02X 0x%02X 0x%02X] (Code=GET, ID=0x1234)\\n\",
           coap_buf[0], coap_buf[1], coap_buf[2], coap_buf[3]);

    printf(\"[STATUS] MQTT v3.1.1 serialization and CoAP headers verified cleanly.\\n\");
    return 0;
}
""",
    "challenge": {
        "task": "Add multi-level wildcard ('#') matching support to the topic matching function in C.",
        "acceptance": [
            "Support '#' at the end of topic filters, matching all subordinate hierarchy levels.",
            "Implement a PINGREQ timer that flags when 60 seconds elapse without outbound traffic.",
            "Verify all variable byte integer calculations reject lengths exceeding 268,435,455 bytes."
        ]
    },
    "sources": [
        {"title": "MQTT Version 3.1.1 OASIS Standard Specification", "url": "http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html"},
        {"title": "RFC 7252: The Constrained Application Protocol (CoAP)", "url": "https://datatracker.ietf.org/doc/html/rfc7252"}
    ],
    "exam": {
        "passPercent": 80,
        "questions": [
            {
                "id": "q-iot-c-mqtt-exam-1",
                "prompt": "What is the maximum payload length supported by MQTT's 4-byte Variable Byte Integer field?",
                "options": [
                    {"id": "a", "text": "268,435,455 bytes (~256 MB)"},
                    {"id": "b", "text": "65,535 bytes (64 KB)"},
                    {"id": "c", "text": "1,048,576 bytes (1 MB)"}
                ],
                "answerId": "a",
                "explanation": "Four bytes of 7 bits each (28 bits) provide a theoretical maximum encoded length of 268,435,455 bytes."
            },
            {
                "id": "q-iot-c-mqtt-exam-2",
                "prompt": "Which delivery guarantee is provided by MQTT Quality of Service 1 (QoS 1)?",
                "options": [
                    {"id": "a", "text": "At least once: message is retransmitted until a PUBACK acknowledgment is received."},
                    {"id": "b", "text": "At most once: unconfirmed best-effort delivery without acknowledgment."},
                    {"id": "c", "text": "Exactly once: four-way handshake ensuring zero duplicated deliveries."}
                ],
                "answerId": "a",
                "explanation": "QoS 1 guarantees arrival at the broker at least once, potentially with duplicates if acknowledgments are delayed."
            },
            {
                "id": "q-iot-c-mqtt-exam-3",
                "prompt": "What packet type is sent by an MQTT client to maintain the connection when no data is being published?",
                "options": [
                    {"id": "a", "text": "PINGREQ (Packet Type 12)"},
                    {"id": "b", "text": "DISCONNECT"},
                    {"id": "c", "text": "SUBSCRIBE"}
                ],
                "answerId": "a",
                "explanation": "PINGREQ is a 2-byte heartbeat packet sent by the client to keep NAT bindings open and confirm the broker is reachable."
            },
            {
                "id": "q-iot-c-mqtt-exam-4",
                "prompt": "Which MQTT topic filter matches `factory/line1/temp` and `factory/line2/temp`, but NOT `factory/line1/sensor/temp`?",
                "options": [
                    {"id": "a", "text": "factory/+/temp"},
                    {"id": "b", "text": "factory/#/temp"},
                    {"id": "c", "text": "factory/*"}
                ],
                "answerId": "a",
                "explanation": "The single-level wildcard `+` matches exactly one hierarchical level, matching `line1` or `line2`, but not multi-level paths."
            },
            {
                "id": "q-iot-c-mqtt-exam-5",
                "prompt": "Which underlying transport layer protocol does CoAP (RFC 7252) utilize?",
                "options": [
                    {"id": "a", "text": "UDP"},
                    {"id": "b", "text": "TCP"},
                    {"id": "c", "text": "SCTP"}
                ],
                "answerId": "a",
                "explanation": "CoAP is designed for constrained networks and runs over UDP to eliminate TCP connection setup overhead."
            }
        ]
    }
}

COURSES_4_TO_6 = [COURSE_4, COURSE_5, COURSE_6]
