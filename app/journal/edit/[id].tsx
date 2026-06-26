import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  JournalNewEntryForm,
  type JournalEditDraft,
} from "@/components/journal-new-entry-form";
import {
  clearPendingJournalEditEntry,
  peekPendingJournalEditEntryFor,
} from "@/lib/journal-edit-bridge";
import { resolveJournalEditRouteId } from "@/lib/journal-route-id";
import { loadJournalEntryById, type MobileJournalListItem } from "@/lib/load-journal-entries";
import { isSampleJournalEntry, JOURNAL_LOCAL_STORAGE_USER_MESSAGE } from "@/lib/journal-local";
import { useMobileAppTheme } from "@/lib/mobile-app-theme-context";

function toEditDraft(item: MobileJournalListItem): JournalEditDraft {
  return {
    id: item.id,
    title: item.title,
    content: item.content,
    book: item.book,
    chapter: item.chapter,
    verse_start: item.verse_start,
    verse_end: item.verse_end,
    bible_translation: item.bible_translation,
  };
}

const LOAD_TIMEOUT_MS = 18_000;

export default function EditJournalEntryScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { id: idParam } = useLocalSearchParams<{ id?: string | string[] }>();
  const id = useMemo(
    () => resolveJournalEditRouteId(idParam, pathname),
    [idParam, pathname],
  );
  const { bundle } = useMobileAppTheme();
  const colors = bundle.ui;

  const editStackScreenOptions = useMemo(
    () => ({
      headerShown: true as const,
      title: "Edit Entry",
      headerStyle: { backgroundColor: colors.parchment },
      headerTintColor: colors.brown800,
      headerTitleStyle: { fontFamily: "Inter_500Medium" as const, fontSize: 17 },
      headerShadowVisible: false as const,
      contentStyle: { flex: 1 as const, backgroundColor: colors.parchment },
    }),
    [colors.parchment, colors.brown800],
  );

  const handleAfterSave = useCallback(() => {
    router.back();
  }, [router]);

  const [entry, setEntry] = useState<MobileJournalListItem | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [storageAccessError, setStorageAccessError] = useState(false);

  useEffect(() => {
    if (!id) return;

    const bridged = peekPendingJournalEditEntryFor(id);
    if (bridged) {
      setLoadError(false);
      setStorageAccessError(false);
      setEntry(bridged);
      // Defer clear so React Strict Mode’s double effect run can still read the same pending row.
      setTimeout(() => clearPendingJournalEditEntry(), 0);
      return;
    }

    let cancelled = false;
    let finished = false;
    setLoadError(false);
    setStorageAccessError(false);
    setEntry(null);

    const timeout = setTimeout(() => {
      if (cancelled || finished) return;
      setLoadError(true);
    }, LOAD_TIMEOUT_MS);

    void (async () => {
      try {
        const row = await loadJournalEntryById(id);
        if (cancelled) return;
        finished = true;
        clearTimeout(timeout);
        setEntry(row);
        setLoadError(!row);
      } catch (e) {
        if (__DEV__) {
          console.error(e);
        }
        if (cancelled) return;
        finished = true;
        clearTimeout(timeout);
        setStorageAccessError(true);
        setLoadError(true);
        setEntry(null);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [id]);

  return (
    <>
      <Stack.Screen options={editStackScreenOptions} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 52 : 0}
        style={{ flex: 1, backgroundColor: colors.parchment }}
      >
        <View style={{ flex: 1 }}>
          {!id ? (
            <View className="px-4 py-8">
              <Text style={{ fontFamily: "Lora_400Regular", fontSize: 16, color: colors.tan300 }}>
                This entry link is invalid. Go back and open the entry again.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={() => router.back()}
                className="mt-6 self-start rounded-full px-5 py-3"
                style={{ backgroundColor: colors.parchmentDark }}
              >
                <Text style={{ fontFamily: "Inter_500Medium", color: colors.brown800 }}>Close</Text>
              </Pressable>
            </View>
          ) : !entry && !loadError ? (
            <View className="py-16 items-center gap-3">
              <ActivityIndicator color={colors.brown800} />
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: colors.tan200 }}>
                Loading…
              </Text>
            </View>
          ) : loadError || !entry ? (
            <View className="px-4 py-8">
              <Text style={{ fontFamily: "Lora_400Regular", fontSize: 16, color: colors.tan300 }}>
                {storageAccessError
                  ? JOURNAL_LOCAL_STORAGE_USER_MESSAGE
                  : "This entry could not be loaded. It may have been removed."}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={() => router.back()}
                className="mt-6 self-start rounded-full px-5 py-3"
                style={{ backgroundColor: colors.parchmentDark }}
              >
                <Text style={{ fontFamily: "Inter_500Medium", color: colors.brown800 }}>Close</Text>
              </Pressable>
            </View>
          ) : isSampleJournalEntry(entry.id) ? (
            <View className="px-4 py-8">
              <Text style={{ fontFamily: "Lora_400Regular", fontSize: 16, color: colors.tan300 }}>
                This sample entry cannot be edited. Create your own journal entry to write and save
                reflections.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={() => router.back()}
                className="mt-6 self-start rounded-full px-5 py-3"
                style={{ backgroundColor: colors.parchmentDark }}
              >
                <Text style={{ fontFamily: "Inter_500Medium", color: colors.brown800 }}>Close</Text>
              </Pressable>
            </View>
          ) : (
            <JournalNewEntryForm
              key={entry.id}
              editDraft={toEditDraft(entry)}
              hideFormScreenTitle
              onAfterSave={handleAfterSave}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
