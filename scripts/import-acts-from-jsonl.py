"""
Import act annotations from JSONL files into generated.json.

Reads all 306 .acts.jsonl files from the third-layer annotation directory
and replaces actsByLetter + actStats in generated.json with the correct data.
"""

import json
import os
import sys
from collections import defaultdict

JSONL_DIR = "/Users/tempom/Desktop/ye_NER/NER/NER_tihrd/第三层行动与第二层联动全量初标_v1.3.2_306封"
GENERATED_PATH = "/Users/tempom/Desktop/ye_NER/ye-annotation-site/data/generated.json"


def load_jsonl_files(jsonl_dir: str) -> dict[str, list[dict]]:
    """Load all .acts.jsonl files, return {letter_id: [act_records]}."""
    acts_by_letter: dict[str, list[dict]] = {}
    file_count = 0
    act_count = 0

    for fname in sorted(os.listdir(jsonl_dir)):
        if not fname.endswith(".acts.jsonl"):
            continue
        file_count += 1
        filepath = os.path.join(jsonl_dir, fname)
        with open(filepath, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                record = json.loads(line)
                if record.get("record_type") != "act":
                    continue
                lid = record["letter_id"]
                if lid not in acts_by_letter:
                    acts_by_letter[lid] = []
                acts_by_letter[lid].append(record)
                act_count += 1

    print(f"Loaded {act_count} acts from {file_count} JSONL files")
    return acts_by_letter


def convert_to_act_mention(record: dict) -> dict:
    """Convert a JSONL act record to the ActMention format used by the app."""
    text_span = record.get("text_span", [0, 0])
    event_links_raw = record.get("event_links") or []

    return {
        "id": record["act_id"],
        "letterId": record["letter_id"],
        "type": record["act_type"],
        "subtype": record.get("act_subtype"),
        "start": text_span[0] if text_span else 0,
        "end": text_span[1] if len(text_span) > 1 else text_span[0] if text_span else 0,
        "originalText": record.get("original_text", ""),
        "headText": record.get("head_text"),
        "speaker": record.get("speaker") or [],
        "addressee": record.get("addressee") or [],
        "orientation": record.get("primary_orientation"),
        "contentDomains": record.get("content_domains") or [],
        "eventLinks": [
            {
                "eventId": el.get("event_mention_id", ""),
                "relation": el.get("relation_type", ""),
                "confidence": el.get("link_confidence", ""),
                "evidenceSpan": el.get("link_evidence_span"),
                "uncertaintyNote": el.get("link_uncertainty_note"),
            }
            for el in event_links_raw
        ],
        "eventLinkStatus": record.get("event_link_status"),
        "annotationStatus": record.get("annotation_status", "draft"),
        "actGroupId": record.get("act_group_id"),
        "actGroupType": record.get("act_group_type"),
        "actGroupLabel": record.get("act_group_label"),
        "contextSpan": record.get("context_span"),
        "quoteSpan": record.get("quote_span"),
        "quoteType": record.get("quote_type"),
        "orientationSubtype": record.get("orientation_subtype"),
        "orientationEvidence": record.get("orientation_evidence"),
        "contentDomainEvidence": record.get("content_domain_evidence"),
        "entityLinks": record.get("entity_links") or [],
        "noEventReason": record.get("no_event_reason"),
    }


def build_act_stats(
    acts_by_letter: dict[str, list[dict]],
) -> dict[str, dict[str, int]]:
    """Compute actStats from imported data."""
    type_counts: dict[str, int] = defaultdict(int)
    type_letters: dict[str, set[str]] = defaultdict(set)

    for lid, acts in acts_by_letter.items():
        for act in acts:
            t = act["type"]
            type_counts[t] += 1
            type_letters[t].add(lid)

    return {
        t: {"paragraphCount": type_counts[t], "letterCount": len(type_letters[t])}
        for t in sorted(type_counts.keys())
    }


def main() -> None:
    # Load JSONL data
    print("Loading JSONL act data...")
    new_acts = load_jsonl_files(JSONL_DIR)

    # Convert to ActMention format
    print("Converting to ActMention format...")
    converted: dict[str, list[dict]] = {}
    for lid, records in new_acts.items():
        converted[lid] = [convert_to_act_mention(r) for r in records]

    # Sort acts within each letter by start position
    for acts in converted.values():
        acts.sort(key=lambda a: a["start"])

    # Build stats
    new_stats = build_act_stats(converted)
    print(f"New actStats: {json.dumps(new_stats, ensure_ascii=False)}")

    # Load generated.json
    print(f"Loading {GENERATED_PATH}...")
    with open(GENERATED_PATH, encoding="utf-8") as fh:
        dataset = json.load(fh)

    # Replace acts data
    dataset["actsByLetter"] = converted
    dataset["actStats"] = new_stats

    # Write back
    print(f"Writing updated {GENERATED_PATH}...")
    with open(GENERATED_PATH, "w", encoding="utf-8") as fh:
        json.dump(dataset, fh, ensure_ascii=False)

    print("Done.")


if __name__ == "__main__":
    main()
