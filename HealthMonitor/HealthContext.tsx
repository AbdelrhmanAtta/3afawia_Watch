// ─────────────────────────────────────────────────────────────────────────────
// HealthContext.tsx
//
// This is the "brain" of the app. It manages the Bluetooth connection to the
// watch and shares all sensor data with every screen in the app.
// Think of it as a live data feed that every component can tap into.
// ─────────────────────────────────────────────────────────────────────────────

import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { LogBox, Platform, PermissionsAndroid, AppState } from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import { Buffer } from 'buffer';
import * as Notifications from 'expo-notifications';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: Device & Service Identity
//
// Every BLE device has a name and a set of "characteristics" — think of them
// as data channels. Each UUID below is a unique address for one sensor on the
// watch. These must match exactly what is programmed into the watch firmware.
// ─────────────────────────────────────────────────────────────────────────────

const DEVICE_NAME  = '3afawia Watch';
const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';

// Environmental sensor channels
const BODY_TEMP_CHAR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8'; // Skin temperature
const AIR_TEMP_CHAR_UUID  = '584cb263-2280-485a-939e-2c81d22e8fb7'; // Room temperature
const HUMIDITY_CHAR_UUID  = '62a8ab87-010e-4ab8-93e1-eb24ff7ee15f'; // Humidity %
const IAQ_CHAR_UUID       = '91bd1fc5-2b0b-47e2-9b2f-2d79d6184762'; // Air quality index
const PRESSURE_CHAR_UUID  = '7132174c-423c-4467-9c86-ef925c4864c2'; // Barometric pressure
const ECO2_CHAR_UUID      = 'e0132338-0050-48a0-8f93-01308a0d9d3d'; // CO₂ level
const VOC_CHAR_UUID       = '8d7e0031-1f9d-4340-974a-a03975765954'; // Volatile organic compounds

// Biometric and activity sensor channels
const STEP_COUNT_UUID   = 'c4e20001-2b0b-47e2-9b2f-2d79d6184762'; // Steps walked
const MOTION_STATE_UUID = 'c4e20002-2b0b-47e2-9b2f-2d79d6184762'; // e.g. "Walking", "Sitting"
const SLEEP_HEAVY_UUID  = 'c4e20003-2b0b-47e2-9b2f-2d79d6184762'; // Deep sleep minutes
const SLEEP_LIGHT_UUID  = 'c4e20004-2b0b-47e2-9b2f-2d79d6184762'; // Light sleep minutes
const BPM_CHAR_UUID     = 'c4e20005-2b0b-47e2-9b2f-2d79d6184762'; // Heart rate
const SPO2_CHAR_UUID    = 'c4e20006-2b0b-47e2-9b2f-2d79d6184762'; // Blood oxygen %
const SOUND_CHAR_UUID   = 'c4e20007-2b0b-47e2-9b2f-2d79d6184762'; // Noise level in dB

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: Notification Setup
//
// By default, Expo hides notifications when the app is open.
// This overrides that behaviour so health alerts always appear,
// even if the user is actively using the app.
// ─────────────────────────────────────────────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: Context & BLE Manager Setup
//
// The Context is the "pipe" that carries data to all screens.
// The BleManager is our interface to the phone's Bluetooth hardware.
// It's created once here so it stays alive for the whole app session.
// ─────────────────────────────────────────────────────────────────────────────

const HealthContext = createContext<any>(null);
const manager = new BleManager();

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: Simulation Constants
//
// Set SIMULATE = true to run the app without a BLE device.
// The simulation feeds fake sensor data through the exact same state setters
// that BLE uses, so every screen behaves identically to real hardware.
//
// TO ENABLE:  SIMULATE = true
// TO DISABLE: SIMULATE = false  → real BLE resumes, no other changes needed
//
// Knobs — adjust these to stress-test specific behaviours:
//   SIM_TICK_MS    — how fast data updates (real BLE is ~500–1000ms)
//   SIM_BPM_BASE   — resting heart rate centre point
//   SIM_BPM_AMP    — how much BPM swings above/below the base (sine wave)
//   SIM_BPM_NOISE  — random jitter added on top of the sine wave
//   SIM_SPIKE_ODDS — probability of a sudden BPM spike per tick
//                    use this to test graph clamping (values > BPM_MAX=200)
//   SIM_SPIKE_VAL  — the spike value; MonitorScreen should clamp it to 200
// ─────────────────────────────────────────────────────────────────────────────

