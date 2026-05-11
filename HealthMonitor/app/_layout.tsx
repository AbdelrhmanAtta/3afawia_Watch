import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { HealthProvider } from '../HealthContext';

// 1. Prevent the splash screen from hiding immediately upon app load
SplashScreen.preventAutoHideAsync();

export default function Layout() {
  
  useEffect(() => {
    // 2. The initialization function
    const prepareApp = async () => {
      try {
        // Simulate a 1.5-second boot delay. 
        // In the future, you can replace this timer with actual checks, 
        // like waiting for local health history databases to load from the device.
        await new Promise(resolve => setTimeout(resolve, 1500));
      } catch (e) {
        console.warn(e);
      } finally {
        // 3. Tell Expo to hide the splash screen gracefully
        await SplashScreen.hideAsync();
      }
    };

    prepareApp();
  }, []);

  return (
    <HealthProvider>
      <StatusBar style="light" />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#1E1E1E',
            borderTopWidth: 0,
            height: 60,
            paddingBottom: 10,
          },
          tabBarActiveTintColor: '#ff4b5c',
          tabBarInactiveTintColor: '#555',
        }}
      >
        <Tabs.Screen
          name="env" // Points to app/environment.tsx
          options={{
            title: 'Environment',
            tabBarIcon: ({ color, size }) => <Ionicons name="radio-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="index" // Points to app/index.tsx
          options={{
            title: 'Monitor',
            tabBarIcon: ({ color, size }) => <Ionicons name="pulse" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="sleep" // Points to app/stats.tsx
          options={{
            title: 'Sleep',
            tabBarIcon: ({ color, size }) => <Ionicons name="moon-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="stats" // Points to app/stats.tsx
          options={{
            title: 'History',
            tabBarIcon: ({ color, size }) => <Ionicons name="list" size={size} color={color} />,
          }}
        />
         
         
      
      </Tabs>
      
    </HealthProvider>
  );
}