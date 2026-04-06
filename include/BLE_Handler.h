#pragma once
#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

class BleManager : public BLEServerCallbacks {
public:
    BleManager();
    void begin();
    bool isConnected();
    
    // --- INDIVIDUAL SEND FUNCTIONS ---
    void sendMax30205(float bodyTemp);
    void sendBme680(float airTemp, float humidity, float iaq, float pressure, float eco2, float voc);
    void sendBmi270(uint32_t steps, String activity);
    void sendSleepData(float hrs, uint8_t deep, uint8_t light);
    void sendHeartData(float bpm, float spo2); // Logic added

    // Keep original for compatibility if needed
    void updateData(float bT, float aT, float h, float i, float p, float e, float v, uint32_t s, String a);
    void updateSleepData(float hrs, uint8_t deep, uint8_t light);

    void onConnect(BLEServer* pServer) override;
    void onDisconnect(BLEServer* pServer) override;

private:
    BLEServer *pServer;
    BLECharacteristic *bodyTempChar, *airTempChar, *humidityChar, *iaqChar, *pressureChar, *eco2Char, *vocChar;
    BLECharacteristic *stepsChar, *activityChar, *sleepHeavyChar, *sleepLightChar;
    BLECharacteristic *bpmChar, *spo2Char; // Added PPG
    bool deviceConnected;
};