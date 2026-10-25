# Embedded IoT in C track

`/iot-c` and `/iot-c/:lessonId` provide ten comprehensive embedded IoT and edge systems programming courses in C (`content/iot-c.json`), rendered by the shared `features/courses/ReadingTrack.jsx` component and configured by `features/iot-c/IotCPage.jsx`. Each course includes four sections with a checkpoint practice question, a guided lab with expected results, a complete compilable/runnable C program, an applied challenge, and a five-question 80% passing exam integrated into the shared progress and certificate systems.

## Courses

1. `iot-c-architecture`: **1. Embedded C Foundations & IoT System Architecture** — Microcontroller memory layouts (Flash vs SRAM, .text, .rodata, .data, .bss, stack, and heap), cross-compilation toolchains (`arm-none-eabi-gcc`), Linker Scripts (`.ld`), C runtime startup (`crt0`), fixed-width types (`stdint.h`), bit manipulation masks, and non-blocking SysTick event loop schedulers. Complete C11 static memory pool and task scheduler.
2. `iot-c-peripherals`: **2. Hardware Register Abstraction & Peripheral Drivers in C** — Memory-mapped I/O (MMIO), the `volatile` qualifier, CMSIS-style peripheral struct mapping, GPIO modes (push-pull vs open-drain), atomic Bit Set/Reset Register (BSRR) operations, hardware interrupt service routines (ISRs), and timer PWM signal generation. Complete C11 register-level GPIO and PWM driver simulator.
3. `iot-c-buses`: **3. Serial Bus Protocols in C: UART, I2C & SPI** — UART framing, lock-free single-producer single-consumer circular FIFO ring buffers, I2C master register read/write sequences with repeated START and ACK/NACK signaling, full-duplex SPI shift register transactions, and polynomial CRC-8 packet framing. Complete C11 lock-free ring buffer and serial sensor packet parser.
4. `iot-c-rtos`: **4. Real-Time Operating Systems (FreeRTOS) & Concurrency in C** — Preemptive priority scheduling, context switching via PendSV, task lifecycles, stack sizing and high-watermark detection (`uxTaskGetStackHighWaterMark`), thread-safe message queues, binary/counting semaphores, and mutexes with Priority Inheritance to eliminate priority inversion. Complete C11 multi-task priority scheduler and queue pipeline.
5. `iot-c-networking`: **5. Embedded Networking: lwIP & BSD Sockets in C** — The lwIP embedded TCP/IP stack, zero-copy packet buffer (`pbuf`) chaining, standard BSD Sockets APIs (`socket`, `connect`, `send`, `recv`), partial send loops, non-blocking I/O multiplexing with `select()`, and SNTP time synchronization over UDP. Complete C11 non-blocking socket client and SNTP epoch converter.
6. `iot-c-mqtt`: **6. IoT Telemetry Protocols in C: MQTT & CoAP** — MQTT v3.1.1 binary packet framing, Variable Byte Integer remaining length encoding, QoS 0 and QoS 1 state machines with PUBACK tracking, Keep-Alive ping timers (`PINGREQ`), Last Will and Testament (LWT), topic wildcard matching (`+` and `#`), and 4-byte CoAP (RFC 7252) binary headers over UDP. Complete C11 MQTT v3.1.1 serializer and parser.
7. `iot-c-security`: **7. Embedded Security & TLS Cryptography with mbedTLS** — IoT threat models, Hardware Root of Trust (RoT), Secure Boot, AES-128/256-GCM authenticated encryption, HMAC-SHA256 message authentication, memory-constrained TLS 1.3 with mbedTLS (Maximum Fragment Length buffers), X.509 certificate validation, and anti-replay sequence number tracking. Complete C11 SHA-256/HMAC engine and anti-replay verifier.
8. `iot-c-power`: **8. Low-Power IoT Design & Energy Harvesting** — Microcontroller power domains (Active, Modem-sleep, Light-sleep, Deep-sleep), CMOS leakage currents and pin isolation, low-power RTC slow memory persistence across hardware resets, duty-cycle math, Coulomb counting, battery lifespan forecasting, and brownout early warnings (BOD/PVD). Complete C11 low-power duty-cycle simulator.
9. `iot-c-ota`: **9. Over-the-Air (OTA) Firmware Updates & Storage** — Flash partition tables, dual-bank (A/B) partition switching (`ota_0`, `ota_1`, `otadata`), structured binary image headers, streaming SHA-256 integrity verification, bootloader rollback guards (`PENDING_VERIFY`), and log-structured Non-Volatile Storage (NVS) wear leveling. Complete C11 dual-bank partition manager with automated rollback.
10. `iot-c-capstone`: **10. Production Edge IoT Firmware Suite Architecture** — Industrial-grade edge firmware suite: layered architecture (HAL -> BSP -> Middleware -> App), multi-task watchdog supervision (preventing deadlocks), naked assembly/C HardFault handlers with stacked register capture, circular telemetry queuing, and remote diagnostic health reporting. Complete C11 production IoT edge controller.

