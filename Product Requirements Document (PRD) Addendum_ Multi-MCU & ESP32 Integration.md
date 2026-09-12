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

---

# **Product Requirements Document (PRD) Addendum: Custom Drone Builder & Flight Bench**

**Product:** VoltQuest

**Document Version:** 1.0.0

**Document Status:** Proposed — **not implemented.** No requirement in this addendum is built today; nothing in `AGENTS.md`, `docs/CONTRACTS.md` or `docs/IMPLEMENTATION_STATUS.md` covers it yet.

**Update Scope:** A player-configurable multirotor ("custom drone") that can be specified, wired, programmed, flown and exported from inside VoltQuest.

**Engine note:** the base PRD and the ESP32 addendum above still describe avr8js, a cloud `arduino-cli` build farm and NestJS. The shipped engine is a **single custom Arduino-C++ interpreter running in a Web Worker**, a **DC MNA circuit solver**, an **SVG canvas**, and a **FastAPI** backend. For this feature, the stack described here supersedes the older references; the binding module contracts remain `docs/CONTRACTS.md`.

## **1. Intent, Scope & Non-Goals**

### **1.1 What "custom drone" means here**

The player does not pick a finished drone off a shelf. They **specify** one — frame class, motor Kv, prop size, cell count, pack capacity, all-up weight — then wire it, write its firmware, tune it, fly it, and (optionally) export a real-world parts list and sketch to build the same machine on a bench. The configurator is the feature; the flight is the reward that proves the configuration was sane.

This extends the product's existing promise (*"risk-free virtual laboratory"*) to the one class of beginner project where real-world mistakes are most expensive and most dangerous: a 4S LiPo, four brushless motors and spinning carbon props.

### **1.2 In scope**

1. A **Drone Bench** canvas mode: chassis-and-connector assembly, distinct from the breadboard canvas.
2. A **Custom Drone Configurator**: a typed, validated build specification with derived performance figures.
3. A **flight dynamics subsystem** running alongside (not inside) the circuit solver.
4. New catalog parts, firmware API surface, quest content, validator rules and exports.

### **1.3 Non-goals (explicitly out)**

* Betaflight/ArduPilot/PX4 firmware emulation, CLI compatibility or config-dump import.
* Fixed-wing, VTOL, helicopter/collective, and >4 rotor airframes in the first release (the mixer must not preclude them).
* Aerodynamic fidelity beyond a coefficient-based rotor model: no blade-element theory, no vortex ring state, no wind field beyond a constant + gust term.
* Real radio-link, video-transmitter or telemetry-radio RF modelling.
* Any payload-carrying, tracking, or weaponization content (see §13).
* Real flight-worthiness certification. The simulator is a teaching tool, never a sign-off.

## **2. The Core Constraint: A Quadcopter Does Not Fit the Breadboard Abstraction**

Everything shipped so far rests on three assumptions: parts sit on **0.1-inch tie-points**, connections are solved by a **DC MNA solver**, and behaviour is decided by **per-pin logic levels**. A quadcopter breaks all three — three-phase brushless motors at tens of amps, a LiPo pack with meaningful internal resistance, soldered/XT60 joints, and six degrees of rigid-body freedom.

If this feature is specified as "add drone parts to the existing parts drawer," it is not implementable. It must be specified as a **second bench**.

| Concern | Breadboard bench (shipped) | Drone bench (this addendum) |
| :---- | :---- | :---- |
| Placement | Holes on a 2.54 mm grid; `Placement` anchors (CONTRACTS §3/§4.2) | Named **mount points** on a frame: arm 1–4 motor pads, FC stack plate, PDB pads, battery strap, RX bay |
| Connection | Jumper wire hole→hole | **Connector-level links**: XT60, 3-phase motor leads (bullet/solder pad), 3-pin servo lead, JST/SH cable, solder joint |
| Currents | Milliamps; pin-level `overcurrent_pin` | **Amps to tens of amps**; pack sag, wire gauge, ESC rating |
| Physics | Steady-state DC operating point | DC operating point **plus** a 6-DOF dynamics integration |
| Failure | Magic smoke on a part | Magic smoke **and** a crash, with the airframe's damage persisted |

### **2.1 What the drone bench reuses vs. replaces**

**Reuses, unchanged in behaviour (must not be forked or duplicated):**

* The document/persistence model — the drone build is a `CircuitDoc` variant (§5.4), so save/load, undo, JSON import/export, publish, preview and fork keep working.
* The parts drawer, the inspector, selection, and the hint tiers 1–3 (tier 3 ghost = the solution build).
* Run/Stop, reset semantics (`run()` implies reset), the serial monitor, and the objective/validator loop.
* The "magic smoke" effect vocabulary (`SmokePuff`, `CrackOverlay`, `Sparkle`) and the sticky-damage model (`damaged`, `events`, `warningCodesSeen`).
* PNG export, BOM CSV export, sketch export, showcase publish/fork.

