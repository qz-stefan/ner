import { readFileSync, writeFileSync } from "fs";

const DATA_PATH = new URL("../data/generated.json", import.meta.url).pathname;
const data = JSON.parse(readFileSync(DATA_PATH, "utf8"));

// Backup
const backupPath = DATA_PATH.replace(".json", `_backup_v2_${Date.now()}.json`);
writeFileSync(backupPath, JSON.stringify(data, null, 2));
console.log("Backup:", backupPath);

const LID = "075_1916_松崎鹤雄";
const letter = data.letters.find((l) => l.id === LID);
if (!letter) { console.error("Not found"); process.exit(1); }

const oldText = letter.text;
const entities = data.entitiesByLetter[LID] || [];

// ═══ Build new text with proper paragraphs ═══

// Split points (find in old text, get end positions)
function findEnd(afterText) {
  const idx = oldText.indexOf(afterText);
  if (idx === -1) throw new Error("Not found: " + afterText.slice(0, 20));
  return idx + afterText.length;
}

// Actually, let me just split by known landmark phrases
const splits = [];

// Para 1 ends: "...将书移城外或乡间。"
const p1end = findEnd("城外或乡间。");
splits.push(p1end);

// Para 2 ends: "...今日似可于报纸发挥矣。"
const p2end = findEnd("发挥矣。");
splits.push(p2end);

// Para 3 ends: "...一刻寻不见也。"
const p3end = findEnd("寻不见也。");
splits.push(p3end);

// Para 4: "禄命不外五行生克伐也之理。" (fix the stray period)
// Current text has: "禄命不外五行生克伐也。之理"
// Should be: "禄命不外五行生克伐也之理。"
const p4start = p3end;
const oldP4 = oldText.slice(p4start, p4start + 30);
console.log("Para 4 area:", JSON.stringify(oldP4));

// Find "天干五行" for end of para 4
const p4end_idx = oldText.indexOf("天干五行，甲乙、木。丙丁、火。戊己、土。庚辛、金。壬癸水。是也。");
// Actually let me search more carefully
const p4end = oldText.indexOf("天干五行");
if (p4end === -1) throw new Error("天干五行 not found");
// Para 4 is "禄命不外..." to before "天干五行"
splits.push(p4end);

// Para 5: "天干五行...是也。"
const p5end = oldText.indexOf("地支五行");
if (p5end === -1) throw new Error("地支五行 not found");
splits.push(p5end);

// Para 6: "地支五行...是也。"
const p6end = oldText.indexOf("又看冲合");
if (p6end === -1) throw new Error("又看冲合 not found");
splits.push(p6end);

// Para 7: "又看冲合...亦犹之合也。"
const p7end = findEnd("亦犹之合也。");
splits.push(p7end);

// Para 8: "人生五年一运...以理气言者也。"
const p8end = findEnd("以理气言者也。");
splits.push(p8end);

// Para 9: "汉时许、郑两大儒...使人易学也。"
const p9end = findEnd("使人易学也。");
splits.push(p9end);

// Para 10: "日本邮便局长...知进知退知存知亡者矣。"
const p10end = findEnd("知存知亡者矣。");
splits.push(p10end);

// Para 11: "有信致易君吟村...敬颂撰安。"
const p11end = findEnd("敬颂撰安。");
splits.push(p11end);

// Remaining: "弟叶德辉顿首。丙辰夏正六月十二日。"
const ending = oldText.slice(p11end);
console.log("Ending:", JSON.stringify(ending));

console.log("Split positions:", splits);

// Build paragraphs
const title = "柔甫仁兄同学左右：";
const paras = [
  title + "\n    " + oldText.slice(0, splits[0]).trim(),                         // para 1 with title
  oldText.slice(splits[0], splits[1]).trim(),                                     // para 2
  oldText.slice(splits[1], splits[2]).trim(),                                     // para 3
  oldText.slice(splits[2], splits[3]).trim().replace("五行生克伐也。之理", "五行生克伐也之理"), // para 4 (fix period)
  oldText.slice(splits[3], splits[4]).trim(),                                     // para 5
  oldText.slice(splits[4], splits[5]).trim(),                                     // para 6
  oldText.slice(splits[5], splits[6]).trim(),                                     // para 7
  oldText.slice(splits[6], splits[7]).trim(),                                     // para 8
  oldText.slice(splits[7], splits[8]).trim(),                                     // para 9
  oldText.slice(splits[8], splits[9]).trim(),                                     // para 10
  oldText.slice(splits[9], splits[10]).trim(),                                    // para 11
];

// Handle ending separately: split "弟叶德辉顿首。丙辰夏正六月十二日。"
const endingMatch = ending.match(/^弟叶德辉顿首。丙辰夏正六月十二日。$/);
let endingLines;
if (endingMatch) {
  endingLines = ["弟叶德辉顿首。", "丙辰夏正六月十二日。"];
} else {
  // Try to split
  endingLines = [ending.trim()];
  console.log("Ending format unexpected:", JSON.stringify(ending));
}

