# Micronutrients plan (review only)

**Status:** Proposal + local prototype. **No merge, no deploy, no production Atlas writes.**  
Optional schema fields are additive; applying them in production still needs your approval.

## What exists today

The Food model already has **calories, protein, carbs, fat, fiber, sugar, sodium** (sugar and sodium are optional extras; fiber is defaulted to 0). FoodLog snapshots calories, macros, and **fiber**, but **not sugar or sodium**. Daily totals on the Food page sum calories, macros, and fiber only.

Catalog size on `main`: **1,750** system foods (`ensureBuiltInFoods` is insert-only).

| List | Items | Typical source (from file headers) | Micros today |
| --- | ---: | --- | --- |
| base | 525 | “USDA-style” / original built-ins | Many rows omit fiber/sugar/sodium keys entirely |
| fruits, vegetables, grains, proteins, dairy, nuts, drinks, world, etc. | ~700 | Described as USDA FoodData Central (often SR Legacy) or typical labels | fiber/sugar/sodium often present; vitamins/minerals not stored |
| chains | 351 | Chain nutrition **as reproduced on fastfoodnutrition.org** | Usually macros + fiber/sugar/sodium; not a first-party PDF set |
| pizza | 113 | Official chain PDFs, retrieved 2026-11-15 | Official macros + fiber/sugar/sodium only (guides rarely list potassium/vitamins) |
| costco, candy, packaged, supplements | smaller | Official labels / FDC / manufacturer pages | Varies; no vitamin/mineral fields |

Coverage in the current catalog (nonzero vs zero-or-null vs key absent):

- fiber: 917 nonzero, 833 zero-or-null, **521 key-absent**
- sugar: 1033 nonzero, 717 zero-or-null, **521 key-absent**
- sodium: 1180 nonzero, 570 zero-or-null, **521 key-absent**
- barcode: none of the built-ins (lookups go to Open Food Facts)
- gramsPerServing: only 132 foods (needed to scale USDA per-100 g data cleanly)

**Important data issue:** a stored `0` and a missing value are not the same, but older fields default to 0. New micronutrient fields in the prototype default to **undefined** (unknown). The UI must not show “0% DV” when the value was never verified.

## Which micronutrients to track (v1)

Track a short, high-signal set that appears on the modern Nutrition Facts label and in USDA FDC:

| Nutrient | Unit | FDA Daily Value | Why |
| --- | --- | ---: | --- |
| Dietary fiber | g | 28 | Already in the model; “get enough” |
| Total sugars | g | *(no DV)* | Already in the model. FDA DV is for **added** sugars (50 g), which we do not currently store — do not use 50 g as a %DV for total sugars |
| Sodium | mg | 2300 | Already in the model; “limit” |
| Potassium | mg | 4700 | Required on the Nutrition Facts label |
| Calcium | mg | 1300 | Required on the label |
| Iron | mg | 18 | Required on the label |
| Magnesium | mg | 420 | Common gap nutrient; in FDC |
| Vitamin A | mcg RAE | 900 | In FDC (use RAE, not IU) |
| Vitamin C | mg | 90 | In FDC |
| Vitamin D | mcg | 20 | Required on the label; use mcg (D2+D3), not IU alone |
| Vitamin B-12 | mcg | 2.4 | Important for mixed/vegetarian diets; official zero on plant foods is still a value |

