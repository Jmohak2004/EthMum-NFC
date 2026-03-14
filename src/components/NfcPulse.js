import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';

export default function NfcPulse({ active = false, size = 80, color = COLORS.primary }) {
    const scale1 = useRef(new Animated.Value(1)).current;
    const scale2 = useRef(new Animated.Value(1)).current;
    const opacity1 = useRef(new Animated.Value(0.5)).current;
    const opacity2 = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        if (!active) {
            scale1.setValue(1);
            scale2.setValue(1);
            opacity1.setValue(0.5);
            opacity2.setValue(0.3);
            return;
        }

        const createPulse = (scaleVal, opacityVal, delay) =>
            Animated.loop(
                Animated.sequence([
                    Animated.delay(delay),
                    Animated.parallel([
                        Animated.timing(scaleVal, {
                            toValue: 2.2,
                            duration: 1500,
                            useNativeDriver: true,
                        }),
                        Animated.timing(opacityVal, {
                            toValue: 0,
                            duration: 1500,
                            useNativeDriver: true,
                        }),
                    ]),
                    Animated.parallel([
                        Animated.timing(scaleVal, {
                            toValue: 1,
                            duration: 0,
                            useNativeDriver: true,
                        }),
                        Animated.timing(opacityVal, {
                            toValue: 0.5,
                            duration: 0,
                            useNativeDriver: true,
                        }),
                    ]),
                ])
            );

        const a1 = createPulse(scale1, opacity1, 0);
        const a2 = createPulse(scale2, opacity2, 500);
        a1.start();
        a2.start();

        return () => {
            a1.stop();
            a2.stop();
        };
    }, [active]);

    return (
        <View style={[styles.container, { width: size * 2.5, height: size * 2.5 }]}>
            <Animated.View
                style={[
                    styles.ring,
                    {
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        borderColor: color,
                        transform: [{ scale: scale1 }],
                        opacity: opacity1,
                    },
                ]}
            />
            <Animated.View
                style={[
                    styles.ring,
                    {
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        borderColor: color,
                        transform: [{ scale: scale2 }],
                        opacity: opacity2,
                    },
                ]}
            />
            <View style={[styles.iconCircle, { width: size, height: size, borderRadius: size / 2 }]}>
                <Ionicons name="phone-portrait-outline" size={size * 0.4} color={color} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    ring: {
        position: 'absolute',
        borderWidth: 2,
    },
    iconCircle: {
        backgroundColor: 'rgba(0,229,255,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
