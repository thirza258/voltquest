from typing import Literal

BoardId = Literal["uno", "nano", "esp32", "esp32s3", "raspberrypi4", "raspberrypi5"]

BOARDS = {
    "uno": {"name": "Arduino Uno R3", "family": "avr", "language": "cpp", "logic_voltage": 5.0, "adc_bits": 10},
    "nano": {"name": "Arduino Nano", "family": "avr", "language": "cpp", "logic_voltage": 5.0, "adc_bits": 10},
    "esp32": {"name": "ESP32 DevKit V1", "family": "esp32", "language": "cpp", "logic_voltage": 3.3, "adc_bits": 12},
    "esp32s3": {"name": "ESP32-S3 DevKitC-1", "family": "esp32", "language": "cpp", "logic_voltage": 3.3, "adc_bits": 12},
    "raspberrypi4": {"name": "Raspberry Pi 4 Model B", "family": "raspberrypi", "language": "python", "logic_voltage": 3.3, "adc_bits": 0},
    "raspberrypi5": {"name": "Raspberry Pi 5", "family": "raspberrypi", "language": "python", "logic_voltage": 3.3, "adc_bits": 0},
}
