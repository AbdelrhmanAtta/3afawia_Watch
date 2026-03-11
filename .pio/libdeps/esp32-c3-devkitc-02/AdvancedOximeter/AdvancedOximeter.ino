#include <Wire.h>
#include "AdvancedOximeter.h"

AdvancedOximeter oximeter;

void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22); // SDA = 21, SCL = 22 for ESP32

  if (!oximeter.begin()) {
    Serial.println("❌ MAX30102 not detected! Check wiring and power.");
    while (1);
  }

  Serial.println("✅ Advanced Oximeter initialized.");
}

void loop() {
  oximeter.update();

  Serial.print("Heart Rate: ");
  Serial.print(oximeter.getHeartRate(), 1);
  Serial.print(" bpm | SpO₂: ");
  Serial.print(oximeter.getSpO2(), 1);
  Serial.print(" % | Signal Quality: ");
  Serial.println(oximeter.getSignalQuality(), 2);

  delay(1000);
}
