#include "BLE_Handler.h"
#include "Config.h"

BleManager::BleManager() : pServer(nullptr), deviceConnected(false) {}

bool BleManager::isConnected() { return deviceConnected; }

void BleManager::begin() {
    BLEDevice::init(BLE_DEVICE_NAME);
    pServer = BLEDevice::createServer();
    pServer->setCallbacks(this);
    BLEService *pService = pServer->createService(BLEUUID(SERVICE_UUID), 100);

    auto createChar = [&](const char* uuid) {
        BLECharacteristic* pC = pService->createCharacteristic(uuid, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
        pC->addDescriptor(new BLE2902());
        return pC;
    };

    bodyTempChar = createChar(BODY_TEMP_CHAR_UUID);
    airTempChar = createChar(AIR_TEMP_CHAR_UUID);
    humidityChar = createChar(HUMIDITY_CHAR_UUID);
    iaqChar = createChar(IAQ_CHAR_UUID);
    pressureChar = createChar(PRESSURE_CHAR_UUID);
    eco2Char = createChar(ECO2_CHAR_UUID);
    vocChar = createChar(VOC_CHAR_UUID);
    stepsChar = createChar(STEP_COUNT_UUID);
    activityChar = createChar(MOTION_STATE_UUID);
    sleepHeavyChar = createChar(SLEEP_HEAVY_UUID);
    sleepLightChar = createChar(SLEEP_LIGHT_UUID);
    bpmChar = createChar(BPM_CHAR_UUID);
    spo2Char = createChar(SPO2_CHAR_UUID);

    pService->start();
    BLEDevice::startAdvertising();
}

void BleManager::onConnect(BLEServer* pS) { deviceConnected = true; }
void BleManager::onDisconnect(BLEServer* pS) { deviceConnected = false; BLEDevice::startAdvertising(); }

void BleManager::updateData(float bT, float aT, float h, float i, float p, float e, float v, 
                            uint32_t s, String a, float bpm, float spo2) {
    if (!deviceConnected) return;
    char buf[32];
    auto sD = [&](BLECharacteristic* c, const char* val) { c->setValue(val); c->notify(); delay(35); };
    
    snprintf(buf, 32, "%.2f C", bT); sD(bodyTempChar, buf);
    snprintf(buf, 32, "%.2f C", aT); sD(airTempChar, buf);
    snprintf(buf, 32, "%.1f %%", h); sD(humidityChar, buf);
    snprintf(buf, 32, "%.0f", i); sD(iaqChar, buf);
    snprintf(buf, 32, "%.1f hPa", p); sD(pressureChar, buf);
    snprintf(buf, 32, "%.0f ppm", e); sD(eco2Char, buf);
    snprintf(buf, 32, "%.2f ppm", v); sD(vocChar, buf);
    snprintf(buf, 32, "%u", s); sD(stepsChar, buf);
    sD(activityChar, a.c_str());
    
    snprintf(buf, 32, "%.1f BPM", bpm); sD(bpmChar, buf);
    snprintf(buf, 32, "%.1f %%", spo2); sD(spo2Char, buf);

    #if SERIAL_DEBUG
    Serial.println("[BLE] Full Sensor Packet Sent.");
    #endif
}

void BleManager::updateSleepData(float hrs, uint8_t d, uint8_t l) {
    if (!deviceConnected) return;
    char buf[32];
    snprintf(buf, 32, "%.2f hrs", hrs); sleepHeavyChar->setValue(buf); sleepHeavyChar->notify(); delay(35);
    snprintf(buf, 32, "D:%d%% L:%d%%", d, l); sleepLightChar->setValue(buf); sleepLightChar->notify();
}