/**
 * Audit: scan all translation backends for metadata leaking into verse text.
 * Run: export $(grep -E '^YVP_APP_KEY=' .env.local | xargs) && npx tsx scripts/audit-translation-parsing.mjs
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { yvpPassageToBibleChapter } from "../lib/yvp-chapter-payload.ts";
import {
  flattenHelloaoVerseText,
  parseHelloaoVerseContentArray,
} from "../packages/core/src/helloao-verse-inline.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const KEY = process.env.YVP_APP_KEY ?? process.env.EXPO_PUBLIC_YVP_APP_KEY;
if (!KEY) {
  console.error("YVP_APP_KEY required");
  process.exit(1);
}

const YVP_LANGUAGE_RANGES = ["en", "fil", "tl", "ceb", "es"];
const HELLOAO_FEATURED_IDS = [
  "tgl_ulb",
  "ceb_ulb",
  "ceb_ocb",
  "ilo_ulb",
  "eng_kjv",
  "eng_kja",
  "eng_asv",
  "eng_bbe",
  "eng_darby",
  "eng_webbe",
  "eng_webu",
  "eng_wmb",
  "eng_wmbbe",
  "eng_lsv",
  "BSB",
  "spa_r09",
];

const PROBE_CHAPTERS = [
  { bookUsfm: "JHN", bookSlug: "john", chapter: 3, label: "John 3" },
  { bookUsfm: "MAT", bookSlug: "matthew", chapter: 5, label: "Matthew 5" },
  { bookUsfm: "PSA", bookSlug: "psalms", chapter: 119, label: "Psalm 119" },
];

const EN_LEAK_PATTERNS = [
  { id: "footnote-greek", re: /\bGreek for\b/i },
  { id: "footnote-alt", re: /\balso means\b/i },
  { id: "footnote-manuscripts", re: /\bSome manuscripts\b/i },
  { id: "footnote-interpreters", re: /\bSome interpreters\b/i },
  { id: "footnote-or-reading", re: /\bOr [a-z]/i },
  { id: "html-residue", re: /<(?:span|div)\b/i },
  { id: "cross-ref-exodus", re: /\bExodus \d+:\d+/i },
  { id: "section-heading-jhn", re: /Testifies Again About Jesus/i },
  { id: "section-heading-mat", re: /\bSalt and Light\b/i },
  { id: "hebrew-acrostic", re: /[\u0590-\u05FF]\s+[A-Za-z]+/ },
];

const KJV_BOOK_SLUGS = [
  "genesis",
  "exodus",
  "leviticus",
  "numbers",
  "deuteronomy",
  "joshua",
  "judges",
  "ruth",
  "1-samuel",
  "2-samuel",
  "1-kings",
  "2-kings",
  "1-chronicles",
  "2-chronicles",
  "ezra",
  "nehemiah",
  "esther",
  "job",
  "psalms",
  "proverbs",
  "ecclesiastes",
  "song-of-solomon",
  "isaiah",
  "jeremiah",
  "lamentations",
  "ezekiel",
  "daniel",
  "hosea",
  "joel",
  "amos",
  "obadiah",
  "jonah",
  "micah",
  "nahum",
  "habakkuk",
  "zephaniah",
  "haggai",
  "zechariah",
  "malachi",
  "matthew",
  "mark",
  "luke",
  "john",
  "acts",
  "romans",
  "1-corinthians",
  "2-corinthians",
  "galatians",
  "ephesians",
  "philippians",
  "colossians",
  "1-thessalonians",
  "2-thessalonians",
  "1-timothy",
  "2-timothy",
  "titus",
  "philemon",
  "hebrews",
  "james",
  "1-peter",
  "2-peter",
  "1-john",
  "2-john",
  "3-john",
  "jude",
  "revelation",
];

function findCloseSpanIndex(html, afterOpenTag) {
  let depth = 1;
  let pos = afterOpenTag;
  while (pos < html.length && depth > 0) {
    const nextOpen = html.indexOf("<span", pos);
    const nextClose = html.indexOf("</span>", pos);
    if (nextClose === -1) return html.length;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      pos = nextOpen + 5;
      continue;
    }
    depth -= 1;
    if (depth === 0) return nextClose;
    pos = nextClose + "</span>".length;
  }
  return html.length;
}

function stripHtmlTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function structuralYvpLeaks(html, chapter) {
  const leaks = [];
  const headingRe = /<div[^>]*class="[^"]*\byv-h\b[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  let hm;
  const headings = [];
  while ((hm = headingRe.exec(html)) !== null) {
    const text = stripHtmlTags(hm[1] ?? "");
    if (text.length >= 4) headings.push(text);
  }

  const noteOpenRe = /<span[^>]*class="[^"]*\byv-n\b[^"]*"[^>]*>/gi;
  let nm;
  const footnotes = [];
  while ((nm = noteOpenRe.exec(html)) !== null) {
    const openEnd = nm.index + nm[0].length;
    const closeIndex = findCloseSpanIndex(html, openEnd);
    const text = stripHtmlTags(html.slice(openEnd, closeIndex));
    if (text.length >= 8) footnotes.push(text);
    noteOpenRe.lastIndex = closeIndex + "</span>".length;
  }

  for (let i = 0; i < chapter.verses.length; i++) {
    const verse = (chapter.verses[i] ?? "").replace(/\s+/g, " ").trim();
    for (const heading of headings) {
      if (verse.includes(heading)) {
        leaks.push({ kind: "heading-in-verse", verse: i + 1, excerpt: heading });
      }
    }
    for (const footnote of footnotes) {
      const probe = footnote.slice(0, Math.min(24, footnote.length));
      if (probe.length >= 8 && verse.includes(probe)) {
        leaks.push({ kind: "footnote-in-verse", verse: i + 1, excerpt: probe });
      }
    }
  }
  return leaks;
}

function heuristicLeaks(chapter) {
  const hits = [];
  for (let i = 0; i < chapter.verses.length; i++) {
    const text = chapter.verses[i] ?? "";
    for (const pattern of EN_LEAK_PATTERNS) {
      if (pattern.re.test(text)) {
        hits.push({
          pattern: pattern.id,
          verse: i + 1,
          excerpt: text.slice(0, 140).replace(/\s+/g, " "),
        });
      }
    }
  }
  return hits;
}

async function fetchYvpCatalog() {
  const byId = new Map();
  for (const range of YVP_LANGUAGE_RANGES) {
    let pageToken;
    do {
      const params = new URLSearchParams({
        "language_ranges[]": range,
        all_available: "true",
        page_size: "99",
      });
      if (pageToken) params.set("page_token", pageToken);
      const res = await fetch(`https://api.youversion.com/v1/bibles?${params}`, {
        headers: { "X-YVP-App-Key": KEY },
      });
      const page = await res.json();
      for (const bible of page.data ?? []) byId.set(bible.id, bible);
      pageToken = page.next_page_token;
    } while (pageToken);
  }
  return [...byId.values()];
}

async function auditYvpBible(bible) {
  const label = `yvp:${bible.id} (${bible.abbreviation}, ${bible.language_tag})`;
  const allHits = [];
  for (const probe of PROBE_CHAPTERS) {
    try {
      const res = await fetch(
        `https://api.youversion.com/v1/bibles/${bible.id}/passages/${probe.bookUsfm}.${probe.chapter}?format=html&include_notes=true&include_headings=true`,
        { headers: { "X-YVP-App-Key": KEY } },
      );
      if (!res.ok) {
        allHits.push({ probe: probe.label, error: `HTTP ${res.status}` });
        continue;
      }
      const passage = await res.json();
      const chapter = yvpPassageToBibleChapter(probe.bookSlug, probe.chapter, passage);
      const structural = structuralYvpLeaks(passage.content ?? "", chapter);
      const heuristic = heuristicLeaks(chapter);
      if (structural.length || heuristic.length) {
        allHits.push({ probe: probe.label, structural, heuristic });
      }
    } catch (error) {
      allHits.push({
        probe: probe.label,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  return { label, allHits };
}

async function auditHelloaoTranslation(apiId) {
  const label = `helloao:${apiId}`;
  const allHits = [];
  for (const probe of PROBE_CHAPTERS) {
    try {
      const res = await fetch(
        `https://bible.helloao.org/api/${apiId}/${probe.bookUsfm}/${probe.chapter}.json`,
      );
      if (!res.ok) {
        allHits.push({ probe: probe.label, error: `HTTP ${res.status}` });
        continue;
      }
      const raw = await res.json();
      const verses = [];
      const inlineIssues = [];
      for (const item of raw.chapter.content) {
        if (item.type !== "verse" || typeof item.number !== "number") continue;
        const inline = parseHelloaoVerseContentArray(item.content ?? []);
        const text = flattenHelloaoVerseText(inline);
        verses.push(text);
        for (const seg of inline) {
          if (typeof seg === "object" && seg && "heading" in seg) {
            inlineIssues.push({
              verse: item.number,
              kind: "heading-in-verse-content",
              excerpt: seg.heading,
            });
          }
        }
      }
      const heuristic = heuristicLeaks({ verses });
      if (heuristic.length || inlineIssues.length) {
        allHits.push({ probe: probe.label, heuristic, inlineIssues });
      }
    } catch (error) {
      allHits.push({
        probe: probe.label,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { label, allHits };
}

function loadBundledTranslation(fileName) {
  return JSON.parse(readFileSync(join(ROOT, "packages/core/data", fileName), "utf8"));
}

function auditBundled(id, fileName) {
  const label = `${id} (bundled)`;
  const data = loadBundledTranslation(fileName);
  const allHits = [];
  for (const probe of PROBE_CHAPTERS) {
    const bookIndex = KJV_BOOK_SLUGS.indexOf(probe.bookSlug);
    if (bookIndex === -1) {
      allHits.push({ probe: probe.label, error: "book slug not in canon index" });
      continue;
    }
    const verses = data.books[bookIndex]?.chapters?.[probe.chapter - 1];
    if (!verses) {
      allHits.push({ probe: probe.label, error: "chapter not found" });
      continue;
    }
    const heuristic = heuristicLeaks({ verses });
    if (heuristic.length) allHits.push({ probe: probe.label, heuristic });
  }
  return { label, allHits };
}

function summarize(title, results) {
  const failed = results.filter((r) => r.allHits.length > 0);
  const clean = results.length - failed.length;
  console.log(`\n${"=".repeat(72)}`);
  console.log(`${title}: ${clean}/${results.length} clean, ${failed.length} with findings`);
  if (!failed.length) return;
  for (const r of failed) {
    console.log(`\n## ${r.label}`);
    for (const item of r.allHits) {
      if (item.error) {
        console.log(`  [${item.probe}] ERROR: ${item.error}`);
        continue;
      }
      if (item.structural?.length) {
        console.log(`  [${item.probe}] structural: ${item.structural.length}`);
        for (const hit of item.structural.slice(0, 4)) {
          console.log(`    v${hit.verse} ${hit.kind}: ${hit.excerpt}`);
        }
      }
      if (item.heuristic?.length) {
        console.log(`  [${item.probe}] heuristic: ${item.heuristic.length}`);
        for (const hit of item.heuristic.slice(0, 4)) {
          console.log(`    v${hit.verse} (${hit.pattern}): ${hit.excerpt}`);
        }
      }
      if (item.inlineIssues?.length) {
        console.log(`  [${item.probe}] inline: ${item.inlineIssues.length}`);
        for (const hit of item.inlineIssues.slice(0, 4)) {
          console.log(`    v${hit.verse} ${hit.kind}: ${hit.excerpt}`);
        }
      }
    }
  }
}

const yvpBibles = await fetchYvpCatalog();
console.log(`YVP catalog: ${yvpBibles.length}`);
console.log(`HelloAO featured ids: ${HELLOAO_FEATURED_IDS.length}`);
console.log(`Bundled: KJV, WEB, ADB1905`);

const yvpResults = [];
for (const bible of yvpBibles.sort((a, b) => a.language_tag.localeCompare(b.language_tag))) {
  process.stdout.write(`YVP ${bible.abbreviation}... `);
  const result = await auditYvpBible(bible);
  yvpResults.push(result);
  console.log(result.allHits.length ? "FINDINGS" : "ok");
}

const helloaoResults = [];
for (const apiId of HELLOAO_FEATURED_IDS) {
  process.stdout.write(`HelloAO ${apiId}... `);
  const result = await auditHelloaoTranslation(apiId);
  helloaoResults.push(result);
  console.log(result.allHits.length ? "FINDINGS" : "ok");
}

const bundledResults = [
  auditBundled("KJV", "kjv.json"),
  auditBundled("WEB", "web.json"),
  auditBundled("ADB1905", "adb1905.json"),
];
for (const r of bundledResults) {
  console.log(`Bundled ${r.label.split(" ")[0]}... ${r.allHits.length ? "FINDINGS" : "ok"}`);
}

summarize("YVP (YouVersion Platform)", yvpResults);
summarize("HelloAO (bible.helloao.org)", helloaoResults);
summarize("Bundled JSON", bundledResults);
