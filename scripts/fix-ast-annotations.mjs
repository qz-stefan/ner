import { readFileSync, writeFileSync } from "fs";

const DATA_PATH = new URL("../data/generated.json", import.meta.url).pathname;
const data = JSON.parse(readFileSync(DATA_PATH, "utf8"));

// Backup
const backupPath = DATA_PATH.replace(".json", `_backup_${Date.now()}.json`);
writeFileSync(backupPath, JSON.stringify(data, null, 2));
console.log("Backup saved to", backupPath);

const LETTER_ID = "075_1916_松崎鹤雄";
const letter = data.letters.find((l) => l.id === LETTER_ID);
if (!letter) { console.error("Letter not found"); process.exit(1); }

let text = letter.text;
const entities = data.entitiesByLetter[LETTER_ID] || [];

// ── helpers ──
function shiftOffsets(afterPos, delta) {
  for (const arr of [entities, data.eventsByLetter[LETTER_ID] || [], data.actsByLetter[LETTER_ID] || []]) {
    for (const e of arr) {
      if (e.start >= afterPos) { e.start += delta; e.end += delta; }
      else if (e.end > afterPos) { e.end += delta; }
    }
  }
}

function addEntity(surface, canonical, start, end) {
  // Don't add if exact same already exists
  const exists = entities.some(e => e.type === "AST" && e.start === start && e.end === end);
  if (exists) return;
  entities.push({ type: "AST", surface, canonical, subtype: null, start, end });
  // Update catalog
  let entry = data.entityCatalog.find(e => e.type === "AST" && e.canonical === canonical);
  if (entry) {
    entry.count++;
    if (!entry.letterIds.includes(LETTER_ID)) entry.letterIds.push(LETTER_ID);
  } else {
    data.entityCatalog.push({ type: "AST", canonical, aliases: [], subtypes: [], count: 1, letterIds: [LETTER_ID] });
  }
}

function findAll(regex, text) {
  const results = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    results.push({ start: match.index, end: match.index + match[0].length, text: match[0] });
  }
  return results;
}

// ═══════════════════════════════════════════
// Phase 1: Apply text fixes (right to left)
// ═══════════════════════════════════════════

const textFixes = [
  [685, "己与亥冲", "巳与亥冲"],
  [643, "己与申合", "巳与申合"],
  [512, "申、中包戊土、壬水二种", "申、中包戊土、庚金、壬水三种"],
  [428, "己火", "己土"],
].sort((a, b) => b[0] - a[0]); // descending position

for (const [pos, oldStr, newStr] of textFixes) {
  const actual = text.slice(pos, pos + oldStr.length);
  if (actual !== oldStr) { console.error(`MISMATCH at ${pos}: expected "${oldStr}" got "${actual}"`); continue; }
  text = text.slice(0, pos) + newStr + text.slice(pos + oldStr.length);
  const delta = newStr.length - oldStr.length;
  if (delta !== 0) shiftOffsets(pos + oldStr.length, delta);
  console.log(`Fixed text: "${oldStr}" → "${newStr}" (delta=${delta})`);
}

// Update entity for 己火→己土
const jiHuo = entities.find(e => e.canonical === "己火");
if (jiHuo) { jiHuo.surface = "己土"; jiHuo.canonical = "己土"; }
// Update catalog
const jiHuoCat = data.entityCatalog.find(e => e.type === "AST" && e.canonical === "己火");
if (jiHuoCat) { jiHuoCat.canonical = "己土"; }
// Merge with existing 己土 in catalog
const jiTuCat = data.entityCatalog.find(e => e.type === "AST" && e.canonical === "己土" && e !== jiHuoCat);
if (jiHuoCat && jiTuCat) {
  jiTuCat.count += jiHuoCat.count;
  jiTuCat.letterIds = [...new Set([...jiTuCat.letterIds, ...jiHuoCat.letterIds])];
  data.entityCatalog = data.entityCatalog.filter(e => e !== jiHuoCat);
}

letter.text = text;

// ═══════════════════════════════════════════
// Phase 2: Add missing AST annotations
// ═══════════════════════════════════════════

