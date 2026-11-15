# Fitness Coach — paid vs. free draft

**Status:** Review only. No payment system, entitlements, merge, or deploy is included in this draft.  
**Based on:** the current app at `main` (215354f, live 15 Nov 2026), inspected in the repo.  
**Competitor prices:** fetched from official pages on **15 Nov 2026** (US dollar list prices; tax and regional prices may differ).

---

## What the app already does (all currently free)

Fitness Coach is already a combined **food + training + body + social/family** product. There is no subscription, no ads, and no feature flags. Today every signed-in user (who meets the age/account rules) can use:

**Food & nutrition**
- Daily food diary by meal, calorie remaining, and macro targets (protein / carbs / fat) from the built-in recommendation engine (weight history + profile)
- Built-in catalog of **1,750** system foods (USDA-style staples, packaged foods, 351 chain items, 113 official pizza rows, Costco, candy, etc.) plus custom foods
- Search, favorites, recents, recipes (private + public), barcode lookup (Open Food Facts), serving units including g/oz
- Copy from yesterday (per meal or whole day)
- Flex / holiday meal estimates (does not break the streak)
- Manual calorie entries

**Training**
- Workout logging with inline set weights/reps, rest timers, set types, draft autosave
- Exercise library including the machine catalog and a Machine filter
- Saved routines, suggested programs (activity + days/week filters, inspired programs, progression notes)
- Sport / practice sessions (duration × effort; counts toward streak and estimated active calories)
- Training-day streak with planned rest days and limited unplanned skips

**Body & goals**
- Weight log and history
- Body metrics (including circumferences) and progress photos
- Goals: lose / gain / maintain, optional macro targets

**Home / diary**
- Dashboard: today’s intake vs targets, activity (logged or imported health data), streak, flex-day summary, active routine, calendar

**People & family**
- Find people, comments, granular read-only share access (weight, workouts, food, body, goals)
- Family (parent ↔ teen) links, with privacy-preserving pending requests and an under-13 account lock

**Settings & platform**
- Themes, units, training schedule, flex-day caps, privacy, on-device reminders
- Connected health data (Health Connect now; HealthKit noted as later)
- Web app, hosted on Render; not a native App Store / Play app yet

Micronutrients beyond fiber / sugar / sodium are **not** in the live product. A prototype (optional fields, USDA import, Food-page %DV view) is proposed separately, review-only.

---

## Suggested tiers

Keep a **real, ongoing Free plan**. Do not copy MacroFactor’s “trial then paid-only” model — this user already has a full free app, and taking core logging away would be a trust break.

### Free — “Log the basics, forever”

Everything that already exists for daily use should stay free:

- Food diary, calorie and **macro** tracking, copy-from-yesterday, barcode, recipes, custom foods
- Workout logging, exercise library (including machines), at least a handful of saved routines, suggested programs
- Weight, body metrics, progress photos, goals
- Streak + flex/holiday estimates
- One or two share links, family linking
- Health import and reminders

Rationale: this is the Strong / Hevy / Cronometer Basic pattern — a genuinely useful free app — and it matches how people already use Fitness Coach. Paid then pays for **depth**, not for the right to log.

A reasonable, *new* free-tier cap (apply only to new extras, or with generous grandfathering) could be: a limit on saved routines (Strong’s free plan is limited to 3 custom routines; Hevy’s to 4 routines and 7 custom exercises). Only consider this if routine storage becomes a cost or complexity problem. Do not add a cap to users who already have more routines than the cap.

### Plus — “Deeper nutrition & insights” (recommended first paid tier)

New or clearly advanced features, not a lock on today’s diary:

- Micronutrient dashboard (daily totals vs FDA Daily Value, coverage “n of m foods had data,” later optional personal DRI)
- Longer-range nutrition and weight reports / export (CSV)
- Richer food insights (top sources of a nutrient, once the data exists)
- Photo or voice logging, if added later
- More share seats / coach access, or family extras

This is closest to **Cronometer Gold** (convenience + deeper insight on top of a generous free tracker) and parts of **MyFitnessPal Premium** (custom insights, extra logging tools). It is the most natural paid unlock once micronutrients ship.

### Pro (optional, later) — “Training analytics + everything in Plus”

Only if workout analytics grow enough to stand alone:

- Full history charts, volume / estimated 1RM, muscle-group reports
- Unlimited routines and custom exercises (if Free is capped)
- Advanced program / progression tools

This is the Strong PRO / Hevy Pro shape. It can wait; Plus alone is enough to start.

---

## Rough pricing (US), compared with verified competitors