**Replaces or adds:**

* Breadboard geometry, hole snapping and terminal continuity → frame mount points and connector sockets.
* A **flight view** (§8) and a **virtual transmitter** (§8.2) — new panels with no breadboard equivalent.
* A **high-current electrical domain** (§3.2) layered on the existing solver rather than replacing it.

## **3. Architecture: Two Loops, One Explicit Interface**

Flight dynamics is a **new subsystem running alongside the circuit solver**, not inside it. The solver owns the electrical domain; the dynamics loop owns thrust and attitude. Their contact surface is small and must be written down before either is built.

```
  [Interpreter / Runtime  (Web Worker) ]
        |  ESC command per motor (µs pulse, or duty, or DShot value)
        v
  +----------------------------+        motor currents I1..I4        +---------------------------+
  |   Electrical domain        | <--------------------------------- |   Flight dynamics loop    |
  |   (MNA solver + pack model)| ---------------------------------> |   (6-DOF rigid body)      |
  |   - pack V_oc, R_int, sag  |   available pack voltage V_bus      |   - motor/prop model      |
  |   - BEC / 5 V rail         |                                     |   - mixer, forces, torques|
  |   - wire / ESC I^2R losses |                                     |   - integrator, collision |
  +----------------------------+                                     +---------------------------+
        |                                                                   |
        | brownout / cutoff / smoke events                                   | IMU, baro, GPS, RPM
        v                                                                   v
  [ Warnings, damage, HUD ]                             [ env -> Runtime: sensor reads, telemetry ]
```

### **3.1 The interface contract (binding, both directions)**

**Dynamics ← Electrical, per dynamics step:**

* `V_bus` — the sagged pack voltage available to each ESC.
* `escEnabled[i]` — false when an ESC is unpowered, burnt, or the FC is browned out.

**Electrical ← Dynamics, per dynamics step:**

* `motorCurrentA[i]` — drawn from the mechanical load, fed back as the pack's load current.
* `rpm[i]`, `omega[i]` — for the RPM telemetry channel and audio.

**Runtime ← Dynamics, via the existing `env` message (CONTRACTS §7.1):**

* IMU: accelerometer (m/s², body frame), gyro (deg/s, body frame), optional magnetometer.
* Barometric altitude, optional GPS fix (lat/lon/alt/sats), optional RPM per motor.
* Receiver channel values (from the virtual transmitter, §8.2).

**Dynamics ← Runtime, via the existing `peripheral` message (CONTRACTS §7.2):**

* `{ type: 'peripheral', protocol: 'esc', componentId, data: { us } }` — one per ESC signal write.

### **3.2 Rates, stepping and determinism**

