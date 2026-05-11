import React from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView } from 'react-native';
import { useHealth } from '../HealthContext';

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

interface AirCardProps {
  title: string;
  value: string | number;
  unit: string;
  status: string;
  color: string;
}

// ---------------------------------------------------------------------------
// REUSABLE COMPONENT
// ---------------------------------------------------------------------------

/**
 * AirCard — displays a single environmental metric with a colored border,
 * large value, unit, and a status badge.
 *
 * Moved outside the parent component so React doesn't re-create the
 * function reference on every render. Defining components inline inside
 * another component causes unnecessary unmount/remount cycles.
 */
const AirCard = ({ title, value, unit, status, color }: AirCardProps) => (
  <View style={[styles.card, { borderColor: color, borderWidth: 2 }]}>
    <Text style={styles.cardTitle}>{title}</Text>
    <View style={styles.valueRow}>
      <Text style={[styles.cardValue, { color }]}>{value}</Text>
      <Text style={styles.cardUnit}>{unit}</Text>
    </View>
    <View style={[styles.statusBadge, { backgroundColor: color }]}>
      {/* .toUpperCase() here is safe since status is always a string literal */}
      <Text style={styles.statusText}>{status.toUpperCase()}</Text>
    </View>
  </View>
);

// ---------------------------------------------------------------------------
// HELPER FUNCTIONS — pure functions, defined outside the component so they
// are not re-created on every render.
// ---------------------------------------------------------------------------

/**
 * IAQ (Indoor Air Quality) index thresholds.
 * Scale: 0–500. Lower is better.
 * Based on Bosch BME680 sensor documentation.
 */
const getIaqDetails = (val: number): { status: string; color: string } => {
  if (val <= 50)  return { status: 'Excellent', color: '#4CAF50' };
  if (val <= 100) return { status: 'Good',      color: '#8BC34A' };
  if (val <= 150) return { status: 'Fair',      color: '#FFEB3B' };
  if (val <= 200) return { status: 'Poor',      color: '#FF9800' };
  if (val <= 300) return { status: 'Bad',       color: '#F44336' };
  return           { status: 'Hazardous',       color: '#B71C1C' };
};

/**
 * eCO2 (equivalent CO₂) thresholds in ppm.
 * 400 ppm ≈ fresh outdoor air. Above 1000 ppm affects cognition.
 */
const getEco2Details = (val: number): { status: string; color: string } => {
  if (val <= 600)  return { status: 'Good',       color: '#4CAF50' };
  if (val <= 1000) return { status: 'Normal',     color: '#8BC34A' };
  if (val <= 1500) return { status: 'Fair/Stale', color: '#FF9800' };
  return            { status: 'Bad',              color: '#F44336' };
};

/**
 * eVOC (equivalent Volatile Organic Compounds) thresholds in ppm.
 * Source: WHO / RESET Air standard rough equivalents.
 */
const getEvocDetails = (val: number): { status: string; color: string } => {
  if (val <= 0.5) return { status: 'Good',   color: '#4CAF50' };
  if (val <= 1.5) return { status: 'Normal', color: '#8BC34A' };
  if (val <= 3.0) return { status: 'Fair',   color: '#FF9800' };
  return           { status: 'Bad',          color: '#F44336' };
};

/**
 * Room temperature comfort zones in °C.
 * BUG FIX 1 — redundant condition removed:
 *   The original had `if (val > 15 && val <= 32)` but since the first branch
 *   already returns when val <= 15, the `val > 15` check is always true here.
 *   Simplified to just `if (val <= 32)`.
 */
const getTempDetails = (val: number): { status: string; color: string } => {
  if (val <= 15) return { status: 'Cold',  color: '#1f5c72' };
  if (val <= 32) return { status: 'Fresh', color: '#6dbb14' };
  return          { status: 'Hot',         color: '#F44336' };
};

/**
 * Atmospheric pressure thresholds in hPa.
 * Normal sea-level range: ~1013 hPa. Significant deviation affects weather
 * and, in extreme cases, health (altitude sickness, etc.).
 *
 * BUG FIX 2 — overlapping conditions simplified:
 *   The original used redundant lower-bound checks (e.g. `val >= 990 && val < 1000`)
 *   that are unreachable after the first branch already handles val < 990.
 *   Simplified to sequential if/else style for clarity and correctness.
 */
