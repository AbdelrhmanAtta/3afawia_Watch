#pragma once
#include <Arduino.h>
#include <driver/i2s.h>
#include "Config.h"

class ICS43434_Handler {
public:
    ICS43434_Handler();
    bool begin();
    void update();
    float getAmbientDB() { return smoothed_db; }
    float getPeakAndReset();

private:
    int32_t raw_samples[MIC_BLOCK_SIZE];
    float smoothed_db;
    float peak_db;
};