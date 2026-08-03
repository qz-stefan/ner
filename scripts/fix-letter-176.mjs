import { readFileSync, writeFileSync } from "fs";

const DATA_PATH = new URL("../data/generated.json", import.meta.url).pathname;
const data = JSON.parse(readFileSync(DATA_PATH, "utf8"));
const backupPath = DATA_PATH.replace(".json", `_backup_176_${Date.now()}.json`);
writeFileSync(backupPath, JSON.stringify(data, null, 2));
console.log("Backup:", backupPath);

const LID = "176_1916_缪荃孙";

// ═══ New text (user's authoritative version) ═══
const newText = [
  "艺风太夫子大人钧鉴：",
  "顶奉谕示，并《天寥年谱》、《甲行日注》四本，拜谢拜谢。",
  "八月中秋前，同族人到吴江访得天寥公撰西方庵、圆通庵二碑，石刻完好，文系骈体，纯用内典。简栖、子安外，久无刻此作。已雇工人往拓，拓出即奉呈。",
  "现在敝族惟无锡一派，尚多文士秀才，天寥、横山二公之流泽孔长，可欣慕也。次则上海之新场。忠节公映榴一支，赫赫最盛之昆山郡城，文庄至文敏以下吴西公初春支，今已式微，无一读书种。然有二三商贸中人，与之谈先世，尚能陈述祖德，无寻常市井气也。辉一派为元和靖山长者讳颙者之后，非宋之颙，所谓茅园派者也。此派人极少，除寒家一小支外，则仅扬州一支，故人丁占谱极少。大约房派丁多者，即不发秀，发贵、发富者亦然。此天下言风水者共同之理，殆即盈亏之数欤？然。",
  "此《已畦集》已将刻出，待印。送板人由永州至长沙，中途遇游勇抢去行李并底稿文集，前五卷。幸此间本家尚有副本正在抄写付湘补刻，此亦大可笑事。",
  "横山公尚有《上宋荔裳书》，诋其舅太王芝兰十六罪状，文极痛快淋漓，其稿底在一族人处，已借抄之。想见此老刚正不阿，不仅见之《汪文摘抄》也。辉藏有明文庄公盛全集三十卷，中缺《水东稿诗》前二卷，《翠竹堂诗稿》四、五、六卷，共五卷。不知藏书尚有全本可配否？乞公留意物色，亦吴中文献也。",
  "有族人云，温州博古斋即刻《永嘉丛书》经手者。刻书极精，价比苏廉。族人在湖南财政厅当科长，今已回，学问甚好，非风尘俗吏。据云温州刻书价现在尚与湖南相等，每字一千不过洋一元。曾见朱疆翁、赵学南兄，以为欲长刻书不如公共要博古斋承领。一较湖北近便，一较苏州价廉，省刻资，多刻书，似非吝啬也。",
  "二曹兄弟但见君直两面，叔彦所居终闹不明，当徐以相访。菊裳先生日内拟走访，然此时又天雨，雨即闷人，兴致索然矣。手此，敬叩福安。",
  "门下晚生叶德辉顿首。",
  "丙辰十月朔。",
].join("\n\n");

// ═══ Helper ═══
function findAll(re, text) {
  const results = [];
  let match;
  while ((match = re.exec(text)) !== null) {
    results.push({ start: match.index, end: match.index + match[0].length, text: match[0] });
  }
  return results;
}

function addEntity(type, surface, canonical, start, end) {
  const entities = data.entitiesByLetter[LID];
  // Avoid exact duplicates
  if (entities.some(e => e.type === type && e.start === start && e.end === end && e.canonical === canonical)) return;
  entities.push({ type, surface, canonical, subtype: null, start, end });
}

// ═══ Clear and rebuild entities ═══
data.entitiesByLetter[LID] = [];
const entities = data.entitiesByLetter[LID];