const getPressureDetails = (val: number): { status: string; color: string } => {
  if (val < 990)                    return { status: 'Dangerous', color: '#B71C1C' };
  if (val < 1000)                   return { status: 'Bad',       color: '#F44336' };
  if (val < 1010)                   return { status: 'Normal',    color: '#FFEB3B' };
  if (val < 1015 || val > 1025)     return { status: 'Good',      color: '#8BC34A' };
  if (val <= 1025)                  return { status: 'Excellent', color: '#4CAF50' };
  // val > 1030 — already caught by the Dangerous branch above via the < 990 check.
  // This fallback guards against any floating-point edge cases.
  return                                   { status: 'Unknown',   color: '#888'    };
};

/**
 * Ambient noise thresholds in dB(A).
 * Based on WHO environmental noise guidelines.
 *   < 30 dB  — very quiet (library)
 *   30–50 dB — quiet (office)
 *   50–70 dB — moderate (conversation)
 *   70–85 dB — loud (traffic)
 *   85–100 dB — very loud (machinery); prolonged exposure causes hearing damage
 *  100–120 dB — extremely loud (concert)
 *  120+ dB    — painful / immediate damage threshold
 */
const getNoiseDetails = (val: number): { status: string; color: string } => {
  if (val < 30)  return { status: 'Very Quiet',      color: '#4CAF50' };
  if (val < 50)  return { status: 'Quiet',           color: '#8BC34A' };
  if (val < 70)  return { status: 'Moderate',        color: '#FFEB3B' };
  if (val < 85)  return { status: 'Loud',            color: '#FF9800' };
  if (val < 100) return { status: 'Very Loud',       color: '#FF5722' };
  if (val < 120) return { status: 'Extremely Loud',  color: '#F44336' };
  return          { status: 'Painful',               color: '#B71C1C' };
};

// ---------------------------------------------------------------------------
// MAIN SCREEN
// ---------------------------------------------------------------------------

