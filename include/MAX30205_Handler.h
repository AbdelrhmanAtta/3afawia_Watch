#pragma once
#include <Arduino.h>
#include <Wire.h>

class TempHandler {
public:
    TempHandler(uint8_t address);
    bool begin();
    void update();
    float getTemp() { return currentTemp; }
    bool isActive() { return sensorActive; }
    void setOverTempLimit(float tempC);
    void setHysteresis(float tempC);
    
    float currentTemp;
    bool sensorActive;

private:
    uint8_t _address;
    unsigned long _lastReadTime;
    void write16(uint8_t reg, uint16_t value);
};