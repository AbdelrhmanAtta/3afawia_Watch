# 🩸 VitalBand 

VitalBand is a React Native (Expo) mobile application designed to interface seamlessly with a custom ESP32-based wearable health monitor (the "3afawia Watch"). It provides real-time biometric tracking, environmental analysis, sleep monitoring, and smart push notifications.

## ✨ Features

* **Real-Time Biometrics:** Live tracking and graphing of Heart Rate (BPM) and Blood Oxygen (SpO2).
* **Environmental Dashboard:** Monitors ambient conditions including Room Temperature, Humidity, Indoor Air Quality (IAQ), eCO2, and VOC levels.
* **Smart Health Alerts:** Utilizes a custom sliding-window average algorithm to prevent notification spam. It analyzes data over time and triggers local push notifications if sustained high heart rates or poor air quality are detected.
* **Activity & Sleep Tracking:** Tracks total steps, current physical state (Standing, Walking, Sleeping), and breaks down sleep quality into Deep and Light sleep percentages.
* **Continuous BLE Connection:** Background-enabled Bluetooth Low Energy (BLE) using `react-native-ble-plx` to automatically reconnect when the app is active.

## 🧰 Tech Stack

* **Framework:** React Native / Expo
* **Bluetooth:** `react-native-ble-plx` (Configured for peripheral/central modes)
* **Notifications:** `expo-notifications` 
* **UI/Data Visualization:** `react-native-gifted-charts`

## ⌚ Hardware Requirements

To use this app, you need the companion ESP32 wearable broadcasting with the device name `3afawia Watch`. The hardware utilizes the following sensors:
* **MAX30102:** Heart Rate & SpO2
* **MAX30205:** Human Body Temperature
* **BME680:** Environmental Data (Temp, Humidity, IAQ, Gas)
* **BMI270:** 6-Axis IMU for Motion & Sleep Tracking
* **ICS43434:** I2S Microphone for ambient noise levels

## 🚀 Installation & Setup

Because this app utilizes custom native code for Bluetooth and background notifications, it **cannot** be run using the standard Expo Go app from the App Store. You must build a standalone APK or Development Client.
