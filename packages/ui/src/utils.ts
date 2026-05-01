/** Merge class names, filtering falsy values. Works on both web and mobile. */
export function cx(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