| Loop | Rate | Note |
| :---- | :---- | :---- |
| Flight dynamics integration | Fixed step, **TBD** (start 1 kHz; must be ≥ 4× the firmware's control loop) | Semi-implicit Euler or RK4; fixed step is non-negotiable for reproducibility |
| Electrical solve | Lower rate, **TBD** (start 100–250 Hz), plus an immediate solve on any topology or damage change | Full MNA at 1 kHz is unaffordable; the pack model may be integrated at dynamics rate |
| Firmware slices | Existing worker slicing (CONTRACTS §8) | Unchanged |
| Flight view render | 60 FPS, interpolated from the last two dynamics states | Never drives physics |

**Determinism requirement:** given the same build, the same sketch, the same stick input timeline and the same seed, a run must produce a bit-identical trajectory. Headless quest validation (`solution.actions`, §9.3) depends on it. All noise sources (IMU noise, vibration, gusts) draw from a single seeded PRNG owned by the dynamics subsystem.

## **4. Drone Bench: Assembly & Electrical Requirements**

### **4.1 New parts (catalog)**

Each part ships a catalog entry in the **existing four-field shape** of `content/catalog.json` — `{ name, unitPriceUsd, vendors[{ name, url }], notes }` — so BOM CSV export and vendor links keep working with no export changes.

| Part | Proposed catalog ids | Key modelled properties |
| :---- | :---- | :---- |
| Frame (quad X) | `frame_3in`, `frame_5in`, `frame_7in` | wheelbase, mass, arm count, max prop diameter, mount pattern |
| Brushless motor | `motor_1404_4600kv`, `motor_2207_1750kv`, `motor_2806_1300kv` | Kv, stator size, mass, `maxCurrentA`, `R_phase`, `I_0` |
| Propeller | `prop_3in_3b`, `prop_5in_3b`, `prop_7in_2b` | diameter, pitch, blade count, mass, direction (CW/CCW) |
| ESC (4-in-1 or single) | `esc_4in1_45a`, `esc_single_30a` | continuous/burst amps, protocol support, BEC rail & amps |
| Flight-controller carrier | `fc_carrier_esp32` | stack plate, 4 ESC signal headers, IMU, baro, RX header, BEC input |
| IMU | `imu_mpu6050` | I²C address, ranges, noise/bias parameters |
| Barometer | `baro_bmp280` | I²C address, resolution, noise |
| LiPo pack | `lipo_4s_1500mah`, `lipo_3s_2200mah`, `lipo_6s_1300mah` | cells, mAh, C rating, mass, `R_int` |
| RC receiver | `rx_elrs_2400` | channel count, protocol, failsafe behaviour |
| Cabling & connectors | `xt60_pair`, `silicone_wire_16awg`, `jst_sh_cable` | gauge, resistance per metre, current rating |
| Bench accessories | `thrust_stand`, `prop_guards`, `smoke_stopper` | used by the safe bench quests (§9.2) |

Single-part-level user authoring (a part nobody shipped) is **not specified here** — it depends on the **Custom Component Creator**, which is PRD Phase 3 and currently deferred (`docs/ARCHITECTURE.md`, `docs/CONTRACTS.md` §13). See §14.2.

### **4.2 Assembly rules**

1. **Mount points, not holes.** A frame exposes named mounts; a part declares which mount kinds it accepts. Drops onto an incompatible or occupied mount are rejected through the existing `onDropRejected(reason)` path.
2. **Motor position and rotation direction are both part of the build.** Each arm carries a motor index (1–4) and a commanded direction; each prop carries a CW/CCW handedness. A mismatch between prop handedness and motor direction is a first-class, detectable build error — not a silent failure.
3. **Three-phase leads are modelled as a bundle, not three independent nets.** The player connects "motor → ESC output", not phase A/B/C individually. Phase-level wiring adds no pedagogy and triples the netlist.
4. **Polarity is enforced where it matters.** Reversing the XT60 is an instant, visible, teachable failure (§4.4).
5. **Signal wiring is conventional.** ESC signal + ground to four FC pins, RX to a UART, IMU/baro on I²C — all resolved through the **existing PeripheralBinding role table** (CONTRACTS §7.3) with new roles, not a parallel binding mechanism.

### **4.3 High-current electrical model (extends the existing solver)**

* **Pack:** `V = V_oc(SoC, cells) − I_total · R_int`. State of charge integrates consumed mAh. Per-cell voltage drives the low-voltage warning and cutoff.
* **Wiring losses:** each conductor carries a resistance from gauge and length; `I²R` heating feeds the overcurrent/burn model.
* **ESC:** models continuous and burst current limits, a thermal accumulator, and a BEC rail with its own current limit that powers the FC and RX.
* **Brownout:** when the BEC or FC rail drops below the board's minimum, the runtime is reset mid-flight — exactly as a real brownout behaves — and the flight ends in a crash. This is a required teaching moment, not an edge case.

### **4.4 New failure states ("magic smoke", extended)**

These extend the existing warning-code vocabulary (CONTRACTS §5.4). Proposed codes:

| Code | Trigger | Player-visible outcome |
| :---- | :---- | :---- |
| `reverse_polarity` | Pack connected backwards | Immediate FC/ESC destruction, smoke, run aborted |
| `esc_overcurrent` | Sustained current over the ESC's rating | ESC burns; that motor stops; asymmetric thrust → crash |
| `motor_overheat` | `I²R` thermal accumulator exceeds limit | Motor degrades then fails; visible scorch |
| `bec_overload` | BEC rail current over rating | Brownout → FC reset mid-air |
| `lipo_overdischarge` | Cell voltage below the safe floor | Pack puff animation, capacity permanently reduced for the session |
| `prop_direction_mismatch` | Prop handedness ≠ motor direction | Downforce instead of lift; the quad flips on takeoff |
| `no_prop_guard` | Arming with props fitted during a bench quest | Blocked with a safety callout, not a silent pass |
| `desync` | Commanded RPM step exceeds the motor's achievable slew | Motor stalls briefly; audible desync; recoverable |

### **4.5 Crash model**

A crash is a collision with the ground or a course obstacle above a velocity threshold (**TBD**). Outcomes scale with impact energy: prop chip → prop break → arm break → FC damage. Damage is sticky through the existing `damaged`/`events` mechanism until reset, so "fix what you broke" is a real step. A **Repair** action restores parts and is always free in sandbox; in quests it may cost time on the star clock.

## **5. The Custom Drone Configurator**

This is the feature the player actually came for, and it must be usable **before** any wiring: pick or clone a preset, change numbers, see immediately what those numbers do.

### **5.1 Build specification (schema)**

Stored with the document (`CircuitDoc.droneConfig`, §5.4) and shareable on its own. All units explicit.

```json
{
  "schemaVersion": 1,
  "name": "My 5-inch freestyle",
  "airframe": { "class": "quad_x", "wheelbaseMm": 220, "frameMassG": 110, "maxPropIn": 5.1 },
  "motors": { "count": 4, "kv": 1750, "stator": "2207", "massG": 32,
              "maxCurrentA": 35, "phaseResistanceMohm": 65, "noLoadCurrentA": 1.1 },
  "props":  { "diameterIn": 5.1, "pitchIn": 4.6, "blades": 3, "massG": 4.5 },
  "esc":    { "kind": "4in1", "continuousA": 45, "burstA": 55,
              "protocol": "dshot600", "becVolts": 5, "becAmps": 2 },
  "battery":{ "cells": 4, "chemistry": "lipo", "capacityMah": 1500, "cRating": 95,
              "massG": 178, "internalResistanceMohm": 12 },
  "fc":     { "board": "esp32", "carrier": "fc_carrier_esp32",
              "imu": "imu_mpu6050", "baro": "baro_bmp280" },
  "extras": [ { "id": "rx_elrs_2400", "massG": 3 } ],
  "payloadG": 0
}
```

### **5.2 Derived quantities**

Derived values are **computed, never stored**, and recomputed on every edit. The doc gives the **formula shape and its inputs**; every coefficient is **TBD — calibrate against reference builds and published thrust-stand data before implementation.** A wrong constant written into a PRD gets implemented as truth.

| Derived value | Formula shape | Calibration inputs (TBD) |
| :---- | :---- | :---- |
| All-up weight (AUW) | Σ part masses + payload | — (exact) |
| Motor speed | `RPM ≈ Kv · V_bus · throttle · k_slip` (Kv is RPM per volt) | `k_slip` (load slip factor) |
| Rotor rate | `n = RPM / 60` (rev/s), `ω = 2π · n` (rad/s) | — (exact) |
| Thrust per motor | `T = C_T · ρ · n² · D⁴`, **D in metres** (`diameterIn × 0.0254`) | `C_T` per prop family, air density ρ |
| Shaft torque | `Q = C_Q · ρ · n² · D⁵`, **D in metres** | `C_Q` per prop family |
| Motor current | `I ≈ (Q · ω) / (η · V_bus) + I_0` | efficiency η, no-load current `I_0` |
| Hover throttle | throttle where `Σ T = AUW · g` | inherits the above |
| Thrust-to-weight (TWR) | `Σ T_max / (AUW · g)` | inherits the above |
| Estimated hover time | `(capacityMah · usableFraction) / I_hover_mA × 60` min | `usableFraction` |
| Pack sag at full throttle | `V_oc − I_total · R_int` | measured `R_int` per pack class |

### **5.3 Feasibility checks (shown live, before flight)**

Warnings, not blocks — the player is allowed to build something bad and watch it fail, which is the pedagogy. Each check states the number, the threshold and the fix.

* TWR below a floor (**TBD**, ~1.5): "it may not lift itself."
* TWR above a ceiling (**TBD**, ~10): "unflyable for a beginner; throttle resolution collapses."
* Peak current above the ESC's continuous rating, or above the pack's `C × capacity`.
* Prop diameter above the frame's `maxPropIn` — physical interference.
* Kv × cell count outside the sane band for the stator size.
* Estimated hover time below a floor (**TBD**, ~2 minutes).
* Motor count ≠ mount count; missing IMU; no receiver and no autonomous mode.

### **5.4 Document model**

The drone build is a `CircuitDoc` (CONTRACTS §4.1) with `kind: "drone"`, `droneConfig` as above, `mounts` in place of breadboard placements, and `links` (typed connectors) in place of `wires`. Consequences are deliberate: persistence, undo, JSON import/export, publish/preview/fork, and the backend project payload all continue to work untouched. `kind: "breadboard"` is the implicit default for every existing document; loaders must treat a missing `kind` as breadboard.

## **6. Flight Dynamics & Control**

### **6.1 Rigid body**

* 6-DOF: position, velocity, orientation (quaternion), body angular rates. Fixed-step integration (§3.2).
* Inertia tensor derived from the configured part masses and their mount geometry — so a heavier pack **actually** makes the drone lazier in yaw.
* Forces: rotor thrust along the body-Z axis, weight, translational drag (coefficient **TBD**), optional constant wind + gust term.
* Torques: roll/pitch from thrust differential across the arm moment, yaw from the **reaction torque** difference between CW and CCW rotors, plus gyroscopic and rotor-inertia terms.
* Motor response: first-order lag on RPM with a time constant derived from rotor inertia (**TBD**), so PID tuning has something real to fight.

### **6.2 Mixer**

Quad-X default, expressed as a sign matrix per motor over `[throttle, roll, pitch, yaw]`, configurable per build so hex/tri/plus layouts are a data change rather than a rewrite. Motor output saturation uses proportional scaling (airmode-style, **TBD**) rather than clipping, and saturation must be visible in the telemetry HUD — it is the cause of half of all "why did it flip?" questions.

### **6.3 Sensors**

Simulated, not idealised, with parameters **TBD**:

* Gyro/accel: bias, white noise, scale error, and **frame vibration proportional to rotor RPM** — the reason real builds need soft mounting and filtering.
* Barometer: slow noise, drift, and prop-wash-induced error near the ground.
* Optional GPS: fix delay, position noise, update rate far below the control loop.

### **6.4 Control modes and the player's role**

| Mode | Who writes the loop | Purpose |
| :---- | :---- | :---- |
| **Raw throttle** (bench) | Player | One motor, no props, on a thrust stand. First quest. |
| **Rate / acro** | Player writes the rate PID | The teaching centrepiece: read gyro → PID → mixer → ESC. |
| **Angle / self-level** | Player writes the outer loop; library provides fusion | Introduces cascaded control. |
| **Assisted hover** | Library-provided | Lets a player fly a course without having tuned a loop, for build-focused quests. |

Arming/disarming, a stick-command arm gesture, a throttle-low safety check, receiver-loss failsafe, and low-voltage cutoff are **required behaviours**, exercised by quests — not optional extras.

## **7. Firmware API Surface (What the Interpreter Must Expose)**

### **7.1 Board decision**

**Reuse the existing `esp32` / `esp32s3` board profiles for v1.** The FC is an ESP32 on a carrier board. This adds **no new board id, no new interpreter core and no new emulation architecture** — the single-interpreter decision that makes the "100 % client-side" NFR achievable stays intact. A dedicated STM32-class FC board id (`fc_f405`) is deferred to a later phase and must not be assumed by any content authored now.

### **7.2 New peripheral roles and protocols**

Added to the role table of CONTRACTS §7.3, resolved by the existing `findPath` binding rule:

| Type | Protocol | Roles | Direction |
| :---- | :---- | :---- | :---- |
| `esc` | `esc` | `signal`, `vbat`, `gnd` | MCU → ESC (pulse µs / DShot value) |
| `imu_mpu6050` | `imu_i2c` | `sda`, `scl` + `i2cAddress` | bidirectional |
| `baro_bmp280` | `baro_i2c` | `sda`, `scl` + `i2cAddress` | sensor → MCU |
| `rx_elrs` | `rc_serial` | `tx`, `rx` | receiver → MCU |
| `gps` | `gps_uart` | `tx`, `rx` | sensor → MCU |

### **7.3 Required libraries and calls**

* **ESC output:** `ESP32Servo`'s `writeMicroseconds()` (1000–2000 µs) as the beginner path, and `ledcWrite`-based OneShot/DShot helpers for the advanced path. ESC arming (the low-throttle hold) must be required before spin-up, exactly as on real hardware.
* **IMU:** an `MPU6050` library over the existing no-op `Wire` — `begin()`, `getMotion6()`, `getAcceleration()`, `getRotation()`, range setters.
* **Barometer:** reuse the existing `Adafruit_BME280`-style surface where possible; add `BMP280` if the part differs.
* **Receiver:** channel access via a small `VoltRC` helper (`readChannel(n)`, `hasSignal()`, `failsafe()`), so a beginner is not parsing CRSF frames in quest 1.
* **Control helpers (optional, never mandatory):** a `PID` class with `setGains/compute/reset` and an `AHRS` complementary/Mahony filter. Every quest that can be solved with these must also be solvable without them — the player who wants to write their own loop must not be locked out.

### **7.4 New worker messages**

Additive to CONTRACTS §7.1/§7.2; nothing existing changes shape:

* Inbound `env` gains `imu`, `baro`, `gps`, `rc`, `rpm` blocks.
* Outbound `{ type: 'peripheral', protocol: 'esc', data: { us } }` per ESC write.
* Outbound `{ type: 'flight', armed, mode, attitude, altitude, batteryV, motorOutputs }` for the HUD, at a throttled rate (**TBD**, ≤ 50 Hz).

## **8. UI / UX: The Drone Bench**

```
+------------------------------------------------------------------------------------+
| VoltQuest | Build: [ My 5-inch freestyle v ]  4S · TWR 6.2 · hover 4:10 | [Run >] |
+---------------------------+--------------------------------+---------------------+
| LEFT: Build & Objectives  | CENTER: Bench / Flight View    | RIGHT: Code & Tune  |
|                           |                                |                     |
| [Configurator]            |   +------------------------+   | [Code | Blocks]     |
|  Frame   [5 in  v]        |   |      ( flight view )   |   | void loop() {       |
|  Motors  [2207 1750Kv v]  |   |    quad in a hangar,   |   |   imu.read();       |
|  Props   [5.1x4.6x3   v]  |   |    gate course, HUD    |   |   pid.compute();    |
|  ESC     [45 A 4in1   v]  |   +------------------------+   |   esc.write(...);   |
|  Pack    [4S 1500 95C v]  |                                | }                   |
|                           |   [ Bench ]  [ Flight ]        |---------------------|
|  AUW     412 g            |                                | [PID Tune]          |
|  TWR     6.2 : 1          |   Sticks:  (L) throttle/yaw    |  Roll  P __ I __ D  |
|  Hover   38 % throttle    |            (R) pitch/roll      |  Pitch P __ I __ D  |
|  Time    ~4 min 10 s      |            [ARM] [Mode: Rate]  |  Yaw   P __ I __ D  |
|  ! Peak 52 A > ESC 45 A   |                                |---------------------|
|                           |   Telemetry: 14.8 V  22 A      | [Serial] [Blackbox] |
+---------------------------+--------------------------------+---------------------+
```

### **8.1 Views**

* **Bench view:** the frame flat-on, for assembly, wiring and inspection. This is where connector-level wiring happens.
* **Flight view:** a chase/orbit camera on the airframe in a simple enclosed volume (hangar, then gated course). 2.5-D is acceptable for v1; the physics is 3-D regardless.
* **Thrust-stand view:** a single motor clamped, with live thrust/current/RPM readouts — the safe first quest, and the calibration lesson.
* **Blackbox panel:** a scrolling plot of setpoint vs. gyro per axis, motor outputs and pack voltage. This is the tuning feedback loop; without it, PID quests degrade into guessing.

### **8.2 Virtual transmitter**

* Two on-screen sticks (mouse/touch drag), keyboard mapping, and optional Gamepad API support.
* Explicit `ARM`/`DISARM` toggle and a flight-mode selector; both feed the RC channel block.
* Stick inputs are **recorded on the virtual clock** so a run can be replayed deterministically and so `solution.actions` can drive a headless flight (§9.3).
* Accessibility: every stick axis must be drivable from the keyboard, and no quest may require simultaneous four-axis analogue input to pass.

### **8.3 Responsiveness**

The bench must fit the existing 390 px target: the three panels collapse to a tabbed stack, the flight view keeps its aspect ratio, and the transmitter docks to the bottom as a compact two-thumb control.

## **9. Campaign Content**

### **9.1 New world**

Authored in the existing `content/worlds.json` shape (`id`, `order`, `title`, `subtitle`, `theme`, `board`, `intro`, `levelIds`), reusing the `esp32` board id per §7.1:

```json
{ "id": "w5", "order": 5, "title": "Rotor Rising",
  "subtitle": "Brushless power, custom builds, and the first hover",
  "theme": "violet", "board": "esp32",
  "intro": "Four motors, one pack, and physics that does not forgive a sign error.",
  "levelIds": ["w5-l1","w5-l2","w5-l3","w5-l4","w5-l5","w5-l6"] }
```

`theme` is not free-form: `CampaignMap.jsx` keeps a static `THEME` map (`amber`, `teal`, `rose`, `indigo`) because Tailwind only retains classes it can see in the source. A `violet` world requires adding that entry — or the world reuses an existing theme value.

### **9.2 Levels**

Each is a level file in the existing `content/quests/<levelId>.json` shape (`docs/QUEST_SCHEMA.md`), with `briefing`, `learn`, `objectives[].rules`, three-tier hints, `starCriteria` and a headless-verifiable `solution`.

| Level | Title | Teaches | Shape of the win condition |
| :---- | :---- | :---- | :---- |
| w5-l1 | **Bench Test** | ESC arming, µs pulses, *props off* | One motor on the stand spins after a correct arming sequence; `no_prop` enforced |
| w5-l2 | **Power Math** | The configurator: Kv, cells, props, TWR | Reach a target TWR band and hover time with a given pack — no soldering iron required |
| w5-l3 | **Four Corners** | Motor order, rotation direction, prop handedness | All four motors mapped and spinning the right way; `prop_direction_mismatch` absent |
| w5-l4 | **Level Head** | IMU reading and attitude | Printed roll/pitch tracks the bench tilt within tolerance |
| w5-l5 | **The Loop** | Rate PID, saturation, blackbox reading | Hold attitude against a scripted disturbance without oscillation |
| w5-l6 | **First Flight** (boss) | Everything, on **the player's own build** | Take off, hold a hover, pass gates, land — with the drone they configured |

The boss level is deliberately parameterised by the player's own `droneConfig`: any build that passes the feasibility checks must be able to complete the course. That is the difference between "a drone level" and "a **custom** drone level."

### **9.3 Validator vocabulary**

New rule types **extend** the predicate vocabulary of `docs/QUEST_SCHEMA.md` — same JSON rule shape, same `all_of`/`any_of`/`not` composition. They do not introduce a parallel validation mechanism.

```
drone_config_between  { field: "twr"|"auwG"|"hoverThrottle"|"hoverMinutes"|"peakCurrentA", min?, max? }
esc_pulse_between     { motor: 1..4, minUs, maxUs, forMs? }
esc_armed_before_spin { }                                  // low-throttle hold honoured before any spin-up
motor_direction       { motor: 1..4, direction: "cw"|"ccw" }
prop_fitted           { fitted: boolean }                  // bench-safety quests
armed_state           { armed: boolean, atMs? }
attitude_within       { axis: "roll"|"pitch"|"yaw", maxDeg, forMs }
hover_held            { minAltitudeM, maxDriftM, forMs }
gates_passed          { count, withinMs }
landed_safely         { maxImpactMs2 }
no_crash              { }
blackbox_oscillation  { axis, maxAmplitudeDeg, windowMs }  // catches a badly tuned P term
imu_read_seen         { minSamples }
```

Extend `solution.actions` with a stick timeline — `{ atMs, sticks: { throttle, roll, pitch, yaw, arm, mode } }` — applied on the virtual clock exactly like the existing `select`/`patch`, `http`, `serial` and `mqtt` actions. Every drone level must pass the same headless test gate as every existing level: load `solution.circuit` + `solution.code`, replay the actions, require `allPassed` inside `solutionRunMs`.

## **10. Sandbox, Sharing & the Real Build**

* **Sandbox:** free configuration and free flight with no objectives, a course editor for gates, and a slow-motion/replay control for watching a crash back.
* **Sharing:** publish, preview and fork reuse the existing showcase path. A shared drone shows its spec sheet (AUW, TWR, hover time) on the preview card.
* **"Build it for real" pack** — the payoff of a *custom* build, assembled from mechanisms that already exist:
  * BOM CSV from the existing catalog shape, with vendor links and a total.
  * The wiring diagram as a PNG from the existing exporter.
  * The sketch as `.ino`.
  * A printable pre-flight checklist, including the safety items of §13.
  * A plain warning on the export: simulated performance figures are estimates from calibrated coefficients, not measurements of the parts anyone actually ships.

## **11. Backend (FastAPI) Additions**

Deliberately thin — the feature is client-side, and nothing here requires a compile service:

* Persist `kind: "drone"` documents through the **existing** project endpoints; no new storage model.
* Optional preset library: read-only drone configurations served from `content/`, same pattern as worlds/quests.
* Optional course leaderboard: best `w5-l6` course time per user, reusing the existing leaderboard service.
* No new authentication, no new rate-limited surface.

## **12. Non-Functional Requirements**

| Metric | Requirement | Justification |
| :---- | :---- | :---- |
| Flight view frame rate | 60 FPS with the dynamics loop running | A stuttering flight view makes manual flight impossible, not merely ugly |
| Dynamics determinism | Identical build + code + stick timeline + seed → identical trajectory | Headless quest validation and fair leaderboard times both require it |
| Dynamics step budget | One fixed step within its wall-clock slice on a mid-range Chromebook | Classroom hardware is the floor, per the base PRD |
| Added payload | Initial JS delta **TBD**, inside the existing 1500 KiB gzipped budget | Current build is 301.1 KiB gzipped; the flight view must not blow the budget |
| Client-side execution | 100 % in-browser, no compile service | Preserves the existing zero-install NFR |
| Headless level test | Every drone level passes in CI within its `solutionRunMs` | Same gate as all 14 existing levels |
| Accessibility | Full keyboard control of arming, sticks and modes | No quest may be gated behind analogue input |

## **13. Safety, Legal & Content Boundaries**

* Bench quests run **props off**; fitting props to a bench test is blocked with an explicit callout (`no_prop_guard`, §4.4).
* LiPo handling is taught where it is relevant: no over-discharge, no charging unattended, no puffed packs, storage voltage between sessions.
* Reverse polarity and short-circuit consequences are shown in simulation precisely so they are not discovered on a real bench.
* Any real build is subject to local aviation rules — registration, weight thresholds, line-of-sight, no-fly zones. VoltQuest states this on the export and does not enumerate jurisdiction-specific rules it cannot keep current.
* No payload-delivery, tracking, surveillance or weaponization content, in quests, sandbox presets, or showcase copy.
* Simulated performance is an estimate from calibrated coefficients. It is never presented as a flight-worthiness assessment.

## **14. Open Questions — Decision Required Before Implementation**

### **14.1 Does flight dynamics ship in v1?**

The single biggest scope fork in this addendum. Three viable answers:

| Option | Scope | Trade-off |
| :---- | :---- | :---- |
| **A — Electronics only** | Drone bench, configurator, high-current model, thrust stand, bench quests. No 6-DOF flight. | Cheapest, fits the existing engine almost entirely, and still teaches the expensive mistakes. But "custom drone" without a hover will read as unfinished. |
| **B — Full flight (recommended)** | Everything in this addendum. | Matches the product promise and makes the configurator meaningful; the dynamics loop, flight view and determinism work are the bulk of the cost. |
| **C — Phased (A then B)** | Ship A, then add the dynamics subsystem behind the interface of §3.1. | Longest calendar time, lowest risk, and §3.1 is specifically written so that A does not have to be rewritten to become B. |

The phasing in §15 **is** how B is delivered: D1 builds the bench and configurator, D2 adds the dynamics subsystem behind the §3.1 interface, D3 adds the course and the export pack. Choosing **A** therefore means stopping after D1 and dropping w5-l4 to w5-l6; choosing **C** means the same sequence with an explicit ship-and-reassess gate after D1. The work in D1 is identical under all three answers, so implementation of D1 does not block on this decision — content scope does.

### **14.2 Dependency on the deferred Custom Component Creator**

Player-authored **parts** (a motor nobody shipped, with custom pin/port definitions) is the Custom Component Creator — PRD Phase 3, currently deferred. This addendum's configurator deliberately depends only on **numeric parameters of known part kinds**, which does not need it. Confirm that boundary: if players must define entirely new part types, the Creator becomes a hard prerequisite and must be un-deferred, not reimplemented alongside.

### **14.3 Remaining decisions**

* **Coefficient calibration source:** which published thrust-stand datasets or reference builds are authoritative for `C_T`, `C_Q`, η and `R_int`? Every **TBD** in §5.2 and §6 blocks on this.
* **Player-written control loop vs. provided flight stack:** how much of w5-l5's PID must the player write before the boss level is reachable?
* **Airframe breadth:** does v1 ship quad-X only, or does the mixer's data-driven design get exercised by a hex/tri at launch?
* **Dedicated FC board id:** is an STM32-class `fc_f405` profile ever needed, or is the ESP32 carrier the permanent answer?

## **15. Phasing & Acceptance Criteria**

### **Phase D1 — Bench & Configurator**

Drone canvas mode, mount/connector model, new catalog parts, configurator with live derived figures and feasibility checks, high-current electrical model, thrust-stand view, quests w5-l1 to w5-l3.

*Accepted when:* a player can specify a build, see AUW/TWR/hover time change as they edit it, wire and arm one motor on a stand with props off, reverse the pack and get smoke instead of a hover, and export a BOM that prices the whole thing.

### **Phase D2 — Flight**

Dynamics subsystem behind the §3.1 interface, mixer, simulated IMU/baro, flight view, virtual transmitter, blackbox plot, quests w5-l4 and w5-l5.

*Accepted when:* a player-written rate loop holds attitude against a scripted disturbance; a replayed stick timeline reproduces the same trajectory bit-for-bit; brownout and prop-direction mismatch produce the documented, visible failures.

### **Phase D3 — Course, Sandbox & Real Build**

Boss level on the player's own build, gate course, sandbox course editor, replay/slow-motion, showcase spec cards, the "Build it for real" pack.

*Accepted when:* two materially different player builds that both pass the feasibility checks can both complete w5-l6, and the exported pack contains a BOM, a diagram, a sketch and a checklist.

### **KPIs**

1. **Configurator engagement:** ≥ 60 % of players who open the drone bench edit at least three specification fields before their first run.
2. **Failure comprehension:** ≥ 70 % of players who trigger a drone failure state resolve it with in-game hints rather than abandoning the session — the base PRD's error-recovery bar, applied to a harder subject.
3. **Custom completion:** ≥ 40 % of w5-l6 completions are flown on a build the player configured themselves rather than a shipped preset.
4. **Real-build intent:** ≥ 15 % of players who complete World 5 export a BOM or sketch pack.
