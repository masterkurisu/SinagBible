import { describe, expect, it } from "vitest";
import { LruMap } from "@sinag-bible/core/lru-map";
import { evictVagueKeywordIndex, getOrBuildVagueKeywordIndex } from "@sinag-bible/core/vague-keyword-index";
import type { KJVData } from "@sinag-bible/types";

describe("LruMap", () => {
  it("evicts the oldest entry when capacity is exceeded", () => {
    const cache = new LruMap<string, string>(2);
    const evicted: string[] = [];

    cache.set("a", "1", (key) => evicted.push(key));
    cache.set("b", "2");
    cache.set("c", "3", (key) => evicted.push(key));

    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe("2");
    expect(cache.get("c")).toBe("3");
    expect(evicted).toEqual(["a"]);
  });

  it("refreshes recency on get without evicting other entries", () => {
    const cache = new LruMap<string, string>(2);
    const evicted: string[] = [];

    cache.set("a", "1");
    cache.set("b", "2");
    expect(cache.get("a")).toBe("1");
    cache.set("c", "3", (key) => evicted.push(key));

    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe("1");
    expect(cache.get("c")).toBe("3");
    expect(evicted).toEqual(["b"]);
  });
});

describe("evictVagueKeywordIndex", () => {
  it("drops a cached inverted index by translation id", () => {
    const data = {
      translation: "TEST",
      books: [
        {
          name: "Genesis",
          chapters: [["In the beginning"]],
        },
      ],
    } satisfies KJVData;

    const first = getOrBuildVagueKeywordIndex("test-cache", data);
    expect(first.get("beginning")).toHaveLength(1);

    evictVagueKeywordIndex("test-cache");

    const second = getOrBuildVagueKeywordIndex("test-cache", data);
    expect(second).not.toBe(first);
  });
});