const SIMULATE       = false; // 👈 flip this to toggle simulation on/off

const SIM_TICK_MS    = 800;   // ms between ticks
const SIM_BPM_BASE   = 72;    // resting BPM centre
const SIM_BPM_AMP    = 15;    // sine wave amplitude
const SIM_BPM_NOISE  = 4;     // random ±jitter per tick
const SIM_SPIKE_ODDS = 0.04;  // 4% chance of a spike per tick
const SIM_SPIKE_VAL  = 185;   // spike BPM (above normal, tests clamping)

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5: HealthProvider Component
//
// This is the component you wrap around the whole app.
// It holds all the sensor data in state, connects to the watch,
// and makes everything available to child screens via the context.
// ─────────────────────────────────────────────────────────────────────────────

export const HealthProvider = ({ children }: { children: React.ReactNode }) => {

  // -- Connection tracking --
  const [connectedDevice, setConnectedDevice] = useState<any>(null);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');

  // -- Core vitals from the watch --
  const [bpm, setBpm]           = useState(0);
  const [spo2, setSpo2]         = useState(0);
  const [bodyTemp, setBodyTemp] = useState(0);

  // Keeps a log of the last 50 readings so the history graph has data to show.
  // Shape: { time: string, bpm: number, spo2: number, bodyTemp: number }
  const [history, setHistory] = useState<{ time: string; bpm: number; spo2: number; bodyTemp: number }[]>([]);

  // -- Environmental readings --
  const [roomTemp, setRoomTemp]   = useState(0);
  const [humidity, setHumidity]   = useState(0);
  const [iaq, setIaq]             = useState(50);
  const [eco2, setEco2]           = useState(400);
  const [evoc, setEvoc]           = useState(0.5);
  const [pressure, setPressure]   = useState(1013);
  const [gasRes, setGasRes]       = useState(20);
  const [noise, setNoise]         = useState(0);

  // -- Activity & sleep --
  const [motion, setMotion]                     = useState({ x: 0, y: 0, z: 0 });
  const [steps, setSteps]                       = useState(0);
  const [activityState, setActivityState]       = useState('Standing');
  const [activityDuration, setActivityDuration] = useState(0);
  const [sleepHeavy, setSleepHeavy]             = useState(0);
  const [sleepLight, setSleepLight]             = useState(0);

  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION 6: Sliding Window Buffers
  //
  // One buffer per monitored metric. Each stores timestamped readings.
  // Old readings fall out automatically; only the recent window is averaged.
  // ─────────────────────────────────────────────────────────────────────────────

  const [bpmWindow,   setBpmWindow]   = useState<{time: number, val: number}[]>([]);
  const [iaqWindow,   setIaqWindow]   = useState<{time: number, val: number}[]>([]);
  const [spo2Window,  setSpo2Window]  = useState<{time: number, val: number}[]>([]);
  const [eco2Window,  setEco2Window]  = useState<{time: number, val: number}[]>([]);
  const [noiseWindow, setNoiseWindow] = useState<{time: number, val: number}[]>([]);

  // Tracks the last time each alert fired — prevents spamming the user.
  // A ref is used so updating it never triggers a re-render.
  const lastAlertTime = useRef({ bpm: 0, iaq: 0, spo2: 0, eco2: 0, noise: 0 });

  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION 7: Ask for Notification Permissions on Launch
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const requestPushPermissions = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') console.log('Notification permissions denied');
    };
    requestPushPermissions();
  }, []);

  // Fires an instant local notification
  const triggerNotification = async (title: string, body: string) => {
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: null, // null = fire immediately
    });
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION 8: Reusable Sliding Window Alert Function
  //
  // Instead of duplicating the same logic 5 times, this single function handles
  // all metrics. You pass in what to measure and what to do — it does the rest.
  //
  // How it works:
  //   1. Append the new reading with a timestamp to the buffer
  //   2. Discard readings older than windowMs (the "window" slides forward)
  //   3. If we have enough samples, compute the average
  //   4. If the average crosses the threshold AND the cooldown has passed → alert
  //
  // The `isBelow` flag flips the comparison for SpO2, which alerts when
  // the value is TOO LOW (opposite of BPM, IAQ, CO₂, Noise).
  //
  // ┌─────────────────────────────── Demo Timers ────────────────────────────┐
  // │  windowMs   =  10 seconds   (Production: 5–10 minutes)                │
  // │  cooldownMs =  15 seconds   (Production: 30–60 minutes)               │
  // │  minSamples =  2 readings   (Production: 10 readings)                 │
  // └────────────────────────────────────────────────────────────────────────┘
  // ─────────────────────────────────────────────────────────────────────────────

  const checkSlidingWindow = (
    newVal     : number,
    setWindow  : React.Dispatch<React.SetStateAction<{time: number, val: number}[]>>,
    alertKey   : keyof typeof lastAlertTime.current,
    threshold  : number,
    isBelow    : boolean,                         // true → alert when avg < threshold
    windowMs   : number,
    cooldownMs : number,
    minSamples : number,
    title      : string,
    getMessage : (avg: number) => string          // builds the notification body
  ) => {
    if (newVal <= 0) return;                      // skip zeroes — sensor not ready

    const now = Date.now();

    setWindow(prev => {
      const updated = [...prev, { time: now, val: newVal }]
        .filter(item => (now - item.time) <= windowMs); // drop expired readings

      if (updated.length >= minSamples) {
        const avg       = updated.reduce((a, c) => a + c.val, 0) / updated.length;
        const triggered = isBelow ? avg < threshold : avg > threshold;

        if (triggered && (now - lastAlertTime.current[alertKey] > cooldownMs)) {
          triggerNotification(title, getMessage(avg));
          lastAlertTime.current[alertKey] = now;  // stamp the cooldown
        }
      }
      return updated;
    });
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION 9: Alert Rules — one per monitored metric
  //
  // Each useEffect watches its sensor value and calls checkSlidingWindow.
  // All use demo-friendly timers. Change the values marked below for release.
  // ─────────────────────────────────────────────────────────────────────────────

  // -- DEMO timers (shared across all alerts for consistency) --
  const DEMO_WINDOW   = 10 * 1000;  // 10 seconds  → Production: 5–10 minutes
  const DEMO_COOLDOWN = 15 * 1000;  // 15 seconds  → Production: 30–60 minutes
  const DEMO_SAMPLES  = 2;          // 2 readings  → Production: 10 readings

  // Heart Rate: alert if average BPM > 100 (tachycardia threshold)
  useEffect(() => {
    checkSlidingWindow(
      bpm, setBpmWindow, 'bpm',
      100, false,                    // alert when avg > 100 BPM
      DEMO_WINDOW, DEMO_COOLDOWN, DEMO_SAMPLES,
      '❤️ High Heart Rate Alert',
      avg => `Your average heart rate is ${avg.toFixed(0)} BPM. Take a moment to rest.`
    );
  }, [bpm]);

  // Blood Oxygen: alert if average SpO2 < 90% (hypoxia danger zone)
  useEffect(() => {
    checkSlidingWindow(
      spo2, setSpo2Window, 'spo2',
      90, true,                      // alert when avg < 90% (isBelow = true)
      DEMO_WINDOW, DEMO_COOLDOWN, DEMO_SAMPLES,
      '🩸 Low Blood Oxygen Alert',
      avg => `Your average SpO₂ is ${avg.toFixed(0)}%. This is below the safe threshold of 90%. Consider seeking medical advice.`
    );
  }, [spo2]);

  // Air Quality: alert if average IAQ > 100 (crosses from Average into Poor)
  useEffect(() => {
    checkSlidingWindow(
      iaq, setIaqWindow, 'iaq',
      100, false,                    // alert when avg > 100 IAQ
      DEMO_WINDOW, DEMO_COOLDOWN, DEMO_SAMPLES,
      '😷 Poor Air Quality Alert',
      avg => `Indoor Air Quality is averaging ${avg.toFixed(0)}. Try opening a window or moving to a ventilated area.`
    );
  }, [iaq]);

  // CO₂: alert if average eCO₂ > 1000 ppm (ASHRAE impairment threshold)
  useEffect(() => {
    checkSlidingWindow(
      eco2, setEco2Window, 'eco2',
      1000, false,                   // alert when avg > 1000 ppm
      DEMO_WINDOW, DEMO_COOLDOWN, DEMO_SAMPLES,
      '🏭 High CO₂ Level Alert',
      avg => `CO₂ is averaging ${avg.toFixed(0)} ppm. High CO₂ can cause drowsiness and reduced focus. Ventilate the room.`
    );
  }, [eco2]);

  // Noise: alert if average sound level > 85 dB (OSHA hearing damage threshold)
  useEffect(() => {
    checkSlidingWindow(
      noise, setNoiseWindow, 'noise',
      85, false,                     // alert when avg > 85 dB
      DEMO_WINDOW, DEMO_COOLDOWN, DEMO_SAMPLES,
      '🔊 High Noise Level Alert',
      avg => `Average noise level is ${avg.toFixed(0)} dB. Prolonged exposure above 85 dB can damage hearing. Consider ear protection.`
    );
  }, [noise]);

  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION 10: Activity Duration Timer
  //
  // Resets to 0 whenever the watch reports a new activity state, then counts
  // up by 1 every 60 seconds to track how long the user has been in that state.
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    setActivityDuration(0);
    const timer = setInterval(() => setActivityDuration(prev => prev + 1), 60000);
    return () => clearInterval(timer); // cleanup prevents memory leaks
  }, [activityState]);

  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION 11: Simulation
  //
  // Feeds fake sensor data through the same state setters BLE would use.
  // Every screen behaves identically to real hardware — no code changes needed
  // in MonitorScreen, AirQualityScreen, or anywhere else.
  //
  // Two useEffects are used intentionally:
  //   1. Seed — runs once on mount to pre-fill history so the graph isn't empty
  //   2. Tick — runs an interval that pushes new readings every SIM_TICK_MS
  //
  // Both return early when SIMULATE = false, adding zero overhead to production.
  // ─────────────────────────────────────────────────────────────────────────────

  // Seed: pre-fill history with 20 plausible readings before the first tick fires
  useEffect(() => {
    if (!SIMULATE) return;

    const seed = Array.from({ length: 20 }, (_, i) => ({
      time: new Date(Date.now() - (20 - i) * SIM_TICK_MS)
        .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      bpm: Math.round(
        SIM_BPM_BASE +
        SIM_BPM_AMP * Math.sin((i / 20) * Math.PI * 2) +
        (Math.random() * SIM_BPM_NOISE * 2 - SIM_BPM_NOISE)
      ),
      spo2: 98,
      bodyTemp: 36.8,
    }));

    setHistory(seed);
    setConnectionStatus('Connected'); // makes the Connect button show as ACTIVE
  }, []);

  // Tick: simulate live sensor updates
  useEffect(() => {
    if (!SIMULATE) return;

    let tick = 0;

    const interval = setInterval(() => {
      tick += 1;

      // BPM: sine wave base + random noise + occasional spike to stress-test clamping
      const isSpike = Math.random() < SIM_SPIKE_ODDS;
      const rawBpm  = isSpike
        ? SIM_SPIKE_VAL
        : SIM_BPM_BASE +
          SIM_BPM_AMP * Math.sin((tick / 10) * Math.PI * 2) +
          (Math.random() * SIM_BPM_NOISE * 2 - SIM_BPM_NOISE);
      const newBpm = Math.round(Math.min(200, Math.max(40, rawBpm)));
      setBpm(newBpm);

      // SpO2: small random walk in the healthy 97–100 range
      setSpo2(Math.round(Math.min(100, Math.max(90, 97 + Math.random() * 3 - 1))));

      // Body temp: slow drift ±0.05 °C per tick, clamped to realistic range
      setBodyTemp(prev =>
        parseFloat(Math.min(37.5, Math.max(36.0, prev + Math.random() * 0.1 - 0.05)).toFixed(1))
      );

      // Environmental — keeps AirQualityScreen looking live during testing
      setRoomTemp(parseFloat((22 + Math.random() * 0.4 - 0.2).toFixed(1)));
      setHumidity(parseFloat((45 + Math.random() * 2 - 1).toFixed(1)));
      setNoise(Math.round(35 + Math.random() * 20));

      // History: same shape as the real history log in SECTION 15.
      // SECTION 15 is guarded with `if (SIMULATE) return` below, so only
      // this path writes to history during simulation — no double-writes.
      setHistory(prev => {
        const entry = {
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          bpm: newBpm,
          spo2: 98,
          bodyTemp: 36.8,
        };
        const updated = [entry, ...prev];
        if (updated.length > 50) updated.pop(); // keep last 50, matching real behaviour
        return updated;
      });

    }, SIM_TICK_MS);

    return () => clearInterval(interval); // cleanup on unmount
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION 12: Bluetooth Adapter State Watcher
  //
  // Watches for the user turning Bluetooth on/off in phone settings.
  // Resets status to 'Disconnected' when BT comes back on so auto-reconnect works.
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const subscription = manager.onStateChange((state) => {
      if (state === 'PoweredOff') {
        setConnectionStatus('Bluetooth Off');
      } else if (state === 'PoweredOn' && connectionStatus === 'Bluetooth Off') {
        setConnectionStatus('Disconnected');
      }
    }, true);
    return () => subscription.remove();
  }, [connectionStatus]);

  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION 13: Android Permission Request
  //
  // Android 12+ needs BLUETOOTH_SCAN + BLUETOOTH_CONNECT.
  // Older Android only needs location permission for BLE scanning.
  // iOS handles permissions automatically — always returns true here.
  // ─────────────────────────────────────────────────────────────────────────────

  const requestPermissions = async () => {
    if (Platform.OS === 'android' && Platform.Version >= 31) {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      return result['android.permission.BLUETOOTH_SCAN'] === 'granted';
    } else if (Platform.OS === 'android' && Platform.Version < 31) {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION 14: Scan & Connect
  //
  // 1. Check permissions — stop if denied
  // 2. Scan all nearby BLE devices
  // 3. Stop scanning the moment the watch is found by name
  // 4. Connect → discover services → start live data monitoring
  // 5. Register a disconnect listener for out-of-range / battery events
  // ─────────────────────────────────────────────────────────────────────────────

  const scanAndConnect = async () => {
    // In simulation mode the button is disabled (shown as ACTIVE), but guard
    // here too in case scanAndConnect is called programmatically elsewhere.
    if (SIMULATE) return;

    const hasPerms = await requestPermissions();
    if (!hasPerms) { setConnectionStatus('Perms Denied'); return; }

    setConnectionStatus('Scanning...');
    manager.startDeviceScan(null, null, (error, device) => {
      if (error) { setConnectionStatus('Scan Error'); return; }

      if (device?.name === DEVICE_NAME) {
        manager.stopDeviceScan();
        setConnectionStatus('Connecting...');

        device.connect()
          .then(d => d.discoverAllServicesAndCharacteristics())
          .then(d => {
            setConnectionStatus('Connected');
            setConnectedDevice(d);
            setupMonitor(d);

            d.onDisconnected(() => {
              setConnectionStatus('Disconnected');
              setConnectedDevice(null);
            });
          })
          .catch(() => setConnectionStatus('Failed'));
      }
    });
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION 15: Data Monitor Setup
  //
  // Subscribe to every sensor characteristic once connected.
  // The watch pushes a new value whenever a reading changes.
  // BLE data arrives as Base64 bytes → decoded to UTF-8 → parsed as a float.
  // ─────────────────────────────────────────────────────────────────────────────

  const setupMonitor = (device: any) => {
    const parseString = (b64: string) => Buffer.from(b64, 'base64').toString('utf-8');
    const parseNum    = (b64: string) => parseFloat(parseString(b64));

    // Environmental sensors
    device.monitorCharacteristicForService(SERVICE_UUID, BODY_TEMP_CHAR_UUID, (e: any, c: any) => { if (!e && c?.value) setBodyTemp(parseNum(c.value)); });
    device.monitorCharacteristicForService(SERVICE_UUID, AIR_TEMP_CHAR_UUID,  (e: any, c: any) => { if (!e && c?.value) setRoomTemp(parseNum(c.value)); });
    device.monitorCharacteristicForService(SERVICE_UUID, HUMIDITY_CHAR_UUID,  (e: any, c: any) => { if (!e && c?.value) setHumidity(parseNum(c.value)); });
    device.monitorCharacteristicForService(SERVICE_UUID, IAQ_CHAR_UUID,       (e: any, c: any) => { if (!e && c?.value) setIaq(parseNum(c.value)); });
    device.monitorCharacteristicForService(SERVICE_UUID, PRESSURE_CHAR_UUID,  (e: any, c: any) => { if (!e && c?.value) setPressure(parseNum(c.value)); });
    device.monitorCharacteristicForService(SERVICE_UUID, ECO2_CHAR_UUID,      (e: any, c: any) => { if (!e && c?.value) setEco2(parseNum(c.value)); });
    device.monitorCharacteristicForService(SERVICE_UUID, VOC_CHAR_UUID,       (e: any, c: any) => { if (!e && c?.value) setEvoc(parseNum(c.value)); });
    device.monitorCharacteristicForService(SERVICE_UUID, SOUND_CHAR_UUID,     (e: any, c: any) => { if (!e && c?.value) setNoise(parseNum(c.value)); });

    // Biometric sensors
    device.monitorCharacteristicForService(SERVICE_UUID, BPM_CHAR_UUID,    (e: any, c: any) => { if (!e && c?.value) setBpm(parseNum(c.value)); });
    device.monitorCharacteristicForService(SERVICE_UUID, SPO2_CHAR_UUID,   (e: any, c: any) => { if (!e && c?.value) setSpo2(parseNum(c.value)); });
    device.monitorCharacteristicForService(SERVICE_UUID, STEP_COUNT_UUID,  (e: any, c: any) => { if (!e && c?.value) setSteps(parseNum(c.value)); });
    device.monitorCharacteristicForService(SERVICE_UUID, SLEEP_HEAVY_UUID, (e: any, c: any) => { if (!e && c?.value) setSleepHeavy(parseNum(c.value)); });
    device.monitorCharacteristicForService(SERVICE_UUID, SLEEP_LIGHT_UUID, (e: any, c: any) => { if (!e && c?.value) setSleepLight(parseNum(c.value)); });

    // Motion state is a text string, not a number
    device.monitorCharacteristicForService(SERVICE_UUID, MOTION_STATE_UUID, (e: any, c: any) => {
      if (!e && c?.value) {
        const s = parseString(c.value).trim();
        if (s) setActivityState(s);
      }
    });
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION 16: Auto-Reconnect When App Returns to Foreground
  //
  // If the user backgrounds the app and comes back while disconnected,
  // automatically attempt to reconnect — no manual button press needed.
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      // Skip auto-reconnect in simulation mode — nothing to reconnect to
      if (SIMULATE) return;
      if (nextAppState === 'active' && connectionStatus === 'Disconnected') {
        scanAndConnect();
      }
    });
    return () => subscription.remove();
  }, [connectionStatus]);

  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION 17: Vitals History Log
  //
  // Saves a timestamped snapshot of core vitals on every new BPM reading.
  // Capped at 50 entries — oldest drops off automatically.
  //
  // NOTE: Guarded with `if (SIMULATE) return` to prevent double-writes.
  //       During simulation, SECTION 11 (the tick useEffect) writes history
  //       directly. Without this guard both paths would push on every bpm change.
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (SIMULATE) return; // simulation handles its own history writes in SECTION 11
    if (connectionStatus === 'Connected' && bpm > 0) {
      setHistory(prev => {
        const entry = {
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          bpm, spo2, bodyTemp,
        };
        const updated = [entry, ...prev];
        if (updated.length > 50) updated.pop();
        return updated;
      });
    }
  }, [bpm]);

  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION 18: Provide Everything to the App
  //
  // Everything listed here is accessible to any screen via useHealth().
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <HealthContext.Provider value={{
      bpm, spo2, bodyTemp,
      roomTemp, humidity, iaq, eco2, evoc, gasRes, pressure, noise,
      motion, steps, activityState, activityDuration, sleepHeavy, sleepLight,
      connectionStatus, scanAndConnect,
      history,
    }}>
      {children}
    </HealthContext.Provider>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 19: useHealth Hook
//
// The clean way for any screen to access the health data.
// Usage:  const { bpm, spo2, connectionStatus } = useHealth();
// ─────────────────────────────────────────────────────────────────────────────

export const useHealth = () => useContext(HealthContext);