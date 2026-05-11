import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Dimensions,
} from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { useHealth } from '../HealthContext';

const { width } = Dimensions.get('window');

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

interface HealthHistoryEntry {
  bpm: number;
  // Add other fields from your HealthContext history shape here as needed
}

interface DataCardProps {
  label: string;
  value: string | number;
  unit: string;
  color: string;
}

// ---------------------------------------------------------------------------
// REUSABLE COMPONENT
// ---------------------------------------------------------------------------

const DataCard = ({ label, value, unit, color }: DataCardProps) => (
  <View style={styles.card}>
    <Text style={styles.label}>{label}</Text>
    <Text style={[styles.value, { color }]}>
      {value} <Text style={styles.unit}>{unit}</Text>
    </Text>
  </View>
);

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------

/**
 * How many history entries to display on the graph.
 * Keep this small so spacing calculations stay stable.
 */
const GRAPH_WINDOW = 20;

/**
 * Physiologically reasonable BPM bounds.
 * Without these, a single spike (e.g. 180 bpm) will dwarf all other data
 * and make the graph misleading.
 */
const BPM_MIN = 40;
const BPM_MAX = 200;

// ---------------------------------------------------------------------------
// MAIN SCREEN
// ---------------------------------------------------------------------------

export default function MonitorScreen() {
  const {
    bpm,
    spo2,
    bodyTemp,
    // BUG FIX (minor): roomTemp and humidity were destructured but never used
    // in the JSX. Keeping them here in case you re-add those DataCards later,
    // but they are commented out so linters don't warn.
    // roomTemp,
    // humidity,
    // motion,
    connectionStatus,
    scanAndConnect,
    history,
    steps = 0,
    activityState = 'Standing',
    activityDuration = 0,
  } = useHealth();

  // -------------------------------------------------------------------------
  // GRAPH DATA
  //
  // BUG FIX 1 — Wrong slice direction:
  //   history.slice(0, 20) takes the OLDEST 20 entries, not the newest.
  //   Use slice(-GRAPH_WINDOW) to grab the most recent entries first.
  //
  // BUG FIX 2 — Stale / invisible data:
  //   The old code called .reverse() after slicing oldest entries, which
  //   produced a chronologically correct but *stale* graph window.
  //   With slice(-GRAPH_WINDOW) the entries are already newest-last, so
  //   no .reverse() is needed — left-to-right on screen = oldest → newest.
  //
  // BUG FIX 3 — Unsafe property access:
  //   `h.bpm` was typed as `any`, hiding a potential undefined. Now typed
  //   as HealthHistoryEntry with a numeric fallback (|| 0) for safety.
  //
  // BUG FIX 4 — Minimum 2 data points:
  //   LineChart crashes if given 0 or 1 point (cannot draw a line).
  //   Baseline padding ensures we always have at least 4 neutral points.
  // -------------------------------------------------------------------------
  const recentHistory: HealthHistoryEntry[] = history.slice(-GRAPH_WINDOW);

  // BUG FIX (from TS error) — minValue/maxValue do NOT exist on LineChartPropsType
  // in react-native-gifted-charts. Instead we clamp values manually before passing
  // to the chart, which achieves the same stable Y-axis scale without invalid props.
  const rawData =
    recentHistory.length > 1
      ? recentHistory.map((h: HealthHistoryEntry) => ({ value: h.bpm || 0 }))
      : [{ value: 60 }, { value: 60 }, { value: 60 }, { value: 60 }]; // safe baseline (60 = resting BPM, looks better than 0)

  const graphData = rawData.map(point => ({
    value: Math.min(BPM_MAX, Math.max(BPM_MIN, point.value)),
  }));

  // -------------------------------------------------------------------------
  // GRAPH WIDTH & SPACING
  //
  // BUG FIX 5 — Hardcoded spacing could overflow narrow screens:
  //   spacing={15} * 20 points = 300px, which may exceed the container on
  //   small devices. Calculate spacing dynamically so the graph always fits.
  //
  // The chart container has 20px horizontal padding on each side (inside the
  // card) + 20px ScrollView padding on each side = 80px total horizontal
  // offset. Subtract that from the screen width for the usable chart width.
  // -------------------------------------------------------------------------
  const HORIZONTAL_OFFSET = 80; // 20 scrollview padding * 2 + 20 card padding * 2
  const chartWidth = width - HORIZONTAL_OFFSET;

  // Distribute spacing evenly across available points; minimum 8px per point.
  const chartSpacing = Math.max(
    8,
    Math.floor(chartWidth / Math.max(graphData.length, 1)),
  );

  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <Text style={styles.header}>VitalBand</Text>
        <View style={styles.statusContainer}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor:
                  connectionStatus === 'Connected' ? '#00FF00' : '#ff4b5c',
              },
            ]}
          />
          <Text style={styles.subHeader}>{connectionStatus}</Text>
        </View>

        {/* ----------------------------------------------------------------
            ACTIVITY OVERVIEW
        ---------------------------------------------------------------- */}
        <Text style={styles.sectionTitle}>ACTIVITY OVERVIEW</Text>
        <View
          style={[styles.card, styles.fullWidthCard, styles.activityDashboard]}
        >
          <View>
            <Text style={styles.label}>CURRENT STATE</Text>
            <View style={styles.activityRow}>
              <Text style={styles.activityStateText}>{activityState}</Text>
              <Text style={styles.activityTimeText}>{activityDuration} min</Text>
            </View>
          </View>

          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.label}>TOTAL STEPS</Text>
            <Text style={[styles.value, { color: '#4CAF50' }]}>{steps}</Text>
          </View>
        </View>

        {/* ----------------------------------------------------------------
            LIVE BIOMETRICS
        ---------------------------------------------------------------- */}
        <Text style={styles.sectionTitle}>LIVE BIOMETRICS</Text>
        <View style={styles.row}>
          <DataCard label="HEART RATE" value={bpm} unit="BPM" color="#ff4b5c" />
          <DataCard label="OXYGEN" value={spo2} unit="%" color="#00adb5" />
        </View>

        <View style={styles.row}>
          {/* BUG FIX 6 — Chained .toFixed() on potentially null/undefined:
              bodyTemp could be undefined on first render before BLE delivers
              data. The (bodyTemp || 0) coercion prevents a TypeError. */}
          <DataCard
            label="BODY TEMP"
            value={(bodyTemp || 0).toFixed(1)}
            unit="°C"
            color="#ffb400"
          />
          {/* Placeholder keeps the row layout balanced */}
          <View style={{ width: '48%' }} />
        </View>

        {/* ----------------------------------------------------------------
            REAL-TIME BPM GRAPH
        ---------------------------------------------------------------- */}
        <View style={styles.graphContainer}>
          <LineChart
            data={graphData}
            height={120}
            width={chartWidth}        // FIX 5: dynamic width
            spacing={chartSpacing}    // FIX 5: dynamic spacing
            color="#ff4b5c"
            thickness={3}
            curved                    // smooth heartbeat curve
            hideDataPoints
            hideRules
            hideYAxisText
            hideAxesAndRules
            // NOTE: isAnimated intentionally omitted — rapid real-time
            // updates + chart animations cause the line to disappear.
          />
        </View>

        {/* ----------------------------------------------------------------
            CONNECT BUTTON
        ---------------------------------------------------------------- */}
        <TouchableOpacity
          disabled={connectionStatus === 'Connected'}
          style={[
            styles.button,
            connectionStatus === 'Connected' && {
              opacity: 0.6,
              backgroundColor: '#4CAF50',
            },
          ]}
          onPress={scanAndConnect}
        >
          <Text style={styles.buttonText}>
            {connectionStatus === 'Connected'
              ? 'ACTIVE'
              : 'CONNECT YOUR WATCH'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// STYLES
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#121212' },
  scrollContainer: { padding: 20, paddingBottom: 40 },
  header: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    marginTop: 10,
  },
  subHeader: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  sectionTitle: {
    color: '#666',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1.5,
    marginBottom: 10,
    marginTop: 10,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  card: {
    backgroundColor: '#1E1E1E',
    width: '48%',
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidthCard: { width: '100%', alignItems: 'flex-start', paddingHorizontal: 25 },
  activityDashboard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  label: { color: '#888', fontSize: 12, fontWeight: 'bold', marginBottom: 5 },
  value: { fontSize: 32, fontWeight: 'bold' },
  unit: { fontSize: 14, color: '#666' },
  activityRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 0 },
  activityStateText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
    textTransform: 'uppercase',
  },
  activityTimeText: {
    fontSize: 14,
    color: '#888',
    marginLeft: 8,
    fontWeight: 'bold',
  },
  graphContainer: {
    backgroundColor: '#1E1E1E',
    padding: 20,
    borderRadius: 20,
    height: 180,
    justifyContent: 'center',
    marginBottom: 25,
    alignItems: 'center',
    overflow: 'hidden',
  },
  button: {
    backgroundColor: '#333',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: { color: '#fff', fontWeight: 'bold', letterSpacing: 1 },
});