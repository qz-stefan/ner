import rawDataset from "@/data/generated.json";
import rawEntityAnnotations from "@/data/entity-annotations.json";
import { actTypeMeta, entityTypeMeta, eventTypeMeta, featuredLetterIds, topicDefinitions } from "./config";
import type {
  ActType,
  Dataset,
  EntityCatalogEntry,
  EntityType,
  EventMention,
  EventType,
  Letter,
  SearchMatchField,
  SearchResult,
  SearchScope,
  TopicSummary,
} from "./types";

export const dataset = rawDataset as unknown as Dataset;

const letterMap = new Map(dataset.letters.map((letter) => [letter.id, letter]));

export function normalizeLetter(letter: Letter): Letter {
  return { ...letter, text: letter.text.trim() };
}

export function normalizeEntityAnnotation(letterId: string) {
  return (dataset.entitiesByLetter[letterId] ?? []).filter((mention) => mention.start >= 0);
}

export function normalizeEventAnnotation(letterId: string) {
  return (dataset.eventsByLetter[letterId] ?? []).filter((event) => event.start >= 0);
}

export function normalizeActAnnotation(letterId: string) {
  return (dataset.actsByLetter?.[letterId] ?? []).filter((act) => act.start >= 0);
}

export function getActAnnotationsForRange(letterId: string, rangeStart: number, rangeEnd: number) {
  return normalizeActAnnotation(letterId).filter(
    (act) => act.start < rangeEnd && act.end > rangeStart,
  );
}

export function getActsByType(type: string) {
  return Object.entries(dataset.actsByLetter ?? {}).flatMap(([letterId, acts]) => {
    const letter = getLetter(letterId);
    if (!letter) return [];
    return acts.filter((act) => act.type === type).map((act) => ({ letter, act }));
  });
}

export function getLetter(id: string) {
  const letter = letterMap.get(id);
  return letter ? normalizeLetter(letter) : null;
}

export function getFeaturedLetters() {
  return featuredLetterIds.map(getLetter).filter((letter): letter is Letter => Boolean(letter));
}

export function getAllLetters() {
  return dataset.letters.map(normalizeLetter).sort((a, b) => a.number.localeCompare(b.number, "zh-CN"));
}

export function getLetterEntitySummary(letterId: string) {
  const mentions = normalizeEntityAnnotation(letterId);
  const types = [...new Set(mentions.map((mention) => mention.type))];
  return { count: mentions.length, types };
}

export function getLetterExcerpt(letter: Letter, length = 116) {
  const text = normalizeLetter(letter).text.replace(/\s+/g, " ");
  return `${text.slice(0, length)}${text.length > length ? "……" : ""}`;
}

export function formatLetterDate(letter: Letter) {
  if (letter.dateLabel) return letter.dateLabel;
  const parts = [letter.year ? `${letter.year}年` : "公历时间暂无数据", letter.ganzhiDate].filter(Boolean);
  return parts.join(" · ");
}

export const searchScopeLabels: Record<SearchScope, string> = {
  all: "全部",
  fulltext: "全文",
  recipient: "收信人",
  source: "来源",
};

/** Expand query to include entity aliases if query matches a known entity. */
function expandEntityTerms(query: string): string[] {
  const lowerQuery = query.toLocaleLowerCase("zh-CN");
  for (const entry of dataset.entityCatalog) {
    const allNames = [entry.canonical, ...entry.aliases].map((n) => n.toLocaleLowerCase("zh-CN"));
    if (allNames.includes(lowerQuery)) {
      return [...new Set([entry.canonical, ...entry.aliases])];
    }
  }
  return [query];
}

/** Check if any of the terms appear in the given field, returning the best match. */
function findBestMatch(field: string, terms: string[], queryLen: number): { idx: number; matchedTerm: string } | null {
  const lowerField = field.toLocaleLowerCase("zh-CN");
  let best: { idx: number; matchedTerm: string } | null = null;
  for (const term of terms) {
    const idx = lowerField.indexOf(term);
    if (idx >= 0 && (!best || idx < best.idx)) {
      best = { idx, matchedTerm: term };
    }
  }
  return best;
}

