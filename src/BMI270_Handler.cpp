#include "BMI270_Handler.h"
#include "Config.h"

BMI270_Handler* bmiInstance = nullptr;

BMI270_Handler::BMI270_Handler() : 
    stepCount(0), lastPrintedSteps(0), currentActivity(255), pendingActivity(255),
    activityChangeTime(0), actStr("Still"), lastPrintTime(0),
    userIsAsleep(false), isAttemptingWake(false), sleepStartTime(0), sleepHours(0.0), 
    jitterCount(0), totalSleepSamples(0), deepSleepPct(0), lightSleepPct(0)
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
    return (abs((x*x + y*y + z*z) - 1.0f) > 0.25f || currentActivity != BMI2_STEP_ACTIVITY_STILL);
}

void BMI270_Handler::update() {
    handleMotion();
    
    #if SERIAL_DEBUG
    if (millis() - lastPrintTime > 5000) {
        Serial.printf("[BMI270] Steps: %u | Activity: %s\n", stepCount, actStr.c_str());
        lastPrintTime = millis();
    }
    #endif
}

void BMI270_Handler::handleMotion() {
    uint32_t currentTotalSteps = 0;
    imu.getStepCount(&currentTotalSteps);
    uint8_t rawActivity = 0;
    imu.getStepActivity(&rawActivity);

    if (userIsAsleep) {
        actStr = "Sleeping";
        if (rawActivity == BMI2_STEP_ACTIVITY_WALKING || rawActivity == BMI2_STEP_ACTIVITY_RUNNING) {
            if (!isAttemptingWake) {
                isAttemptingWake = true;
                wakeStartTime = millis();
                wakeStepAnchor = currentTotalSteps;
            }
        }
        if (isAttemptingWake) {
            if ((currentTotalSteps - wakeStepAnchor) >= 10 && (millis() - wakeStartTime <= 60000)) {
                userIsAsleep = false;
                isAttemptingWake = false;
                activityChangeTime = millis();
                #if SERIAL_DEBUG
                Serial.println("[BMI270] Wake-up detected!");
                #endif
            } else if (millis() - wakeStartTime > 60000) {
                isAttemptingWake = false;
            }
        }
        
        totalSleepSamples++;
        imu.getSensorData();
        float accMag = sqrt(pow(imu.data.accelX, 2) + pow(imu.data.accelY, 2) + pow(imu.data.accelZ, 2));
        if (abs(accMag - 1.0f) > 0.05f) jitterCount++;
        sleepHours = (millis() - sleepStartTime) / 3600000.0;
        calculateSleepQuality();
    } 
    else {
        stepCount = currentTotalSteps;
        if (rawActivity != currentActivity) {
            if (rawActivity == pendingActivity) {
                if (millis() - activityChangeTime > 5000) {
                    currentActivity = rawActivity;
                    switch(currentActivity) {
                        case BMI2_STEP_ACTIVITY_WALKING: actStr = "Walking"; break;
                        case BMI2_STEP_ACTIVITY_RUNNING: actStr = "Running"; break;
                        default:                         actStr = "Still";   break;
                    }
                    #if SERIAL_DEBUG
                    Serial.printf("[BMI270] State Shift Confirmed: %s\n", actStr.c_str());
                    #endif
                }
            } else {
                pendingActivity = rawActivity;
                activityChangeTime = millis();
            }
        } else {
            pendingActivity = currentActivity;
        }

        if (currentActivity == BMI2_STEP_ACTIVITY_STILL && (millis() - activityChangeTime > 1200000)) {
            userIsAsleep = true;
            sleepStartTime = millis() - 1200000;
            jitterCount = 0;
            totalSleepSamples = 0;
            #if SERIAL_DEBUG
            Serial.println("[BMI270] Entering Sleep Mode...");
            #endif
        }
    }
}

void BMI270_Handler::calculateSleepQuality() {
    if (totalSleepSamples == 0) return;
    float lightRatio = (float)jitterCount / (float)totalSleepSamples;
    lightSleepPct = (uint8_t)(constrain(lightRatio * 500.0f, 0, 100));
    deepSleepPct = 100 - lightSleepPct;
}