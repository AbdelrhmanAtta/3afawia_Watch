#include "BMI270_Handler.h"
#include "Config.h"

BMI270_Handler* bmiInstance = nullptr;

BMI270_Handler::BMI270_Handler() : 
    stepCount(0), lastPrintedSteps(0), 
    currentActivity(255), pendingActivity(255),
    activityChangeTime(0), actStr("Still"), lastPrintTime(0) 
{
    bmiInstance = this;
}

bool BMI270_Handler::begin() {
    if (imu.beginI2C(BMI270_ADDRESS, Wire) != BMI2_OK) return false;
    imu.enableFeature(BMI2_STEP_COUNTER);
    imu.enableFeature(BMI2_STEP_ACTIVITY);
    return true;
}

bool BMI270_Handler::isPpgMovementDetected() {
    imu.getSensorData();
    float x = imu.data.accelX;
    float y = imu.data.accelY;
    float z = imu.data.accelZ;
    float magSq = (x*x + y*y + z*z);
    return (abs(magSq - 1.0f) > 0.25f || currentActivity != BMI2_STEP_ACTIVITY_STILL);
}

void BMI270_Handler::update() {
    handleMotion();
    
    // Serial Print every 5 seconds only if steps changed
    if (millis() - lastPrintTime > 5000) {
        if (stepCount != lastPrintedSteps) {
            Serial.printf("[BMI270] Steps: %u | Activity: %s\n", stepCount, actStr.c_str());
            lastPrintedSteps = stepCount;
        }
        lastPrintTime = millis();
    }
}

void BMI270_Handler::handleMotion() {
    imu.getStepCount(&stepCount);
    uint8_t rawActivity = 0;
    imu.getStepActivity(&rawActivity);

    // If the sensor sees something different than our confirmed state
    if (rawActivity != currentActivity) {
        // If this new activity is the same as the one we are currently timing
        if (rawActivity == pendingActivity) {
            if (millis() - activityChangeTime > 5000) { // Confirmed after 5 seconds
                currentActivity = rawActivity;
                switch(currentActivity) {
                    case BMI2_STEP_ACTIVITY_WALKING: actStr = "Walking"; break;
                    case BMI2_STEP_ACTIVITY_RUNNING: actStr = "Running"; break;
                    default:                         actStr = "Still";   break;
                }
                Serial.printf("[BMI270] State Shift Confirmed: %s\n", actStr.c_str());
            }
        } else {
            // New activity detected, start the 5s clock
            pendingActivity = rawActivity;
            activityChangeTime = millis();
        }
    } else {
        // Sensor matches our confirmed state, reset the pending clock
        pendingActivity = currentActivity;
    }
}