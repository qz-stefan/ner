import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const sourcePath = resolve(here, "../data/generated.json");
const subtypeBackupPath = resolve(here, "../data/generated_backup.json");
const outputPath = resolve(here, "../data/free-analysis.json");
const source = JSON.parse(await readFile(sourcePath, "utf8"));
const subtypeBackup = JSON.parse(await readFile(subtypeBackupPath, "utf8"));

const entityLabels = { PER: "人物", LOC: "地点", BOK: "书籍", VER: "版本", TIM: "时间", OFF: "官职", ORG: "机构", KIN: "亲属", AST: "星命" };
const eventLabels = { BIB: "文献活动", ACA: "学术活动", SOC: "社会交往", POL: "政治时局", FAM: "家族事务" };
const actionLabels = { AST: "陈述", DIR: "指示", EXP: "表达", COM: "承诺" };
const subtypeLabels = {
  "PER-SELF": "叶德辉本人", "PER-ADDRESSEE": "收信人", "PER-CONTEMPORARY": "同时代人", "PER-FAMILY": "叶氏家族", "PER-JAPANESE": "日本人士", "PER-HISTORICAL": "历史人物",
  URB: "城市", REG: "地区／模糊区域", ADM2: "府／州／县级", ADM1: "省／省级", ADM0: "国家", STR: "街道／具体地点", MTN: "山岳", FAC: "设施／建筑", WAT: "水体",
  "BOK-CLASSICS": "经部", "BOK-HISTORY": "史部", "BOK-THINKERS": "子部", "BOK-LITERATURE": "集部", "BOK-MODERN": "今人著作", "BOK-REFERENCE": "工具书", "BOK-ANCESTOR": "先祖著作",
  "VER-SONG": "宋本／宋刻", "VER-YUAN": "元本／元刻", "VER-MING": "明本／明刻", "VER-QING": "清本／清刻", "VER-BLOCK": "刻本／刊本", "VER-MANUSCRIPT": "抄本／稿本／写本", "VER-MOVABLE": "活字本／排印本", "VER-RUBBING": "拓本／碑帖", "VER-FACSIMILE": "影印本／石印本", "VER-QUALIFIER": "版本状态", "VER-JAPANESE": "和刻本",
  "TIM-RELATIVE": "相对时间", "TIM-ABSOLUTE": "绝对时间", "TIM-DURATION": "时段／频率", "TIM-PERIOD": "历史时期",
  "OFF-CENTRAL": "中央文官", "OFF-LOCAL": "地方官", "OFF-MILITARY": "武职", "OFF-ACADEMIC": "学官／文教", "OFF-MODERN": "民国新职", "OFF-DIPLOMATIC": "外交／涉外",
  "ORG-PUBLISH": "出版／书店", "ORG-LIBRARY": "图书馆／藏书机构", "ORG-EDUCATION": "学校／书院", "ORG-GOVERNMENT": "政府／衙门", "ORG-POLITICAL": "政党／派系", "ORG-COMPANY": "公司／银行", "ORG-STUDIO": "书斋／堂号",
  "KIN-ANCESTOR": "祖先／先世", "KIN-DESCENDANT": "子孙／后嗣", "KIN-PATERNAL": "父系／宗族", "KIN-AFFINAL": "姻亲／婚姻", "KIN-COLLECTIVE": "家族合称",
  "AST-WUXING": "五行／干支", "AST-XINGSU": "星宿／星次", "AST-MINGLI": "命理／八字", "AST-YIXUE": "易学／占卜", "AST-DIVINATION": "杂占／风水",
};

const catalog = new Map(source.entityCatalog.map((entry) => [`${entry.type}:${entry.canonical}`, entry]));
const subtypeCatalog = new Map(subtypeBackup.entityCatalog.map((entry) => [`${entry.type}:${entry.canonical}`, entry.subtypes ?? []]));
const resolveSubtypeCodes = (type, canonical, currentCodes = []) => {
  if (currentCodes.length) return currentCodes;
  return subtypeCatalog.get(`${type}:${canonical}`) ?? [];
};
const countBy = (items, keyFn) => items.reduce((acc, item) => {
  const key = keyFn(item);
  acc[key] = (acc[key] ?? 0) + 1;
  return acc;
}, {});

const letters = source.letters.map((letter) => {
  const mentions = source.entitiesByLetter[letter.id] ?? [];
  const entities = mentions.reduce((acc, mention) => {
    const type = entityLabels[mention.type];
    if (!type) return acc;
    const entry = catalog.get(`${mention.type}:${mention.canonical}`);
    const subtypeCode = mention.subtype ?? resolveSubtypeCodes(mention.type, mention.canonical, entry?.subtypes)[0] ?? "";
    const subtype = subtypeLabels[subtypeCode] ?? subtypeCode ?? "未分类";
    acc[type] ??= {};
    const current = acc[type][mention.canonical] ?? { count: 0, subtype };
    current.count += 1;
    if (!current.subtype && subtype) current.subtype = subtype;
    acc[type][mention.canonical] = current;
    return acc;
  }, {});
  const events = countBy(source.eventsByLetter[letter.id] ?? [], (event) => eventLabels[event.type] ?? event.type);
  const actions = countBy(source.actsByLetter?.[letter.id] ?? [], (act) => actionLabels[act.type] ?? act.type);
  return { id: letter.id, number: letter.number, year: letter.year, recipient: letter.recipient, entities, events, actions };
});

const entityOptions = {};
for (const [code, label] of Object.entries(entityLabels)) {
  entityOptions[label] = source.entityCatalog
    .filter((entry) => entry.type === code)
    .sort((a, b) => b.count - a.count || a.canonical.localeCompare(b.canonical, "zh-CN"))
    .slice(0, 80)
    .map((entry) => ({
      name: entry.canonical,
      count: entry.count,
      subtypes: resolveSubtypeCodes(entry.type, entry.canonical, entry.subtypes).map((value) => subtypeLabels[value] ?? value),
    }));
}

const compact = {
  generatedAt: source.generatedAt,
  sourceTotals: {
    letters: source.letters.length,
    entityMentions: Object.values(source.entitiesByLetter).flat().length,
    events: Object.values(source.eventsByLetter).flat().length,
    actions: Object.values(source.actsByLetter ?? {}).flat().length,
    canonicalEntities: source.entityCatalog.length,
  },
  events: Object.values(eventLabels),
  actions: Object.values(actionLabels),
  entityOptions,
  letters,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(compact)}\n`);
console.log(`Wrote ${outputPath} (${letters.length} letters)`);
