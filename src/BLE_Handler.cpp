#include "BLE_Handler.h"
#include "Config.h"

BleManager::BleManager() : pServer(nullptr), deviceConnected(false) {}
bool BleManager::isConnected() { return deviceConnected; }

void BleManager::begin() {
    BLEDevice::init(BLE_DEVICE_NAME);
    pServer = BLEDevice::createServer();
    pServer->setCallbacks(this);
    
    BLEService *pService = pServer->createService(BLEUUID(SERVICE_UUID), 150);

    bodyTempChar = pService->createCharacteristic(BODY_TEMP_CHAR_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
    bodyTempChar->addDescriptor(new BLE2902());

    airTempChar = pService->createCharacteristic(AIR_TEMP_CHAR_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
    airTempChar->addDescriptor(new BLE2902());

    humidityChar = pService->createCharacteristic(HUMIDITY_CHAR_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
    humidityChar->addDescriptor(new BLE2902());

    iaqChar = pService->createCharacteristic(IAQ_CHAR_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
    iaqChar->addDescriptor(new BLE2902());

    pressureChar = pService->createCharacteristic(PRESSURE_CHAR_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
    pressureChar->addDescriptor(new BLE2902());

    eco2Char = pService->createCharacteristic(ECO2_CHAR_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
    eco2Char->addDescriptor(new BLE2902());

    vocChar = pService->createCharacteristic(VOC_CHAR_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
    vocChar->addDescriptor(new BLE2902());

    stepsChar = pService->createCharacteristic(STEP_COUNT_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
    stepsChar->addDescriptor(new BLE2902());

    activityChar = pService->createCharacteristic(MOTION_STATE_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
    activityChar->addDescriptor(new BLE2902());

    sleepHeavyChar = pService->createCharacteristic(SLEEP_HEAVY_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
    sleepHeavyChar->addDescriptor(new BLE2902());

    sleepLightChar = pService->createCharacteristic(SLEEP_LIGHT_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
    sleepLightChar->addDescriptor(new BLE2902());

    bpmChar = pService->createCharacteristic(BPM_CHAR_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
    bpmChar->addDescriptor(new BLE2902());

    spo2Char = pService->createCharacteristic(SPO2_CHAR_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
    spo2Char->addDescriptor(new BLE2902());

    soundChar = pService->createCharacteristic(SOUND_CHAR_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
    soundChar->addDescriptor(new BLE2902());

    pService->start();
    BLEDevice::startAdvertising();
}

void BleManager::onConnect(BLEServer* pS) { deviceConnected = true; }
void BleManager::onDisconnect(BLEServer* pS) { deviceConnected = false; BLEDevice::startAdvertising(); }

void BleManager::sendMax30205(float bT) {
    if (!deviceConnected) return;
    char buf[32];
    snprintf(buf, 32, "%.2f C", bT);
    bodyTempChar->setValue(buf);
    bodyTempChar->notify();
}

void BleManager::sendBme680(float aT, float h, float i, float p, float e, float v) {
    if (!deviceConnected) return;
    char buf[32];
    snprintf(buf, 32, "%.2f C", aT); airTempChar->setValue(buf); airTempChar->notify(); delay(35);
    snprintf(buf, 32, "%.1f %%", h); humidityChar->setValue(buf); humidityChar->notify(); delay(35);
    snprintf(buf, 32, "%.0f", i); iaqChar->setValue(buf); iaqChar->notify(); delay(35);
    snprintf(buf, 32, "%.1f hPa", p); pressureChar->setValue(buf); pressureChar->notify(); delay(35);
    snprintf(buf, 32, "%.0f ppm", e); eco2Char->setValue(buf); eco2Char->notify(); delay(35);
    snprintf(buf, 32, "%.2f ppm", v); vocChar->setValue(buf); vocChar->notify();
}

void BleManager::sendBmi270(uint32_t s, String a) {
    if (!deviceConnected) return;
    char buf[32];
    snprintf(buf, 32, "%u", s);
    stepsChar->setValue(buf); stepsChar->notify(); delay(35);
    activityChar->setValue(a.c_str()); activityChar->notify();
}

void BleManager::sendSleepData(float hrs, uint8_t d, uint8_t l) {
    if (!deviceConnected) return;
    char buf[32];
    snprintf(buf, 32, "%.2f hrs", hrs); sleepHeavyChar->setValue(buf); sleepHeavyChar->notify(); delay(35);
    snprintf(buf, 32, "D:%d%% L:%d%%", d, l); sleepLightChar->setValue(buf); sleepLightChar->notify();
}

void BleManager::sendHeartData(float bpm, float spo2) {
    if (!deviceConnected) return;
    char buf[32];
    snprintf(buf, 32, "%.1f BPM", bpm);
    bpmChar->setValue(buf); bpmChar->notify(); delay(35);
    snprintf(buf, 32, "%.1f %%", spo2);
    spo2Char->setValue(buf); spo2Char->notify();
}

void BleManager::sendSoundData(float db) {
    if (!deviceConnected) return;
    char buf[32];
    snprintf(buf, 32, "%.1f dB", db);
    soundChar->setValue(buf);
    soundChar->notify();
}

void BleManager::updateData(float bT, float aT, float h, float i, float p, float e, float v, uint32_t s, String a) {
    sendMax30205(bT);
    sendBme680(aT, h, i, p, e, v);
    sendBmi270(s, a);
}

void BleManager::updateSleepData(float hrs, uint8_t d, uint8_t l) {
    sendSleepData(hrs, d, l);
}