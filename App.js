import React, { useEffect } from 'react';
import { StatusBar, LogBox } from 'react-native';
import NfcManager from 'react-native-nfc-manager';
import AppNavigator from './src/navigation/AppNavigator';

// Suppress NFC-related warnings in Expo Go (NFC is native-only)
LogBox.ignoreLogs([
  'NfcManager',
  'Possible Unhandled Promise',
]);

export default function App() {
  useEffect(() => {
    // Initialize NFC — will silently fail in Expo Go / simulator
    NfcManager.start().catch((e) => {
      console.log('NFC not available on this device:', e?.message);
    });

    return () => {
      // Cleanup on unmount
      NfcManager.cancelTechnologyRequest().catch(() => { });
    };
  }, []);

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a1a" />
      <AppNavigator />
    </>
  );
}
