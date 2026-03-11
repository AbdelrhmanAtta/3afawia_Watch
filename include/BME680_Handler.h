#pragma once
#include <Arduino.h>
#include <Wire.h>
#include <bsec2.h>
#include <Preferences.h> 

class AirHandler {
public:
    AirHandler();
    bool begin();
    void update();

    float getTemp()       { return roomTemp; }
    float getHumidity()   { return humidity; }
    float getPressure()   { return pressure; }
    float getIAQ()        { return iaqScore; }
    uint8_t getAccuracy() { return iaqAccuracy; }
    float getCO2()        { return eco2Value; }
    float getVOC()        { return vocValue; }

    float roomTemp, humidity, pressure, iaqScore, eco2Value, vocValue;
    uint8_t iaqAccuracy;
    Bsec2 envSensor;

private:
    unsigned long lastPrint;
    unsigned long lastStateSave;
    bool stateSavedOnce;
    Preferences preferences;
    void loadState();
    void saveState();
};

extern AirHandler* airInstance;