#include "ICS43434_Handler.h"
#include <math.h>

// Initializing with 35.0f to prevent a 0.0 starting jump
ICS43434_Handler::ICS43434_Handler() : smoothed_db(35.0f), peak_db(0.0f) {}

bool ICS43434_Handler::begin() {
    i2s_config_t i2s_config = {
        .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
        .sample_rate = 16000,
        .bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT,
        .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
        .communication_format = I2S_COMM_FORMAT_STAND_I2S,
        .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
        .dma_buf_count = 4,            // Optimized for ESP32-C3 RAM
        .dma_buf_len = MIC_BLOCK_SIZE,
        .use_apll = false
    };

    i2s_pin_config_t pin_config = {
        .bck_io_num = MIC_SCK_PIN, 
        .ws_io_num = MIC_WS_PIN,
        .data_out_num = -1, 
        .data_in_num = MIC_SD_PIN
    };

    if (i2s_driver_install(I2S_NUM_0, &i2s_config, 0, NULL) != ESP_OK) {
        #if SERIAL_DEBUG
        Serial.println("[ERROR] I2S Driver Install Failed");
        #endif
        return false;
    }

    if (i2s_set_pin(I2S_NUM_0, &pin_config) != ESP_OK) {
        #if SERIAL_DEBUG
        Serial.println("[ERROR] I2S Pin Config Failed");
        #endif
        return false;
    }

    #if SERIAL_DEBUG
    Serial.println("[ICS43434] Mic Initialized Successfully");
    #endif
    return true;
}

void ICS43434_Handler::update() {
    size_t bytes_read = 0;
    // Non-blocking read (0ms timeout) for parallel loop performance
    esp_err_t result = i2s_read(I2S_NUM_0, &raw_samples, sizeof(raw_samples), &bytes_read, 0);

    if (result == ESP_OK && bytes_read > 0) {
        int samples_count = bytes_read / 4;
        float sum_sq = 0;
        
        for (int i = 0; i < samples_count; i++) {
            // Shift 8 bits to align 24-bit data in 32-bit slot and normalize
            float sample = (float)(raw_samples[i] >> 8) * (1.0f / 8388608.0f);
            sum_sq += (sample * sample);
        }
        
        float mean_sq = sum_sq / (float)samples_count;

        // Efficient dB calculation: skips sqrtf() by using 10.0 * log10
        float inst_db = 10.0f * log10f(mean_sq + 1e-12f) + DB_OFFSET;
        
        // --- HARD CONSTRAIN 0-120 dB ---
        inst_db = constrain(inst_db, 0.0f, 120.0f);
        
        if (inst_db > peak_db) peak_db = inst_db;
        
        // Apply 98% smoothing for stable ambient reporting
        smoothed_db = (smoothed_db * 0.98f) + (inst_db * 0.02f);

        #if SERIAL_DEBUG
        static uint32_t lastPrint = 0;
        if (millis() - lastPrint > 2000) {
            Serial.printf("[MIC] Ambient: %.1f dB | Peak: %.1f dB\n", smoothed_db, peak_db);
            lastPrint = millis();
        }
        #endif
    }
}

float ICS43434_Handler::getPeakAndReset() {
    float p = peak_db;
    peak_db = 0;
    return p;
}