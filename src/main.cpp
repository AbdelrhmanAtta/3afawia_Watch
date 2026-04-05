#include <Arduino.h>
#include <Wire.h>
#include "Config.h"
#include "BME680_Handler.h"
#include "MAX30205_Handler.h"
#include "BMI270_Handler.h"
#include "BLE_Handler.h"

AirHandler airSensor;
TempHandler bodySensor(MAX30205_ADDRESS);
BMI270_Handler bmiSensor;
BleManager bleServer;

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
    
    if (!bmiSensor.begin()) {
        #if SERIAL_DEBUG
        Serial.println("[ERROR] BMI270 initialization failed!");
        #endif
    }
}

void loop() {
    bodySensor.update();
    airSensor.update();
    bmiSensor.update();

    #if BLE_ENABLED
    static unsigned long lastBleUpdate = 0;
    static unsigned long lastSleepSync = 0;

    if (bleServer.isConnected()) {
        // AWAKE SYNC
        if (!bmiSensor.isAsleep() && (millis() - lastBleUpdate > 5000)) {
            bleServer.updateData(
                bodySensor.getTemp(), airSensor.getTemp(), airSensor.getHumidity(),
                airSensor.getIAQ(), airSensor.getPressure(), airSensor.getCO2(),
                airSensor.getVOC(), bmiSensor.getSteps(), bmiSensor.getActivity()
            );
            lastBleUpdate = millis();
        }

        // SLEEP SYNC
        if (bmiSensor.isAsleep() && (millis() - lastSleepSync > 300000)) {
            bleServer.updateData(
                bodySensor.getTemp(), airSensor.getTemp(), airSensor.getHumidity(),
                airSensor.getIAQ(), airSensor.getPressure(), airSensor.getCO2(),
                airSensor.getVOC(), 0, "Sleeping"
            );
            bleServer.updateSleepData(bmiSensor.getSleepHrs(), bmiSensor.getDeepSleep(), bmiSensor.getLightSleep());
            lastSleepSync = millis();
        }
    }
    #endif
}