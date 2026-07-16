import { describe, expect, it } from "vitest";
import { yvpPassageToBibleChapter } from "./yvp-chapter-payload";

const JHN_3_SNIPPET = `<div><div class="p"><span class="yv-v" v="3"></span><span class="yv-vlbl">3</span>Jesus replied, <span class="wj">"Very truly I tell you, no one can see the kingdom of God unless they are born again.</span><span class="yv-n f"><span class="fr">3:3 </span><span class="ft">The Greek for </span><span class="fq">again </span><span class="ft">also means </span><span class="fqa">from above</span><span class="ft">; also in verse 7.</span></span><span class="wj">"</span></div><div class="p"><span class="yv-v" v="21"></span><span class="yv-vlbl">21</span>But whoever lives by the truth comes into the light.</div><div class="s1 yv-h">John Testifies Again About Jesus</div><div class="p"><span class="yv-v" v="22"></span><span class="yv-vlbl">22</span>After this, Jesus and his disciples went out.</div></div>`;

const PSA_119_SNIPPET = `<div><div class="q1"><span class="yv-v" v="32"></span><span class="yv-vlbl">32</span>I run in the path of your commands,</div><div class="q2">for you have broadened my understanding.</div><div class="qa yv-h">ה He</div><div class="q1"><span class="yv-v" v="33"></span><span class="yv-vlbl">33</span>Teach me, the way of your decrees,</div><div class="q2">that I may follow it to the end.<span class="yv-n f"><span class="fr">119:33 </span><span class="ft">Or </span><span class="fqa">follow it for its reward</span></span></div></div>`;

const MAT_5_38_SNIPPET = `<div><div class="p"><span class="yv-v" v="38"></span><span class="yv-vlbl">38</span><span class="wj">"Eye for eye, and tooth for tooth."</span> <span class="yv-n f"><span class="fr">5:38 </span><span class="ft"><span class="ref" usfm="EXO.21.24">Exodus 21:24</span> ; <span class="ref" usfm="LEV.24.20">Lev. 24:20</span></span></span></div></div>`;

describe("yvpPassageToBibleChapter", () => {
  it("extracts nested NIV footnotes without leaking body text into verses", () => {
    const chapter = yvpPassageToBibleChapter("john", 3, {
      id: "JHN.3",
      reference: "John 3",
      content: JHN_3_SNIPPET,
    });

    expect(chapter.verses[0]).toBe(
      'Jesus replied, "Very truly I tell you, no one can see the kingdom of God unless they are born again. "',
    );
    expect(chapter.yvpFootnotes?.[1]).toEqual({
      label: "3:3",
      body: "The Greek for again also means from above ; also in verse 7.",
    });
  });

  it("strips section headings so they do not append to the previous verse", () => {
    const chapter = yvpPassageToBibleChapter("john", 3, {
      id: "JHN.3",
      reference: "John 3",
      content: JHN_3_SNIPPET,
    });

    expect(chapter.verses[1]).toBe("But whoever lives by the truth comes into the light.");
    expect(chapter.verses[2]).toBe("After this, Jesus and his disciples went out.");
  });

  it("strips Hebrew acrostic headings between poetic lines", () => {
    const chapter = yvpPassageToBibleChapter("psalms", 119, {
      id: "PSA.119",
      reference: "Psalm 119",
      content: PSA_119_SNIPPET,
    });

    expect(chapter.verses[0]).toBe(
      "I run in the path of your commands, for you have broadened my understanding.",
    );
    expect(chapter.verses[1]).toBe(
      "Teach me, the way of your decrees, that I may follow it to the end.",
    );
    expect(chapter.yvpFootnotes?.[1]?.body).toBe("Or follow it for its reward");
  });

  it("keeps cross-reference text inside footnote bodies, not verse text", () => {
    const chapter = yvpPassageToBibleChapter("matthew", 5, {
      id: "MAT.5.38",
      reference: "Matthew 5:38",
      content: MAT_5_38_SNIPPET,
    });

    expect(chapter.verses[0]).toBe('"Eye for eye, and tooth for tooth."');
    expect(chapter.yvpFootnotes?.[1]?.body).toContain("Exodus 21:24");
    expect(chapter.yvpFootnotes?.[1]?.body).toContain("Lev. 24:20");
  });
});
