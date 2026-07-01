/** Path segments map to the primary tab (`(tabs)` group may or may not appear in the path). */
export function tabHapticKeyFromPathname(pathname: string | null): string | null {
  if (pathname == null || pathname === "" || pathname === "/") return "index";
  const parts = pathname.split("/").filter(Boolean);
  const first = parts[0];
  if (!first) return "index";
  if (first === "(tabs)") {
    const second = parts[1];
    if (second == null || second === "" || second === "index") return "index";
    if (second === "reader" || second === "journal") return second;
    return null;
  }
  if (first === "reader" || first === "journal") return first;
  if (first === "index") return "index";
  return null;
}
