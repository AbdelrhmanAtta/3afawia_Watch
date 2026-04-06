#include <Arduino.h>
#include <Wire.h>
#include "Config.h"
#include "BME680_Handler.h"
#include "MAX30205_Handler.h"
#include "BMI270_Handler.h"
#include "BLE_Handler.h"
#include "MAX30102_Handler.h"

AirHandler airSensor;
TempHandler bodySensor(MAX30205_ADDRESS);
BMI270_Handler bmiSensor;
BleManager bleServer;
PPGHandler ppgSensor;

void setup() {
    #if SERIAL_DEBUG
    Serial.begin(115200);
    delay(2000);
    Serial.println("\n=== SYSTEM START ===");
    #endif

    Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
    #if BLE_ENABLED
    bleServer.begin();
    #endif
    bodySensor.begin();
    airSensor.begin();
    ppgSensor.begin();
    bmiSensor.begin();
}

void loop() {
    bmiSensor.update();
    ppgSensor.update(bmiSensor.isPpgMovementDetected());

    #if BLE_ENABLED
    if (bleServer.isConnected() && ppgSensor.hasNewData()) {
        bleServer.updateData(
            bodySensor.getTemp(), airSensor.getTemp(), airSensor.getHumidity(),
            airSensor.getIAQ(), airSensor.getPressure(), airSensor.getCO2(),
            airSensor.getVOC(), bmiSensor.getSteps(), bmiSensor.getActivity(),
            ppgSensor.getBPM(), ppgSensor.getSpO2()
        );
        ppgSensor.clearNewData();
    }
    #endif

    static unsigned long lastEnvUpdate = 0;
    if (millis() - lastEnvUpdate > READ_PERIOD_MS) {
        bodySensor.update();
        airSensor.update();
        lastEnvUpdate = millis();
    }
}