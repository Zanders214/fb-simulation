import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../src/theme';

// Placeholder — the full New Game flow (create vs take over a club, choose a
// league, auto-generated squad) is built in milestone M3.
export default function NewGame() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>New Game flow coming in M3.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg, alignItems: 'center', justifyContent: 'center', padding: theme.spacing(3) },
  text: { color: theme.colors.textMuted, fontSize: theme.font.body, textAlign: 'center' },
});
