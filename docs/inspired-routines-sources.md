# Inspired routines — public sources (preview research)

Not affiliated with or endorsed by any named coach. Routines are original Fitness Coach plans. We cite publicly shared principles only; no invented quotes, no paid-program tables.

| Coach | App routines (ids) | Supported public principles (paraphrase) | Sources | App design decisions (ours, not theirs) |
| --- | --- | --- | --- | --- |
| Marc Lobliner | `steady_strength_4day`, `compound_ladder_3day` | Training-max style long-term overload; main lift + higher-rep volume follow-up; +5 lb upper / +10 lb lower TM bumps after a cycle; deload every 4th week (5/3/1 BBB guide). Complete planned sets×reps before adding load (VPO-10 article). | https://tigerfitness.com/blogs/training/the-complete-5-3-1-bbb-program-guide-the-ultimate-blueprint-for-strength-size-and-simplicity · https://tigerfitness.com/blogs/workouts/vpo-10-training-muscle-growth | Original day/exercise lists. No Wendler % tables, no VPO 10×5 spreadsheet. Cycle bumps are written guidance; day-to-day tips use our logged double progression. |
| Judd Lienhard | `athlete_mass_3day`, `frequent_stimulus_5day` | MASS = Movement, Athleticism, Strength, Speed (About). Public hypertrophy blurb: two areas per session (one primary hard work, one minor stimulus); short sessions. | https://www.juddlienhard.com/about · https://my.playbookapp.io/judd-lienhard/programs/mass-method-hypertrophy/25368 | Identity verified via juddlienhard.com. Original templates. Substack hypertrophy essay was paywalled beyond title/lede — **no detailed rules attributed from it**. |
| Jeff Cavaliere | `athletic_compound_4day` | Compounds + progressive overload (load, volume, density); multi-plane / corrective work; form over ego load; recovery. | https://learn.athleanx.com/articles/how-to-get-stronger | Original 4-day layout with lateral/rotational slots. Not an ATHLEAN-X template. |
| Sean Nalewanyj | `effort_physique_3day` | Prefer concrete effort (RPE / RIR / “reps short of failure”); ~RPE 8–9 (1–2 RIR) as a common working zone; constant failure not required. | https://www.seannal.com/articles/training/general/rpe-scale.php | Original 3-day full-body. RIR is user-applied; not auto-read from logs. |
| Mike Israetel (RP) | `size_wave_4day` | Progress load, RIR, and weekly sets within recoverability; start easier and wave harder then deload; small load bumps; volume is a major hypertrophy driver. | https://rpstrength.com/blogs/articles/progressing-for-hypertrophy | Original upper/lower. No RP app automation or mesocycle tables. |
| Jeremy Ethier (Built With Science) | `double_progress_2day` | Multiple overload levers; double progression (reps in a range, then add weight). | https://builtwithscience.com/fitness-tips/progressive-overload-techniques/ | Article author on the fetched page is Jeremy Ethier. Aligns with existing `suggestNext` behavior. |

## Limits

- Progression panels are **static coaching text**. Logged-set double progression (`client/lib/progression.js`) still drives next-load suggestions when sets are logged — that is not a full personalized periodization engine.
- Teen accounts get `effortTeen` copy (no max-testing / failure prescriptions).
- Activities with none selected still show **no** suggested programs. Multi-select remains union + dedupe. No automatic plan substitutions.
