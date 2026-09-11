# 

# **Product Requirements Document (PRD) Addendum: Multi-MCU & ESP32 Integration**

**Product:** VoltQuest

# **Product Requirements Document (PRD)**

**Product Name:** CircuitQuest (Working Title)

**Document Version:** 1.0.0

**Document Status:** Ready for Review

**Target Platform:** Web Browsers (Desktop-first; responsive tablet support)

## **1\. Executive Summary**

**CircuitQuest** is a browser-based, gamified electronics learning platform designed to teach Arduino programming and circuit design. By combining an interactive breadboard canvas, real-time circuit simulation (powered by WebAssembly), and RPG-style quest mechanics, CircuitQuest eliminates the cost, intimidation, and component-breakage barriers often faced by beginner hardware enthusiasts.

### **1.1 Problem Statement**

* **Hardware Fear & Cost:** Beginners worry about frying real microcontrollers, buying the wrong components, or spending money before knowing if they enjoy the hobby.  
*   
* **Dry Simulation Tools:** Existing tools (e.g., standard SPICE software, CAD tools) are functional but lack guided pedagogical loops, narrative motivation, and gamified dopamine cycles.  
*   
* **Separation of Code and Circuitry:** Beginners struggle to understand how firmware code directly interacts with breadboard electrical states (e.g., pull-up resistors, voltage drops).  
* 

### **1.2 Product Vision**

To provide the "Duolingo meets Tinkercad" of embedded systems—a zero-install, risk-free virtual laboratory where players wire interactive breadboards, write micro-code, earn XP, and unlock project blueprints through bite-sized, animated tutorials.

## **2\. Target Audience & User Personas**

| Persona | Demographics | Pain Points | Desired Outcome |
| :---- | :---- | :---- | :---- |
| **"Curious Clara" (Primary)** | Age 13–22; Student / Hobbyist | Intimidated by schematic diagrams and raw C++ compiler errors; has no hardware kit. | Wants to build a working prototype visually and understand *why* an LED needs a resistor. |
| **"Educator Evan" (Secondary)** | STEM Teacher / Camp Instructor | Managing lost physical parts, burned components, and troubleshooting 30 physical breadboards in 45 minutes. | Needs an easy-to-grade, browser-based sandbox with pre-built lesson plans and automated verification. |
| **"Tinkerer Tom" (Tertiary)** | Adult Maker / Software Dev | Wants to experiment with Arduino logic without setting up physical hardware on his desk. | Quick prototyping sandbox to test code against breadboard configurations before soldering. |

## **3\. Core Product Modules & Functional Specifications**

                    ┌─────────────────────────────────────────────────────────┐  
                     │                 CircuitQuest Workspace                  │  
                     └─────────────────────────────────────────────────────────┘  
                                                  │  
         ┌────────────────────────────────────────┼────────────────────────────────────────┐  
         ▼                                        ▼                                        ▼  
┌──────────────────┐                    ┌──────────────────┐                    ┌──────────────────┐  
│   Quest Engine   │                    │ Breadboard Canvas│                    │ Code & Execution │  
│ \- Level Goals    │                    │ \- Snap-to-Hole   │                    │ \- Dual Editor    │  
│ \- Hints & Steps  │◄──State Check─────►│ \- Interactive UI │◄──Pin Triggers────►│ \- AVR Emulator   │  
│ \- XP & Rewards   │                    │ \- Visual Physics │                    │ \- Serial Monitor │  
└──────────────────┘                    └──────────────────┘                    └──────────────────┘

### **Module 1: Interactive Breadboard Canvas (Visual Workbench)**

The interactive breadboard canvas acts as the main game viewport where players place components and draw wires.

#### **Functional Requirements**

1. **Grid Snap & Terminal Mechanics:**  
2. 

   * Full-size (830 tie-point) and half-size (400 tie-point) solderless breadboard visual assets.  
   *   
   * Auto-snapping connection points on standard 0.1-inch (2.54mm) pitch.  
   *   
   * Interactive hover highlight displaying terminal strip continuity (e.g., hovering pin e12 highlights row 12 pins a–e in soft green).  
   *   
   * Dedicated power rails marked with red (+) and blue (-) lines that highlight continuous vertical busses.  
   *   
