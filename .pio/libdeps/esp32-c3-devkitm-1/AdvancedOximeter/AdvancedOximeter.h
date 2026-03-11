#ifndef ADVANCED_OXIMETER_H
#define ADVANCED_OXIMETER_H

#include <Arduino.h>
#include <Wire.h>

// MAX30102 Register Addresses
#define REG_INTR_STATUS_1  0x00
#define REG_INTR_STATUS_2  0x01
#define REG_INTR_ENABLE_1  0x02
#define REG_INTR_ENABLE_2  0x03
#define REG_FIFO_WR_PTR    0x04
#define REG_OVF_COUNTER    0x05
#define REG_FIFO_RD_PTR    0x06
#define REG_FIFO_DATA      0x07
#define REG_FIFO_CONFIG    0x08
#define REG_MODE_CONFIG    0x09
#define REG_SPO2_CONFIG    0x0A
#define REG_LED1_PA        0x0C
#define REG_LED2_PA        0x0D
#define REG_TEMP_INT       0x1F
#define REG_TEMP_FRAC      0x20
#define REG_PART_ID        0xFF

#define MAX30102_ADDR 0x57

class AdvancedOximeter {
public:
  bool begin();
  void update();

  float getHeartRate() const { return heartRate; }
  float getSpO2() const { return spo2; }
  float getSignalQuality() const { return signalQuality; }

private:
  void reset();
  void writeReg(uint8_t reg, uint8_t value);
  uint8_t readReg(uint8_t reg);
  uint32_t readFIFO();

  // Filters
  float dcFilter(float x, float prev);
  float bandpassFilter(float x);

  // Estimations
  float estimateHeartRate(float ir);
  float estimateSpO2(float ir, float red);

  // Variables
  float irDC = 0, redDC = 0;
  float heartRate = 0;
  float spo2 = 0;
  float signalQuality = 0;

  float prevIR = 0;
  unsigned long lastBeatTime = 0;
};

#endif