// ═══ PER entities (人物) ═══
const pers = [
  // [regex or string, canonical] — searched in newText
  { re: /艺风太夫子大人/g, canonical: "缪荃孙" },
  { re: /天寥公/g, canonical: "叶绍袁" },
  { re: /(?<!已畦集|上宋荔裳书|永嘉丛书|汪文摘抄|水东稿诗|翠竹堂诗稿|命学津梁|珞琭子赋|命书|天寥年谱|甲行日注|太极图说|说文解字|汉书)天寥(?!公|年谱)/g, canonical: "叶绍袁" },
  { re: /横山公/g, canonical: "叶燮" },
  { re: /(?<!已畦集|上宋荔裳书|永嘉丛书|汪文摘抄|水东稿诗|翠竹堂诗稿|命学津梁|珞琭子赋|命书|天寥年谱|甲行日注|太极图说|说文解字|汉书)横山(?!公)/g, canonical: "叶燮" },
  { re: /简栖/g, canonical: "王巾" },
  { re: /子安/g, canonical: "王勃" },
  { re: /忠节公映榴/g, canonical: "叶映榴" },
  { re: /文庄公盛/g, canonical: "叶盛" },
  { re: /文庄至文敏/g, canonical: null }, // split below
  { re: /文庄(?!公|至)/g, canonical: "叶盛" },
  { re: /文敏/g, canonical: "叶方蔼" },
  { re: /吴西公初春/g, canonical: "叶初春" },
  { re: /讳颙者/g, canonical: "叶颙" },
  { re: /宋之颙/g, canonical: "叶颙" },
  { re: /(?<!元和靖山长者)颙(?!者)/g, canonical: null }, // handled by 讳颙者 and 宋之颙
  { re: /王芝兰/g, canonical: "王芝兰" },
  { re: /朱疆翁/g, canonical: "朱祖谋" },
  { re: /赵学南兄/g, canonical: "赵诒琛" },
  { re: /赵学南(?!兄)/g, canonical: "赵诒琛" },
  { re: /君直/g, canonical: "曹元忠" },
  { re: /叔彦/g, canonical: "曹元弼" },
  { re: /二曹兄弟/g, canonical: null }, // handled separately below
  { re: /(?<=二曹)兄弟(?!的)/g, canonical: null }, // NOT KIN
  { re: /菊裳先生/g, canonical: "叶昌炽" },
  { re: /(?<!门下晚生)叶德辉/g, canonical: "叶德辉" },
  { re: /(?<!宋之|讳)颙(?!者)/g, canonical: null },
  { re: /尚农/g, canonical: "叶永倬" },
  { re: /缪荃孙/g, canonical: "缪荃孙" },
  { re: /宋荔裳/g, canonical: "宋琬" },
];

// Add PER entities by searching newText
for (const { re, canonical } of pers) {
  if (!canonical) continue; // skip split cases
  let match;
  re.lastIndex = 0;
  while ((match = re.exec(newText)) !== null) {
    addEntity("PER", match[0], canonical, match.index, match.index + match[0].length);
  }
}

// Handle special cases:
// "文庄至文敏" → 文庄 (叶盛), 文敏 (叶方蔼)
{
  const idx = newText.indexOf("文庄至文敏");
  if (idx >= 0) {
    addEntity("PER", "文庄", "叶盛", idx, idx + 2);
    addEntity("PER", "文敏", "叶方蔼", idx + 3, idx + 5);
  }
}

// "二曹兄弟" → 二曹 as PER (曹元忠+曹元弼), but NOT marking 兄弟 as KIN
{
  const idx = newText.indexOf("二曹兄弟");
  if (idx >= 0) {
    addEntity("PER", "二曹", "曹元忠、曹元弼", idx, idx + 2);
    // 兄弟 is NOT annotated as KIN here (not 叶德辉's relatives)
  }
}

// 辉 (self-reference) — in context "辉一派" and "辉藏有"
for (const ctx of ["辉一派", "辉藏有"]) {
  const idx = newText.indexOf(ctx);
  if (idx >= 0) addEntity("PER", "辉", "叶德辉", idx, idx + 1);
}

// ═══ LOC entities ═══
const locs = [
  { re: /吴江/g, canonical: "吴江" },
  { re: /无锡/g, canonical: "无锡" },
  { re: /上海/g, canonical: "上海" },
  { re: /新场/g, canonical: "新场" },
  { re: /昆山/g, canonical: "昆山" },
  { re: /扬州/g, canonical: "扬州" },
  { re: /元和/g, canonical: "元和" },
  { re: /永州/g, canonical: "永州" },
  { re: /长沙/g, canonical: "长沙" },
  { re: /湘/g, canonical: "湖南" },
  { re: /湖南/g, canonical: "湖南" },
  { re: /温州/g, canonical: "温州" },
  { re: /苏州/g, canonical: "苏州" },
  { re: /湖北/g, canonical: "湖北" },
  { re: /吴中/g, canonical: "吴中" },
];

for (const { re, canonical } of locs) {
  let match;
  re.lastIndex = 0;
  while ((match = re.exec(newText)) !== null) {
    addEntity("LOC", match[0], canonical, match.index, match.index + match[0].length);
  }
}

// ═══ ORG entities ═══
const orgs = [
  { re: /博古斋/g, canonical: "博古斋" },
  { re: /湖南财政厅/g, canonical: "湖南财政厅" },
];

