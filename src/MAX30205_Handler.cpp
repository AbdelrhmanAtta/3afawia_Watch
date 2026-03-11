#include "MAX30205_Handler.h"
#include "Config.h"

TempHandler::TempHandler(uint8_t address) : _address(address), currentTemp(0.0), sensorActive(false), _lastReadTime(0) {}

bool TempHandler::begin() {
    Wire.beginTransmission(_address);
    if (Wire.endTransmission() == 0) {
        sensorActive = true;
        setOverTempLimit(SKIN_FEVER_LIMIT);
        setHysteresis(SKIN_HYSTERESIS);
        return true;
    }
    return false;
}

void TempHandler::write16(uint8_t reg, uint16_t value) {
    Wire.beginTransmission(_address);
    Wire.write(reg);
    Wire.write((uint8_t)(value >> 8));
    Wire.write((uint8_t)(value & 0xFF));
    Wire.endTransmission();
}

void TempHandler::setOverTempLimit(float tempC) { write16(0x03, (uint16_t)(tempC / 0.00390625)); }
void TempHandler::setHysteresis(float tempC) { write16(0x02, (uint16_t)(tempC / 0.00390625)); }

void TempHandler::update() {
    if (!sensorActive) return;
    if (millis() - _lastReadTime > READ_PERIOD_MS) { // Respect global timing
        Wire.beginTransmission(_address);
        Wire.write(0x00);
        if (Wire.endTransmission() == 0) {
            Wire.requestFrom(_address, (uint8_t)2);
            if (Wire.available() == 2) {
                int16_t raw = (Wire.read() << 8) | Wire.read();
                currentTemp = raw * 0.00390625;
                #if SERIAL_DEBUG
                Serial.printf("[MAX30205] Body Temp: %.2f C\n\n", currentTemp);
                #endif
            }
        }
        _lastReadTime = millis();
    }
}