// 2a. First 天干五行 paragraph — 天干, 五行, 甲乙, 木, 丙丁, 火, 戊己, 土, 庚辛, 金, 水
const firstParaTerms = [
  { re: /天干/g, canonical: "天干" },
  { re: /五行/g, canonical: "五行" },
  { re: /甲乙/g, canonical: "甲乙" },
  { re: /丙丁/g, canonical: "丙丁" },
  { re: /戊己/g, canonical: "戊己" },
  { re: /庚辛/g, canonical: "庚辛" },
  { re: /壬癸(?!水)/g, canonical: "壬癸" },  // 壬癸 when NOT followed by 水 (壬癸水 is already annotated)
  { re: /(?<![壬])木(?!数)/g, canonical: "木" },
  { re: /(?<![丁])火(?!方)/g, canonical: "火" },
  { re: /(?<![己])土(?!三种|二种)/g, canonical: "土" },
  { re: /(?<![辛])金(?!三种|二种)/g, canonical: "金" },
  { re: /(?<![癸])水(?!方|三种|二种)/g, canonical: "水" },
];

for (const { re, canonical } of firstParaTerms) {
  // Only process within the first ~120 chars (天干五行 section)
  const section = text.slice(370, 410);
  let match;
  re.lastIndex = 0;
  while ((match = re.exec(section)) !== null) {
    const start = 370 + match.index;
    const end = start + match[0].length;
    // Only if not already covered by existing entity
    if (!entities.some(e => e.start <= start && e.end >= end)) {
      addEntity(match[0], canonical, start, end);
    }
  }
}

// 2b. Individual 地支 (子丑寅卯辰巳午未申酉戌亥) — only in 地支藏干 section (~406-560)
const dizhi = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];
for (const dz of dizhi) {
  // Match this 地支 followed by 、 or 中包 (藏干 section pattern)
  const re = new RegExp(dz + "(?=[、中])", "g");
  const section = text.slice(406, 560);
  let match;
  while ((match = re.exec(section)) !== null) {
    const start = 406 + match.index;
    const end = start + 1;
    if (!entities.some(e => e.start <= start && e.end >= end)) {
      addEntity(dz, dz, start, end);
    }
  }
}

// 2c. 化 + 五行 (甲与己合，化土 etc.) — around 574-610
const huaTerms = [
  { re: /化土/g, canonical: "化土" },
  { re: /化水/g, canonical: "化水" },
  { re: /化火/g, canonical: "化火" },
  { re: /化金/g, canonical: "化金" },
  { re: /化木/g, canonical: "化木" },
  { re: /甲(?=与己)/g, canonical: "甲" },
  { re: /(?<=甲与)己(?=合)/g, canonical: "己" },
  { re: /丙(?=与辛)/g, canonical: "丙" },
  { re: /(?<=丙与)辛(?=合)/g, canonical: "辛" },
  { re: /戊(?=与癸)/g, canonical: "戊" },
  { re: /(?<=戊与)癸(?=合)/g, canonical: "癸" },
  { re: /乙(?=与庚)/g, canonical: "乙" },
  { re: /(?<=乙与)庚(?=合)/g, canonical: "庚" },
  { re: /丁(?=与壬)/g, canonical: "丁" },
  { re: /(?<=丁与)壬(?=合)/g, canonical: "壬" },
];

for (const { re, canonical } of huaTerms) {
  const section = text.slice(570, 620);
  let match;
  while ((match = re.exec(section)) !== null) {
    const start = 570 + match.index;
    const end = start + match[0].length;
    if (!entities.some(e => e.start <= start && e.end >= end)) {
      addEntity(match[0], canonical, start, end);
    }
  }
}

// 2d. 合 (individual, separate from 冲合)
const heMatches = findAll(/合/g, text);
for (const { start, end, text: t } of heMatches) {
  // Skip if inside "冲合" (冲合 already annotated)
  if (text.slice(Math.max(0, start - 1), end) === "冲合") continue;
  // Skip if inside 天干之合 or 地支之合 (already annotated)
  const existingAnnotated = entities.some(e => e.canonical === "天干之合" && e.start <= start && e.end >= end)
    || entities.some(e => e.canonical === "地支之合" && e.start <= start && e.end >= end)
    || entities.some(e => e.canonical === "冲合" && e.start <= start && e.end >= end);
  if (existingAnnotated) continue;
  if (!entities.some(e => e.start <= start && e.end >= end)) {
    addEntity(t, "合", start, end);
  }
}

// 2e. 冲 (individual)
const chongMatches = findAll(/冲/g, text);
for (const { start, end, text: t } of chongMatches) {
  // Skip if inside 冲合, 地支之冲, or 相冲害
  const existingAnnotated = entities.some(e =>
    (e.canonical === "冲合" || e.canonical === "地支之冲") && e.start <= start && e.end >= end
  );
  if (existingAnnotated) continue;
  if (!entities.some(e => e.start <= start && e.end >= end)) {
    addEntity(t, "冲", start, end);
  }
}

