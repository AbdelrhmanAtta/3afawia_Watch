#include <Arduino.h>
#include <Wire.h>
#include "Config.h"
#include "BME680_Handler.h"
#include "MAX30205_Handler.h"
#include "BLE_Handler.h"

AirHandler airSensor;
TempHandler bodySensor(MAX30205_ADDRESS);
BleManager bleServer;

void setup() {
    #if SERIAL_DEBUG
    Serial.begin(115200);
    delay(2000);
    #endif

    Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);

    #if BLE_ENABLED
    bleServer.begin();
    #endif

    bodySensor.begin();
    airSensor.begin();
}

void loop() {
    bodySensor.update();
    airSensor.update();

    #if BLE_ENABLED
    static unsigned long lastBleUpdate = 0;
    if (millis() - lastBleUpdate > READ_PERIOD_MS) {
        // Removed Accuracy from the call
        bleServer.updateData(
            bodySensor.getTemp(), airSensor.getTemp(), airSensor.getHumidity(),
            airSensor.getIAQ(), airSensor.getPressure(), airSensor.getCO2(),
            airSensor.getVOC()
        );
        lastBleUpdate = millis();
    }
    #endif
}