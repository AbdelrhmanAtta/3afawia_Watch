#pragma once
#include <Arduino.h>
#include "MAX30105.h" 
#include <Wire.h>
#include "Config.h"
#include "arduinoFFT.h" 

struct PPGData {
    float bpm;
    float spo2;
    bool valid;
};

class PPGHandler {
public:
    PPGHandler();
    bool begin();
    void update(bool isMoving);
    
    float getBPM()     { return currentBPM; }
    float getSpO2()    { return currentSpO2; }
    bool  hasNewData() { return dataReady; }
    void  clearNewData() { dataReady = false; }

private:
    PPGData processBatch();
    
    MAX30105 sensor;
    ArduinoFFT<float> FFT; 
    
    uint32_t irBuffer[BUFFER_SIZE];
    uint32_t redBuffer[BUFFER_SIZE];
    
    float vReal[BUFFER_SIZE];
    float vImag[BUFFER_SIZE];
    
    float currentBPM, currentSpO2, sumBPM, sumSpO2;
    int batchCount, sampleIndex;           
    unsigned long lastSample, lastMsgTime; 
    bool dataReady, idleLogged;
};