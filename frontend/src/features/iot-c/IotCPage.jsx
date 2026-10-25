import content from '@content/iot-c.json'
import ReadingTrack from '../courses/ReadingTrack.jsx'

export const IOTC_COURSES = content.courses

const track = {
  base: '/iot-c',
  courses: IOTC_COURSES,
  reviewedAt: content.reviewedAt,
  tag: 'Embedded IoT (C)',
  codeExt: 'c',
  difficulties: ['Fundamental', 'Intermediate', 'Advanced'],
  haystack: 'iot c embedded microcontroller rtos freertos lwip sockets mqtt coap mbedtls crypto deep sleep rtc ota watchdog registers bme280 telemetry',
  eyebrow: 'Embedded IoT in C · System Architecture & Drivers',
  title: 'Embedded IoT & Edge Systems in C',
  intro: 'Master production IoT device programming from microcontroller memory layouts and peripheral registers to FreeRTOS multitasking, lwIP BSD sockets, MQTT/CoAP telemetry, TLS cryptography, low-power deep sleep, dual-bank A/B OTA updates, and resilient edge firmware architectures.',
  metrics: '10 courses · 40 section checkpoints · 10 exams',
  continueLabel: 'Continue the IoT in C path',
  capstoneId: 'iot-c-capstone',
  capstoneLabel: 'Jump to the edge firmware capstone',
  allLabel: 'All IoT in C courses',
  searchLabel: 'Search IoT in C courses',
  disclosure: 'Study and take exams in any browser. Compiling C programs locally requires GCC, Clang, or an embedded cross-compiler (such as arm-none-eabi-gcc or ESP-IDF) and standard C11 headers. VoltQuest does not execute native C binaries or flash physical microcontrollers in the browser. Lab step checkboxes record your own observations and verify nothing.',
  codeNote: 'Copy or download this complete, self-contained C program, inspect the peripheral or protocol implementation, and compile or test it with gcc -std=c11 -Wall -Wextra in your local environment. VoltQuest does not flash physical microcontrollers in the browser.',
  langNote: 'Embedded IoT in C course narratives, questions and code samples are currently in English. Interface controls and learning rewards support Indonesian.',
  reviewedNote: 'Embedded IoT in C architectures and protocol standards reviewed on {date}. Aligns with FreeRTOS 10+, lwIP 2.1+, MQTT 3.1.1, RFC 7252 (CoAP), and ESP-IDF / ARM Cortex-M conventions.',
}

export default function IotCPage() {
  return <ReadingTrack track={track} />
}
