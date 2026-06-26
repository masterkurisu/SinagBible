import { useState, type ReactNode } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

type OnboardingScrollScreenProps = {
  backgroundColor: string;
  paddingTop: number;
  children: ReactNode;
  /** Pinned to the bottom of the scroll area (e.g. nav row, back link). */
  footer?: ReactNode;
  /** Styles for the main content wrapper that grows to fill the viewport when content is short. */
  mainContentStyle?: StyleProp<ViewStyle>;
};

/**
 * Scrollable onboarding shell. When system font scaling makes content taller than the screen,
 * users can scroll to reach footer actions and links. When content fits, minHeight keeps
 * centered / space-between layouts intact.
 */
export function OnboardingScrollScreen({
  backgroundColor,
  paddingTop,
  children,
  footer,
  mainContentStyle,
}: OnboardingScrollScreenProps) {
  const [viewportHeight, setViewportHeight] = useState(0);

  return (
    <View style={[styles.root, { backgroundColor, paddingTop }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          viewportHeight > 0 && { minHeight: viewportHeight },
        ]}
        onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
      >
        <View style={[styles.main, mainContentStyle]}>{children}</View>
        {footer}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  main: {
    flexGrow: 1,
  },
});
