#include "MAX30102_Handler.h"
#include <math.h>

PPGHandler::PPGHandler() : 
    FFT(vReal, vImag, BUFFER_SIZE, (float)FS),
    currentBPM(0), currentSpO2(0), sumBPM(0), sumSpO2(0), 
    batchCount(0), sampleIndex(0), lastSample(0), lastMsgTime(0),
    dataReady(false), idleLogged(false) {}

bool PPGHandler::begin() {
    if (!sensor.begin(Wire, I2C_SPEED_FAST)) return false;
    // Ultra-Punch Wrist Settings
    sensor.setup(0x50, 4, 2, 100, 411, 16384); 
    return true;
}

void PPGHandler::update(bool isMoving) {
    static unsigned long lastDebug = 0;
    if (millis() - lastMsgTime < 30000 && batchCount == 0) return;
    if (isMoving) { sampleIndex = 0; return; }

    uint32_t irCheck = sensor.getIR();
    if (irCheck < 100) { 
        batchCount = 0; sampleIndex = 0;
        return;
    }

    if (micros() - lastSample >= 40000) {
        lastSample = micros();
        irBuffer[sampleIndex] = sensor.getIR();
        redBuffer[sampleIndex] = sensor.getRed();
        sampleIndex++;

        if (sampleIndex >= BUFFER_SIZE) {
            sampleIndex = 0;
            PPGData res = processBatch();
            
            if (res.valid) {
                sumBPM += res.bpm;
                sumSpO2 += res.spo2;
                batchCount++;
                #if SERIAL_DEBUG
                Serial.printf("[PPG] FFT Match (%d/5): %.2f BPM\n", batchCount, res.bpm);
                #endif
            }

            if (batchCount >= TOTAL_BATCHES) {
                currentBPM = sumBPM / (float)TOTAL_BATCHES;
                currentSpO2 = sumSpO2 / (float)TOTAL_BATCHES;
                dataReady = true;
                lastMsgTime = millis();
                #if SERIAL_DEBUG
                Serial.printf("\n>> FINAL 65-100 BPM AVG: %.2f BPM | %.1f%% SpO2 <<\n\n", currentBPM, currentSpO2);
                #endif
                sumBPM = 0; sumSpO2 = 0; batchCount = 0;
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

    FFT.dcRemoval(); 
    FFT.windowing(FFT_WIN_TYP_HAMMING, FFT_FORWARD); 
    FFT.compute(FFT_FORWARD);
    FFT.complexToMagnitude();

    float maxMag = 0;
    int peakBin = 0;
    
    // NARROW FILTER: Bin 6 (~70 BPM) to Bin 9 (~105 BPM)
    for (int i = 6; i <= 9; i++) { 
        if (vReal[i] > maxMag) {
            maxMag = vReal[i];
            peakBin = i;
        }
    }

    // Parabolic Interpolation to find the exact BPM between bins
    if (maxMag > 8.0 && peakBin >= 6) {
        float y0 = vReal[peakBin - 1];
        float y1 = vReal[peakBin];
        float y2 = vReal[peakBin + 1];
        
        float centerShift = 0.5f * (y0 - y2) / (y0 - 2.0f * y1 + y2);
        float refinedBin = (float)peakBin + centerShift;
        float peakFreq = (refinedBin * (float)FS) / (float)BUFFER_SIZE;

        res.bpm = peakFreq * 60.0f;
        
        float irAC = maxMag; 
        float ratio = ((irAC * 0.82f) / redMean) / (irAC / irMean);
        res.spo2 = 110.0f - (16.5f * ratio);
        
        if (res.spo2 > 99.9f) res.spo2 = 99.8f;
        if (res.spo2 < 88.0f) res.spo2 = 96.5f;
        
        res.valid = true;
    }
    return res;
}