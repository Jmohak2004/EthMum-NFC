import React, { useEffect } from 'react';
import { StatusBar, LogBox, View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import NfcManager from 'react-native-nfc-manager';
import { AppKitProvider, AppKit } from '@reown/appkit-react-native';
import { appKit } from './src/config/AppKitConfig';
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
    <SafeAreaProvider>
      <AppKitProvider instance={appKit}>
        <StatusBar barStyle="light-content" backgroundColor="#0a0a1a" />
        <AppNavigator />
        <View style={styles.appKitContainer}>
          <AppKit />
        </View>
      </AppKitProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  appKitContainer: {
    position: 'absolute',
    height: '100%',
    width: '100%',
    pointerEvents: 'box-none',
  },
});
