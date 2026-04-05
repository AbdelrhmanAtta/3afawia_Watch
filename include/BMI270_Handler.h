#pragma once
#include <Arduino.h>
#include <Wire.h>
#include "SparkFun_BMI270_Arduino_Library.h"

class BMI270_Handler {
public:
    BMI270_Handler();
    bool begin();
    void update();
    
    bool isPpgMovementDetected();
    uint32_t getSteps()    { return stepCount; }
    String getActivity()   { return actStr; }
    
    bool isAsleep()        { return userIsAsleep; }
    float getSleepHrs()    { return sleepHours; }
    uint8_t getDeepSleep() { return deepSleepPct; }
    uint8_t getLightSleep(){ return lightSleepPct; }

private:
    void handleMotion();
    void calculateSleepQuality();
    
    BMI270 imu;
    uint32_t stepCount;
    uint32_t lastPrintedSteps;
    uint8_t currentActivity;
    uint8_t pendingActivity;
    unsigned long activityChangeTime;
    unsigned long lastPrintTime;
    String actStr;

    bool userIsAsleep;
    bool isAttemptingWake;
    unsigned long sleepStartTime;
    unsigned long wakeStartTime;
    uint32_t wakeStepAnchor;
    float sleepHours;
    uint32_t jitterCount;        
    uint32_t totalSleepSamples;  
    uint8_t deepSleepPct;
    uint8_t lightSleepPct;
};

extern BMI270_Handler* bmiInstance;