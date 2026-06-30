import type { RefObject } from "react";
import { Platform, Pressable, StyleSheet, Text, View, type View as RNView } from "react-native";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import { JournalM3DatePickerField } from "@/src/features/journal/JournalM3DatePickerField";
import { JournalM3FilterChip } from "@/src/features/journal/JournalM3FilterChip";

export type JournalFilterKind = "all" | "new" | "old" | "favorites";
export type JournalSortKind = "newest" | "oldest" | "book";

export const JOURNAL_FILTER_MENU_ITEMS: { kind: JournalFilterKind; label: string }[] = [
  { kind: "all", label: "All" },
  { kind: "new", label: "New Testament" },
  { kind: "old", label: "Old Testament" },
  { kind: "favorites", label: "Favorites" },
];

export const JOURNAL_SORT_MENU_ITEMS: { kind: JournalSortKind; label: string }[] = [
  { kind: "newest", label: "Newest" },
  { kind: "oldest", label: "Oldest" },
  { kind: "book", label: "Book A-Z" },
];

export type JournalFilterSortPanelProps = {
  bundle: MobileAppThemeBundle;
  filter: JournalFilterKind;
  sort: JournalSortKind;
  onSelectFilter: (kind: JournalFilterKind) => void;
  onSelectSort: (kind: JournalSortKind) => void;
  dateFrom?: Date | null;
  dateTo?: Date | null;
  onDateFromChange?: (date: Date | null) => void;
  onDateToChange?: (date: Date | null) => void;
  filtersRef?: RefObject<RNView | null>;
  sortRef?: RefObject<RNView | null>;
  dateFilterRef?: RefObject<RNView | null>;
  pointerEvents?: "none" | "auto" | "box-none";
  onOpenCarouselSettings?: () => void;
};

function LegacyFilterChip({
  label,
  active,
  onPress,
  bundle,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  bundle: MobileAppThemeBundle;
}) {
  const j = bundle.journal;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.legacyChip,
        {
          borderColor: active ? j.chipActiveBorder : j.chipInactiveBorder,
          backgroundColor: active ? j.chipActiveBackground : j.chipInactiveBackground,
        },
      ]}
    >
      <Text
        style={{
          fontFamily: "Inter_500Medium",
          fontSize: 12,
          color: active ? j.chipActiveText : j.chipInactiveText,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SectionHeading({ label, color }: { label: string; color: string }) {
  return (
    <Text style={[styles.sectionHeading, { color }]}>{label}</Text>
  );
}

export function JournalFilterSortPanel({
  bundle,
  filter,
  sort,
  onSelectFilter,
  onSelectSort,
  dateFrom = null,
  dateTo = null,
  onDateFromChange,
  onDateToChange,
  filtersRef,
  sortRef,
  dateFilterRef,
  pointerEvents = "auto",
  onOpenCarouselSettings,
}: JournalFilterSortPanelProps) {
  const j = bundle.journal;
  const useM3Chips = Platform.OS === "android";

  const renderChip = (
    key: string,
    label: string,
    active: boolean,
    onPress: () => void,
  ) => {
    if (useM3Chips) {
      return (
        <View key={key} style={styles.chipSlot}>
          <JournalM3FilterChip
            label={label}
            selected={active}
            onPress={onPress}
            bundle={bundle}
          />
        </View>
      );
    }
    return (
      <View key={key} style={styles.chipSlot}>
        <LegacyFilterChip label={label} active={active} onPress={onPress} bundle={bundle} />
      </View>
    );
  };

  return (
    <View pointerEvents={pointerEvents} style={styles.panel}>
      <View ref={filtersRef} collapsable={false} style={[styles.section, styles.sectionFirst]}>
        <SectionHeading label="Filter" color={j.dateHeading} />
        <View style={styles.chipRow}>
          {JOURNAL_FILTER_MENU_ITEMS.map((item) =>
            renderChip(item.kind, item.label, item.kind === filter, () => onSelectFilter(item.kind)),
          )}
        </View>
      </View>

      <View ref={sortRef} collapsable={false} style={styles.section}>
        <SectionHeading label="Sort" color={j.dateHeading} />
        <View style={styles.chipRow}>
          {JOURNAL_SORT_MENU_ITEMS.map((item) =>
            renderChip(item.kind, item.label, item.kind === sort, () => onSelectSort(item.kind)),
          )}
        </View>
      </View>

      {useM3Chips && onDateFromChange && onDateToChange ? (
        <View ref={dateFilterRef} collapsable={false} style={styles.section}>
          <SectionHeading label="Date" color={j.dateHeading} />
          <View style={styles.dateFields}>
            <JournalM3DatePickerField
              label="From"
              value={dateFrom}
              onChange={onDateFromChange}
              bundle={bundle}
              maximumDate={dateTo ?? new Date()}
            />
            <JournalM3DatePickerField
              label="To"
              value={dateTo}
              onChange={onDateToChange}
              bundle={bundle}
              maximumDate={new Date()}
              minimumDate={dateFrom ?? undefined}
            />
          </View>
        </View>
      ) : null}

      {onOpenCarouselSettings ? (
        <View style={styles.section}>
          <SectionHeading label="Carousel" color={j.dateHeading} />
          <Pressable
            onPress={onOpenCarouselSettings}
            style={[
              styles.carouselSettingsButton,
              {
                borderColor: j.panelBorder,
                backgroundColor: j.filterOpenerBackground,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Verse carousel settings"
          >
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: j.filterOpenerText }}>
              Verse Carousel
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: "100%",
    alignSelf: "stretch",
  },
  section: {
    width: "100%",
    marginTop: 16,
  },
  sectionFirst: {
    marginTop: 0,
  },
  sectionHeading: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.76,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  chipRow: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
  },
  chipSlot: {
    maxWidth: "100%",
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  legacyChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  dateFields: {
    width: "100%",
    gap: 12,
  },
  carouselSettingsButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
});
