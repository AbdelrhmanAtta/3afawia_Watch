// ─────────────────────────────────────────────────────────────────────────────
// StatsScreen.tsx
//
// The History Log screen. Shows two things:
//   1. A summary dashboard — AVG / MIN / MAX for heart rate, oxygen, and temperature
//      calculated from the entire current session.
//   2. A scrollable table of every individual reading logged during the session,
//      with colour-coded values that turn red when a reading is abnormal.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo } from 'react';
import { StyleSheet, Text, View, SafeAreaView, FlatList } from 'react-native';
import { useHealth } from '../HealthContext';

export default function StatsScreen() {

  // Pull the connection status and the reading history out of the global context.
  // `history` is the rolling array of up to 50 timestamped readings kept in HealthContext.
  const { connectionStatus, history } = useHealth();

  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION 1: Dynamic Stat Calculator
  //
  // Given a key like 'bpm', 'spo2', or 'bodyTemp', this function scans the entire
  // history array and returns the average, max, and min for that metric.
  //
  // It filters out zeroes and nulls first so a missing reading doesn't
  // drag down the average or produce a fake minimum of 0.
  // ─────────────────────────────────────────────────────────────────────────────

  const getStats = (key: string) => {
    if (history.length === 0) return { avg: 0, max: 0, min: 0 };

    // Extract just the values for this key, ignoring any zeroes or missing data
    const validData = history
      .map((h: any) => h[key])
      .filter((val: number) => val && val > 0);

    if (validData.length === 0) return { avg: 0, max: 0, min: 0 };

    const max = Math.max(...validData);
    const min = Math.min(...validData);

    // Round average to 1 decimal place for clean display
    const avg = Math.round(
      (validData.reduce((acc: number, curr: number) => acc + curr, 0) / validData.length) * 10
    ) / 10;

    return { avg, max, min };
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION 2: Memoised Stats
  //
  // useMemo means these calculations only re-run when `history` actually changes,
  // not on every single render. Important for keeping the UI smooth.
  // ─────────────────────────────────────────────────────────────────────────────

  const bpmStats  = useMemo(() => getStats('bpm'),      [history]);
  const spo2Stats = useMemo(() => getStats('spo2'),     [history]);
  const tempStats = useMemo(() => getStats('bodyTemp'), [history]);

  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION 3: MetricSummaryCard Component
  //
  // A reusable card that displays AVG / MIN / MAX for a single metric.
  // Colour is passed in as a prop so each card can have its own accent colour,
  // while MIN is always blue and MAX is always red (universal convention).
  //
  // Props:
  //   title        — label shown at the top of the card (e.g. "HR (BPM)")
  //   stats        — { avg, min, max } object from getStats()
  //   defaultColor — accent colour for the AVG row
  //   unit         — suffix appended to each value (e.g. "%" or "°")
  // ─────────────────────────────────────────────────────────────────────────────

  const MetricSummaryCard = ({
    title,
    stats,
    defaultColor,
    unit,
  }: {
    title: string;
    stats: any;
    defaultColor: string;
    unit: string;
  }) => (
    <View style={styles.summaryCard}>
      <Text style={styles.cardTitle}>{title}</Text>

      {/* AVG row — uses the card's accent colour */}
      <View style={styles.statRow}>
        <Text style={styles.statLabel}>AVG</Text>
        <Text style={[styles.statValue, { color: defaultColor }]}>
          {stats.avg}{unit}
        </Text>
      </View>

      {/* MIN row — always blue (low/cool) */}
      <View style={styles.statRow}>
        <Text style={styles.statLabel}>MIN</Text>
        <Text style={[styles.statValue, { color: '#00adb5' }]}>
          {stats.min}{unit}
        </Text>
      </View>

      {/* MAX row — always red (high/danger) */}
      <View style={styles.statRow}>
        <Text style={styles.statLabel}>MAX</Text>
        <Text style={[styles.statValue, { color: '#ff4b5c' }]}>
          {stats.max}{unit}
        </Text>
      </View>
    </View>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION 4: Summary Header (rendered above the scrollable list)
  //
  // FlatList only accepts a single scrollable body, so we can't just put JSX
  // above it — it would stay fixed and not scroll with the list. Instead we
  // pass this as `ListHeaderComponent` so it scrolls together with the rows.
  //
  // Contains:
  //   - Three MetricSummaryCards side by side (HR, Oxygen, Temperature)
  //   - The column headers for the readings table below
  // ─────────────────────────────────────────────────────────────────────────────

  const renderSummaryHeader = () => (
    <View style={styles.summaryWrapper}>

      <Text style={styles.subHeader}>SESSION STATISTICS</Text>

      {/* Three stat cards laid out in a row */}
      <View style={styles.cardsContainer}>
        <MetricSummaryCard title="HR (BPM)" stats={bpmStats}  defaultColor="#ffb400" unit=""  />
        <MetricSummaryCard title="OXYGEN"   stats={spo2Stats} defaultColor="#00adb5" unit="%" />
        <MetricSummaryCard title="TEMP"     stats={tempStats} defaultColor="#ffb400" unit="°" />
      </View>

      {/* Only show the table header once there is data to display */}
      {history.length > 0 && (
        <>
          <Text style={[styles.subHeader, { marginTop: 25 }]}>RECENT READINGS</Text>

          {/* Column headers — widths match the data columns below exactly */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, { flex: 1 }]}>TIME</Text>
            <Text style={[styles.tableHeaderText, { width: 50 }]}>BPM</Text>
            <Text style={[styles.tableHeaderText, { width: 50 }]}>SpO2</Text>
            <Text style={[styles.tableHeaderText, { width: 50, textAlign: 'right' }]}>TEMP</Text>
          </View>
        </>
      )}
    </View>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION 5: Main Render
  //
  // FlatList is used instead of ScrollView + map() because it only renders
  // the rows currently visible on screen — much more efficient for long lists.
  //
  // Key parts:
  //   ListHeaderComponent — the stats dashboard, scrolls with the list
  //   renderItem          — one row per history entry, with colour-coded values
  //   ListEmptyComponent  — shown when history is empty, explains why
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>HISTORY LOG</Text>

      <FlatList
        data={history}
        keyExtractor={(item, index) => index.toString()}
        ListHeaderComponent={renderSummaryHeader}

        // ── Each row in the readings table ──────────────────────────────────
        renderItem={({ item }) => {

          // ─────────────────────────────────────────────────────────────────
          // SECTION 6: Conditional Colour Formatting
          //
          // Each value has a normal colour. If it crosses a clinical threshold
          // it switches to bright red to catch the user's eye immediately.
          //
          //   BPM    > 100   → tachycardia warning
          //   SpO2   < 95%   → below normal oxygen saturation
          //   Temp   > 37.5° → fever threshold
          // ─────────────────────────────────────────────────────────────────

          const isHighHr  = item.bpm      > 100;   // Tachycardia
          const isLowSpo2 = item.spo2     < 95;    // Below normal SpO₂
          const isFever   = item.bodyTemp > 37.5;  // Fever

          return (
            <View style={styles.listItem}>

              {/* Timestamp — always grey, it's just reference info */}
              <Text style={[styles.rowText, { flex: 1, color: '#aaa' }]}>
                {item.time}
              </Text>

              {/* BPM — turns bright red if above 100 */}
              <Text style={[styles.rowText, { width: 50, color: isHighHr ? '#FF0000' : '#ff4b5c' }]}>
                {item.bpm}
              </Text>

              {/* SpO₂ — turns bright red if below 95% */}
              <Text style={[styles.rowText, { width: 50, color: isLowSpo2 ? '#FF0000' : '#00adb5' }]}>
                {item.spo2}%
              </Text>

              {/* Temperature — turns bright red if above 37.5° */}
              <Text style={[styles.rowText, { width: 50, textAlign: 'right', color: isFever ? '#FF0000' : '#ffb400' }]}>
                {item.bodyTemp}°
              </Text>

            </View>
          );
        }}

        // ── Empty state — shown when no readings have been logged yet ───────
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            {/*
              Ternary operator: shows a different message depending on whether
              the watch is connected or not, so the user always knows what to do.
            */}
            <Text style={styles.emptyText}>
              {connectionStatus === 'Connected'
                ? 'Bluetooth connected.\nWaiting for sensor data...'
                : 'Bluetooth is disconnected.\nConnect your Vital Band to view history.'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7: Styles
//
// Dark theme throughout (#121212 background, white/grey text).
// Cards use a slightly lighter dark (#1E1E1E) to lift off the background.
// All layout is flexbox — no fixed pixel heights so it adapts to screen size.
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#121212', padding: 20 },
  header:       { fontSize: 24, fontWeight: '900', color: '#fff', marginBottom: 5, marginTop: 29 },
  subHeader:    { fontSize: 14, color: '#888', marginBottom: 10, marginTop: 10, letterSpacing: 1 },

  summaryWrapper:  { marginBottom: 5 },
  cardsContainer:  { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },

  // Each card takes equal width via flex: 1, with a small gap between them
  summaryCard:  { backgroundColor: '#1E1E1E', flex: 1, padding: 12, borderRadius: 12, marginHorizontal: 4 },
  cardTitle:    { color: '#fff', fontSize: 11, fontWeight: 'bold', marginBottom: 10, textAlign: 'center', letterSpacing: 0.5 },

  statRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  statLabel:    { color: '#888', fontSize: 10, fontWeight: 'bold' },
  statValue:    { fontSize: 14, fontWeight: 'bold' },

  tableHeader:      { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#444' },
  tableHeaderText:  { color: '#666', fontSize: 12, fontWeight: 'bold' },

  // Each data row has a subtle bottom border acting as a divider
  listItem:     { flexDirection: 'row', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#333' },
  rowText:      { fontSize: 16, fontWeight: 'bold' },

  emptyContainer: { marginTop: 60, alignItems: 'center' },
  emptyText:      { color: '#888', textAlign: 'center', fontSize: 16, fontStyle: 'italic', lineHeight: 24 },
});