import { useCallback, useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { JournalNewEntryForm, type JournalNewEntryInitialParams } from "@/components/journal-new-entry-form";
import { JOURNAL_NEW_ENTRY_FORM_TOP_OFFSET_PX } from "@/lib/native-tab-chrome";
import { useMobileAppTheme } from "@/lib/mobile-app-theme-context";
import { isTabletLayout, TABLET_NEW_ENTRY_SHEET_MAX_WIDTH_PX } from "@/lib/tablet-layout";
import { JournalDraftCloseDialog } from "@/src/features/journal/JournalDraftCloseDialog";

const NEW_ENTRY_STACK_SCREEN_OPTIONS = {
  headerShown: false,
  presentation: "transparentModal" as const,
  animation: "slide_from_bottom" as const,
  contentStyle: { backgroundColor: "transparent" as const },
};

export default function NewJournalEntryScreen() {
  const router = useRouter();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<JournalNewEntryInitialParams>();
  const [hasDraftInput, setHasDraftInput] = useState(false);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const { bundle } = useMobileAppTheme();
  const colors = bundle.ui;
  const j = bundle.journal;
  const isTablet = isTabletLayout(windowWidth, windowHeight);

  const requestClose = useCallback(() => {
    if (!hasDraftInput) {
      router.back();
      return;
    }
    setDiscardDialogOpen(true);
  }, [hasDraftInput, router]);

  const bottomGutter = Math.max(insets.bottom + 12, 16);
  const topGutter = insets.top + 8 + JOURNAL_NEW_ENTRY_FORM_TOP_OFFSET_PX;
  const sheetShellMaxHeight = Math.min(windowHeight * 0.78, windowHeight - topGutter - bottomGutter);
  const sheetHorizontalInset = insets.left + 2;
  const sheetWidth = Math.min(
    windowWidth - sheetHorizontalInset * 2,
    isTabletLayout(windowWidth, windowHeight)
      ? TABLET_NEW_ENTRY_SHEET_MAX_WIDTH_PX
      : windowWidth - sheetHorizontalInset * 2,
  );

  return (
    <>
      <Stack.Screen options={NEW_ENTRY_STACK_SCREEN_OPTIONS} />
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: j.newEntryRouteScrim }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss new entry"
          onPress={requestClose}
          style={{ flex: 1 }}
        />
        <View
          style={{
            maxHeight: sheetShellMaxHeight,
            width: "100%",
            flexGrow: 1,
          }}
        >
          <View
            style={{
              flex: 1,
              width: sheetWidth,
              alignSelf: "center",
              marginBottom: bottomGutter,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: j.newEntrySheetBorder,
              backgroundColor: j.newEntrySheetBackground,
              overflow: "hidden",
              shadowColor: colors.brown800,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.14,
              shadowRadius: 16,
              elevation: 10,
              paddingHorizontal: 0,
              paddingBottom: 0,
            }}
          >
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                paddingTop: 6,
                paddingBottom: 4,
                backgroundColor: j.newEntryDragAreaBackground,
              }}
            >
              <View
                style={{
                  width: 56,
                  height: 6,
                  borderRadius: 999,
                  backgroundColor: "rgba(123,106,86,0.35)",
                }}
              />
            </View>
            <View
              style={{
                flex: 1,
                minHeight: 0,
                paddingHorizontal: 0,
                paddingTop: 4,
                paddingBottom: 0,
              }}
            >
              <JournalNewEntryForm
                initialParams={params}
                contentScrollMaxHeight={520}
                contentHorizontalPadding={10}
                onDirtyChange={setHasDraftInput}
              />
            </View>
          </View>
        </View>
      </View>
      <JournalDraftCloseDialog
        visible={discardDialogOpen}
        title="Discard this entry?"
        onKeepEditing={() => setDiscardDialogOpen(false)}
        onDiscard={() => {
          setDiscardDialogOpen(false);
          router.back();
        }}
        bundle={bundle}
        isTabletLayout={isTablet}
      />
    </>
  );
}
