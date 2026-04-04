#include "BLE_Handler.h"
#include "Config.h"

BleManager::BleManager() : pServer(nullptr), deviceConnected(false) {}

bool BleManager::isConnected() {
    return deviceConnected;
}

void BleManager::begin() {
    BLEDevice::init(BLE_DEVICE_NAME);
    pServer = BLEDevice::createServer();
    pServer->setCallbacks(this);

    // 80 handles for 9 characteristics + descriptors
    BLEService *pService = pServer->createService(BLEUUID(SERVICE_UUID), 80);

    auto createChar = [&](const char* uuid) {
        BLECharacteristic* pChar = pService->createCharacteristic(
            uuid, 
            BLECharacteristic::PROPERTY_READ | 
            BLECharacteristic::PROPERTY_NOTIFY |
            BLECharacteristic::PROPERTY_WRITE 
        );
        pChar->addDescriptor(new BLE2902()); 
        return pChar;
    };

    bodyTempChar = createChar(BODY_TEMP_CHAR_UUID);
    airTempChar  = createChar(AIR_TEMP_CHAR_UUID);
    humidityChar = createChar(HUMIDITY_CHAR_UUID);
    iaqChar      = createChar(IAQ_CHAR_UUID);
    pressureChar = createChar(PRESSURE_CHAR_UUID);
    eco2Char     = createChar(ECO2_CHAR_UUID);
    vocChar      = createChar(VOC_CHAR_UUID);
    stepsChar    = createChar(STEP_COUNT_UUID);
    activityChar = createChar(MOTION_STATE_UUID);

    pService->start();

    BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(SERVICE_UUID);
    pAdvertising->setScanResponse(true);
    BLEDevice::startAdvertising();
}

void BleManager::onConnect(BLEServer* pServer) {
    deviceConnected = true;
}

void BleManager::onDisconnect(BLEServer* pServer) {
    deviceConnected = false;
    BLEDevice::startAdvertising();
}

void BleManager::updateData(float bodyTemp, float airTemp, float humidity, float iaq, float pressure, float eco2, float voc, uint32_t steps, String activity) {
    if (!deviceConnected) return;

    char buf[32];
    auto sendData = [&](BLECharacteristic* pChar, const char* val) {
        if (pChar) {
            pChar->setValue(val);
            pChar->notify();
            delay(35); 
        }
    };

    snprintf(buf, sizeof(buf), "%.2f C", bodyTemp); sendData(bodyTempChar, buf);
    snprintf(buf, sizeof(buf), "%.2f C", airTemp);  sendData(airTempChar, buf);
    snprintf(buf, sizeof(buf), "%.2f %%", humidity); sendData(humidityChar, buf);
    snprintf(buf, sizeof(buf), "%.0f", iaq);      sendData(iaqChar, buf);
    snprintf(buf, sizeof(buf), "%.1f hPa", pressure); sendData(pressureChar, buf);
    snprintf(buf, sizeof(buf), "%.0f ppm", eco2);     sendData(eco2Char, buf);
    snprintf(buf, sizeof(buf), "%.2f ppm", voc);      sendData(vocChar, buf);
    
    // Steps and Activity
    snprintf(buf, sizeof(buf), "%u", steps);      sendData(stepsChar, buf);
    
    if (activityChar) {
        activityChar->setValue(activity.c_str());
        activityChar->notify();
        delay(35);
    }
}