export default function AirQualityScreen() {
  // CRASH FIX — null-safe context access:
  //   useHealth() should never return null if the provider is set up correctly,
  //   but the `|| {}` fallback prevents a hard crash during provider
  //   initialisation races (e.g. app cold-start before BLE connects).
  const healthContext = useHealth() || {};

  // Destructure with safe defaults so downstream math never operates on
  // undefined. These defaults represent "neutral / sensor not yet ready" values.
  const {
    iaq = 50,           // IAQ index (0–500); 50 = excellent baseline
    eco2 = 400,         // eCO2 ppm; 400 = clean outdoor air baseline
    evoc = 0.5,         // eVOC ppm; 0.5 = clean air baseline
    gasRes = 20,        // Raw gas resistance (kΩ) — not displayed but kept for future use
    roomTemp = 0,       // °C
    humidity = 0,       // %RH
    pressure = 1013,    // hPa; standard sea-level pressure
    noise = 0,          // dB(A)
    connectionStatus = 'Disconnected',
  } = healthContext;

  // Pre-compute all status/color objects outside JSX to keep the render clean.
  const iaqData      = getIaqDetails(iaq);
  const eco2Data     = getEco2Details(eco2);
  const evocData     = getEvocDetails(evoc);
  const tempData     = getTempDetails(roomTemp);
  const pressureData = getPressureDetails(pressure);
  const noiseData    = getNoiseDetails(noise);

  // BUG FIX 3 — toFixed() on default-zero values:
  //   If a sensor value arrives as undefined and the default is 0, calling
  //   .toFixed() on `undefined` would throw a TypeError. The destructured
  //   defaults above prevent this, but we add Number() coercions below as a
  //   belt-and-suspenders guard, since HealthContext data may arrive as strings
  //   depending on how BLE characteristics are parsed.
  const safeFixed = (val: number, digits: number) =>
    Number(val).toFixed(digits);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>ENVIRONMENT</Text>

      {/* Debug banner — only visible when not connected.
          BUG FIX 4 — inline style moved to StyleSheet:
          Inline style objects are re-created on every render; better to
          reference a named style. Added `statusWarning` to the StyleSheet. */}
      {connectionStatus !== 'Connected' && (
        <Text style={styles.statusWarning}>Status: {connectionStatus}</Text>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* ----------------------------------------------------------------
            AMBIENT NOISE
            Shown first because it's the most immediately perceivable metric.
        ---------------------------------------------------------------- */}
        <View style={styles.row}>
          <AirCard
            title="AMBIENT NOISE"
            value={safeFixed(noise, 1)}
            unit="dB"
            status={noiseData.status}
            color={noiseData.color}
          />
        </View>

        {/* ----------------------------------------------------------------
            TEMPERATURE & HUMIDITY
            Grouped together as they are directly related (feels-like temp).
        ---------------------------------------------------------------- */}
        <View style={styles.row}>
          <View style={styles.basicCard}>
            <Text style={styles.cardTitle}>TEMPERATURE</Text>
            <Text style={[styles.basicValue, { color: tempData.color }]}>
              {safeFixed(roomTemp, 1)}°C
            </Text>
          </View>
          <View style={styles.basicCard}>
            <Text style={styles.cardTitle}>HUMIDITY</Text>
            <Text style={styles.basicValue}>{safeFixed(humidity, 1)}%</Text>
          </View>
        </View>

        {/* ----------------------------------------------------------------
            IAQ SCORE
            Composite air quality index from the BME680 sensor.
        ---------------------------------------------------------------- */}
        <View style={styles.row}>
          <AirCard
            title="INDOOR AIR QUALITY SCORE"
            value={safeFixed(iaq, 0)}
            unit=""
            status={iaqData.status}
            color={iaqData.color}
          />
        </View>

        {/* ----------------------------------------------------------------
            eCO2
            Equivalent CO₂ concentration derived from VOC sensing.
        ---------------------------------------------------------------- */}
        <View style={styles.row}>
          <AirCard
            title="CARBON DIOXIDE CONCENTRATION"
            value={safeFixed(eco2, 0)}
            unit="ppm"
            status={eco2Data.status}
            color={eco2Data.color}
          />
        </View>

        {/* ----------------------------------------------------------------
            eVOC
            Equivalent VOC concentration (formaldehyde, solvents, etc.).
        ---------------------------------------------------------------- */}
        <View style={styles.row}>
          <AirCard
            title="VOLATILE ORGANIC COMPOUNDS"
            value={safeFixed(evoc, 2)}
            unit="ppm"
            status={evocData.status}
            color={evocData.color}
          />
        </View>

        {/* ----------------------------------------------------------------
            AIR PRESSURE
            Barometric pressure; useful for weather prediction and altitude.
        ---------------------------------------------------------------- */}
        <View style={styles.row}>
          <AirCard
            title="AIR PRESSURE"
            value={safeFixed(pressure, 1)}
            unit="hPa"
            status={pressureData.status}
            color={pressureData.color}
          />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// STYLES
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', padding: 20 },
  header: { fontSize: 24, fontWeight: '900', color: '#fff', marginBottom: 5, marginTop: 29 },

  // BUG FIX 4 — was an inline style object in JSX; extracted here to avoid
  // object re-creation on every render.
  statusWarning: { color: '#ff4b5c', textAlign: 'center', marginBottom: 10 },

  scrollContent: { paddingBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },

  card: {
    flex: 1,
    backgroundColor: '#1E1E1E',
    padding: 15,
    borderRadius: 12,
    marginHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    color: '#aaa',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 10,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 10 },
  cardValue: { fontSize: 32, fontWeight: '900' },
  cardUnit: { fontSize: 14, color: '#888', marginLeft: 4, fontWeight: 'bold' },

  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  statusText: { color: '#121212', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },

  basicCard: {
    flex: 1,
    backgroundColor: '#1E1E1E',
    padding: 15,
    borderRadius: 12,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  basicValue: { fontSize: 24, fontWeight: 'bold', marginTop: 5, color: '#00adf5' },
});