| Product | Official source (retrieved 15 Nov 2026) | Free tier? | Listed US price |
| --- | --- | --- | --- |
| MyFitnessPal Premium | [myfitnesspal.com/premium](https://www.myfitnesspal.com/premium) | Yes | **$19.99/month** or **$79.99/year** |
| MacroFactor | [macrofactor.com/workouts/price](https://macrofactor.com/workouts/price/) (page states the same prices for MacroFactor or MacroFactor Workouts); also listed on the [US App Store](https://apps.apple.com/us/app/macrofactor-macro-tracker/id1553503471) | No (trial, then subscription) | **$11.99/month**, **$47.99/6 months**, or **$71.99/year** |
| Cronometer Gold | [cronometer.com/gold](https://cronometer.com/gold/) | Yes (Basic is free, including extensive nutrient tracking) | **$10.99/month**, or **$59.99/year** (shown as $4.99/month billed annually) |
| Strong PRO | [US App Store listing](https://apps.apple.com/us/app/strong-workout-tracker-gym-log/id464254577) | Yes (unlimited workouts, **3 custom routines**) | Listing copy: **$4.99/month** or **$29.99/year**. The same listing also shows other IAPs (e.g. 6 months $19.99; “PRO Forever” at both $79.99 and $99.99). Treat the in-app purchase screen as authoritative at checkout. |
| Hevy Pro | [US App Store listing](https://apps.apple.com/us/app/hevy-workout-tracker-gym-log/id1458862350) | Yes (helpful free app; Pro adds unlimited routines, full history, Trainer, etc.) | **Hevy Pro — Monthly $2.99**, **Yearly $23.99**, **Lifetime $74.99** |

**Suggested Fitness Coach Plus list price (draft, not a decision):**

- **$5.99 / month**, or **$49.99 / year** (~$4.17/month)

That sits between workout-app Pro (Hevy $2.99 / $23.99, Strong $4.99 / $29.99) and nutrition-app Gold/Premium (Cronometer $10.99 / $59.99, MacroFactor $11.99 / $71.99, MyFitnessPal $19.99 / $79.99). The product is a hybrid, so a mid price is easier to justify than MFP’s $80/year, and a year of Plus stays cheaper than Cronometer Gold while leaving room to add a later Pro if training analytics grow.

Do **not** launch a lifetime SKU at the same time. Hevy ($74.99) and Strong ( Forever SKUs on the listing) show why lifetime is popular — and why it is hard to unwind if costs or pricing change.

A 7-day Plus trial is in line with MacroFactor and MyFitnessPal; Cronometer Gold’s official Gold page did not advertise a trial on the date checked.

---

## Rationale (short)

1. **Pay for new depth, not for today’s diary.** Users already log food, workouts, weight, and family shares for free. Moving those to a paywall later is the hardest change to walk back.
2. **Micronutrients are the cleanest first Plus feature** — they are valuable, not required for basic logging, and competitors (especially Cronometer) already train people to expect them as a “serious tracker” feature. Cronometer still includes a large nutrient set on Basic, so Fitness Coach should keep calories + macros free and put the *dashboard, %DV/RDA, and coverage insights* in Plus, not the right to log a food.
3. **Price under the nutrition specialists, slightly above the cheapest workout logs.** The app is more than a gym logger and less mature than MFP/MacroFactor. $49.99/year is a clear “serious hobby” price without looking like MFP Premium.
4. **Keep Free good enough that unpaid users stay.** That is how Strong and Hevy grew; it also fits a personal app that already has family and teen rules.

---

## Irreversible or hard-to-change choices (flag these before building billing)

**Product**
- **Moving a free feature to paid later** is the most damaging option. If in doubt, leave it free and put only new capabilities in Plus.
- **Grandfathering.** If you ever cap routines, shares, or history, decide now whether existing free users are exempt.
- **Lifetime purchases.** Easy to sell, hard to support a decade later, and messy if you later add family plans or change tiers.
- **What “macros stay free, micros are Plus” means in the UI.** Fiber, sugar, and sodium already exist on foods. Do not hide numbers people can already see; Plus should add the *dashboard / %DV / trends*.

**Platform and money**
- **App Store / Google Play in-app purchases.** If you ship iOS or Android, digital subscriptions generally **must** use store IAP (Apple typically takes 15–30%). A web-only Stripe subscription that unlocks the same features in a sideloaded or store app can get an app rejected. Decide the billing path *before* the first native store listing. This is hard to redo.
- **Account-based vs. Apple/Google subscription.** People will expect one login to work on the web and on a future app. Plan receipt mapping and “restore purchase” early.
- **Price changes** on auto-renewing subscriptions require store rules, notice, and often new SKUs. Starting too cheap is easier than starting too high, but not free to fix.
- **Family or coach plans** (one payer, several accounts) collide with teen/parent linking and with store “family sharing” rules. Hevy’s help center says Pro is a single-user purchase. Decide this before selling the first family-adjacent SKU.
- **Tax, VAT, and auto-renew cancellation** (web vs. store) need real legal/copy work; do not improvise in Settings.

**Data and legal**
- **Health-adjacent claims.** A micronutrient %DV view is fine as a labeling reference; implying medical advice or personalized RDAs without careful copy is harder to unwind.
- **Under-13 / teen billing.** The app already locks under-13 accounts and has family links. Paid features for minors need a clear, lawful path (almost certainly: an adult pays, and some features stay off).
- **Adding paid entitlements to the User/Settings schema** is straightforward; **tying historical logs to a lapsed subscription** (e.g. hiding old food data) is not. Keep history readable on Free if they cancel.

**Hosting vs. user price**
- Render service cost is a separate issue from what end users pay. Do not set Plus pricing only to cover today’s hosting bill.

---

## Decisions needed from you

1. Are you comfortable with **Free staying as capable as it is today**, with Plus limited to new/deeper features (starting with micronutrients)?
2. Is **$5.99/month or $49.99/year** a reasonable starting list price, or do you want closer to Hevy ($23.99/year) or Cronometer ($59.99/year)?
3. One paid tier (Plus) now, or Plus + Pro from the start?
4. Any **lifetime** option, or hold off?
5. Is the first store target **web only** (e.g. Stripe), or should we plan **Apple/Google IAP** from day one because a native app is coming?
6. Should family/coach accounts ever share one subscription?
7. Confirm we **will not move existing features** (barcode, copy-yesterday, flex days, suggested programs, basic sharing) behind a paywall.

