import type { ActType, EntityType, EventType } from "./types";

export const featuredLetterIds = [
  "171_1913_缪荃孙",
  "063_1914_松崎鹤雄",
  "064_1914_松崎鹤雄",
  "172_1914_缪荃孙",
] as const;

export const entityTypeMeta: Record<EntityType, { label: string; prompt: string }> = {
  PER: { label: "人物", prompt: "信中出现的人物、称谓与规范人名" },
  LOC: { label: "地点", prompt: "信中出现的地名及规范地点" },
  BOK: { label: "书籍", prompt: "信中提及的书名" },
  VER: { label: "版本", prompt: "书籍的刻本、抄本与版本信息" },
  TIM: { label: "时间", prompt: "年、月、日与干支时间" },
  OFF: { label: "官职", prompt: "人物的官职与职衔" },
  ORG: { label: "机构", prompt: "政府、学校与社会机构" },
  KIN: { label: "亲属", prompt: "亲属关系与亲属称谓" },
  AST: { label: "星命", prompt: "星命与术数相关表达" },
};

export const eventTypeMeta: Record<EventType, { label: string; definition: string }> = {
  BIB: { label: "文献活动", definition: "购书、借书、索取拓片、刻印、版本评价、著书计划与撰书进展。" },
  ACA: { label: "学术活动", definition: "考证、鉴定、论学、学术史评价及著作学术贡献评价。" },
  SOC: { label: "社会交往", definition: "通信、通报近况、会晤、请托、行迹、叙旧与友朋交往。" },
  POL: { label: "政治时局", definition: "战乱议论、时局影响、国际关系与文化批判。" },
  FAM: { label: "家族事务", definition: "修谱、葬事、先君先慈、家母寿庆与家族话题。" },
};

export const actTypeMeta: Record<ActType, { label: string; definition: string }> = {
  REQ: { label: "请求", definition: "提出请求、委托或期望对方采取行动。" },
  DSP: { label: "展示", definition: "展示学识、成果、收藏或个人立场。" },
  INF: { label: "告知", definition: "向收信人传递事实、进展或近况。" },
  PRS: { label: "赞扬", definition: "表达赞许、敬重或正面评价。" },
  MNT: { label: "维系", definition: "维护关系、问候、致意或延续交往。" },
  INS: { label: "训导", definition: "提出教诲、规劝或学术指导。" },
  NEG: { label: "协商", definition: "讨论条件、安排与可协调事项。" },
};
