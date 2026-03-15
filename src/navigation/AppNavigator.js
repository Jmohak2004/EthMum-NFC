import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, RADIUS, FONT, SHADOWS } from '../theme';

import MerchantScreen from '../screens/MerchantScreen';
import CustomerScreen from '../screens/CustomerScreen';
import HistoryScreen from '../screens/HistoryScreen';

const Tab = createBottomTabNavigator();

const TAB_CONFIG = {
    Receive: { icon: 'download-outline', color: COLORS.primary },
    Send: { icon: 'send-outline', color: COLORS.secondary },
    History: { icon: 'time-outline', color: COLORS.warning },
};

function TabIcon({ routeName, focused, size }) {
    const config = TAB_CONFIG[routeName];
    const color = focused ? config.color : COLORS.textMuted;

    return (
        <View style={styles.tabIconContainer}>
            {focused && (
                <View style={[styles.activeGlow, { backgroundColor: config.color + '20' }]} />
            )}
            <Ionicons name={config.icon} size={size} color={color} />
            {focused && (
                <View style={[styles.activeDot, { backgroundColor: config.color }]} />
            )}
        </View>
    );
}

export default function AppNavigator() {
    return (
        <NavigationContainer>
            <Tab.Navigator
                screenOptions={({ route }) => ({
                    headerShown: false,
                    tabBarIcon: ({ focused, size }) => (
                        <TabIcon routeName={route.name} focused={focused} size={size} />
                    ),
                    tabBarActiveTintColor: TAB_CONFIG[route.name]?.color || COLORS.primary,
                    tabBarInactiveTintColor: COLORS.textMuted,
                    tabBarStyle: styles.tabBar,
                    tabBarLabelStyle: styles.tabLabel,
                    tabBarItemStyle: styles.tabItem,
                })}
            >
                <Tab.Screen name="Receive" component={MerchantScreen} />
                <Tab.Screen name="Send" component={CustomerScreen} />
                <Tab.Screen name="History" component={HistoryScreen} />
            </Tab.Navigator>
        </NavigationContainer>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: COLORS.tabBar,
        borderTopWidth: 1,
        borderTopColor: COLORS.glassBorder,
        height: 85,
        paddingTop: SPACING.sm,
        paddingBottom: SPACING.lg,
        ...(Platform.OS === 'ios' ? {} : { elevation: 16, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.2, shadowRadius: 8 }),
    },
    tabLabel: {
        fontSize: FONT.size.xs,
        ...FONT.medium,
        marginTop: 2,
    },
    tabItem: {
        paddingTop: 4,
    },
    tabIconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 44,
        height: 34,
    },
    activeGlow: {
        position: 'absolute',
        width: 44,
        height: 34,
        borderRadius: RADIUS.md,
    },
    activeDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        marginTop: 2,
    },
});