FDA Daily Values are from [Daily Value on the Nutrition and Supplement Facts Labels](https://www.fda.gov/food/nutrition-facts-label/daily-value-nutrition-and-supplement-facts-labels), “Content current as of: 03/05/2024”, retrieved **2026-11-15**. These are **labeling reference amounts** for a general 2,000-calorie diet, not personalized Recommended Dietary Allowances (which vary by age, sex, pregnancy, etc.).

**Later / only with official data:** added sugars (distinct from total sugars), saturated fat, cholesterol, folate, zinc, iodine. Do not add them until a source actually provides the number.

## Data sources

1. **USDA FoodData Central** (public domain in the U.S.) — primary fill for staples already described as USDA-based. Prefer **SR Legacy** or **Foundation** foods over crowd-sourced Branded entries when mapping generic items (banana, spinach, milk). API: `https://api.nal.usda.gov/fdc/v1/food/{fdcId}`. Nutrient amounts are **per 100 g** and must be scaled only by an official gram weight (FDC portion or a `gramsPerServing` we already trust).
2. **Official chain / manufacturer PDFs and Nutrition Facts labels** — same rule as the pizza work: cite URL + retrieval date; skip anything not listed. Most chain PDFs will not support vitamins/minerals.
3. **Open Food Facts** — already used for barcode lookup (ODbL). Fine as a *user-scan* source with a visible “unverified / may be incomplete” mark. Do not silently merge OFF micros into the system catalog.
4. **Do not use** invented or “typical” values, and do not treat fastfoodnutrition.org as official for new micronutrient fields (existing chain macros stay as they are under insert-only sync).

Mapping existing catalog rows:

- **USDA-described lists:** match by name + portion to an FDC `fdcId`, store `sourceFdcId`, fill only nutrients FDC reports. If grams per serving are missing, **do not guess** a household portion — either attach an official FDC portion or leave micros empty.
- **Official pizza / Costco / labeled packaged foods:** copy only nutrients printed on the official source; leave the rest unknown.
- **FFN chain items and “USDA-style” rows without an fdcId:** leave new fields empty until a first-party or FDC match is confirmed.
- **Insert-only `ensureBuiltInFoods` will not update foods that already exist.** Filling micros on the current 1,750 production rows needs an **approved, explicit update path** (still no silent overwrites of calories/macros). Flag this; do not run it against Atlas in this prototype.

## Schema change (needs approval)

Additive, optional fields only. **Not run against production in this work.**

- **Food:** `potassium`, `calcium`, `iron`, `magnesium`, `vitaminA`, `vitaminC`, `vitaminD`, `vitaminB12` (units as above), plus optional `sourceFdcId`. `undefined` = unknown.
- **FoodLog:** snapshot those fields **and** `sugar` / `sodium` at log time (a gap today: changing a food later should not rewrite history). Flex/holiday estimates still have no micros.

No collection drop, no required fields, no backfill required for the app to boot. A production deploy of the code alone would not invent values; new fields would simply be empty until an approved data update.

## UI

- Food page: a **Micronutrients** block under the macro bars.
- For each nutrient: amount, **% Daily Value** when a DV exists, and **coverage** (`3/5 foods` had a verified number).
- If nothing is verified, hide the block (or show a short “no verified micronutrient data today”).
- **Never display unknown as 0.** Official zeros (e.g. vitamin B-12 in banana) may show 0% DV.
- Total sugars: show grams only, with a note that FDA’s 50 g DV is for added sugars.
- Copy: this is a **labeling reference**, not medical advice and not a personal RDA.
- Later: optional personal DRI targets using age/sex already on the profile — only from a cited DRI table, and only after you want that complexity.

## Prototype included on this branch (local / test only)

- Optional fields on the models (additive).
- `server/services/micronutrients.js` — FDA DVs, scaling, day totals with coverage.
- `scripts/import-fdc.js` — FDC JSON or API → Food shape. **Does not connect to MongoDB.**
- Official slim fixtures: FDC `173944` bananas, `168462` spinach, `173441` 1% milk (retrieved 2026-11-15).
- Food page renderer for `totals.micros`.
- Tests and a 390×844 sample preview using those three official portions (1 medium banana 118 g, 1 cup spinach 30 g, 1 cup 1% milk 244 g).

## Decisions needed from you

1. Approve (or defer) the **additive schema fields** on Food and FoodLog?
2. Is **FDA %DV** the right first target, with personal RDAs later?
3. May we later add an **approved, insert-or-update-by-fdcId** job to attach micros to existing USDA-described foods (still no invented numbers, still no silent macro edits)?
4. Should the micronutrient **dashboard** be a Plus/paid feature while calories/macros stay free? (See `docs/paid-free-draft.md`.)
5. Confirm: **do not merge or deploy** this prototype until you have reviewed it.

