import { View } from "react-native";

/** Transparent shell — search UI is `TabBarSearchLayer`; route exists only for the tab trigger. */
export default function SearchTabPlaceholder() {
  return <View style={{ flex: 1, backgroundColor: "transparent" }} />;
}
