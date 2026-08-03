import { readFileSync, writeFileSync } from "fs";

const DATA_PATH = new URL("../data/generated.json", import.meta.url).pathname;
const data = JSON.parse(readFileSync(DATA_PATH, "utf8"));
const backupPath = DATA_PATH.replace(".json", `_backup_277_${Date.now()}.json`);
writeFileSync(backupPath, JSON.stringify(data, null, 2));
console.log("Backup:", backupPath);

const LID = "277_1924_各省机关_法团_报馆";

// ═══ New text with proper paragraphs ═══
const newText = [
  "各省机关、法团、报馆均鉴：",
  "改革以来，湘省当南北兵冲，频年战祸相乘，人民所受凶灾，较他省尤为剧烈。前者谭畏公主张省自治为宪，推而至于联省自治，始以为责疆而理，即可保境安民。乃宪法未成，身先去职。",
  "迨省宪成立之后，东南各省，如苏、浙、赣、皖、川、鄂、云、贵等处，如风起云涌，一哄而兴。然首先不同意而加之诋斥者，即孙中山先生。诚以省自为宪，引起省界之争，是无异破析我中国十八省为十八小国，瓜分瓦裂，无非自速灭亡。中山远虑深谋，出于爱国至诚，国人一经提撕，各省皆悟其非，遂尔无形消灭。而湘中以提倡最先之省，不能不见之施行。",
  "施行三年，内讧时起。其最谬者，如省长为最高行政长官，一省政纲所系，乃于省长以下，复设省务院，已为骈枝；而院长于各司推举一人长之。省长不能揽全省之权，院长又不能行省务之实，省院都成虚位。负责究问何人？即此一端，宪网已坠。宪纲不立，又安望百僚奉职、吏治澄清？吏治不修，乱源斯伏。以故土匪蜂起，烟种繁滋，地富而民益贫，年丰而米仍贵。稗政弊俗，莫非此省宪为之厉阶。",
  "畏公初不料省宪如此之窒碍，故毅然有革新湘政之举。知过必改，本不失为名人。假使入湘之时，军骑严饬，所有旧部师旅团营，谅无不同声响应。且当时赵省长亦频退避贤路，藉息兵戎者，一缘畏公随带兵队入湘，引起全省人震惶；一缘议会及各师长决议致讨。与师在省长，职在护法，决不至于同室操戈、贻笑邻邦。",
  "今者护宪成功、军事大定，而中山排斥联省自治之伟见、畏公革新湘政之本心，几成不白之冤，终无相谅之日。此全湘人固公道在心，而不能形之笔舌者也。今畏公部曲远徙粤中，主义未伸，实抱无穷遗憾。",
  "军队之编、统一之先声，不谋之武力，而谋之文字，若长此饰非度日，自误误人，政体纷歧，操戈终无止日。近者宋皋南军长致友人书，有誓不扰湘之语，可见敬恭桑梓，人同此心。畏公明达之人，苟得发扬精神，何至相争禄位。",
  "故废除省宪，所以表示畏公之本心。根据中山之伟见，息事定乱，是在当局一语之转移。即议会诸君子，各有本籍本乡，平时已多棘手于乡省市镇之争，建议在故里，而此次所受兵灾匪祸，与编户相同。揆诸保卫乡里顾全身家之私，亦当知省宪之无一足恃。况谭、赵两君，向称莫逆，抵以宪法牵制，遂致主见乖违。系铃解铃，在此一决。",
  "民意有真有伪，经此大乱之后，已经一一揭破，大众皆知，何为祛病、何为劫药之占。留此祸萌，俟其滋长，鄙人目击此次湘乱，毁宪护宪，皆以益民。护者何功？毁者何罪？不如废弃，永息兵戈。此非调停中立之言，实为根本廓清之论。土物犹爱，何况人民。是在当事诸人，有所主持，非吾辈一言所能处分者也。",
  "叶德辉笺印",
].join("\n\n");

const oldText = data.letters.find(l => l.id === LID).text;

// ═══ Remap old entities ═══
// Build a "flattened" version for searching
const flatNew = newText.replace(/\n\n/g, "");

// Build offset map: flatPos → realPos
const offsetMap = [];
let realPos = 0;
for (let fp = 0; fp < flatNew.length; fp++) {
  while (realPos < newText.length) {
    if (newText.slice(realPos, realPos + 2) === "\n\n") { realPos += 2; continue; }
    break;
  }
  offsetMap[fp] = realPos;
  realPos++;
}

function flatToReal(flatPos, length) {
  const start = offsetMap[flatPos];
  // Find end by counting non-newline chars
  let remaining = length;
  let end = start;
  while (remaining > 0 && end < newText.length) {
    if (newText.slice(end, end + 2) === "\n\n") { end += 2; continue; }
    end++;
    remaining--;
  }
  return { start, end };
}

function flatIndexOf(str, fromPos = 0) {
  return flatNew.indexOf(str, fromPos);
}

// Clear old entities and rebuild
const oldEntities = data.entitiesByLetter[LID] || [];
data.entitiesByLetter[LID] = [];
const entities = data.entitiesByLetter[LID];

function addEntity(type, surface, canonical, start, end) {
  if (entities.some(e => e.type === type && e.start === start && e.end === end && e.canonical === canonical)) return;
  entities.push({ type, surface, canonical, subtype: null, start, end });
}

function searchAndAdd(type, re, canonical) {
  let match;
  re.lastIndex = 0;
  while ((match = re.exec(newText)) !== null) {
    addEntity(type, match[0], canonical, match.index, match.index + match[0].length);
  }
}

