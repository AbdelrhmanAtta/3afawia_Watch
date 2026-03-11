#include "BME680_Handler.h"
#include "Config.h"

AirHandler* airInstance = nullptr;

void newDataCallback(const bme68xData data, const bsecOutputs outputs, Bsec2 bsec) {
    if (!airInstance || !outputs.nOutputs) return;
    for (uint8_t i = 0; i < outputs.nOutputs; i++) {
        const bsecData output = outputs.output[i];
        switch (output.sensor_id) {
            case BSEC_OUTPUT_IAQ: airInstance->iaqScore = output.signal; airInstance->iaqAccuracy = output.accuracy; break;
            case BSEC_OUTPUT_CO2_EQUIVALENT: airInstance->eco2Value = output.signal; break;
            case BSEC_OUTPUT_BREATH_VOC_EQUIVALENT: airInstance->vocValue = output.signal; break;
            case BSEC_OUTPUT_RAW_PRESSURE: airInstance->pressure = output.signal; break; // Fixed hPa
            case BSEC_OUTPUT_SENSOR_HEAT_COMPENSATED_TEMPERATURE: airInstance->roomTemp = output.signal; break;
            case BSEC_OUTPUT_SENSOR_HEAT_COMPENSATED_HUMIDITY: airInstance->humidity = output.signal; break;
        }
    }
}

AirHandler::AirHandler() : roomTemp(0), humidity(0), pressure(0), iaqScore(0), eco2Value(0), vocValue(0), iaqAccuracy(0), lastPrint(0), lastStateSave(0), stateSavedOnce(false) {
    airInstance = this;
}

bool AirHandler::begin() {
    if (!envSensor.begin(BME680_ADDRESS, Wire)) return false;
    envSensor.sensor.softReset();
    delay(100);
    bsec_virtual_sensor_t sensorList[] = { BSEC_OUTPUT_IAQ, BSEC_OUTPUT_CO2_EQUIVALENT, BSEC_OUTPUT_BREATH_VOC_EQUIVALENT, BSEC_OUTPUT_RAW_PRESSURE, BSEC_OUTPUT_SENSOR_HEAT_COMPENSATED_TEMPERATURE, BSEC_OUTPUT_SENSOR_HEAT_COMPENSATED_HUMIDITY };
    envSensor.updateSubscription(sensorList, 6, BSEC_SAMPLE_RATE_LP);
    envSensor.attachCallback(newDataCallback);
    loadState();
    return true;
}

void AirHandler::update() {
    envSensor.run();
    if (iaqAccuracy >= 3 && (!stateSavedOnce || (millis() - lastStateSave > BME680_STATE_SAVE_PERIOD_MS))) {
        saveState();
        stateSavedOnce = true;
        lastStateSave = millis();
    }
    #if SERIAL_DEBUG
    if (millis() - lastPrint > READ_PERIOD_MS) {
        Serial.printf("[BME680] Temp: %.2f C | Hum: %.2f %% | Pres: %.1f hPa | IAQ: %.0f (Acc: %d) | eCO2: %.0f ppm | VOC: %.2f ppm\n\n", roomTemp, humidity, pressure, iaqScore, iaqAccuracy, eco2Value, vocValue);
        lastPrint = millis();
    }
    #endif
}

void AirHandler::loadState() {
    preferences.begin("bsec", true);
    uint8_t tempState[BSEC_MAX_STATE_BLOB_SIZE];
    if (preferences.getBytesLength("state") == BSEC_MAX_STATE_BLOB_SIZE) {
        preferences.getBytes("state", tempState, BSEC_MAX_STATE_BLOB_SIZE);
        envSensor.setState(tempState);
        #if SERIAL_DEBUG
        Serial.println("[BME680] Calibration memory loaded successfully.\n");
        #endif
    }
    preferences.end();
}

void AirHandler::saveState() {
    uint8_t tempState[BSEC_MAX_STATE_BLOB_SIZE];
    if (envSensor.getState(tempState)) {
        preferences.begin("bsec", false);
        preferences.putBytes("state", tempState, BSEC_MAX_STATE_BLOB_SIZE);
        preferences.end();
        #if SERIAL_DEBUG
        Serial.println("[BME680] *** CALIBRATION STATE SAVED TO FLASH MEMORY ***\n");
        #endif
    }
}