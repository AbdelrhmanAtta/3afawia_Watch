#include "AdvancedOximeter.h"

bool AdvancedOximeter::begin() {
  Wire.beginTransmission(MAX30102_ADDR);
  if (Wire.endTransmission() != 0) return false;

  reset();

  // Mode setup
  writeReg(REG_INTR_ENABLE_1, 0xC0); // Interrupts for HR/SpO2
  writeReg(REG_INTR_ENABLE_2, 0x00);
  writeReg(REG_FIFO_WR_PTR, 0x00);
  writeReg(REG_OVF_COUNTER, 0x00);
  writeReg(REG_FIFO_RD_PTR, 0x00);
  writeReg(REG_FIFO_CONFIG, 0x4F); // Sample avg = 4, FIFO rollover enabled
  writeReg(REG_MODE_CONFIG, 0x03); // SpO2 mode
  writeReg(REG_SPO2_CONFIG, 0x27); // ADC range = 4096nA, 100Hz, 18-bit
  writeReg(REG_LED1_PA, 0x24);     // Red LED current
  writeReg(REG_LED2_PA, 0x24);     // IR LED current

  return true;
}

void AdvancedOximeter::reset() {
  writeReg(REG_MODE_CONFIG, 0x40);
  delay(10);
}

void AdvancedOximeter::writeReg(uint8_t reg, uint8_t value) {
  Wire.beginTransmission(MAX30102_ADDR);
  Wire.write(reg);
  Wire.write(value);
  Wire.endTransmission();
}

uint8_t AdvancedOximeter::readReg(uint8_t reg) {
  Wire.beginTransmission(MAX30102_ADDR);
  Wire.write(reg);
  Wire.endTransmission(false);
  Wire.requestFrom(MAX30102_ADDR, 1);
  if (Wire.available()) return Wire.read();
  return 0;
}

uint32_t AdvancedOximeter::readFIFO() {
  Wire.beginTransmission(MAX30102_ADDR);
  Wire.write(REG_FIFO_DATA);
  Wire.endTransmission(false);
  Wire.requestFrom(MAX30102_ADDR, 6);
  if (Wire.available() < 6) return 0;

  uint32_t red = (Wire.read() << 16) | (Wire.read() << 8) | Wire.read();
  uint32_t ir  = (Wire.read() << 16) | (Wire.read() << 8) | Wire.read();

  return (ir << 24) | (red & 0xFFFFFF);
}

float AdvancedOximeter::dcFilter(float x, float prev) {
  float alpha = 0.95f;
  return alpha * prev + (1 - alpha) * x;
}

float AdvancedOximeter::bandpassFilter(float x) {
  static float prevInput = 0, prevOutput = 0;
  float alpha = 0.8f;
  float y = alpha * (prevOutput + x - prevInput);
  prevInput = x;
  prevOutput = y;
  return y;
}

float AdvancedOximeter::estimateHeartRate(float ir) {
  static float lastIR = 0;
  static unsigned long lastBeat = 0;
  float bpm = heartRate;

  if (ir > prevIR && lastIR < prevIR) {
    unsigned long now = millis();
    if (lastBeat != 0) {
      float interval = (now - lastBeat) / 1000.0f;
      bpm = 60.0f / interval;
    }
    lastBeat = now;
  }
  lastIR = ir;
  prevIR = ir;
  return bpm;
}

float AdvancedOximeter::estimateSpO2(float ir, float red) {
  float ratio = (red / (ir + 1e-6));
  ratio = constrain(ratio, 0.4f, 1.2f);
  return 110.0f - 25.0f * ratio;
}

void AdvancedOximeter::update() {
  uint32_t data = readFIFO();
  if (!data) return;

  uint32_t irRaw = (data >> 24) & 0xFFFFFF;
  uint32_t redRaw = data & 0xFFFFFF;

  float ir = bandpassFilter(irRaw - dcFilter(irRaw, irDC));
  float red = bandpassFilter(redRaw - dcFilter(redRaw, redDC));

  heartRate = estimateHeartRate(ir);
  spo2 = estimateSpO2(ir, red);

  // crude signal quality metric
  signalQuality = abs(ir) / (abs(red) + 1.0f);
  signalQuality = constrain(signalQuality, 0.0f, 1.0f);
}
