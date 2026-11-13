"""Conservative OpenStreetMap motor-vehicle access rules for TravelEmpire.

Only explicitly licensed taxi or public-service-vehicle exemptions to otherwise
restricted roads become taxi-only. A bus=yes tag alone never grants taxi access.
Do not infer connections between different OSM node IDs.
"""
from __future__ import annotations

HIGHWAYS = {
    "motorway", "motorway_link", "trunk", "trunk_link",
    "primary", "primary_link", "secondary", "secondary_link",
    "tertiary", "tertiary_link", "unclassified", "residential",
    "living_street", "service", "road", "track",
}
GRANTED = {"yes", "designated", "permissive"}
RESTRICTED = {"no", "private"}
ACCESS_PARENTS = ("access", "vehicle", "motor_vehicle", "motorcar")


def taxi_permission(tags: dict[str, str]) -> str | None:
    """The most specific specified permission wins (taxi > psv > parents).

    Return None when no access tag is present. An explicit taxi=no vetoes an
    otherwise positive psv tag. Conditional access requires manual review.
    """
    for key in ("taxi", "psv", "motorcar", "motor_vehicle", "vehicle", "access"):
        value = tags.get(key)
        if value is not None:
            return value.lower().strip()
    return None


def taxi_access_exception(tags: dict[str, str]) -> bool:
    """Does this *motor road* need restoring as a taxi/PSV-only corridor?

    Includes access=no + taxi=yes and vehicle=private + psv=designated.
    Excludes bus-only, explicitly taxi-prohibited, and conditional permissions.
    """
    if tags.get("highway") not in HIGHWAYS or tags.get("area") == "yes":
        return False
    if any(key in tags for key in (
        "taxi:conditional", "psv:conditional", "access:conditional",
        "vehicle:conditional", "motor_vehicle:conditional",
        "motorcar:conditional",
    )):
        return False
    restricted_parent = any(tags.get(key, "").lower().strip() in RESTRICTED for key in ACCESS_PARENTS)
    if not restricted_parent:
        return False
    taxi = tags.get("taxi", "").lower().strip()
    psv = tags.get("psv", "").lower().strip()
    if taxi:
        return taxi in GRANTED
    return psv in GRANTED


def taxi_oneway(tags: dict[str, str]) -> int:
    """Preserve OSM driving direction, honoring taxi/PSV-only exceptions."""
    value = (tags.get("oneway:taxi") or tags.get("oneway:psv")
             or tags.get("oneway", "")).lower().strip()
    if value in ("-1", "reverse"):
        return -1
    if value in ("yes", "true", "1"):
        return 1
    if value in ("no", "false", "0"):
        return 0
    return 1 if tags.get("junction") == "roundabout" else 0


def vertical_metadata(tags: dict[str, str]) -> dict:
    fields = {}
    try:
        layer = int(tags.get("layer", "0"))
        if layer:
            fields["layer"] = layer
    except ValueError:
        pass
    try:
        level = float(tags.get("level", ""))
        import math
        if math.isfinite(level):
            fields["level"] = level
    except ValueError:
        pass
    for key in ("bridge", "tunnel"):
        if tags.get(key, "no").lower() not in ("no", "false", "0"):
            fields[key] = True
    return fields