const newText = [...paras, ...endingLines].join("\n\n");
console.log("\nNew text paragraphs:", newText.split("\n\n").length);
console.log("First para:", JSON.stringify(newText.split("\n\n")[0].slice(0, 60)));
console.log("Last two:", JSON.stringify(newText.split("\n\n").slice(-2)));

// ═══ Rebuild entity offsets ═══
// Strategy: find each entity's surface text in the new text near its expected position
// Simple approach: search for surface text in new text, assign new positions

const newEntities = [];
for (const ent of entities) {
  // Try to find the surface text in the old text, then map to new text
  const oldSurface = oldText.slice(ent.start, ent.end);
  // Search for this surface in new text, preferring near the proportional position
  const ratio = ent.start / oldText.length;
  const searchStart = Math.max(0, Math.floor(ratio * newText.length) - 50);
  const searchEnd = Math.min(newText.length, searchStart + 200);
  const searchRegion = newText.slice(searchStart, searchEnd);
  const localIdx = searchRegion.indexOf(oldSurface);
  if (localIdx >= 0) {
    newEntities.push({
      ...ent,
      start: searchStart + localIdx,
      end: searchStart + localIdx + oldSurface.length,
    });
  } else {
    // Try full text search
    const globalIdx = newText.indexOf(oldSurface);
    if (globalIdx >= 0) {
      newEntities.push({
        ...ent,
        start: globalIdx,
        end: globalIdx + oldSurface.length,
      });
    } else {
      console.log("WARNING: Could not find surface in new text:", JSON.stringify(oldSurface), "old pos:", ent.start);
      // Keep old positions as-is (they'll be wrong but won't crash)
      newEntities.push({...ent});
    }
  }
}

// Sort by position
newEntities.sort((a, b) => a.start - b.start);

// ═══ Add missing PER entities ═══
const perAdditions = [
  // [surface, canonical, searchHint]
  ["大隈", "大隈重信"],
  ["老黎", "黎元洪"],
  ["黎氏", "黎元洪"],
  ["岳飞", "岳飞"],
  ["袁皇帝", "袁世凯"],
  ["唐绍仪", "唐绍仪"],
  ["伍廷芳", "伍廷芳"],
  ["陆荣廷", "陆荣廷"],
  ["段祺瑞", "段祺瑞"],
  ["许慎", "许慎"],
  ["易君吟村", "易培基"],
  ["柔甫仁兄", "松崎鹤雄"],
  ["柔甫", "松崎鹤雄"],
];

function addPerEntity(surface, canonical) {
  // Search for surface in newText, but only where not already covered by existing entity
  let idx = 0;
  while (idx < newText.length) {
    const pos = newText.indexOf(surface, idx);
    if (pos === -1) break;
    // Check if this position is already covered
    const covered = newEntities.some(e => e.type === "PER" && e.start <= pos && e.end >= pos + surface.length);
    if (!covered) {
      newEntities.push({
        type: "PER",
        surface,
        canonical,
        subtype: null,
        start: pos,
        end: pos + surface.length,
      });
    }
    idx = pos + 1;
  }
}

for (const [surface, canonical] of perAdditions) {
  addPerEntity(surface, canonical);
}

// Handle 陈 (陈宧) — context: "一陈一汤", "陈则见拒"
// Handle 汤 (汤芗铭) — context: "一陈一汤", "汤则潜逃", "汤去年"
// Handle 袁 — "特袁最后", "全袭袁皇帝"
// Handle 黎 — "黎、段则未知其用心"
// Handle 段 — "黎、段则未知其用心"
// Handle 陆 — "陆为湘粤两省所推重"
// Handle 许 — "汉时许、郑两大儒"
// Handle 郑 — "汉时许、郑两大儒"

const contextPers = [
  // [surface before, surface, canonical]
  // 陈宧
  [/一陈一汤/g, "陈", "陈宧"],
  [/陈则见拒/g, "陈", "陈宧"],
  // 汤芗铭
  [/一陈一汤/g, "汤", "汤芗铭"],
  [/汤则潜逃/g, "汤", "汤芗铭"],
  [/汤去年/g, "汤", "汤芗铭"],
  // 袁世凯 (already has 袁皇帝, now add standalone 袁)
  [/特袁最后/g, "袁", "袁世凯"],
  [/全袭袁皇帝/g, "袁", "袁世凯"], // "袁" in "袁皇帝" is caught here but E means the standalone ones
  // 黎元洪
  [/黎、段则/g, "黎", "黎元洪"],
  // 段祺瑞
  [/黎、段则/g, "段", "段祺瑞"],
  // 陆荣廷
  [/陆为湘粤/g, "陆", "陆荣廷"],
  // 许慎
  [/汉时许、郑/g, "许", "许慎"],
  // 郑玄
  [/许、郑两大儒/g, "郑", "郑玄"],
];

