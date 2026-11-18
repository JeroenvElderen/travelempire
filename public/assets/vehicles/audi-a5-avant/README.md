# Audi A5 Avant colour sprites

Transparent PNG game sprites for the Audi A5 Avant e-hybrid (2027)
in the dealership, purchased fleet and live taxi map.

All nine source variants were derived from the same user-supplied top-down
vehicle artwork. The car is centred consistently and **faces north/up** at
zero map rotation. This art is generated for the game; it is **not Audi's
official product photography or a colour-accurate manufacturer paint sample**.

## Format

- Nine individual PNGs: **80 × 170 pixels**, alpha transparency.
- Single one-row thumbnail atlas: **720 × 170 pixels**, nine 80px cells.
- Atlas order: Arkona White, Glacier White Metallic, Mythos Black Metallic,
  Firmament Blue Metallic, Floret Silver Metallic, Plateau Grey Metallic,
  Horizon Blue Metallic, Grenadine Red Metallic, Daytona Grey Pearl Effect.
- Saved paint IDs are the existing `audi-a5-paint-0` to `paint-9`, excluding
  `paint-8` (Ascari Blue); see `src/audiA5Sprites.ts`.

## How it works

1. The dealership's A5 Avant e-hybrid paint buttons display this atlas.
2. Selecting a paint automatically previews its matching individual PNG.
3. The purchased Taxi retains its existing paint option ID and HEX value.
4. Both the fleet listing and MapLibre taxi marker display the matching PNG.
5. All other vehicles, A5 Limousine and unsupported Audi exclusive/custom paints
   continue using their previous SVG icons; no new save fields or migration.

When adding new paint sprites, put them on the same **80 × 170 transparent
canvas** with the vehicle facing up, then update the manifest and atlas.
