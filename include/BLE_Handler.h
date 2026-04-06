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
    
    void updateData(float bodyTemp, float airTemp, float humidity, float iaq, float pressure, 
                    float eco2, float voc, uint32_t steps, String activity, float bpm, float spo2);
    
    void updateSleepData(float hrs, uint8_t deep, uint8_t light);

    void onConnect(BLEServer* pServer) override;
    void onDisconnect(BLEServer* pServer) override;

private:
    BLEServer *pServer;
    BLECharacteristic *bodyTempChar, *airTempChar, *humidityChar, *iaqChar, *pressureChar, *eco2Char, *vocChar;
    BLECharacteristic *stepsChar, *activityChar, *sleepHeavyChar, *sleepLightChar;
    BLECharacteristic *bpmChar, *spo2Char;
    bool deviceConnected;
};