## Curriculum Alignment & Learning Outcomes

Learners who complete this track master the core disciplines required for production embedded systems and IoT device engineering:
- **Bare-Metal & Register Foundations**: Configuring microcontrollers through memory-mapped I/O, manipulating individual bits safely with `volatile` pointers, and designing deterministic SysTick event loops.
- **Serial Protocols & Queues**: Developing lock-free FIFO ring buffers for UART, mastering multi-device I2C register transactions, and exchanging full-duplex SPI sensor frames.
- **Real-Time Concurrency**: Architecting multi-threaded firmware using FreeRTOS tasks, thread-safe message queues, and priority inheritance mutexes.
- **Embedded Telemetry & Cloud Connectivity**: Interfacing with lwIP sockets, constructing binary MQTT 3.1.1 packets, and managing QoS acknowledgments and keep-alive timers.
- **Device Security & Field Resilience**: Securing device payloads with HMAC-SHA256, protecting against replay attacks, maximizing battery life through deep sleep, and performing fail-safe dual-bank OTA updates with automated rollback.

### VoltQuest Course Certificates
Every course includes a five-question 80% passing exam. Learners who score ≥80% can issue a signed, tamper-evident PDF certificate with a permanent public verification URL at `/certificates/:certificateId` and automatic portfolio tracking under `/certificates`.

## Honesty and Verification

Nothing runs in the browser. VoltQuest does not execute native C binaries or flash physical microcontrollers in client JavaScript:
- `backend/tests/test_iot_c_content.py` validates the entire curriculum, compiles all sample C programs using `gcc -std=c11 -Wall -Wextra`, and verifies clean execution (exit code 0).
- All 10 courses provide 4 lessons with questions and a 5-question 80% passing exam (9 unique questions per course, 90 questions total with zero ID collisions).
- All 10 courses are registered in the backend certificate catalogue (`iot-c.json`), issuing and verifying exact PDFs.
- The hub disclosure clearly states that studying and taking exams works in any browser, while compiling C source locally requires the learner's own GCC or cross-compilation environment.
- Lab step checkboxes record user self-checks for this visit only and verify nothing.

## Wiring

- Route in `frontend/src/App.jsx` (`/iot-c` and `/iot-c/:lessonId`).
- Nav active section in `frontend/src/features/workspace/AppHeader.jsx`.
- Landing page footer in `frontend/src/features/landing/LandingPage.jsx`.
- Course directory card in `frontend/src/features/courses/coursesDirectory.js` (`hardware` domain, `ALL_COURSES` count at 19).
- Sitemap generation in `frontend/vite-sitemap.js` and regenerated `frontend/public/sitemap.xml` (539 URLs).
- Certificate catalogue entry in `backend/app/services/certificates.py` (`iot-c.json`, 244 total courses).
- Indonesian translations in `frontend/src/i18n/id.json`.
- Test suites: `frontend/src/features/iot-c/iotC.test.jsx`, `frontend/vite-sitemap.test.js`, `backend/tests/test_iot_c_content.py`, `backend/tests/test_certificates.py`.
