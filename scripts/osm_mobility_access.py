"""Conservative Greek OSM foot/bicycle access and direction decisions.

No paths are invented at crossings. Separate sidewalks are imported as
OSM footways; sidewalk=* on motor roads is not duplicated geometrically.
For shared-road continuity only suitable, non-motorway local roads are reused
in a separate on-demand walking/cycling tile set.
"""
from __future__ import annotations

from dataclasses import dataclass

ALLOW = {"yes", "designated", "permissive", "official"}
DENY = {"no", "private", "agricultural", "forestry", "delivery"}
PATHS = {"footway", "pedestrian", "path", "cycleway", "steps", "bridleway"}
SHARED = {"residential", "living_street", "service", "unclassified", "track", "road"}
EXPLICIT_SHARED = {"tertiary", "tertiary_link", "secondary", "secondary_link", "primary", "primary_link"}
NO_ACCESS = {"motorway", "motorway_link", "trunk", "trunk_link", "proposed", "construction"}


@dataclass(frozen=True)
class MobilityAccess:
    walk: bool
    cycle: bool
    walk_direction: int = 0
    cycle_direction: int = 0


def allowed_direction(tags: dict[str,str], mode: str) -> int:
    """0=both, 1=forward, -1=reverse; cycling respects oneway exceptions."""
    if mode == "walking":
        raw = tags.get("oneway:foot", "no").lower()
    else:
        raw = tags.get("oneway:bicycle", tags.get("oneway", "no")).lower()
        opposite = tags.get("cycleway", "").lower().startswith("opposite")
        if "oneway:bicycle" not in tags and opposite:
            raw = "no"
    if raw in {"yes", "true", "1"}:
        return 1
    if raw in {"-1", "reverse"}:
        return -1
    return 0


def granted(tags: dict[str,str], specific: str, parent: str) -> bool:
    value = tags.get(specific, "").lower()
    if value in DENY or value in {"dismount", "use_sidepath"}:
        return False
    if value in ALLOW:
        return True
    # Explicit generic restriction applies unless explicitly overridden.
    generic = tags.get(parent, tags.get("access", "")).lower()
    return generic not in DENY


def classify(tags: dict[str,str]) -> MobilityAccess:
    highway = tags.get("highway", "").lower()
    if tags.get("area") == "yes" or highway in NO_ACCESS or (highway not in PATHS | SHARED | EXPLICIT_SHARED):
        return MobilityAccess(False, False)
    if any(key in tags for key in ("foot:conditional","bicycle:conditional","access:conditional")):
        # Do not incorrectly treat restricted time windows as permanent access.
        return MobilityAccess(False, False)
    if highway in {"steps", "footway", "pedestrian", "cycleway", "path", "bridleway"}:
        walk_default = highway in {"steps", "footway", "pedestrian", "path", "bridleway"}
        # Cycleway foot access is jurisdiction-dependent: explicit foot=yes only.
        cycle_default = highway in {"cycleway"}
        # Unspecified generic paths/bridleways are deliberately treated as walking
        # until explicitly allowed for cycling, avoiding riding in protected areas.
    else:
        walk_default = highway in SHARED or tags.get("sidewalk") in {"yes", "both", "left", "right", "separate"}
        cycle_default = highway in SHARED
        if highway in EXPLICIT_SHARED:
            walk_default = walk_default or tags.get("foot", "").lower() in ALLOW
            cycle_default = tags.get("bicycle", "").lower() in ALLOW or tags.get("cycleway") in {"lane", "track", "both", "shared_lane"}
    foot_tag = tags.get("foot", "").lower()
    bicycle_tag = tags.get("bicycle", "").lower()
    walk = (walk_default or foot_tag in ALLOW) and granted(tags, "foot", "access")
    cycle = (cycle_default or bicycle_tag in ALLOW) and granted(tags, "bicycle", "vehicle")
    if highway == "steps":
        cycle = False
    if highway == "footway" and bicycle_tag not in ALLOW:
        cycle = False
    if highway == "pedestrian" and bicycle_tag not in ALLOW:
        cycle = False
    if highway == "path" and bicycle_tag not in ALLOW:
        cycle = False
    if highway == "bridleway" and bicycle_tag not in ALLOW:
        cycle = False
    if highway == "cycleway" and foot_tag not in ALLOW:
        walk = False
    if tags.get("motorroad") == "yes":
        walk = False
        cycle = False
    return MobilityAccess(
        walk=walk, cycle=cycle,
        walk_direction=allowed_direction(tags,"walking") if walk else 0,
        cycle_direction=allowed_direction(tags,"cycling") if cycle else 0,
    )
