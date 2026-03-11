#pragma once

// --- I2C PINS ---
#define I2C_SDA_PIN 2
#define I2C_SCL_PIN 3

// --- TIMING CONFIG ---
#define READ_PERIOD_MS 3000

// --- SYSTEM TOGGLES ---
#define SERIAL_DEBUG 1
#define BLE_ENABLED  1  

// --- BME680 CONFIG ---
#define BME680_ADDRESS 0x76
#define BME680_STATE_SAVE_PERIOD_MS 3600000 

// --- MAX30205 CONFIG ---
#define MAX30205_ADDRESS 0x48
#define SKIN_FEVER_LIMIT 38.0
#define SKIN_HYSTERESIS  37.5

// --- BLE CONFIG (UUIDs) ---
#define BLE_DEVICE_NAME        "3afawia Watch V6" 
#define SERVICE_UUID           "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define BODY_TEMP_CHAR_UUID    "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define AIR_TEMP_CHAR_UUID     "584cb263-2280-485a-939e-2c81d22e8fb7"
#define HUMIDITY_CHAR_UUID     "62a8ab87-010e-4ab8-93e1-eb24ff7ee15f"
#define IAQ_CHAR_UUID          "91bd1fc5-2b0b-47e2-9b2f-2d79d6184762"
#define PRESSURE_CHAR_UUID     "7132174c-423c-4467-9c86-ef925c4864c2"
#define ECO2_CHAR_UUID         "e0132338-0050-48a0-8f93-01308a0d9d3d"
#define VOC_CHAR_UUID          "8d7e0031-1f9d-4340-974a-a03975765954"