for (const [re, surface, canonical] of contextPers) {
  let match;
  re.lastIndex = 0;
  while ((match = re.exec(newText)) !== null) {
    const pos = match.index + match[0].indexOf(surface);
    if (pos < match.index) continue; // surface not in match
    const realPos = pos;
    const covered = newEntities.some(e => e.type === "PER" && e.start <= realPos && e.end >= realPos + surface.length);
    if (!covered) {
      newEntities.push({
        type: "PER",
        surface,
        canonical,
        subtype: null,
        start: realPos,
        end: realPos + surface.length,
      });
    }
  }
}

// Sort
newEntities.sort((a, b) => a.start - b.start);

// ═══ Also handle events (they need offset remapping too) ═══
const events = data.eventsByLetter[LID] || [];
const newEvents = [];
for (const ev of events) {
  const oldSurface = oldText.slice(ev.start, ev.end);
  const ratio = ev.start / oldText.length;
  const searchStart = Math.max(0, Math.floor(ratio * newText.length) - 100);
  const searchEnd = Math.min(newText.length, searchStart + 300);
  const searchRegion = newText.slice(searchStart, searchEnd);
  const localIdx = searchRegion.indexOf(oldSurface);
  if (localIdx >= 0) {
    newEvents.push({
      ...ev,
      start: searchStart + localIdx,
      end: searchStart + localIdx + oldSurface.length,
    });
  } else {
    const globalIdx = newText.indexOf(oldSurface);
    if (globalIdx >= 0) {
      newEvents.push({ ...ev, start: globalIdx, end: globalIdx + oldSurface.length });
    } else {
      console.log("WARNING: Event surface not found:", JSON.stringify(oldSurface.slice(0, 30)));
      newEvents.push({ ...ev });
    }
  }
}
newEvents.sort((a, b) => a.start - b.start);

// ═══ Handle acts ═══
const acts = data.actsByLetter[LID] || [];
const newActs = [];
for (const act of acts) {
  const oldSurface = oldText.slice(act.start, act.end);
  const ratio = act.start / oldText.length;
  const searchStart = Math.max(0, Math.floor(ratio * newText.length) - 100);
  const searchEnd = Math.min(newText.length, searchStart + 300);
  const searchRegion = newText.slice(searchStart, searchEnd);
  const localIdx = searchRegion.indexOf(oldSurface);
  if (localIdx >= 0) {
    newActs.push({
      ...act,
      start: searchStart + localIdx,
      end: searchStart + localIdx + oldSurface.length,
    });
  } else {
    const globalIdx = newText.indexOf(oldSurface);
    if (globalIdx >= 0) {
      newActs.push({ ...act, start: globalIdx, end: globalIdx + oldSurface.length });
    } else {
      console.log("WARNING: Act surface not found:", JSON.stringify(oldSurface.slice(0, 30)));
      newActs.push({ ...act });
    }
  }
}
newActs.sort((a, b) => a.start - b.start);

// ═══ Update data ═══
letter.text = newText;
data.entitiesByLetter[LID] = newEntities;
data.eventsByLetter[LID] = newEvents;
data.actsByLetter[LID] = newActs;

// ═══ Update entity catalog ═══
function updateCatalog() {
  // Rebuild from scratch for all entities
  const catMap = new Map(); // key: "TYPE:canonical"
  for (const [letterId, letterEntities] of Object.entries(data.entitiesByLetter)) {
    for (const e of letterEntities) {
      const key = `${e.type}:${e.canonical}`;
      if (!catMap.has(key)) {
        catMap.set(key, {
          type: e.type,
          canonical: e.canonical,
          aliases: [],
          subtypes: [],
          count: 0,
          letterIds: [],
        });
      }
      const entry = catMap.get(key);
      entry.count++;
      if (!entry.letterIds.includes(letterId)) entry.letterIds.push(letterId);
    }
  }
  data.entityCatalog = [...catMap.values()];

  // Update stats
  const allTypes = ["PER","LOC","BOK","VER","TIM","OFF","ORG","KIN","AST"];
  for (const type of allTypes) {
    const entries = data.entityCatalog.filter(e => e.type === type);
    const allLids = new Set();
    let total = 0;
    for (const e of entries) {
      total += e.count;
      for (const lid of e.letterIds) allLids.add(lid);
    }
    data.entityStats[type] = { canonicalCount: entries.length, mentionCount: total, letterCount: allLids.size };
  }
}

updateCatalog();

// ═══ Write ═══
writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
console.log("\nDone!");
console.log("New text length:", newText.length);
console.log("Total entities:", newEntities.length);
console.log("PER entities:", newEntities.filter(e => e.type === "PER").length);
console.log("AST entities:", newEntities.filter(e => e.type === "AST").length);
console.log("Events:", newEvents.length);
console.log("Acts:", newActs.length);

// Show all PER entities
console.log("\n=== ALL PER ENTITIES ===");
newEntities.filter(e => e.type === "PER").sort((a,b) => a.start - b.start).forEach(e => {
  const ctx = newText.slice(Math.max(0,e.start-3), e.end+3);
  console.log(`  ${e.start}-${e.end} [${e.surface}] -> ${e.canonical}  ctx:"${ctx}"`);
});
