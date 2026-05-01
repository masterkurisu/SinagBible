import { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Props = { children: ReactNode };

type State = {
  hasError: boolean;
  message: string | null;
};

/**
 * Catches JavaScript render errors in descendants so a bad screen cannot blank the whole app.
 * Wrap once near the root of Expo Router (inside `GestureHandlerRootView`).
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      message: error.message?.trim() || "Something went wrong.",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (__DEV__) {
      console.error("[AppErrorBoundary]", error.message, info.componentStack);
    }
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, message: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
          <View style={styles.inner}>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.body}>{this.state.message}</Text>
            {__DEV__ && this.state.message ? (
              <Text style={styles.hint}>Check the Metro / device logs for the full stack.</Text>
            ) : null}
            <Pressable
              onPress={this.handleRetry}
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
              accessibilityRole="button"
              accessibilityLabel="Try again"
            >
              <Text style={styles.buttonLabel}>Try again</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f5f2ec" },
  inner: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    color: "#2c2416",
    textAlign: "center",
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: "#6b5e4b",
    textAlign: "center",
  },
  hint: {
    fontSize: 12,
    color: "#8a7b68",
    textAlign: "center",
    fontStyle: "italic",
  },
  button: {
    alignSelf: "center",
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 999,
    backgroundColor: "#2c2416",
  },
  buttonPressed: { opacity: 0.88 },
  buttonLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#f5e9d6",
  },
});
