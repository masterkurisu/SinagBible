export * from "./bible-meta";
export * from "./bible-translations";
export * from "./journal";
// Note: kjv.ts is NOT re-exported here because it imports the full 4.5MB KJV JSON.
// Import it directly in server-side code only:
//   import { getChapterBySlug, getSearchResults } from "@sinag-bible/core/kjv"
// or use the Next.js server-only wrapper in apps/web.
