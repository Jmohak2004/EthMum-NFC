import React, { useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, RADIUS, FONT, SHADOWS } from '../theme';

export default function GlassButton({
    title,
    onPress,
    gradient = [COLORS.primary, COLORS.secondary],
    disabled = false,
    icon = null,
    style,
}) {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.95,
            useNativeDriver: true,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 3,
            useNativeDriver: true,
        }).start();
    };

    return (
        <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
            <TouchableOpacity
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={onPress}
                activeOpacity={0.8}
                disabled={disabled}
            >
                <LinearGradient
                    colors={disabled ? ['#333', '#222'] : gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.button, disabled && styles.disabled]}
                >
                    {icon}
                    <Text style={[styles.text, disabled && styles.disabledText]}>
                        {title}
                    </Text>
                </LinearGradient>
            </TouchableOpacity>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.xl,
        borderRadius: RADIUS.lg,
        gap: SPACING.sm,
        ...SHADOWS.glow(),
    },
    text: {
        color: COLORS.text,
        fontSize: FONT.size.lg,
        ...FONT.bold,
        letterSpacing: 0.5,
    },
    disabled: {
        opacity: 0.5,
    },
    disabledText: {
        color: COLORS.textMuted,
    },
});