3. **Interactive Component Catalog:**  
4. 

   * **Microcontrollers:** Arduino Uno R3, Arduino Nano (expandable to ESP32 post-MVP).  
   *   
   * **Actuators/Outputs:** 5mm LEDs (Red, Green, Blue, RGB with configurable forward voltage), Piezo Buzzer, SG90 Micro Servo, 16x2 I2C LCD Display, 7-Segment Display.  
   *   
   * **Inputs/Sensors:** Pushbuttons, 10k Potentiometer, Photocell (LDR), HC-SR04 Ultrasonic Sensor, PIR Motion Sensor.  
   *   
   * **Passives:** Resistors (color-band auto-generation based on selectable ohm value: $220\\Omega$, $1\\text{k}\\Omega$, $10\\text{k}\\Omega$), Capacitors, NPN Transistors.  
   *   
5. **Wiring Engine:**  
6. 

   * Click-drag wire routing from any pin/lead to another.  
   *   
   * Dynamic spline curving to prevent visual clutter.  
   *   
   * Customizable wire insulation colors (Red, Black, Yellow, Green, Blue) via hotkeys (1–5) or floating palette.  
   *   
   * Strip-wire detection: Warning indicator if a wire connects power directly to ground without a load (short circuit).  
   *   
7. **Dynamic Visual Feedback & Failure States ("Magic Smoke" Engine):**  
8. 

   * **LEDs:** Glow radius scales dynamically based on calculated current ($I$).  
   *   
   * **Overcurrent Failure:** If current exceeds rated capacity (e.g., 5V across an LED without a current-limiting resistor), animate a comedic "poof" of gray smoke, crack the component texture, and trigger a contextual hint.  
   *   
   * **Buttons/Potentiometers:** Clickable and draggable directly on screen while simulation is running.  
   *   
   * **Motors/Servos:** Animated rotor blades rotating according to PWM duty cycle.  
   * 

### **Module 2: Code Editor & Real-Time Firmware Engine**

Players must write or assemble code that compiles and executes against the virtual microcontroller.

#### **Functional Requirements**

1. **Dual-Mode Code Editor:**  
2. 

   * **Blockly Mode (Novice):** Scratch-like drag-and-drop code blocks translating visual nodes into Arduino C++.  
   *   
   * **Text Editor Mode (Intermediate/Advanced):** Monaco-based code editor with Arduino syntax highlighting, bracket matching, and auto-formatting.  
   *   
   * Two-way sync: Code generated in Blockly updates the text view instantly.  
   *   
3. **Simulation Runtime (AVR WebAssembly):**  
4. 

   * In-browser compilation using an AVR instruction emulator (e.g., avr8js).  
   *   
   * Zero server-side compilation latency; execution runs directly within the client's Web Worker to prevent UI freezing.  
   *   
   * Accurate virtual clock cycle timing for standard Arduino timing functions (millis(), micros(), delay()).  
   *   
5. **Virtual Peripherals:**  
6. 

   * **Integrated Serial Monitor:** Floating or dockable console showing Serial.print() outputs with selectable baud rates (9600, 115200\) and an input field for Serial.read().  
   *   
   * **Virtual Oscilloscope / Logic Analyzer (Stretch):** 2-channel plot tracking voltage oscillations on user-selected pins.  
   * 

### **Module 3: The Gamified Tutorial & Quest Engine**

The tutorial framework guides players through structured levels using game mechanics.

#### **Functional Requirements**

1. **Campaign Structure (World Map):**  
2. 

   * The game is structured into themed "Worlds" (e.g., *World 1: The Sparks of Dawn \[Digital Outputs\]*, *World 2: The Whispering Sensors \[Analog Inputs\]*, *World 3: Mechanical Magic \[PWM & Actuators\]*).  
   *   
   * Each world contains 5–8 levels ending in a "Boss Level" (an open-ended project challenge).  
   *   
