export const ASSISTED_CODE = `#include <VoltFlight.h>
// ESP32 carrier: motor signals 18, 19, 23, 25.
// ESP32-S3 carrier: motor signals 4, 5, 6, 7.
// The helper reads the connected IMU, barometer and receiver.
void setup() {
  Serial.begin(115200);
  Flight.begin();
  Flight.setGains(0.0015, 0.0002, 0.00003);
}
void loop() {
  Flight.update();
  delay(4); // 250 Hz control; 1 kHz physics
}
`
export const BENCH_CODE = `#include <ESP32Servo.h>
Servo esc;
void setup() {
  Serial.begin(115200);
  esc.attach(18);
  esc.writeMicroseconds(1000);
  delay(1200); // ESC low-throttle arming hold, props OFF
}
void loop() {
  esc.writeMicroseconds(1250);
  delay(20);
}
`
export const IMU_CODE = `#include <MPU6050.h>
MPU6050 imu;
void setup() {
  Serial.begin(115200);
  imu.begin();
}
void loop() {
  Serial.print("Roll: "); Serial.print(imu.getRoll(), 1);
  Serial.print(" Pitch: "); Serial.println(imu.getPitch(), 1);
  delay(100);
}
`
export const RATE_CODE = `#include <MPU6050.h>
#include <VoltRC.h>
#include <VoltFlight.h>
MPU6050 imu;
VoltRC receiver;
PID rollPID(0.0015, 0.0002, 0.00003);
PID pitchPID(0.0015, 0.0002, 0.00003);
PID yawPID(0.0015, 0.0002, 0.00003);
void setup() { imu.begin(); receiver.begin(); }
void loop() {
  if (millis() < 1200 || !receiver.armed()) {
    for (int i = 1; i <= 4; i++) Flight.writeMotor(i, 1000);
    rollPID.reset(); pitchPID.reset(); yawPID.reset();
  } else {
    float r = rollPID.compute(receiver.roll() * 100, imu.getGyroX(), 0.004);
    float p = pitchPID.compute(receiver.pitch() * 100, imu.getGyroY(), 0.004);
    float y = yawPID.compute(receiver.yaw() * 100, imu.getGyroZ(), 0.004);
    float throttle = receiver.throttle();
    Flight.mix(throttle * throttle, r, p, y);
  }
  delay(4);
}
`
