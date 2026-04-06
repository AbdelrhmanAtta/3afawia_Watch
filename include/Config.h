#pragma once

// --- SYSTEM TOGGLES ---
#define SERIAL_DEBUG 1
#define BLE_ENABLED  1  

// --- I2C CONFIG ---
#define I2C_SDA_PIN 2
#define I2C_SCL_PIN 3
#define MAX30102_ADDRESS 0x57
#define BMI270_ADDRESS 0x68 
#define BME680_ADDRESS 0x76
#define MAX30205_ADDRESS 0x48

// --- SENSOR CONFIG ---
#define SKIN_FEVER_LIMIT 38.0
#define SKIN_HYSTERESIS  37.5
#define BME680_STATE_SAVE_PERIOD_MS 3600000 

// --- PPG & FFT CONFIG ---
#define FS 25
#define BUFFER_SIZE 128    // MUST be power of 2 for FFT
#define TOTAL_BATCHES 5    // Faster 5-batch average
#define READ_PERIOD_MS 3000                 

// --- BLE CONFIG (UUIDs) ---
#define BLE_DEVICE_NAME        "3afawia Watch" 
#define SERVICE_UUID           "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define BODY_TEMP_CHAR_UUID    "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define AIR_TEMP_CHAR_UUID     "584cb263-2280-485a-939e-2c81d22e8fb7"
#define HUMIDITY_CHAR_UUID     "62a8ab87-010e-4ab8-93e1-eb24ff7ee15f"
#define IAQ_CHAR_UUID          "91bd1fc5-2b0b-47e2-9b2f-2d79d6184762"
#define PRESSURE_CHAR_UUID     "7132174c-423c-4467-9c86-ef925c4864c2"
#define ECO2_CHAR_UUID         "e0132338-0050-48a0-8f93-01308a0d9d3d"
#define VOC_CHAR_UUID          "8d7e0031-1f9d-4340-974a-a03975765954"
#define STEP_COUNT_UUID        "c4e20001-2b0b-47e2-9b2f-2d79d6184762"
#define MOTION_STATE_UUID      "c4e20002-2b0b-47e2-9b2f-2d79d6184762"
#define SLEEP_HEAVY_UUID       "c4e20003-2b0b-47e2-9b2f-2d79d6184762"
#define SLEEP_LIGHT_UUID       "c4e20004-2b0b-47e2-9b2f-2d79d6184762"
#define BPM_CHAR_UUID          "c4e20005-2b0b-47e2-9b2f-2d79d6184762"
#define SPO2_CHAR_UUID         "c4e20006-2b0b-47e2-9b2f-2d79d6184762"