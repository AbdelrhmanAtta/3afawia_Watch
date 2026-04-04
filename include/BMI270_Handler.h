#pragma once
#include <Arduino.h>
#include <Wire.h>
#include "SparkFun_BMI270_Arduino_Library.h"

class BMI270_Handler {
public:
    BMI270_Handler();
    bool begin();
    void update();
    
    // Standalone function for other files to check motion noise
    // Returns TRUE if the sensor is moving enough to ruin PPG data
    bool isPpgMovementDetected();

    uint32_t getSteps()    { return stepCount; }
    String getActivity()   { return actStr; }

    BMI270 imu;
    uint32_t stepCount;
    uint8_t currentActivity;
    String actStr;

private:
    uint32_t lastPrintedSteps;
    uint8_t pendingActivity;
    unsigned long activityChangeTime;
    unsigned long lastPrintTime;

    void handleMotion();
};

extern BMI270_Handler* bmiInstance;