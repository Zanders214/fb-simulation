import { Pressable, StyleSheet, Text, View } from 'react-native';
import { dateKey, daysInMonth, WEEKDAY_SHORT } from '../engine/calendar';
import { useThemedStyles, type Theme } from '../theme';

/** What to draw on a day that has the user's match. */
export interface DayMarker {
  isUserMatch: boolean;
  /** The fixture has been played (a result exists). */
  played?: boolean;
  resultText?: string; // e.g. "2-1"
  resultLetter?: string; // "W" | "D" | "L"
  resultColor?: string;
  oppShortName?: string;
  oppColor?: string;
}

type Props = Readonly<{
  /** Any date within the month to render. */
  month: Date;
  /** Reveal cutoff: days strictly before this are "passed" (crossed off / results shown). */
  asOf: Date;
  /** Days before this (the season's first match) are out of season and not crossed off. */
  seasonStart: Date;
  /** Markers keyed by `dateKey(date)`. */
  markers: ReadonlyMap<string, DayMarker>;
  onSelectDay: (day: Date) => void;
  canSelect: (day: Date) => boolean;
}>;

/** A single grid cell; `day` is null for the leading/trailing blanks. */
type DayCell = { key: string; day: number | null };

export function CalendarGrid({ month, asOf, seasonStart, markers, onSelectDay, canSelect }: Props) {
  const styles = useThemedStyles(makeStyles);
  const year = month.getUTCFullYear();
  const m = month.getUTCMonth();
  const lead = new Date(Date.UTC(year, m, 1)).getUTCDay(); // 0=Sun
  const total = daysInMonth(year, m);

  // Build a flat list of cells padded to whole weeks. Each cell carries a stable
  // key so list rendering never relies on the array index.
  const cells: DayCell[] = [];
  for (let i = 0; i < lead; i++) cells.push({ key: `lead-${i}`, day: null });
  for (let d = 1; d <= total; d++) cells.push({ key: `day-${d}`, day: d });
  let pad = 0;
  while (cells.length % 7 !== 0) cells.push({ key: `tail-${pad++}`, day: null });

  const weeks: DayCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const asOfTime = asOf.getTime();
  const startTime = seasonStart.getTime();

  return (
    <View>
      <View style={styles.weekRow}>
        {WEEKDAY_SHORT.map((w, i) => (
          <View key={`${w}-${i}`} style={styles.headCell}>
            <Text style={styles.headText}>{w}</Text>
          </View>
        ))}
      </View>

      {weeks.map((week) => (
        <View key={`week-${week[0].key}`} style={styles.weekRow}>
          {week.map((cell) => {
            if (cell.day == null) return <View key={cell.key} style={styles.cell} />;
            const day = cell.day;
            const date = new Date(Date.UTC(year, m, day));
            const t = date.getTime();
            const isToday = t === asOfTime;
            const passed = t >= startTime && t < asOfTime;
            const marker = markers.get(dateKey(date));
            const selectable = canSelect(date);

            const body = (
              <>
                <Text style={[styles.dayNum, isToday && styles.dayNumToday]}>{day}</Text>
                <View style={styles.cellBody}>
                  <CellMarker marker={marker} passed={passed} revealed={t <= asOfTime} />
                </View>
              </>
            );

            const cellStyle = [
              styles.cell,
              styles.dayCell,
              isToday && styles.todayCell,
              selectable && styles.selectableCell,
              !selectable && !isToday && styles.dimCell,
            ];

            if (selectable) {
              return (
                <Pressable
                  key={cell.key}
                  style={cellStyle}
                  onPress={() => onSelectDay(date)}
                  accessibilityRole="button"
                >
                  {body}
                </Pressable>
              );
            }
            return (
              <View key={cell.key} style={cellStyle}>
                {body}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** What to draw inside a day cell: a result, a match dot, an ✕, or nothing. */
function CellMarker({
  marker,
  passed,
  revealed,
}: Readonly<{ marker?: DayMarker; passed: boolean; revealed: boolean }>) {
  const styles = useThemedStyles(makeStyles);
  if (marker?.isUserMatch) {
    if (marker.played && revealed) {
      return (
        <View style={styles.resultWrap}>
          <Text style={[styles.resultLetter, { color: marker.resultColor }]}>{marker.resultLetter}</Text>
          <Text style={styles.resultScore}>{marker.resultText}</Text>
        </View>
      );
    }
    return <View style={[styles.matchDot, { backgroundColor: marker.oppColor }]} />;
  }
  if (passed) return <Text style={styles.cross}>✕</Text>;
  return null;
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  weekRow: { flexDirection: 'row' },
  headCell: { flex: 1, alignItems: 'center', paddingVertical: theme.spacing(0.5) },
  headText: {
    color: theme.colors.textMuted,
    fontSize: theme.font.small,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cell: { flex: 1, aspectRatio: 1, padding: 2 },
  dayCell: {
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    margin: 1,
    overflow: 'hidden',
  },
  selectableCell: { backgroundColor: theme.colors.surfaceAlt },
  dimCell: { opacity: 0.5 },
  todayCell: { borderColor: theme.colors.accent, borderWidth: 2 },
  dayNum: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    paddingLeft: 3,
    paddingTop: 1,
  },
  dayNumToday: { color: theme.colors.accent },
  cellBody: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cross: { color: theme.colors.textMuted, fontSize: 14, fontWeight: '700' },
  matchDot: { width: 8, height: 8, borderRadius: 4 },
  resultWrap: { alignItems: 'center', justifyContent: 'center' },
  resultLetter: { fontSize: 12, fontWeight: '900', lineHeight: 14 },
  resultScore: { color: theme.colors.text, fontSize: 10, fontWeight: '700' },
});
