import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../src/theme';

// Placeholder — reset save, version info, etc. land in milestone M5.
export default function Settings() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Settings coming later.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg, alignItems: 'center', justifyContent: 'center', padding: theme.spacing(3) },
  text: { color: theme.colors.textMuted, fontSize: theme.font.body, textAlign: 'center' },
});