export function searchLetters(rawQuery: string, scope: SearchScope = "all", limit = 30): SearchResult[] {
  const query = rawQuery.trim().toLocaleLowerCase("zh-CN");
  if (!query) return [];
  const expandedTerms = scope !== "source" ? expandEntityTerms(rawQuery.trim()) : [rawQuery.trim()];
  const results: SearchResult[] = [];
  for (const letter of dataset.letters) {
    if (scope === "all") {
      // Search all fields: text, recipient, source
      const fields = [
        { label: letter.text, matchField: "fulltext" as SearchMatchField },
        { label: letter.recipient, matchField: "recipient" as SearchMatchField },
        { label: letter.source ?? "", matchField: "source" as SearchMatchField },
      ];
      let bestMatch: { rawIndex: number; matchField: SearchMatchField; field: string; matchLen: number } | null = null;
      for (const { label, matchField } of fields) {
        const searchTerms = matchField === "source" ? [rawQuery.trim()] : expandedTerms;
        const m = findBestMatch(label, searchTerms, rawQuery.trim().length);
        if (m && (!bestMatch || m.idx < bestMatch.rawIndex)) {
          bestMatch = { rawIndex: m.idx, matchField, field: label, matchLen: m.matchedTerm.length };
        }
      }
      if (!bestMatch) continue;
      const { rawIndex, matchField, field, matchLen } = bestMatch;
      const start = Math.max(0, rawIndex - 34);
      const end = Math.min(field.length, rawIndex + Math.max(matchLen, 1) + 56);
      results.push({
        letter: normalizeLetter(letter),
        snippet: `${start > 0 ? "……" : ""}${field.slice(start, end)}${end < field.length ? "……" : ""}`,
        matchStart: rawIndex,
        snippetMatchStart: rawIndex - start + (start > 0 ? 2 : 0),
        matchLength: matchLen,
        matchField,
      });
    } else {
      const field = scope === "recipient" ? letter.recipient : scope === "source" ? letter.source ?? "" : letter.text;
      const searchTerms = scope === "source" ? [rawQuery.trim()] : expandedTerms;
      const m = findBestMatch(field, searchTerms, rawQuery.trim().length);
      if (!m) continue;
      const start = scope === "fulltext" ? Math.max(0, m.idx - 34) : 0;
      const end = scope === "fulltext" ? Math.min(field.length, m.idx + Math.max(m.matchedTerm.length, 1) + 56) : field.length;
      results.push({
        letter: normalizeLetter(letter),
        snippet: `${start > 0 ? "……" : ""}${field.slice(start, end)}${end < field.length ? "……" : ""}`,
        matchStart: m.idx,
        snippetMatchStart: m.idx - start + (start > 0 ? 2 : 0),
        matchLength: m.matchedTerm.length,
        matchField: scope,
      });
    }
    if (results.length >= limit) break;
  }
  return results;
}

export function getSearchResultHref(result: SearchResult, query: string) {
  const params = new URLSearchParams({ q: query, scope: result.matchField });
  if (result.matchField === "fulltext" || (result.matchField === "all" && result.matchStart >= 0)) params.set("at", String(result.matchStart));
  return `/letter/${encodeURIComponent(result.letter.id)}?${params.toString()}`;
}

export function getEntityCategory(type: EntityType): EntityCatalogEntry[] {
  return dataset.entityCatalog.filter((entry) => entry.type === type);
}

const entityAnnotations = rawEntityAnnotations as Record<string, string>;

export function getEntity(type: EntityType, canonical: string) {
  return dataset.entityCatalog.find((entry) => entry.type === type && entry.canonical === canonical) ?? null;
}

/** Get the annotation/description for an entity, if available. */
export function getEntityAnnotation(type: EntityType, canonical: string): string | null {
  return entityAnnotations[`${type}:${canonical}`] ?? null;
}

/** The catalog's stable composite key. Surface text is intentionally excluded. */
export function getEntityKey(entity: Pick<EntityCatalogEntry, "type" | "canonical">) {
  return `${entity.type}:${entity.canonical}`;
}

export function getEntityHref(entity: Pick<EntityCatalogEntry, "type" | "canonical">) {
  return `/entity/${entity.type}/${encodeURIComponent(entity.canonical)}`;
}

export function getEntityOccurrences(entry: EntityCatalogEntry) {
  return entry.letterIds.flatMap((letterId) => {
    const letter = getLetter(letterId);
    if (!letter) return [];
    const mentions = normalizeEntityAnnotation(letterId).filter(
      (mention) => mention.type === entry.type && mention.canonical === entry.canonical,
    );
    return mentions.map((mention) => ({ letter, mention }));
  });
}