for (const { re, canonical } of orgs) {
  let match;
  re.lastIndex = 0;
  while ((match = re.exec(newText)) !== null) {
    addEntity("ORG", match[0], canonical, match.index, match.index + match[0].length);
  }
}

// ═══ BOK entities ═══
const boks = [
  { re: /《天寥年谱》/g, canonical: "天寥年谱" },
  { re: /《甲行日注》/g, canonical: "甲行日注" },
  { re: /《已畦集》/g, canonical: "已畦集" },
  { re: /《上宋荔裳书》/g, canonical: "上宋荔裳书" },
  { re: /《汪文摘抄》/g, canonical: "汪文摘抄" },
  { re: /《水东稿诗》/g, canonical: "水东稿诗" },
  { re: /《翠竹堂诗稿》/g, canonical: "翠竹堂诗稿" },
  { re: /《永嘉丛书》/g, canonical: "永嘉丛书" },
];

for (const { re, canonical } of boks) {
  let match;
  re.lastIndex = 0;
  while ((match = re.exec(newText)) !== null) {
    addEntity("BOK", match[0], canonical, match.index, match.index + match[0].length);
  }
}

// ═══ OFF entities ═══
const offs = [
  { re: /财政厅科长/g, canonical: "科长" },
];
for (const { re, canonical } of offs) {
  let match;
  re.lastIndex = 0;
  while ((match = re.exec(newText)) !== null) {
    addEntity("OFF", match[0], canonical, match.index, match.index + match[0].length);
  }
}

// ═══ KIN entities (only 叶德辉's actual relatives) ═══
// In this letter: 舅太 (舅太王芝兰 — but 王芝兰 is 宋琬's 妻舅, not 叶德辉's relative)
// "兄弟" in "二曹兄弟" — NOT 叶德辉's relative
// No KIN entities to add in this letter based on user's rules

// ═══ TIM entities ═══
const tims = [
  { re: /八月中秋前/g, canonical: "八月中秋前" },
  { re: /丙辰十月朔/g, canonical: "丙辰十月朔" },
];
for (const { re, canonical } of tims) {
  let match;
  re.lastIndex = 0;
  while ((match = re.exec(newText)) !== null) {
    addEntity("TIM", match[0], canonical, match.index, match.index + match[0].length);
  }
}

// ═══ AST entities ═══
const astPatterns = [
  { re: /风水/g, canonical: "风水" },
];
for (const { re, canonical } of astPatterns) {
  let match;
  re.lastIndex = 0;
  while ((match = re.exec(newText)) !== null) {
    addEntity("AST", match[0], canonical, match.index, match.index + match[0].length);
  }
}

// ═══ VER entities ═══
// None obvious in this letter

// ═══ Sort entities ═══
entities.sort((a, b) => a.start - b.start);

// ═══ Update letter text ═══
const letter = data.letters.find(l => l.id === LID);
letter.text = newText;

// ═══ Clear events/acts (can't remap across completely changed text) ═══
// Keep them but with a note — they need manual review
console.log("Old events:", (data.eventsByLetter[LID] || []).length);
console.log("Old acts:", (data.actsByLetter[LID] || []).length);
// We'll clear them since the text is completely different
data.eventsByLetter[LID] = [];
data.actsByLetter[LID] = [];

// ═══ Update entity catalog ═══
const catMap = new Map();
for (const [letterId, letterEntities] of Object.entries(data.entitiesByLetter)) {
  for (const e of letterEntities) {
    const key = `${e.type}:${e.canonical}`;
    if (!catMap.has(key)) {
      catMap.set(key, { type: e.type, canonical: e.canonical, aliases: [], subtypes: [], count: 0, letterIds: [] });
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
  for (const e of entries) { total += e.count; for (const lid of e.letterIds) allLids.add(lid); }
  data.entityStats[type] = { canonicalCount: entries.length, mentionCount: total, letterCount: allLids.size };
}

// ═══ Write ═══
writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));

// ═══ Report ═══
const finalEntities = data.entitiesByLetter[LID];
const typeCounts = {};
finalEntities.forEach(e => { typeCounts[e.type] = (typeCounts[e.type] || 0) + 1; });
console.log("\n=== DONE ===");
console.log("Paragraphs:", newText.split("\n\n").length);
console.log("Entity types:", typeCounts);
console.log("Total entities:", finalEntities.length);
console.log("\nPER entities:");
finalEntities.filter(e => e.type === "PER").sort((a,b) => a.start - b.start).forEach(e => {
  console.log(`  ${e.start}-${e.end} [${e.surface}] -> ${e.canonical}`);
});
