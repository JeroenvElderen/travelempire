# Q7, Q9 and Volvo top-down vehicle sprites

All five game models share one transparent PNG atlas in this folder.

Atlas dimensions: 240 × 220 pixels; 12 columns and five rows.
Every cell measures 20 × 44 pixels. Cars face upward.

Rows:
- 0: Audi Q7 SUV TFSI e (12 named finishes)
- 1: Audi Q9 SUV (10 named finishes; unspecified exclusive option falls back)
- 2: Volvo XC60 (8 factory finishes)
- 3: Volvo V60 (8 factory finishes)
- 4: Volvo XC90 (9 finishes, with saved Black Edition aliases)

The existing factory prices, trim eligibility, and purchase options remain unchanged.
Only one atlas is fetched, and cropped images are cached by selected paint.
Fallback SVGs remain available if a requested paint has no sprite.

The current small atlas is intended for the live map; the supplied full-size
generated sources can be added as higher-resolution dealership previews.