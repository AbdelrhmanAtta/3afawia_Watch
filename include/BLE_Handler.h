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
    void updateData(float bodyTemp, float airTemp, float humidity, float iaq, float pressure, float eco2, float voc);
    void onConnect(BLEServer* pServer) override;
    void onDisconnect(BLEServer* pServer) override;

private:
    BLEServer* pServer;
    BLECharacteristic *bodyTempChar, *airTempChar, *humidityChar, *iaqChar, *pressureChar, *eco2Char, *vocChar;
    bool deviceConnected;
};