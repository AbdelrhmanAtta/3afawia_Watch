#include <Arduino.h>
#include <Wire.h>
#include "Config.h"
#include "BME680_Handler.h"
#include "MAX30205_Handler.h"
#include "BMI270_Handler.h"
#include "BLE_Handler.h"
#include "MAX30102_Handler.h"
#include "ICS43434_Handler.h" // Added

AirHandler airSensor;
TempHandler bodySensor(MAX30205_ADDRESS);
BMI270_Handler bmiSensor;
BleManager bleServer;
PPGHandler ppgSensor;
ICS43434_Handler micSensor; // Added

void setup() {
    #if SERIAL_DEBUG
    Serial.begin(115200);
    delay(2000);
    Serial.println("System starting...");
    #endif

    Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);

    #if BLE_ENABLED
    bleServer.begin();
    #endif

    bodySensor.begin();
    airSensor.begin();
    bmiSensor.begin();
    ppgSensor.begin();
    micSensor.begin(); // Added
}

void loop() {
    bodySensor.update();
    airSensor.update();
    bmiSensor.update();
    micSensor.update(); // Added parallel update
    
    // PPG Update: ignores reading if motion is detected via BMI270
    ppgSensor.update(bmiSensor.isPpgMovementDetected());

    #if BLE_ENABLED
    if (bleServer.isConnected()) {
        unsigned long now = millis();
        static unsigned long lastEnvUpdate = 0;
        static unsigned long lastBmiUpdate = 0;
        static unsigned long lastMicUpdate = 0; // Added

        // HEART RATE
        if (ppgSensor.hasNewData()) {
            bleServer.sendHeartData(ppgSensor.getBPM(), ppgSensor.getSpO2());
            ppgSensor.clearNewData();
        }

        // MIC DATA: Every 5 Seconds
        if (now - lastMicUpdate > 5000) {
            bleServer.sendSoundData(micSensor.getAmbientDB());
            lastMicUpdate = now;
        }

        // ENVIRONMENT: Every 5 Seconds
        if (now - lastEnvUpdate > 5000) {
            bleServer.sendMax30205(bodySensor.getTemp());
            bleServer.sendBme680(
                airSensor.getTemp(), airSensor.getHumidity(), airSensor.getIAQ(),
                airSensor.getPressure(), airSensor.getCO2(), airSensor.getVOC()
            );
            lastEnvUpdate = now;
        }

        // BMI270 Logic (Awake vs Sleep)
        if (!bmiSensor.isAsleep()) {
            if (now - lastBmiUpdate > 5000) {
                bleServer.sendBmi270(bmiSensor.getSteps(), bmiSensor.getActivity());
                lastBmiUpdate = now;
            }
        } else {
            // Asleep: Send statistics every 1 hour
            if (now - lastBmiUpdate > 3600000) {
                bleServer.sendBmi270(0, "Sleeping");
                bleServer.sendSleepData(bmiSensor.getSleepHrs(), bmiSensor.getDeepSleep(), bmiSensor.getLightSleep());
                lastBmiUpdate = now;
            }
        }
    }
    #endif
}