# Model-specific Audi Q7 / Q9 / Volvo overhead PNGs

This folder holds **one transparent 960 × 850 PNG atlas**, divided into
12 paint columns × 5 model rows. Each cell is **80 × 170 pixels**, nose-up.

Unlike the original 20 × 44 placeholder atlas, each row is derived from a
different high-detail, transparent 256 × 512 base PNG generated specifically
for that vehicle from the reference pictures supplied in the ChatGPT
conversation. The individual colours were recoloured from a single locked
base shape per model, preserving the windows, mirrors, roofline and lights.

| Row | Model | Supported named paint finishes |
| --- | --- | ---: |
| 0 | Audi Q7 SUV TFSI e | 12 |
| 1 | Audi Q9 SUV | 10 |
| 2 | Volvo XC60 | 8 |
| 3 | Volvo V60 | 8 |
| 4 | Volvo XC90 | 9 |

One atlas is downloaded and decoded; the browser crops each requested
paint once and caches it for dealership, fleet and moving MapLibre vehicles.
The existing factory paint identifiers, trim restrictions, prices, legacy
owned vehicles and XC90 Black Edition aliases are unchanged. Audi Q9's
unspecified S line exclusive colour still falls back to the original SVG.

The images are **original game illustrations**, not official manufacturer
renders or direct copies of third-party watermarked photography. Paint
colours are approximations of the catalogued finishes.

To update the artwork later, keep the model row order, existing paint column
order, and the atlas dimensions or update the matching constants in
`src/estateSuvSprites.ts` and the asset validation CI check.