export function getEventsByType(type: EventType) {
  return Object.entries(dataset.eventsByLetter).flatMap(([letterId, events]) => {
    const letter = getLetter(letterId);
    if (!letter) return [];
    return events.filter((event) => event.type === type).map((event) => ({ letter, event }));
  });
}

export function getAllEvents() {
  return Object.entries(dataset.eventsByLetter).flatMap(([letterId, events]) => {
    const letter = getLetter(letterId);
    return letter ? events.map((event) => ({ letter, event })) : [];
  });
}

export function getTopicSummaries(): TopicSummary[] {
  const allEvents = getAllEvents();
  const eventLetters = new Set(allEvents.map(({ letter }) => letter.id)).size;
  return topicDefinitions.map((topic) => {
    if (topic.kind === "event") {
      return {
        ...topic,
        entityCount: Object.keys(eventTypeMeta).length,
        mentionCount: allEvents.length,
        letterCount: eventLetters,
        status: allEvents.length ? "available" : "organizing",
      };
    }
    const stats = topic.entityCode ? dataset.entityStats[topic.entityCode] : null;
    const available = Boolean(stats?.canonicalCount || stats?.mentionCount);
    return {
      ...topic,
      entityCount: stats?.canonicalCount ?? 0,
      mentionCount: stats?.mentionCount ?? 0,
      letterCount: stats?.letterCount ?? 0,
      status: available ? "available" : "organizing",
    };
  });
}

export function getTopicBySlug(slug: string) {
  return getTopicSummaries().find((topic) => topic.slug === slug) ?? null;
}

export function getRelatedEntities(entry: EntityCatalogEntry, limit = 12) {
  const letterIds = new Set(entry.letterIds);
  return dataset.entityCatalog
    .filter((candidate) => candidate.canonical !== entry.canonical && candidate.letterIds.some((id) => letterIds.has(id)))
    .map((candidate) => ({
      entry: candidate,
      sharedLetters: candidate.letterIds.filter((id) => letterIds.has(id)).length,
    }))
    .sort((a, b) => b.sharedLetters - a.sharedLetters || b.entry.count - a.entry.count)
    .slice(0, limit);
}

export function getRelatedEvents(entry: EntityCatalogEntry, limit = 12) {
  return entry.letterIds
    .flatMap((letterId) => {
      const letter = getLetter(letterId);
      if (!letter) return [];
      return (dataset.eventsByLetter[letterId] ?? []).map((event) => ({ letter, event }));
    })
    .slice(0, limit);
}

export function getCategoryMeta(layer: string, code: string) {
  if (layer === "entity" && code in entityTypeMeta) {
    const type = code as EntityType;
    return { layer, code: type, ...entityTypeMeta[type], stats: dataset.entityStats[type] };
  }
  if (layer === "event" && code in eventTypeMeta) {
    const type = code as EventType;
    return { layer, code: type, ...eventTypeMeta[type], stats: dataset.eventStats[type] };
  }
  if (layer === "act" && code in actTypeMeta) {
    const type = code as ActType;
    return { layer, code: type, ...actTypeMeta[type], stats: dataset.actStats[type] };
  }
  return null;
}

export function splitLetterIntoTranslationPairs(letter: Letter) {
  const events = normalizeEventAnnotation(letter.id)
    .filter((event) => event.start >= 0)
    .sort((a, b) => a.start - b.start);
  const pairs: Array<{ original: string; translation: string | null; event: EventMention | null; start: number; end: number }> = [];
  let cursor = 0;
  for (const event of events) {
    if (event.start < cursor) continue;
    if (event.start > cursor) {
      const original = letter.text.slice(cursor, event.start);
      if (original.trim()) pairs.push({ original, translation: null, event: null, start: cursor, end: event.start });
    }
    pairs.push({ original: letter.text.slice(event.start, event.end), translation: event.paraphrase, event, start: event.start, end: event.end });
    cursor = event.end;
  }
  const tail = letter.text.slice(cursor);
  if (tail.trim()) pairs.push({ original: tail, translation: null, event: null, start: cursor, end: letter.text.length });
  return pairs.length ? pairs : [{ original: letter.text, translation: null, event: null, start: 0, end: letter.text.length }];
}
