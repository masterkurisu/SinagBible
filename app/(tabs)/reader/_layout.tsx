import { Stack } from "expo-router";

/** Matches `bg-parchment-canvas` — native stack default is white and flashes through a transparent header. */
const READER_STACK_SCENE_BG = "#f5f2ec";

export default function ReaderStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: "",
        headerBackVisible: false,
        contentStyle: { flex: 1, backgroundColor: READER_STACK_SCENE_BG },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false, title: "Bible" }} />
      <Stack.Screen
        name="[book]/[chapter]/index"
        options={{
          title: "",
          headerBackTitle: "",
          headerBackVisible: false,
          animation: "fade",
          animationDuration: 120,
          contentStyle: { flex: 1, backgroundColor: READER_STACK_SCENE_BG },
        }}
      />
    </Stack>
  );
}
