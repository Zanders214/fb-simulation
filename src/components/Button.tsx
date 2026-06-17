import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme, useThemedStyles, type Theme } from '../theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Pick black/white ink for legible text on an arbitrary fill (perceived luminance). */
function readableInk(hex: string): string {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#111111' : '#ffffff';
}

/** The primary CTA fills with accent (Broadcast gold / Terminal teal); Programme stays calm on primary. */
function primaryFill(theme: Theme): string {
  return theme.style === 'programme' ? theme.colors.primary : theme.colors.accent;
}

export function Button({ label, onPress, variant = 'primary', disabled = false, style, testID }: Readonly<Props>) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const accessibilityState = useMemo(() => ({ disabled }), [disabled]);
  const pressableStyle = useCallback(
    ({ pressed }: { pressed: boolean }) => [
      styles.base,
      variant === 'primary' && styles.primary,
      variant === 'secondary' && styles.secondary,
      variant === 'ghost' && styles.ghost,
      variant === 'danger' && styles.danger,
      pressed && !disabled && styles.pressed,
      disabled && styles.disabled,
      style,
    ],
    [styles, variant, disabled, style],
  );
  // Shouty styles (Broadcast/Terminal) uppercase the label and tip the primary CTA with ▸.
  const shout = theme.fonts.uppercaseHeadings;
  const display = shout ? label.toUpperCase() : label;
  const text = variant === 'primary' && shout ? `${display} ▸` : display;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={accessibilityState}
      style={pressableStyle}
    >
      <Text
        style={[
          styles.label,
          variant === 'primary' && styles.labelPrimary,
          (variant === 'secondary' || variant === 'ghost') && styles.labelDark,
        ]}
      >
        {text}
      </Text>
    </Pressable>
  );
}

const makeStyles = (theme: Theme) => {
  const fill = primaryFill(theme);
  // Terminal squares its corners; the softer styles keep the rounded CTA.
  const radius = theme.style === 'terminal' ? theme.radius.sm : theme.radius.md;
  return StyleSheet.create({
    base: {
      minHeight: 52,
      paddingHorizontal: theme.spacing(2.5),
      borderRadius: radius,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'transparent',
    },
    primary: { backgroundColor: fill },
    secondary: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
    ghost: { backgroundColor: 'transparent', borderColor: theme.colors.border },
    danger: { backgroundColor: theme.colors.danger },
    pressed: { opacity: 0.8 },
    disabled: { opacity: 0.4 },
    label: {
      color: theme.colors.onPrimary,
      fontFamily: theme.fonts.heading,
      fontWeight: theme.fonts.headingWeight,
      fontSize: theme.font.body,
      letterSpacing: theme.fonts.uppercaseHeadings ? 0.5 : 0,
    },
    labelPrimary: { color: readableInk(fill) },
    labelDark: { color: theme.colors.text },
  });
};
