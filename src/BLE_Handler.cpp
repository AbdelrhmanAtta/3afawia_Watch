#include "BLE_Handler.h"
#include "Config.h"

BleManager::BleManager() : pServer(nullptr), deviceConnected(false) {}

void BleManager::begin() {
    BLEDevice::init(BLE_DEVICE_NAME);
    pServer = BLEDevice::createServer();
    pServer->setCallbacks(this);

    // THE MAGIC FIX: Allocate 50 handles instead of the default 15!
    // This gives you room for ~16 separate sensor characteristics.
    BLEService *pService = pServer->createService(BLEUUID(SERVICE_UUID), 50);

    auto createChar = [&](const char* uuid) {
        BLECharacteristic* pChar = pService->createCharacteristic(
            uuid, 
            BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
        );
        pChar->addDescriptor(new BLE2902()); 
        return pChar;
    };

    // All 7 can now exist peacefully
    bodyTempChar = createChar(BODY_TEMP_CHAR_UUID);
    airTempChar  = createChar(AIR_TEMP_CHAR_UUID);
    humidityChar = createChar(HUMIDITY_CHAR_UUID);
    iaqChar      = createChar(IAQ_CHAR_UUID);
    pressureChar = createChar(PRESSURE_CHAR_UUID);
    eco2Char     = createChar(ECO2_CHAR_UUID);
    vocChar      = createChar(VOC_CHAR_UUID);

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

void BleManager::updateData(float bodyTemp, float airTemp, float humidity, float iaq, float pressure, float eco2, float voc) {
    if (!deviceConnected) return;

    char buf[20];

    auto sendData = [&](BLECharacteristic* pChar, const char* fmt, float val) {
        snprintf(buf, sizeof(buf), fmt, val);
        pChar->setValue(buf);
        pChar->notify();
        delay(25); // Traffic control for the radio
    };

    sendData(bodyTempChar, "%.2f C", bodyTemp);
    sendData(airTempChar,  "%.2f C", airTemp);
    sendData(humidityChar, "%.2f %%", humidity);
    sendData(iaqChar,      "%.0f", iaq);
    sendData(pressureChar, "%.1f hPa", pressure);
    sendData(eco2Char,     "%.0f ppm", eco2);
    sendData(vocChar,      "%.2f ppm", voc);
}