3. **Level Progression Loop:**  
4. 

   * **Briefing:** Dialogue from a friendly retro robot mascot ("Chip") explaining the goal (e.g., *"Our spaceship airlock light is broken\! Wire up an SOS beacon"*).  
   *   
   * **Objective Checklist:** Real-time checking of electrical and logical conditions:  
   * 

     * \[ \] Place Arduino Uno on canvas  
     *   
     * \[ \] Wire Red LED to Pin 9 via a 220-ohm resistor  
     *   
     * \[ \] Ground the LED cathode to GND  
     *   
     * \[ \] Write firmware to blink LED at 1-second intervals  
     *   
   * **Automated Validator:** A rule engine evaluates both the circuit netlist and runtime state (e.g., "Did Pin 9 toggle high/low 3 times in 3000ms?").  
   *   
   * **Success Screen:** 1 to 3 Star rating based on:  
   * 

     * Objective completion (1 star)  
     *   
     * No fried components/clean wiring (2 stars)  
     *   
     * Code efficiency/minimal component count (3 stars)  
     *   
   * XP awarded to level up player profile and unlock aesthetic customization (custom breadboard skins, neon wire colors).  
   *   
5. **Dynamic Hint System:**  
6. 

   * **Tier 1 Hint:** Nudges player on concept (e.g., *"Remember: Current can only flow through an LED in one direction."*).  
   *   
   * **Tier 2 Hint:** Highlights the specific breadboard row or pin where an error exists.  
   *   
   * **Tier 3 Hint (Ghost Blueprint):** Overlays a translucent wireframe showing exact wire placement directly on the board.  
   * 

### **Module 4: Open Sandbox Mode & Sharing**

1. **Free Play Canvas:**  
2. 

   * Blank canvas with access to the entire component drawer without level constraints.  
   *   
   * Ability to export the project as:  
   * 

     * Native JSON save file.  
     *   
     * High-resolution schematic/breadboard PNG diagram.  
     *   
     * Raw .ino sketch file for physical Arduino IDE upload.  
     *   
     * Bill of Materials (BOM) CSV with purchase links to real-world electronics vendors.  
     *   
3. **Community Showcase:**  
4. 

   * Publish sandbox projects with a read-only interactive preview link.  
   *   
   * "Fork Project" button allowing players to clone and remix shared circuits.  
   * 

## **4\. UI/UX Wireframe & Layout Architecture**

The workspace follows a 3-panel adaptable IDE layout:

\+-----------------------------------------------------------------------------+  
|  \[Logo\] Level 1-3: The SOS Beacon    \[Hint Button\]    \[Reset\]  \[Run/Stop ▶\] |  
\+-----------------------+----------------------------------+------------------+  
|  LEFT PANEL:          |  CENTER PANEL:                   |  RIGHT PANEL:    |  
|  Quest & Components   |  Interactive Breadboard Canvas   |  Code & Output   |  
|                       |                                  |                  |  
|  \[Objectives Tracker\] |  \+----------------------------+  |  \[Blocks | C++\]  |  
|  \- \[x\] Wire LED       |  |  ( \+ ) \[Power Bus\] ( \- )   |  |                  |  
|  \- \[ \] Add Resistor   |  |  \+----------------------+  |  |  void setup() {  |  
|                       |  |  | a b c d e   f g h i j | |  |    pinMode(9,   |  
|  \[Component Drawer\]   |  |  | 1 o o o o o   o o o o o | |  |      OUTPUT);  |  
|  \- Resistor (220R)    |  |  | 2 o o o o o   o o o o o | |  |  }             |  
|  \- Red LED            |  |  \+----------------------+  |  |                  |  
|  \- Jumper Wire        |  |  \[ Arduino Uno Board Area\] |  |  void loop() {   |  
|                       |  \+----------------------------+  |    ...           |  
|                       |                                  |  }               |  
|                       |  \[Pan / Zoom Toolbar\]            |------------------|  
|                       |                                  | \[Serial Monitor\] |  
\+-----------------------+----------------------------------+------------------+  
| FOOTER: Player XP \[||||||||||  \] Level 4   | Audio: On   | Status: Sim Idle |  
\+-----------------------------------------------------------------------------+

## **5\. Technical Architecture & Tech Stack**

┌─────────────────────────────────────────────────────────────────────────────┐  
│                             Browser Client (SPA)                            │  
├────────────────────────────────┬────────────────────────────────────────────┤  
│ Presentation Layer             │ Application & State                        │  
│ \- React 18 / Tailwind CSS      │ \- Zustand / Redux Toolkit (App State)      │  
│ \- Pixi.js / Konva.js (Canvas)  │ \- Monaco Editor (Code Editing)             │  
│ \- Lucide Icons / Framer Motion │ \- Blockly (Visual Code Generation)         │  
├────────────────────────────────┴────────────────────────────────────────────┤  
│ Simulation Core (Web Workers)                                               │  
│ \- avr8js: AVR Microcontroller CPU emulation (ATMega328P execution)          │  
│ \- Custom SPICE-lite Solver: MNA (Modified Nodal Analysis) for DC/analog     │  
└──────────────────────────────────────┬──────────────────────────────────────┘  
                                       │ HTTPS / WSS  
