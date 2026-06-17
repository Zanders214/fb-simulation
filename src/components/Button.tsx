import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { useThemedStyles, type Theme } from '../theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Button({ label, onPress, variant = 'primary', disabled = false, style, testID }: Readonly<Props>) {
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
          (variant === 'secondary' || variant === 'ghost') && styles.labelDark,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  base: {
    minHeight: 52,
    paddingHorizontal: theme.spacing(2.5),
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  primary: { backgroundColor: theme.colors.primary },
  secondary: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
  ghost: { backgroundColor: 'transparent', borderColor: theme.colors.border },
  danger: { backgroundColor: theme.colors.danger },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.4 },
  label: { color: theme.colors.onPrimary, fontSize: theme.font.body, fontWeight: '700' },
  labelDark: { color: theme.colors.text },
});
