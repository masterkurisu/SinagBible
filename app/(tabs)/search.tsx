import { View } from "react-native";

/** Transparent shell — reserves the fourth nav-bar slot for `TabBarSearchFab`. */
export default function SearchFabNavSlotPlaceholder() {
  return <View style={{ flex: 1, backgroundColor: "transparent" }} />;
}
