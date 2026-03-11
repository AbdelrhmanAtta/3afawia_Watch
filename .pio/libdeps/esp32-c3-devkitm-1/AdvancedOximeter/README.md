# Advanced Oximeter 

The Advanced Oximeter library provides a high-accuracy interface for the MAX30102 pulse oximeter and heart-rate sensor.  
It is designed for developers who need precise, real-time physiological data with complete control over the MAX30102’s registers and data flow.

## Overview

This library implements a full low-level driver for the MAX30102 sensor, including register access, FIFO management, and digital signal processing for heart-rate and SpO₂ estimation.  
It is written in C++ and optimized for use with ESP32 and other Arduino-compatible microcontrollers.

## Features

- Complete MAX30102 register configuration and control  
- FIFO (First-In, First-Out) data buffer handling  
- DC removal and band-pass filtering for noise reduction  
- Heart-rate detection from IR signal peaks  
- SpO₂ estimation using the ratio-of-ratios method  
- Signal quality metric to assess reliability of readings  
- Simple API for sensor initialization and continuous data sampling  
- Compatible with ESP32, Arduino Uno, and similar boards  

## Implementation Notes

The library reads samples from the MAX30102’s FIFO buffer, applies a digital filter chain to remove DC offset and noise, and performs peak detection on the infrared signal to estimate heart rate.  
It simultaneously calculates SpO₂ from the ratio between red and infrared signal amplitudes.  
A quality score is generated based on signal stability, amplitude, and sensor contact.