// 2f. 生 (individual, not inside 五行生克)
const shengMatches = findAll(/生/g, text);
for (const { start, end, text: t } of shengMatches) {
  const existingAnnotated = entities.some(e =>
    e.canonical === "五行生克" && e.start <= start && e.end >= end
  );
  if (existingAnnotated) continue;
  // Only annotate 生 in 禄命 context (the 生克 section)
  if (start > 740 && start < 830) {
    if (!entities.some(e => e.start <= start && e.end >= end)) {
      addEntity(t, "生", start, end);
    }
  }
}

// 2g. 克 (individual, not inside 五行生克)
const keMatches = findAll(/克/g, text);
for (const { start, end, text: t } of keMatches) {
  const existingAnnotated = entities.some(e =>
    e.canonical === "五行生克" && e.start <= start && e.end >= end
  );
  if (existingAnnotated) continue;
  if (start > 690 && start < 830) {
    if (!entities.some(e => e.start <= start && e.end >= end)) {
      addEntity(t, "克", start, end);
    }
  }
}

// 2h. 伐 — in "生克伐也"
const faMatches = findAll(/伐/g, text);
for (const { start, end, text: t } of faMatches) {
  if (!entities.some(e => e.start <= start && e.end >= end)) {
    addEntity(t, "伐", start, end);
  }
}

// 2i. 运 (大运) — "五年一运", "所行之运"
const yunMatches = findAll(/运/g, text);
for (const { start, end, text: t } of yunMatches) {
  if (start > 820 && start < 900) {
    if (!entities.some(e => e.start <= start && e.end >= end)) {
      addEntity(t, "运", start, end);
    }
  }
}

// 2j. 月干支
{
  const re = /月干支/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    const start = match.index, end = start + match[0].length;
    if (!entities.some(e => e.start <= start && e.end >= end)) {
      addEntity(match[0], "月干支", start, end);
    }
  }
}

// 2k. 五行之气
{
  const re = /五行之气/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    const start = match.index, end = start + match[0].length;
    if (!entities.some(e => e.start <= start && e.end >= end)) {
      addEntity(match[0], "五行之气", start, end);
    }
  }
}

// 2l. 命 ("命中多火", "命中多水")
{
  const re = /命(?=中多)/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    const start = match.index, end = start + 1;
    if (!entities.some(e => e.start <= start && e.end >= end)) {
      addEntity("命", "命", start, end);
    }
  }
}

// 2m. 火方, 水方
for (const term of ["火方", "水方"]) {
  const re = new RegExp(term, "g");
  let match;
  while ((match = re.exec(text)) !== null) {
    const start = match.index, end = start + 2;
    if (!entities.some(e => e.start <= start && e.end >= end)) {
      addEntity(match[0], term, start, end);
    }
  }
}

// 2n. 辰, 巳 in 郑玄 禄命 context ("岁在辰", "岁在巳")
{
  const re = /岁在([辰巳])/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    const start = match.index + 2, end = start + 1;
    if (!entities.some(e => e.start <= start && e.end >= end)) {
      addEntity(match[1], match[1], start, end);
    }
  }
}

// ═══════════════════════════════════════════
// Phase 3: Sort entities by start position
// ═══════════════════════════════════════════
entities.sort((a, b) => a.start - b.start);

// ═══════════════════════════════════════════
// Phase 4: Recalculate entityStats
// ═══════════════════════════════════════════
const allEntityTypes = ["PER","LOC","BOK","VER","TIM","OFF","ORG","KIN","AST"];
for (const type of allEntityTypes) {
  const entries = data.entityCatalog.filter(e => e.type === type);
  const allLetterIds = new Set();
  let totalMentions = 0;
  for (const entry of entries) {
    totalMentions += entry.count;
    for (const lid of entry.letterIds) allLetterIds.add(lid);
  }
  data.entityStats[type] = {
    canonicalCount: entries.length,
    mentionCount: totalMentions,
    letterCount: allLetterIds.size,
  };
}

// ═══════════════════════════════════════════
// Write
// ═══════════════════════════════════════════
writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
console.log("\nDone! New entity count for letter:", entities.length);
const astCount = entities.filter(e => e.type === "AST").length;
console.log("AST entities in letter:", astCount);
console.log("Total AST catalog entries:", data.entityCatalog.filter(e => e.type === "AST").length);
console.log("AST stats:", JSON.stringify(data.entityStats["AST"]));
