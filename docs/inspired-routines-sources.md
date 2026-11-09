# Inspired routines — public sources (preview research)

Not affiliated with or endorsed by any named coach. Routines are original Fitness Coach plans. We cite publicly shared principles only; no invented quotes, no paid-program tables.

| Coach / origin | App routines (ids) | Supported public principles (paraphrase) | Sources | App design decisions (ours, not theirs) |
| --- | --- | --- | --- | --- |
| **Jim Wendler** (5/3/1 BBB method origin) | `steady_strength_4day` | Main lift + higher-rep BBB-style volume; long-term overload with a training max; planned lighter recovery weeks in the public method. | https://www.jimwendler.com/blogs/jimwendler-com/101077382-boring-but-big · Tiger Fitness discussion (Lobliner byline) of the same Wendler method: https://tigerfitness.com/blogs/training/the-complete-5-3-1-bbb-program-guide-the-ultimate-blueprint-for-strength-size-and-simplicity | **5/3/1 BBB is Wendler-associated, not a Lobliner-created method.** Tiger Fitness hosting/byline ≠ authorship of the method. No % tables shipped. Cycle/deload text is static advisory only. |
| **Marc Lobliner** (verified bylines) | `compound_ladder_3day`; also cited on `steady_strength_4day` for overload only | Progressive overload (load/reps/volume/related variables) is the main driver of gains; favor compounds with controlled form (TUT article). VPO-10: finish planned sets×reps before adding load; miss → repeat weight (VPO-10 article). | https://tigerfitness.com/blogs/training/time-under-tension-bad · https://tigerfitness.com/blogs/workouts/vpo-10-training-muscle-growth | Original templates. No VPO 10×5 tables. Lobliner is **not** credited as creator of 5/3/1 BBB. |
| Judd Lienhard | `athlete_mass_3day` (visible name: **Athlete Strength Builder**), `frequent_stimulus_5day` | About page: MASS acronym = Movement, Athleticism, Strength, Speed. Public Playbook blurb: two areas per session (primary hard / minor stimulus); short sessions. | https://www.juddlienhard.com/about · https://my.playbookapp.io/judd-lienhard/programs/mass-method-hypertrophy/25368 | Visible name avoids looking like an official MASS product (stable id unchanged). Substack paywalled beyond lede — **no detailed rules from it**. |
| Jeff Cavaliere | `athletic_compound_4day` | Compounds + progressive overload (load, volume, density); multi-plane / corrective work; form over ego load; recovery. | https://learn.athleanx.com/articles/how-to-get-stronger | Original 4-day layout. Not an ATHLEAN-X template. |
| Sean Nalewanyj | `effort_physique_3day` | Prefer concrete effort (RPE / RIR); ~RPE 8–9 (1–2 RIR) as a common working zone; constant failure not required. | https://www.seannal.com/articles/training/general/rpe-scale.php | Original 3-day full-body. RIR user-applied. |
| Mike Israetel (RP) | `size_wave_4day` | Progress load, RIR, and weekly sets within recoverability; wave then deload; small load bumps; volume matters. | https://rpstrength.com/blogs/articles/progressing-for-hypertrophy | Wave/deload advisory only — not auto-mesocycle. |
| Jeremy Ethier (Built With Science) | `double_progress_2day` | Multiple overload levers; double progression (reps in a range, then add weight). | https://builtwithscience.com/fitness-tips/progressive-overload-techniques/ | Aligns with existing `suggestNext`. |

## Auto vs advisory (UI)

- **Automated:** logged-set double progression next-load tip only.
- **Advisory:** cycle bumps, deload weeks, RIR waves, ladder “finish before adding” framing, rest/ROM notes.
- If advisory conflicts with the session tip, UI instructs following the logged tip for that session.

## Teen safety

- Teens get `effortTeen` plus **sanitization of all progression panel fields** (max/failure/AMRAP/1RM-style wording softened or dropped).
- Source links remain; adult principle blurbs are not rendered as free-text advice in the panel beyond links.

## Limits

- Progression panels remain static coaching text, not a periodization engine.
- Activities none → no suggestions; multi-select union/dedupe; no automatic plan substitutions.
- Honest limited Lobliner sourcing: verified on progressive overload + VPO-10 progression rule; **not** as 5/3/1 BBB author.
