// ─────────────────────────────────────────────────────────────────────────────
// MonitorScreen.tsx  (index.tsx — the default/home tab)
//
// The main live dashboard. Shows everything about the user in real time:
//   - Current activity state and step count
//   - Sleep stage breakdown (with a tab switcher)
//   - Live heart rate, SpO₂, and body temperature
//   - A scrolling line graph of the last 20 BPM readings
//   - A connect button that turns green and locks when the watch pairs
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, ScrollView, Dimensions } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { useHealth } from '../HealthContext';

// Get the phone's screen width so the graph can fill the available space exactly
const { width } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: DataCard — Reusable Display Card
//
// A simple card that shows one metric: a label, a coloured value, and a unit.
// Defined outside the screen component so React doesn't recreate it on
// every render — keeps things efficient.
//
// Props:
//   label  — small grey label above the value (e.g. "HEART RATE")
//   value  — the number or string to display large
//   unit   — suffix after the value (e.g. "BPM", "%", "°C")
//   color  — accent colour for the value text
// ─────────────────────────────────────────────────────────────────────────────

const DataCard = ({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: string | number;
  unit: string;
  color: string;
}) => (
  <View style={styles.card}>
    <Text style={styles.label}>{label}</Text>
    <Text style={[styles.value, { color }]}>
      {value} <Text style={styles.unit}>{unit}</Text>
    </Text>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: MonitorScreen Component
// ─────────────────────────────────────────────────────────────────────────────

export default function MonitorScreen() {

  // Pull live sensor values and connection helpers from the global health context.
  // Default values (= 0, = 'Standing', etc.) protect against the brief moment
  // after app launch when the context hasn't populated yet.
  const {
    bpm, spo2, bodyTemp, motion,
    connectionStatus, scanAndConnect, history,
    steps          = 0,
    activityState  = 'Standing',
    activityDuration = 0,
    sleepHeavy     = 0,
    sleepLight     = 0,
  } = useHealth();

  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION 3: Sleep Tab State
  //
  // Local state (not in the global context) because this is purely a UI concern —
  // no other screen cares which sleep tab is selected.
  // Toggles between 'Stages' (shows % deep/light) and 'Duration' (total hours).
  // ─────────────────────────────────────────────────────────────────────────────

  const [activeSleepTab, setActiveSleepTab] = useState('Stages');

  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION 4: BPM Graph Data Preparation
  //
  // The LineChart needs an array of { value: number } objects.
  // We take the last 20 history entries, reverse them so the oldest is on the
  // left and newest on the right, and extract just the BPM.
  //
  // The fallback (4 zero points) prevents the chart from crashing when there
  // isn't enough data yet — it needs at least 2 points to draw a line.
  // ─────────────────────────────────────────────────────────────────────────────

  const graphData =
    history.length > 1
      ? history.slice(0, 20).reverse().map((h: any) => ({ value: h.bpm || 0 }))
      : [{ value: 0 }, { value: 0 }, { value: 0 }, { value: 0 }];

  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION 5: Main Render
  //
  // Wrapped in SafeAreaView (handles iPhone notch/status bar padding) and
  // ScrollView (lets the content scroll if it overflows the screen height).
  // showsVerticalScrollIndicator={false} hides the scrollbar for a cleaner look.
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Header & Connection Status ────────────────────────────────────
            The green/red dot gives instant visual feedback on BLE state.
            The dot colour is driven by a ternary on connectionStatus.        */}
        <Text style={styles.header}>VitalBand</Text>
        <View style={styles.statusContainer}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: connectionStatus === 'Connected' ? '#00FF00' : '#ff4b5c' },
            ]}
          />
          <Text style={styles.subHeader}>{connectionStatus}</Text>
        </View>

        {/* ── Activity Overview ─────────────────────────────────────────────
            One wide card showing the current motion state (e.g. "WALKING")
            beside how long the user has been in that state, and total steps
            on the right side. Both values come live from the watch firmware.  */}
        <Text style={styles.sectionTitle}>ACTIVITY OVERVIEW</Text>
        <View style={[styles.card, styles.fullWidthCard, styles.activityDashboard]}>
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

        {/* ── Sleep Tracking Tabs ───────────────────────────────────────────
            A custom two-button tab bar — no library needed.
            Pressing a tab updates `activeSleepTab` state, which controls
            which content block renders below it.                              */}
        <Text style={styles.sectionTitle}>SLEEP TRACKING</Text>

        <View style={styles.tabContainer}>
          {/* STAGES tab — shows percentage breakdown of deep vs light sleep */}
          <TouchableOpacity
            style={[styles.tabButton, activeSleepTab === 'Stages' && styles.activeTab]}
            onPress={() => setActiveSleepTab('Stages')}
          >
            <Text style={[styles.tabText, activeSleepTab === 'Stages' && styles.activeTabText]}>
              STAGES (%)
            </Text>
          </TouchableOpacity>

          {/* DURATION tab — shows total hours slept */}
          <TouchableOpacity
            style={[styles.tabButton, activeSleepTab === 'Duration' && styles.activeTab]}
            onPress={() => setActiveSleepTab('Duration')}
          >
            <Text style={[styles.tabText, activeSleepTab === 'Duration' && styles.activeTabText]}>
              DURATION
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Tab Content (conditional render) ─────────────────────────────
            Ternary operator: render one of two views based on active tab.
            'Stages' shows two DataCards side by side.
            'Duration' shows a full-width card. Currently hardcoded to 0.0 hrs
            — a total duration UUID needs to be added to the firmware to make
            this dynamic.                                                      */}
        {activeSleepTab === 'Stages' ? (
          <View style={styles.row}>
            <DataCard label="DEEP SLEEP"  value={sleepHeavy} unit="%" color="#8A2BE2" />
            <DataCard label="LIGHT SLEEP" value={sleepLight} unit="%" color="#00BFFF" />
          </View>
        ) : (
          <View style={styles.row}>
            <View style={[styles.card, styles.fullWidthCard, { alignItems: 'center', paddingVertical: 30 }]}>
              <Text style={styles.label}>TOTAL TIME ASLEEP</Text>
              {/* TODO: Replace 0.0 with a dynamic value once firmware supports total duration */}
              <Text style={[styles.value, { color: '#4CAF50', fontSize: 48 }]}>
                0.0 <Text style={styles.unit}>hrs</Text>
              </Text>
            </View>
          </View>
        )}

        {/* ── Live Biometrics ───────────────────────────────────────────────
            Three DataCards showing the core health readings as they arrive
            from the watch. bodyTemp uses .toFixed(1) to show one decimal
            place (e.g. 36.6 instead of 36.5999...).                          */}
        <Text style={styles.sectionTitle}>LIVE BIOMETRICS</Text>
        <View style={styles.row}>
          <DataCard label="HEART RATE" value={bpm}                       unit="BPM" color="#ff4b5c" />
          <DataCard label="OXYGEN"     value={spo2}                      unit="%"   color="#00adb5" />
        </View>
        <View style={styles.row}>
          <DataCard label="BODY TEMP"  value={(bodyTemp || 0).toFixed(1)} unit="°C" color="#ffb400" />
          {/* Empty view to keep the grid layout balanced (one card on this row) */}
          <View style={{ width: '48%' }} />
        </View>

        {/* ── Real-Time BPM Line Graph ──────────────────────────────────────
            Plots the last 20 BPM readings as a smooth curved line.
            All axis labels, rules, and data point dots are hidden for a clean
            minimal look — the shape of the curve is what matters.
            NOTE: isAnimated is intentionally removed. Rapid real-time updates
            combined with animation make the graph invisible/glitchy.          */}
        <View style={styles.graphContainer}>
          <LineChart
            data={graphData}
            height={120}
            width={width - 80}
            spacing={15}
            color="#ff4b5c"
            thickness={3}
            curved={true}        // Smooth bezier curve instead of jagged lines
            hideDataPoints       // No dots on each data point
            hideRules            // No horizontal grid lines
            hideYAxisText        // No Y-axis numbers
            hideAxesAndRules     // No axis borders
          />
        </View>

        {/* ── Connect Button ────────────────────────────────────────────────
            Calls scanAndConnect() from the context when pressed.
            Once connected: button turns green, label changes to "ACTIVE",
            and disabled={true} prevents double-tapping.                       */}
        <TouchableOpacity
          disabled={connectionStatus === 'Connected'}
          style={[
            styles.button,
            connectionStatus === 'Connected' && { opacity: 0.6, backgroundColor: '#4CAF50' },
          ]}
          onPress={scanAndConnect}
        >
          <Text style={styles.buttonText}>
            {connectionStatus === 'Connected' ? 'ACTIVE' : 'CONNECT YOUR WATCH'}
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6: Styles
//
// Dark theme (#121212 background, #1E1E1E cards).
// All layout uses flexbox — no fixed heights so it scales across devices.
// Tab bar uses overflow: 'hidden' to clip the activeTab highlight to rounded corners.
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea:        { flex: 1, backgroundColor: '#121212' },
  scrollContainer: { padding: 20, paddingBottom: 40 },

  header:          { fontSize: 28, fontWeight: '900', color: '#fff', textAlign: 'center', marginTop: 10 },
  subHeader:       { fontSize: 14, color: '#888', textAlign: 'center', textTransform: 'uppercase' },
  statusContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 20, marginTop: 10 },
  statusDot:       { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  sectionTitle:    { color: '#666', fontSize: 12, fontWeight: 'bold', letterSpacing: 1.5, marginBottom: 10, marginTop: 10 },

  row:             { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  card:            { backgroundColor: '#1E1E1E', width: '48%', padding: 20, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  fullWidthCard:   { width: '100%', alignItems: 'flex-start', paddingHorizontal: 25 },
  activityDashboard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },

  // Sleep tab bar — overflow hidden clips the active highlight inside the rounded container
  tabContainer:    { flexDirection: 'row', backgroundColor: '#1E1E1E', borderRadius: 12, marginBottom: 15, overflow: 'hidden' },
  tabButton:       { flex: 1, paddingVertical: 12, alignItems: 'center' },
  activeTab:       { backgroundColor: '#333' },
  tabText:         { color: '#888', fontSize: 12, fontWeight: 'bold', letterSpacing: 1 },
  activeTabText:   { color: '#fff' },

  label:           { color: '#888', fontSize: 12, fontWeight: 'bold', marginBottom: 5 },
  value:           { fontSize: 32, fontWeight: 'bold' },
  unit:            { fontSize: 14, color: '#666' },

  activityRow:       { flexDirection: 'row', alignItems: 'baseline', marginTop: 0 },
  activityStateText: { fontSize: 24, fontWeight: '900', color: '#fff', textTransform: 'uppercase' },
  activityTimeText:  { fontSize: 14, color: '#888', marginLeft: 8, fontWeight: 'bold' },

  motionRow:       { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 10 },
  motionText:      { color: '#888', fontSize: 16, fontWeight: 'bold' },

  graphContainer:  { backgroundColor: '#1E1E1E', padding: 20, borderRadius: 20, height: 180, justifyContent: 'center', marginBottom: 25, alignItems: 'center', overflow: 'hidden' },

  button:          { backgroundColor: '#333', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  buttonText:      { color: '#fff', fontWeight: 'bold', letterSpacing: 1 },
});