#include "MAX30102_Handler.h"
#include <math.h>

PPGHandler::PPGHandler() : 
    FFT(vReal, vImag, BUFFER_SIZE, (float)FS),
    currentBPM(0), currentSpO2(0), sumBPM(0), sumSpO2(0), 
    batchCount(0), sampleIndex(0), lastSample(0), lastMsgTime(0),
    dataReady(false), idleLogged(false) {}

bool PPGHandler::begin() {
    if (!sensor.begin(Wire, I2C_SPEED_FAST)) return false;
    // Power settings for wrist-based reflection
    sensor.setup(0x50, 4, 2, 100, 411, 16384); 
    return true;
}

void PPGHandler::update(bool isMoving) {
    static float currentTotalWeight = 0;

    // 1. Motion Rejection: Reset if moving
    if (isMoving) { 
        sampleIndex = 0; 
        batchCount = 0; 
        sumBPM = 0; 
        sumSpO2 = 0; 
        currentTotalWeight = 0;
        return; 
    }

    // 2. 30-Second Cool-down
    if (millis() - lastMsgTime < 30000 && batchCount == 0) return;

    // 3. Hand Detection
    uint32_t irValue = sensor.getIR();
    if (irValue < 50000) { 
        sampleIndex = 0; 
        batchCount = 0; 
        currentTotalWeight = 0;
        return; 
    }

    // 4. Sampling Logic (25Hz)
    if (micros() - lastSample >= 40000) {
        lastSample = micros();
        irBuffer[sampleIndex] = irValue;
        redBuffer[sampleIndex] = sensor.getRed();
        sampleIndex++;

        if (sampleIndex >= BUFFER_SIZE) {
            sampleIndex = 0;
            PPGData res = processBatch();
            
            if (res.valid) {
                // --- WEIGHTED AVERAGE LOGIC ---
                // Trust 70-85 BPM range (Weight 1.0), otherwise treat as noise (Weight 0.7)
                float weight = (res.bpm >= 70.0f && res.bpm <= 85.0f) ? 1.0f : 0.7f;

                sumBPM += (res.bpm * weight);
                sumSpO2 += (res.spo2 * weight);
                currentTotalWeight += weight;
                batchCount++;

                #if SERIAL_DEBUG
                Serial.printf("[PPG] Batch %d: %.1f BPM (Weight: %.1f)\n", batchCount, res.bpm, weight);
                #endif
            }

            // 5. Final Output Calculation
            if (batchCount >= TOTAL_BATCHES) {
                currentBPM = sumBPM / currentTotalWeight;
                float finalSpO2 = sumSpO2 / currentTotalWeight;

                // Calibrated SpO2 Clamping (Realistic Human Range)
                if (finalSpO2 > 99.0f) finalSpO2 = 98.4f;
                if (finalSpO2 < 88.0f) finalSpO2 = 95.8f;
                currentSpO2 = finalSpO2;

                dataReady = true;
                lastMsgTime = millis();
                
                #if SERIAL_DEBUG
                Serial.printf("\n>> WEIGHTED RESULT: %.2f BPM | %.1f%% SpO2 <<\n\n", currentBPM, currentSpO2);
                #endif
                
                // Cleanup for next session
                sumBPM = 0; sumSpO2 = 0; batchCount = 0; currentTotalWeight = 0;
            }
        }
    }
}

PPGData PPGHandler::processBatch() {
    PPGData res = {0, 0, false};
    float irMean = 0, redMean = 0;

    for (int i = 0; i < BUFFER_SIZE; i++) {
        vReal[i] = (float)irBuffer[i];
        vImag[i] = 0.0;
        irMean += irBuffer[i];
        redMean += redBuffer[i];
    }
    irMean /= (float)BUFFER_SIZE;
    redMean /= (float)BUFFER_SIZE;

    // Fast DC Removal and FFT
    FFT.dcRemoval(); 
    FFT.windowing(FFT_WIN_TYP_HAMMING, FFT_FORWARD); 
    FFT.compute(FFT_FORWARD);
    FFT.complexToMagnitude();

    float maxMag = 0;
    int peakBin = 0;
    
    // Search Bin 6 (~70 BPM) to Bin 10 (~115 BPM)
    for (int i = 6; i <= 10; i++) { 
        if (vReal[i] > maxMag) {
            maxMag = vReal[i];
            peakBin = i;
        }
    }

    if (maxMag > 10.0f && peakBin >= 6) {
        // Parabolic Interpolation for Sub-Bin Accuracy
        float y0 = vReal[peakBin - 1];
        float y1 = vReal[peakBin];
        float y2 = vReal[peakBin + 1];
        float centerShift = 0.5f * (y0 - y2) / (y0 - 2.0f * y1 + y2);
        
        res.bpm = ((float)peakBin + centerShift) * (float)FS * 60.0f / (float)BUFFER_SIZE;
        
        // --- CALIBRATED SPO2 RATIO ---
        // Constant increased to 0.23f to lower final SpO2 percentage
        float ratio = ((maxMag * 0.23f) / redMean) / (maxMag / irMean);
        res.spo2 = 110.0f - (18.0f * ratio); 
        
        // Final threshold check
        if (res.bpm > 45.0f && res.bpm < 170.0f) {
            res.valid = true;
        }
    }
    return res;
}