┌──────────────────────────────────────▼──────────────────────────────────────┐  
│                              Cloud Infrastructure                           │  
│ \- Node.js / NestJS: API gateway, level completion validation, user profiles │  
│ \- PostgreSQL: Relational DB (Users, Progress, XP, Quests, Saved Projects)   │  
│ \- AWS S3 / Cloudflare R2: Saved user circuit snapshots and JSON payloads    │  
└─────────────────────────────────────────────────────────────────────────────┘

### **5.1 Simulation Engine Details**

* **Analog Solving:** Implement a lightweight Modified Nodal Analysis (MNA) matrix solver in TypeScript/WebAssembly to calculate voltages at every breadboard node, ensuring realistic resistor dividers, diode forward drops, and parallel/series resistance behavior.  
*   
* **MCU Emulation:** Utilize avr8js to run real compiled AVR binary bytes inside a Dedicated Web Worker. Pins fire event listeners on every clock phase update (reading and setting logical voltage states).  
* 

## **6\. Curated Quest Campaign Curriculum (MVP Scope)**

World 1: The Spark of Life (Basics)  
├── 1.1 First Glow: Wire an LED directly to 5V & Ground (Discover "Magic Smoke" failure).  
├── 1.2 The Shield: Introduce the 220Ω resistor to fix 1.1 and keep the LED lit.  
├── 1.3 The Gatekeeper: Insert a pushbutton switch into the circuit (Manual logic).  
└── 1.4 Code Awakening: Move LED to Arduino Pin 13, write standard \`blink.ino\`.

World 2: Signals and Rhythms (Digital & Analog I/O)  
├── 2.1 The SOS Beacon: Use \`delay()\` and digital writes to program Morse code.  
├── 2.2 Night Owl: Wire a Photoresistor (LDR) voltage divider; read analog levels via \`analogRead()\`.  
├── 2.3 The Dimmer: Use a Potentiometer to control LED brightness via PWM (\`analogWrite()\`).  
└── 2.4 Simon Says (Boss Challenge): Wire 3 colored LEDs and 3 buttons; implement memory sequence game.

## **7\. Non-Functional Requirements (NFRs)**

| Metric | Requirement | Justification |
| :---- | :---- | :---- |
| **Canvas Frame Rate** | Constant 60 FPS under $\\le 50$ active visual components | Jerky wire dragging or sluggish component updates breaks game immersion. |
| **Simulation Latency** | Input-to-action delay $\< 16\\text{ ms}$ | Pressing a virtual breadboard button must feel instantaneous. |
| **Initial Load Time** | $\< 3.0\\text{ seconds}$ on standard broadband ($15\\text{ Mbps}$) | Classroom environments with limited bandwidth must be able to boot the app quickly. |
| **Browser Compatibility** | Chrome, Edge, Firefox, Safari (versions released within the last 24 months) | Schools often run older Chromium-based software on managed Chromebooks. |
| **Zero Setup / Installation** | $100\\%$ client-side execution; no plugins or external drivers required | Chromebooks used in K-12 education lock down admin privileges and block local executable files. |

## **8\. Release Roadmap**

### **Phase 1: Minimum Viable Product (MVP) — Target: 3 Months**

* Interactive breadboard with snap-to-grid wire routing.  
*   
* Basic component set: Arduino Uno, Resistors, LEDs, Pushbuttons, Potentiometer.  
*   
* Monaco Text Editor \+ avr8js simulator in a Web Worker.  
*   
* World 1 Campaign (4 fully validated interactive quests).  
*   
* Basic XP, level complete modal, and failure animations ("Magic Smoke").  
* 

### **Phase 2: Expanded Hardware & Visual Code — Target: \+2 Months**

* Blockly visual programming integration.  
*   
* Additional components: Micro Servo, 16x2 I2C LCD, Ultrasonic Sensor, Buzzer.  
*   
* World 2 Campaign (Analog and PWM challenges).  
*   
* User profiles, progress persistence, and level star ratings.  
* 

### **Phase 3: Sandbox, Social, & Expansion — Target: \+3 Months**

* Free Play Sandbox with sharable URL previews.  
*   
* Educator Portal: Teachers can track student quest progress and assign custom level packs.  
*   
* Custom Component Creator (JSON-based pin definitions for advanced users).  
* 

## **9\. Key Performance Indicators (KPIs)**

1. **Level 1 Completion Rate:** $\\ge 85\\%$ of new users complete Quest 1.1 and 1.2 within their first session.  
2.   
3. **First "Aha\!" Moment Metric:** Time from landing page visit to first virtual LED blink is under 3 minutes.  
4.   
5. **Sandbox Conversion:** $\\ge 25\\%$ of users who complete World 1 create and save an original project in Sandbox Mode.  
6.   
7. **Error Recovery Rate:** $\\ge 70\\%$ of players who trigger the "Magic Smoke" failure successfully resolve the problem using the built-in hints rather than bouncing from the session.

**Update Scope:** Multi-MCU Architecture (Arduino Uno \+ ESP32 DevKit V1 / ESP32-S3)

**Core Impact:** Introduces dual-voltage simulation logic (5V vs. 3.3V), IoT network emulation, breadboard footprint mechanics, and dual simulation cores (AVR \+ Xtensa/RISC-V).

## **1\. System Architecture Update: Multi-MCU Engine**

Adding the ESP32 transitions the platform from a single 8-bit AVR emulator to a modular multi-architecture runtime.

                                \+-------------------------------------+  
                                 |         VoltQuest Web Canvas        |  
                                 \+-------------------------------------+  
                                                    |  
                         \+--------------------------+--------------------------+  
                         |                                                     |  
                         v                                                     v  
         \+-------------------------------+                     \+-------------------------------+  
         |       5V Arduino Domain       |                     |        3.3V ESP32 Domain      |  
         \+-------------------------------+                     \+-------------------------------+  
         | \- Logic: 5V TTL               |                     | \- Logic: 3.3V CMOS            |  
         | \- ADC: 10-bit (0-1023)        |                     | \- ADC: 12-bit (0-4095)        |  
         | \- Engine: AVR8js (WebAssembly)|                     | \- Engine: Xtensa WASM Core    |  
         | \- Pins: D0-D13, A0-A5         |                     | \- Features: Capacitive Touch, |  
         |                               |                     |   DAC, Dual-core, BLE, Wi-Fi  |  
         \+-------------------------------+                     \+-------------------------------+  
                         |                                                     |  
                         \+--------------------------+--------------------------+  
                                                    |  
                                                    v  
                                 \+-------------------------------------+  
                                 |   Virtual Circuit Solver & Netlist  |  
                                 |  (MNA Engine with Overvoltage Check)|  
                                 \+-------------------------------------+  
                                                    |  
                                                    v  
                                 \+-------------------------------------+  
                                 |        Virtual IoT Gateway          |  
                                 |   (Mock Wi-Fi, WebServer, MQTT)     |  
                                 \+-------------------------------------+

## **2\. ESP32-Specific Gameplay & Physics Mechanics**

### **2.1 The Voltage Trap: 3.3V vs. 5V Logic (Core Educational Mechanic)**

Unlike the 5V-tolerant ATmega328P, the ESP32’s GPIO pins can only tolerate **3.3V**. Feeding 5V directly into an ESP32 pin is one of the most common beginner mistakes in physical computing.

* **Simulation Rule**:  
* 

  * If an ESP32 GPIO receives $\> 3.6\\text{V}$, trigger a warning status or visual **"Burnt GPIO Pin"** animation (pin turns charcoal black with an error tooltip: *"Overvoltage\! ESP32 GPIOs tolerate max 3.3V"*).  
  *   
* **Game Puzzles**:  
* 

  * Force players to wire **Voltage Dividers** (using two resistors) or insert a **Bidirectional Logic Level Shifter** module when interfacing 5V sensors (e.g., standard ultrasonic HC-SR04) with the ESP32.  
  * 

      5V Sensor Echo (5V)  
               │  
               ▼  
             \[R1: 1kΩ\]  
               │  
               ├───► Safe 3.3V Signal to ESP32 GPIO  
               │  
             \[R2: 2kΩ\]  
               │  
               ▼  
              GND

### **2.2 Breadboard Footprint Realism**

Standard ESP32 NodeMCU/DevKit boards are 30 pins wide. On a standard half-size or full-size breadboard, they occupy 10 rows and leave **zero or only one row of tie-points accessible**, creating a spatial layout challenge for beginners:

* **Canvas Mechanic**:  
* 

  * Users can select between:  
  * 

    1. **Single Breadboard Offset Mode**: Leaves one column of tie-points exposed on one side only.  
    2.   
    3. **Dual Breadboard Mode**: Snaps two breadboards side-by-side with the central divider bridged by the ESP32, exposing all pins on both sides.  
    4.   
  * Teaches real-world workbench prototyping strategies before buying hardware.  
  * 

## **3\. Simulated IoT & Wireless Subsystem**

The ESP32 enables network connectivity tutorials without needing physical network cards or backend servers.

\+-----------------------------------------------------------------------------------+  
|                            VIRTUAL NETWORK SANDBOX                                |  
|                                                                                   |  
|  \[ESP32 Code\] ──► WiFi.begin("VoltNet", "pass") ──► \[Virtual Access Point (AP)\]   |  
|                                                              │                    |  
|                        \+─────────────────────────────────────+                    |  
|                        │                                                          |  
|                        ▼                                                          |  
|  \+─────────────────────────────────────────+   \+───────────────────────────────+  |  
|  |     Simulated Web Browser / Phone       |   |      Virtual MQTT Broker      |  |  
|  |  Renders embedded HTML from ESP32       |   |  Subscribes to:               |  |  
|  |  (e.g., Web-based Relay Toggle Button)  |   |  "home/sensor/temp" \-\> 24.5°C |  |  
|  \+─────────────────────────────────────────+   \+───────────────────────────────+  |  
\+-----------------------------------------------------------------------------------+

### **3.1 Features**

1. **Virtual Wi-Fi Access Point**:  
2. 

   * Pre-configured virtual SSID VoltNet-Guest inside the simulator environment.  
   *   
   * WiFi.status() transitions: WL\_DISCONNECTED $\\rightarrow$ WL\_CONNECTED with realistic handshake latency (\~500ms).  
   *   
3. **In-Game Virtual Smartphone / Dashboard**:  
4. 

   * A slide-out panel representing a user's phone.  
   *   
   * If the user runs an HTTP server on the ESP32 (WebServer server(80)), the virtual phone loads \[http://192.168.4.1\](http://192.168.4.1) and displays the rendered UI (buttons to toggle breadboard LEDs, gauges reading potentiometer values).  
   *   
5. **Simulated MQTT Broker**:  
6. 

   * Inspects client.publish("sensors/light", value) packets directly in an integrated game console inspector.  
   * 

## **4\. Hardware Library Matrix (Arduino vs. ESP32)**

| Feature / Component | Arduino Uno R3 Track | ESP32 DevKit V1 Track |
| :---- | :---- | :---- |
| **Logic Level** | 5V | 3.3V (Overvoltage damage enabled) |
| **Core Architecture** | 8-bit AVR (avr8js WASM) | 32-bit Xtensa dual-core (QEMU/WASM core) |
| **ADC Resolution** | 10-bit (0–1023) | 12-bit (0–4095) with nonlinear attenuation options |
| **PWM Channels** | 6 hardware pins (analogWrite) | 16 software/hardware channels (ledcAttachPin) |
| **Built-in Peripherals** | None | Capacitive Touch Pins (touchRead), Hall Sensor, DAC |
| **Exclusive Components** | 5V Relays, basic LEDs, DC Motor driver | NeoPixel Ring (WS2812B), I2C OLED (SSD1306), DHT22, BME280 |

## **5\. Gamified Campaign Structure (Updated Progression)**

\[Level 1-4: Arduino Uno Basics\]  
"The 5V Sandbox"  
\- Digital Outputs (LEDs)  
\- Button Pull-ups / Pull-downs  
\- Analog Reading (Potentiometers)  
\- Transistor Motor Driving  
             │  
             ▼  
\[Level 5: Transition Boss Level\]  
"The Power Swap"  
\- Move circuit to ESP32  
\- Fix overvoltage on 5V sensor via Voltage Divider  
\- Calibrate 12-bit ADC code (1023 \-\> 4095\)  
             │  
             ▼  
\[Level 6-9: ESP32 IoT Academy\]  
"The Connected World"  
\- Touch-sensitive lamp (Using touchRead on T0 pin)  
\- NeoPixel status indicator with RGB colors  
\- Wi-Fi Web Controlled Smart Switch (Browser HUD on Virtual Phone)  
\- Weather Station: DHT22 sensor data streaming over simulated MQTT

## **6\. Technical Implementation Details for ESP32 Emulation**

### **6.1 WASM Execution Engine**

* **AVR Path**: Continue using avr8js for ultra-fast, lightweight client-side execution on Arduino tracks.  
*   
* **ESP32 Path**:  
* 

  * Adopt the **Wokwi ESP32 WebAssembly Core** or a compiled **Xtensa QEMU WASM** worker.  
  *   
  * Offload execution to a dedicated Web Worker to keep canvas animations and UI interaction at 60 FPS.  
  * 

### **6.2 Cloud vs. Client Compilation**

* **Arduino C++**: Client-side preprocessing and fast compilation via lightweight cloud build farm (Dockerized arduino-cli).  
*   
* **ESP32 FreeRTOS / ESP-IDF**:  
* 

  * Compiling WiFi.h or ESP-IDF libraries in-browser is too heavy.  
  *   
  * **Architecture**: A stateless compilation worker pool running arduino-cli with the esp32:esp32 board definitions caches common binary sketches and returns linked .bin/.elf files to the browser in $\< 2\\text{ seconds}$.  
  * 

\[User clicks "Run Code"\]  
          │  
          ▼  
Is binary in IndexedDB Cache? ──Yes──► \[Feed binary to Xtensa WASM Engine\]  
          │  
          No  
          ▼  
\[POST /api/compile\] ──► \[Serverless Worker: arduino-cli \--fqbn esp32:esp32:esp32doit-devkit-v1\]  
                                 │  
                                 ▼ (Compiles in \~1.8s)  
                        \[Returns .bin file\] ──► \[Run in Browser\]

## **7\. UI / UX Additions for ESP32**

\+---------------------------------------------------------------------------+  
| \[Header\] VoltQuest | Board: \[ ESP32 DevKit V1 ▼ \] | Power: 3.3V | \[Run Code\] |  
\+-------------------------------------+-------------------------------------+  
| LEFT PANE: Code & IoT Inspector     | RIGHT PANE: Canvas & Peripherals    |  
|                                     |                                     |  
| \[Tab: Code\] \[Tab: Virtual Phone\]    |   \+-------------------------------+ |  
| 1  \#include \<WiFi.h\>                |   |        \[ESP32 DEVKIT\]         | |  
| 2  const char\* ssid \= "VoltNet";    |   | \[3V3\] \[GND\] \[D15\] ... \[D2\]    | |  
| 3  void setup() {                   |   \+-------------------------------+ |  
| 4    WiFi.begin(ssid);              |                                     |  
| 5  }                                |   \+-------------------------------+ |  
|                                     |   | \[Dual Breadboard Setup\]       | |  
| \----------------------------------- |   |  . . . . . . . . . . . . . .  | |  
| \[Virtual Phone Preview\]             |   |  \[Logic Shifter\]  \[NeoPixel\]  | |  
| \+---------------------------------+ |   |  . . . . . . . . . . . . . .  | |  
| | VoltNet Connected (192.168.4.1) | |   \+-------------------------------+ |  
| | \[ Light: ON \] \[ Color: RED \]    | |                                     |  
| \+---------------------------------+ |   \[Palette: 3.3V Sensors | OLEDs\]   |  
\+-------------------------------------+-------------------------------------+

* **Board Switcher Dropdown**: Allows instant switching between **Arduino Uno R3**, **ESP32 DevKit V1**, and **ESP32-S3** (adds camera/AI puzzle levels later).  
*   
* **Multi-Breadboard Drag**: Canvas automatically warns users when dropping an ESP32 onto a single breadboard: *"This board covers all available pin rows. Would you like to snap a secondary breadboard alongside it?"* with a 1-click auto-expand option.

