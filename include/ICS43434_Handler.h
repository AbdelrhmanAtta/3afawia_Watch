#pragma once
#include <Arduino.h>
#include <driver/i2s.h>
#include "Config.h" // Pulls in MIC_SCK_PIN, DB_OFFSET, etc.

class ICS43434_Handler {
public:
    ICS43434_Handler();
    bool begin();
    void update();
    float getAmbientDB() { return smoothed_db; } // Called by main.cpp
    float getPeakAndReset();

private:
    float smoothed_db;
    float peak_db;

    // Audio chunking variables for accurate DSP
    static const int CHUNK_SIZE = 512; 
    float sample_buffer[512];          
    int sample_index;                  
};