// ═══ PER entities ═══
searchAndAdd("PER", /谭畏公/g, "谭延闿");
searchAndAdd("PER", /(?<!谭)畏公/g, "谭延闿");
searchAndAdd("PER", /孙中山先生/g, "孙逸仙");
searchAndAdd("PER", /孙中山(?!先生)/g, "孙逸仙");
searchAndAdd("PER", /(?<!孙)中山/g, "孙逸仙");
searchAndAdd("PER", /赵省长/g, "赵恒惕");
searchAndAdd("PER", /宋皋南/g, "宋鹤庚");
searchAndAdd("PER", /叶德辉/g, "叶德辉");

// 谭 and 赵 standalone in "谭、赵两君"
{
  const idx = newText.indexOf("谭、赵两君");
  if (idx >= 0) {
    addEntity("PER", "谭", "谭延闿", idx, idx + 1);
    addEntity("PER", "赵", "赵恒惕", idx + 2, idx + 3);
  }
}
// "赵" standalone in other contexts
{
  // Already handled 赵 in 谭、赵, now handle 赵省长 (already done)
  // Check for any remaining standalone 赵
  const re = /(?<!谭、)(?<!长)赵(?!省长)/g;
  // Actually, all 赵 should be covered now. Let's search for remaining:
  let match;
  while ((match = re.exec(newText)) !== null) {
    if (!entities.some(e => e.start === match.index && e.end === match.index + 1)) {
      addEntity("PER", match[0], "赵恒惕", match.index, match.index + 1);
    }
  }
}

// ═══ LOC entities ═══
searchAndAdd("LOC", /湘省/g, "湖南省");
searchAndAdd("LOC", /苏(?=、|，|。|、)/g, "江苏");  // careful matching
searchAndAdd("LOC", /(?<=、)浙(?=、)/g, "浙江");
searchAndAdd("LOC", /(?<=、)赣(?=、)/g, "江西");
searchAndAdd("LOC", /(?<=、)皖(?=、)/g, "安徽");
searchAndAdd("LOC", /(?<=、)川(?=、)/g, "四川");
searchAndAdd("LOC", /(?<=、)鄂(?=、)/g, "湖北");
searchAndAdd("LOC", /(?<=、)云(?=、)/g, "云南");
searchAndAdd("LOC", /(?<=、)贵(?=等)/g, "贵州");
searchAndAdd("LOC", /中国/g, "中国");
searchAndAdd("LOC", /湘中/g, "湘中");
searchAndAdd("LOC", /粤中/g, "广东");

// More 湘 occurrences
for (const term of ["革新湘政", "入湘", "全湘人", "全湘", "不扰湘", "此次湘乱", "湘乱"]) {
  const re = new RegExp(term, "g");
  let match;
  while ((match = re.exec(newText)) !== null) {
    const canonical = "湖南省";
    addEntity("LOC", match[0], canonical, match.index, match.index + match[0].length);
  }
}

// ═══ TIM entities ═══
searchAndAdd("TIM", /改革以来/g, "改革以来");
searchAndAdd("TIM", /省宪成立之后/g, "省宪成立之后");
searchAndAdd("TIM", /此大乱之后/g, "此大乱之后");

// ═══ OFF entities ═══
searchAndAdd("OFF", /省长/g, "省长");
searchAndAdd("OFF", /军长/g, "军长");
searchAndAdd("OFF", /师长/g, "师长");

// ═══ ORG entities ═══
searchAndAdd("ORG", /省务院/g, "省务院");
searchAndAdd("ORG", /议会/g, "议会");

// ═══ Sort ═══
entities.sort((a, b) => a.start - b.start);

// ═══ Update letter ═══
data.letters.find(l => l.id === LID).text = newText;

// Clear events/acts
data.eventsByLetter[LID] = [];
data.actsByLetter[LID] = [];

// ═══ Update catalog ═══
const catMap = new Map();
for (const [lid, ents] of Object.entries(data.entitiesByLetter)) {
  for (const ent of ents) {
    const key = ent.type + ":" + ent.canonical;
    if (!catMap.has(key)) {
      catMap.set(key, { type: ent.type, canonical: ent.canonical, aliases: [], subtypes: [], count: 0, letterIds: [] });
    }
    const entry = catMap.get(key);
    entry.count++;
    if (!entry.letterIds.includes(lid)) entry.letterIds.push(lid);
  }
}
data.entityCatalog = [...catMap.values()];

const allTypes = ["PER","LOC","BOK","VER","TIM","OFF","ORG","KIN","AST"];
for (const type of allTypes) {
  const entries = data.entityCatalog.filter(e => e.type === type);
  const allLids = new Set();
  let total = 0;
  for (const e of entries) { total += e.count; for (const lid of e.letterIds) allLids.add(lid); }
  data.entityStats[type] = { canonicalCount: entries.length, mentionCount: total, letterCount: allLids.size };
}

writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));

// Report
const final = data.entitiesByLetter[LID];
const tc = {};
final.forEach(e => { tc[e.type] = (tc[e.type] || 0) + 1; });
console.log("\n=== DONE ===");
console.log("Paragraphs:", newText.split("\n\n").length);
console.log("Types:", tc);
console.log("Total entities:", final.length);

console.log("\nPER:");
final.filter(e => e.type === "PER").sort((a,b) => a.start - b.start).forEach(e => {
  console.log("  " + e.surface + " -> " + e.canonical);
});

console.log("\nLOC:");
final.filter(e => e.type === "LOC").sort((a,b) => a.start - b.start).forEach(e => {
  console.log("  " + e.surface + " -> " + e.canonical);
});

console.log("\nTIM:");
final.filter(e => e.type === "TIM").forEach(e => {
  console.log("  " + e.surface + " -> " + e.canonical);
});
