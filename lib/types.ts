export type EntityType = "PER" | "LOC" | "BOK" | "VER" | "TIM" | "OFF" | "ORG" | "KIN" | "AST";
export type EventType = "BIB" | "ACA" | "SOC" | "POL" | "FAM";
export type ActType = "REQ" | "DSP" | "INF" | "PRS" | "MNT" | "INS" | "NEG";

export interface Letter {
  id: string;
  number: string;
  year: string | null;
  recipient: string;
  text: string;
  ganzhiDate: string | null;
  source: string | null;
}

export interface EntityMention {
  type: EntityType;
  surface: string;
  canonical: string;
  subtype: string | null;
  start: number;
  end: number;
}

export interface EventMention {
  id: string;
  type: EventType;
  subtype: string | null;
  stage: string | null;
  modes: string[];
  originalText: string;
  paraphrase: string | null;
  participants: string[];
  objects: string[];
  locations: string[];
  timeText: string | null;
  start: number;
  end: number;
}

export interface EntityCatalogEntry {
  type: EntityType;
  canonical: string;
  aliases: string[];
  subtypes: string[];
  count: number;
  letterIds: string[];
}

export interface Dataset {
  generatedAt: string;
  letters: Letter[];
  entitiesByLetter: Record<string, EntityMention[]>;
  eventsByLetter: Record<string, EventMention[]>;
  entityCatalog: EntityCatalogEntry[];
  entityStats: Record<EntityType, { canonicalCount: number; mentionCount: number; letterCount: number }>;
  eventStats: Record<EventType, { eventCount: number; letterCount: number }>;
  actStats: Record<ActType, { paragraphCount: number; letterCount: number }>;
}

export interface SearchResult {
  letter: Letter;
  snippet: string;
  matchStart: number;
  matchLength: number;
}
