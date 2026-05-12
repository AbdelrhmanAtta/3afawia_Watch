#include "ICS43434_Handler.h"
#include <math.h>

// Initialize variables
ICS43434_Handler::ICS43434_Handler() : smoothed_db(35.0f), peak_db(35.0f), sample_index(0) {}

bool ICS43434_Handler::begin() {
    i2s_config_t i2s_config = {
        .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
        .sample_rate = 16000,
        .bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT,
        .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
        .communication_format = I2S_COMM_FORMAT_STAND_I2S,
        .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
        .dma_buf_count = 4,
        .dma_buf_len = CHUNK_SIZE, 
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
    int32_t raw_samples[64]; // Read whatever is immediately available
    
    // Non-blocking read (0ms timeout)
    esp_err_t result = i2s_read(I2S_NUM_0, &raw_samples, sizeof(raw_samples), &bytes_read, 0);

    if (result == ESP_OK && bytes_read > 0) {
        int samples_count = bytes_read / 4;
        
        // 1. Accumulate samples into our chunk buffer
        for (int i = 0; i < samples_count; i++) {
            if (sample_index < CHUNK_SIZE) {
                // Safely convert 32-bit I2S data to a float between -1.0 and 1.0
                sample_buffer[sample_index++] = (float)raw_samples[i] / 2147483648.0f;
            }
        }

        // 2. Process only when we have a full cohesive chunk of audio
        if (sample_index >= CHUNK_SIZE) {
            
            // Step A: Find the DC Offset (Average of the chunk)
            float sum = 0.0f;
            for (int i = 0; i < CHUNK_SIZE; i++) {
                sum += sample_buffer[i];
            }
            float dc_offset = sum / (float)CHUNK_SIZE;

            // Step B: Calculate RMS with DC Offset removed
            float sum_sq = 0.0f;
            for (int i = 0; i < CHUNK_SIZE; i++) {
                float corrected_sample = sample_buffer[i] - dc_offset;
                sum_sq += (corrected_sample * corrected_sample);
            }
            float mean_sq = sum_sq / (float)CHUNK_SIZE;

            // Step C: Get the Raw Decibels (This includes the invisible ESP32 electrical noise)
            float dbfs = 10.0f * log10f(mean_sq + 1e-12f);
            float raw_db = dbfs + 120.0f; 
            
            // ==========================================
            // Step D: THE SMART CALIBRATOR
            // ==========================================
            
            // 1. The invisible noise floor. If your room is totally quiet but the 
            // serial monitor is jumping without you talking, increase this to 68.0 or 70.0.
            float board_noise_floor = 65.0f; 
            
            // 2. What you actually want the screen to show when the room is quiet.
            float quiet_room_target = 35.0f; 
            
            // 3. THE SCREAM MULTIPLIER! 
            // At 5.0, a slight raise in your voice will shoot past 60. A scream will hit 90+.
            float sensitivity_boost = 5.0f;  
            
            float inst_db;
            if (raw_db > board_noise_floor) {
                // You are making noise! Multiply the difference so it shoots up.
                inst_db = quiet_room_target + ((raw_db - board_noise_floor) * sensitivity_boost);
            } else {
                // The room is quiet. Lock it to your target.
                inst_db = quiet_room_target;
            }
            
            // Hard constrain 0-120 dB so it never outputs a crazy impossible number
            inst_db = constrain(inst_db, 0.0f, 120.0f);
            
            // Update Peak Tracking
            if (inst_db > peak_db) {
                peak_db = inst_db;
            }
            
            // Apply smoothing for ambient reporting (so the numbers don't flicker too fast)
            smoothed_db = (smoothed_db * 0.85f) + (inst_db * 0.15f);

            // Reset index to start filling the next chunk
            sample_index = 0; 

            #if SERIAL_DEBUG
            static uint32_t lastPrint = 0;
            if (millis() - lastPrint > 1000) {
                Serial.printf("[MIC] Ambient: %.1f dB | Peak: %.1f dB\n", smoothed_db, peak_db);
                lastPrint = millis();
            }
            #endif
        }
    }
}

float ICS43434_Handler::getPeakAndReset() {
    float p = peak_db;
    // Reset peak to current ambient, NOT 0, to avoid artificial jumping in the next cycle
    peak_db = smoothed_db; 
    return p;
}