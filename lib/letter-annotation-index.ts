import {
  normalizeActAnnotation,
  normalizeEntityAnnotation,
  normalizeEventAnnotation,
} from "./data-adapter";
import type { ActType, EntityType, EventType } from "./types";

export interface LetterEntityIndexItem {
  canonical: string;
  mentionCount: number;
  firstStart: number;
}

export interface LetterEntityIndexGroup {
  type: EntityType;
  canonicalCount: number;
  mentionCount: number;
  entities: LetterEntityIndexItem[];
}

export interface LetterEventIndexGroup {
  type: EventType;
  count: number;
}

export interface LetterActSubtypeItem {
  label: string;
  count: number;
}

export interface LetterActIndexGroup {
  type: ActType;
  count: number;
  subtypes: LetterActSubtypeItem[];
}

export interface LetterAnnotationIndexData {
  entities: {
    canonicalCount: number;
    mentionCount: number;
    groups: LetterEntityIndexGroup[];
  };
  events: {
    count: number;
    groups: LetterEventIndexGroup[];
  };
  acts: {
    count: number;
    groups: LetterActIndexGroup[];
  };
}

const ENTITY_ORDER: EntityType[] = ["PER", "LOC", "BOK", "VER", "TIM", "OFF", "ORG", "KIN", "AST"];
const EVENT_ORDER: EventType[] = ["BIB", "ACA", "SOC", "POL", "FAM"];
const ACT_ORDER: ActType[] = ["AST", "DIR", "EXP", "COM"];

export function buildLetterAnnotationIndex(letterId: string): LetterAnnotationIndexData {
  const mentions = normalizeEntityAnnotation(letterId);
  const events = normalizeEventAnnotation(letterId);
  const acts = normalizeActAnnotation(letterId);

  const entityGroups = ENTITY_ORDER.flatMap((type) => {
    const typedMentions = mentions.filter((mention) => mention.type === type);
    if (!typedMentions.length) return [];

    const entityMap = new Map<string, LetterEntityIndexItem>();
    for (const mention of typedMentions) {
      const canonical = mention.canonical.trim() || mention.surface.trim() || "未规范实体";
      const current = entityMap.get(canonical);
      if (current) {
        current.mentionCount += 1;
        current.firstStart = Math.min(current.firstStart, mention.start);
      } else {
        entityMap.set(canonical, {
          canonical,
          mentionCount: 1,
          firstStart: mention.start,
        });
      }
    }

    const entities = [...entityMap.values()].sort(
      (a, b) => b.mentionCount - a.mentionCount || a.firstStart - b.firstStart,
    );

    return [{
      type,
      canonicalCount: entities.length,
      mentionCount: typedMentions.length,
      entities,
    }];
  });

  const eventGroups = EVENT_ORDER.flatMap((type) => {
    const count = events.filter((event) => event.type === type).length;
    return count ? [{ type, count }] : [];
  });

  const actGroups = ACT_ORDER.flatMap((type) => {
    const typedActs = acts.filter((act) => act.type === type);
    if (!typedActs.length) return [];

    const subtypeCounts = new Map<string, number>();
    for (const act of typedActs) {
      const label = act.subtype?.trim();
      if (!label) continue;
      subtypeCounts.set(label, (subtypeCounts.get(label) ?? 0) + 1);
    }

    const subtypes = [...subtypeCounts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "zh-CN"));

    return [{ type, count: typedActs.length, subtypes }];
  });

  return {
    entities: {
      canonicalCount: entityGroups.reduce((sum, group) => sum + group.canonicalCount, 0),
      mentionCount: mentions.length,
      groups: entityGroups,
    },
    events: {
      count: events.length,
      groups: eventGroups,
    },
    acts: {
      count: acts.length,
      groups: actGroups,
    },
  };
}
