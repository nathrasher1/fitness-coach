/**
 * Inspired catalog expansions (original routines).
 * Attribution notes cite publicly shared principles only — not affiliated/endorsed.
 * Do not copy proprietary/paid program tables. Progression text is static coaching
 * guidance; logged-set double progression (client/lib/progression.js) still drives
 * in-app next-load suggestions when the user logs sets.
 */
module.exports = [
  {
    id: 'steady_strength_4day',
    name: 'Steady Strength Builder',
    focus: 'strength',
    notes:
      'Four main-lift days with lighter volume follow-ups. Inspired by publicly shared principles; not affiliated or endorsed. Sources: Marc Lobliner / Tiger Fitness 5/3/1 BBB guide.',
    inspiration: {
      coaches: [
        {
          name: 'Marc Lobliner',
          principles: [
            'Long-term progressive overload with a training max, not a daily max-out.',
            'Main lift for strength, then higher-rep volume on the same (or related) pattern.',
            'Small training-max bumps after a multi-week cycle (+5 lb upper / +10 lb lower in his public guide).',
            'A lighter recovery week every fourth week is part of the process.'
          ],
          sources: [
            'https://tigerfitness.com/blogs/training/the-complete-5-3-1-bbb-program-guide-the-ultimate-blueprint-for-strength-size-and-simplicity'
          ]
        }
      ],
      designNote:
        'Original exercise list and day names. We do not ship Wendler percentage tables or AMRAP prescriptions. Day-to-day load tips use this app’s logged-set double progression; cycle bumps and deload timing are written guidance only.'
    },
    progression: {
      autoBehavior:
        'When you log working sets, the app suggests the next load/reps with double progression (add a rep until the top of the range on every set, then add weight). That is not a personalized periodization engine and does not auto-run cycle bumps or deloads.',
      effort:
        'On main lifts, stop with about 1–3 reps in reserve (RIR = how many clean reps you could still do). On volume follow-ups, stay further from failure and keep form crisp.',
      effortTeen:
        'Use challenging but controlled sets. Stop when form slows down — leave a couple of clean reps in the tank. Do not test maxes or grind until you cannot move the weight.',
      setsReps:
        'Main lifts: about 3–4 working sets in a strength range (roughly 3–6 reps). Volume follow-ups: 3–5 sets of about 8–12. Accessories: 2–3 sets of 10–15.',
      whenToProgress:
        'Session to session: use the in-app suggestion from your last log. Every ~4 weeks of good sessions, optionally add ~5 lb to upper main lifts and ~10 lb to lower main lifts (smallest practical plates), then keep volume work moderate.',
      increments:
        'Upper compounds: +2.5–5 lb (or +1–2.5 kg). Lower compounds: +5–10 lb (or +2.5–5 kg). Dumbbells: next available pair.',
      ifMissed:
        'If you miss the bottom of the rep range on 2+ sets, keep the same weight and own the range. If you feel wiped or pain (not normal effort), skip the bump, reduce volume follow-ups, or take an extra easy day — never push through sharp pain.',
      recovery:
        'Plan a lighter week about every 4th week (reduce load ~40–60% or cut sets in half). Sleep and food matter as much as the bars.',
      adultOnly: null
    },
    days: [
      {
        name: 'Press + Volume',
        exercises: ['Overhead Press', 'Dumbbell Shoulder Press', 'Pull-Up', 'Lateral Raise', 'Tricep Pushdown']
      },
      {
        name: 'Hinge + Volume',
        exercises: ['Deadlift', 'Romanian Deadlift', 'Seated Cable Row', 'Hanging Leg Raise', 'Farmer Carry']
      },
      {
        name: 'Bench + Volume',
        exercises: ['Bench Press', 'Incline Dumbbell Press', 'Barbell Row', 'Face Pull', 'Dumbbell Curl']
      },
      {
        name: 'Squat + Volume',
        exercises: ['Back Squat', 'Walking Lunge', 'Leg Curl', 'Calf Raise', 'Plank']
      }
    ]
  },
  {
    id: 'compound_ladder_3day',
    name: 'Compound Ladder Strength',
    focus: 'strength',
    notes:
      'Three compound-focused days. Inspired by publicly shared principles; not affiliated or endorsed. Sources: Marc Lobliner Tiger Fitness VPO-10 article (progression idea only — not the paid/tabled workout).',
    inspiration: {
      coaches: [
        {
          name: 'Marc Lobliner',
          principles: [
            'Prioritize standing compound lifts that load the whole chain (squat, hinge, overhead press).',
            'Progressive overload: only add load after you complete the planned sets × reps.',
            'If you miss sets/reps, repeat the same weight until you own it, then go up.'
          ],
          sources: ['https://tigerfitness.com/blogs/workouts/vpo-10-training-muscle-growth']
        }
      ],
      designNote:
        'Original 3-day layout and set structure. We do not reproduce VPO-10’s 10×5 tables or six-day template. Ladder means: finish the planned sets at the target reps before adding weight.'
    },
    progression: {
      autoBehavior:
        'In-app next-load tips still come from logged-set double progression. The ladder rule below is static coaching text, not an automated set-counter.',
      effort:
        'Main compounds: leave ~1–2 reps in reserve (RIR). Assistance: ~2–3 RIR. Skip grinding form breakdown.',
      effortTeen:
        'Main lifts should feel hard but clean. Stop 2+ reps before form breaks. No max attempts.',
      setsReps:
        'Mains: 5 sets of 5 (or 4×6 if newer). Assistance: 3–4 sets of 8–12. Calves/arms: 3×12–15.',
      whenToProgress:
        'Add weight only after every working set hits the target reps. Until then, repeat the same load.',
      increments:
        'Barbell: smallest plates you have (often +5 lb / side once you own the ladder). Machines/DBs: next notch or pair.',
      ifMissed:
        'Incomplete ladder → same weight next time. Persistent misses → drop ~5–10% and rebuild. Fatigue week → cut assistance sets first.',
      recovery:
        'At least one full rest day per week. If legs or back feel cooked, swap a heavy hinge for a lighter RDL day.'
    },
    days: [
      {
        name: 'Squat Focus',
        exercises: ['Back Squat', 'Leg Curl', 'Walking Lunge', 'Calf Raise', 'Pallof Press']
      },
      {
        name: 'Press Focus',
        exercises: ['Overhead Press', 'Incline Dumbbell Press', 'Pull-Up', 'Lateral Raise', 'Tricep Pushdown']
      },
      {
        name: 'Hinge Focus',
        exercises: ['Deadlift', 'Lat Pulldown', 'Seated Cable Row', 'Face Pull', 'Farmer Carry']
      }
    ]
  },
  {
    id: 'athlete_mass_3day',
    name: 'Athlete MASS Builder',
    focus: 'power',
    notes:
      'Movement, athleticism, strength, and speed blended across three days. Inspired by publicly shared principles; not affiliated or endorsed. Sources: Judd Lienhard About (MASS Method) and public Playbook hypertrophy blurb.',
    inspiration: {
      coaches: [
        {
          name: 'Judd Lienhard',
          principles: [
            'MASS Method pillars: Movement, Athleticism, Strength, and Speed (from his public About page).',
            'Hypertrophy-style sessions can stay short, with a primary body-part focus and a lighter secondary stimulus (public Playbook program description).'
          ],
          sources: [
            'https://www.juddlienhard.com/about',
            'https://my.playbookapp.io/judd-lienhard/programs/mass-method-hypertrophy/25368'
          ]
        }
      ],
      designNote:
        'Original day names and lifts. We verified identity via juddlienhard.com (collegiate athlete, Ranger, Austin performance coach, MASS Method founder). Specific paid-program progressions and tables are not copied; a public Substack hypertrophy essay was paywalled beyond the title/lede, so we do not attribute detailed rules from it.'
    },
    progression: {
      autoBehavior:
        'Logged-set double progression still suggests next loads. Athletic quality (landing, sprint intent, ROM) is coached in text only — the app does not auto-score athleticism.',
      effort:
        'Strength sets ~1–3 RIR. Jumps and med-ball work: quality and crisp landings over max fatigue. Stop a drill when speed or control drops.',
      effortTeen:
        'Focus on clean landings and controlled strength. Keep jumps moderate. Never chase max jumps when tired.',
      setsReps:
        'Strength compounds: 3–4×4–8. Single-leg and accessories: 3×8–12. Power drills: 3–5 sets of 3–5 quality reps.',
      whenToProgress:
        'Add load on strength lifts when all sets hit the top of the range with good positions. For jumps/throws, progress height/distance only when landings stay quiet and balanced.',
      increments:
        'Strength: +5–10 lb lower / +2.5–5 lb upper. Power: small height steps or a slightly heavier med ball — not both at once.',
      ifMissed:
        'Missed strength reps → hold load. Sloppy landings → regress height/volume. Soreness from sport practice → keep this session lighter (design intent: support athleticism, not bury it).',
      recovery:
        'Leave room for skill/sport work. If you have hard practice days, treat one MASS day as movement quality only.'
    },
    days: [
      {
        name: 'Move + Strength',
        exercises: ['Goblet Squat', 'Trap Bar Deadlift', 'Push-Up', 'Single-Arm Dumbbell Row', 'Dead Bug']
      },
      {
        name: 'Athleticism + Pull',
        exercises: ['Box Jump', 'Bulgarian Split Squat', 'Pull-Up', 'Landmine Press', 'Pallof Press']
      },
      {
        name: 'Strength + Speed',
        exercises: ['Front Squat', 'Broad Jump', 'Bench Press', 'Medicine Ball Slam', 'Farmer Carry']
      }
    ]
  },
  {
    id: 'frequent_stimulus_5day',
    name: 'Frequent Stimulus Split',
    focus: 'hypertrophy',
    notes:
      'Five shorter sessions: each day emphasizes one area hard and gives another a lighter touch. Inspired by publicly shared principles; not affiliated or endorsed. Source: Judd Lienhard public Playbook hypertrophy description.',
    inspiration: {
      coaches: [
        {
          name: 'Judd Lienhard',
          principles: [
            'Train two areas in a session: one gets the primary hard work, the other a minor stimulus.',
            'Keep workouts short (under an hour in the public description).'
          ],
          sources: [
            'https://my.playbookapp.io/judd-lienhard/programs/mass-method-hypertrophy/25368',
            'https://www.juddlienhard.com/about'
          ]
        }
      ],
      designNote:
        'Original five-day split and lifts. Frequency-with-manageable-per-session-volume is the design takeaway; we do not claim his private programming details.'
    },
    progression: {
      autoBehavior:
        'In-app suggestions follow logged double progression per exercise. Weekly volume targets are guidance, not auto-adjusted.',
      effort:
        'Primary lifts of the day: ~1–2 RIR. Secondary/minor work: ~2–4 RIR so it does not steal recovery from the next primary day.',
      effortTeen:
        'Primary work should feel challenging with clean form. Keep the second area easy. Skip all-out last-rep grinding.',
      setsReps:
        'Primary: 3–4 sets of 6–12. Minor: 2 sets of 10–15. Total session time goal: keep moving, finish in under ~60 minutes when possible.',
      whenToProgress:
        'Progress the primary lifts first (reps, then load). Only nudge minor work after primaries are advancing.',
      increments:
        'Same as hypertrophy defaults: +2.5–5 lb upper, +5–10 lb lower, or next DB pair when all primary sets hit the top of the range.',
      ifMissed:
        'If primaries stall, cut a minor-set first. If you miss sessions, resume the next day in order — do not cram two primaries.',
      recovery:
        'Five days is a lot — keep at least two rest or easy movement days. Deload by dropping minor work for a week if sleep or joints complain.'
    },
    days: [
      {
        name: 'Push Hard · Pull Easy',
        exercises: ['Bench Press', 'Overhead Press', 'Lateral Raise', 'Seated Cable Row', 'Face Pull']
      },
      {
        name: 'Legs Hard · Core Easy',
        exercises: ['Back Squat', 'Romanian Deadlift', 'Walking Lunge', 'Calf Raise', 'Dead Bug']
      },
      {
        name: 'Pull Hard · Push Easy',
        exercises: ['Pull-Up', 'Barbell Row', 'Lat Pulldown', 'Incline Dumbbell Press', 'Tricep Pushdown']
      },
      {
        name: 'Hinge/Glute Hard · Arms Easy',
        exercises: ['Trap Bar Deadlift', 'Hip Thrust', 'Leg Curl', 'Dumbbell Curl', 'Tricep Pushdown']
      },
      {
        name: 'Shoulders/Arms Hard · Legs Easy',
        exercises: ['Dumbbell Shoulder Press', 'Lateral Raise', 'Face Pull', 'Goblet Squat', 'Pallof Press']
      }
    ]
  },
  {
    id: 'athletic_compound_4day',
    name: 'Athletic Compound Strength',
    focus: 'strength',
    notes:
      'Compound-first strength with multi-plane assistance. Inspired by publicly shared principles; not affiliated or endorsed. Source: Jeff Cavaliere / ATHLEAN-X “How To Get Stronger”.',
    inspiration: {
      coaches: [
        {
          name: 'Jeff Cavaliere',
          principles: [
            'Prioritize compound lifts and progressive overload for strength.',
            'Overload can mean more weight, more reps/sets, or higher density (e.g., slightly shorter rests) while keeping form.',
            'Train beyond one plane — add lateral/rotational and corrective work (e.g., face pulls) to support athleticism and balance.',
            'Do not sacrifice form for load; respect recovery.'
          ],
          sources: ['https://learn.athleanx.com/articles/how-to-get-stronger']
        }
      ],
      designNote:
        'Original upper/lower-style layout with explicit lateral/rotational slots. We do not ship ATHLEAN-X program templates.'
    },
    progression: {
      autoBehavior:
        'Weight/rep suggestions use logged double progression. Rest-time and ROM overloads are manual — log how you feel; the app does not time rests automatically.',
      effort:
        'Compounds ~1–3 RIR with strict form. If weight will not move up, add a rep or keep rest honest before forcing load.',
      effortTeen:
        'Master form before adding weight. Leave reps in the tank. Skip max testing and forced grinders.',
      setsReps:
        'Compounds: 3–4×4–8. Assistance and single-leg: 3×8–12. Correctives (face pull, pallof): 2–3×12–15.',
      whenToProgress:
        'Prefer small weekly load bumps when form is solid. If stuck, add reps within the range, then load. Optionally shorten rest by ~15–30 seconds once reps are easy — only if form stays sharp.',
      increments:
        'About +2.5–5 lb per week on upper compounds and +5–10 lb on lower for newer lifters when earned; slower is fine when advanced.',
      ifMissed:
        'Form break or missed reps → hold or drop load. Persistent joint irritation → swap to a friendlier variation (e.g., goblet squat) and keep progressing reps.',
      recovery:
        '3–4 hard lift days with rest or easy movement between. Mobility and sleep are part of the plan, not extras.'
    },
    days: [
      {
        name: 'Push + Pull',
        exercises: ['Bench Press', 'Barbell Row', 'Overhead Press', 'Chin-Up', 'Face Pull']
      },
      {
        name: 'Squat + Hinge',
        exercises: ['Back Squat', 'Romanian Deadlift', 'Walking Lunge', 'Calf Raise', 'Back Extension']
      },
      {
        name: 'Press + Row Variety',
        exercises: ['Incline Dumbbell Press', 'Pull-Up', 'Dumbbell Shoulder Press', 'Seated Cable Row', 'Lateral Raise']
      },
      {
        name: 'Legs + Multi-Plane',
        exercises: ['Front Squat', 'Trap Bar Deadlift', 'Lateral Lunge', 'Box Jump', 'Pallof Press']
      }
    ]
  },
  {
    id: 'effort_physique_3day',
    name: 'Effort-Based Physique',
    focus: 'hypertrophy',
    notes:
      'Full-body bias with clear effort targets. Inspired by publicly shared principles; not affiliated or endorsed. Source: Sean Nalewanyj seannal.com RPE article.',
    inspiration: {
      coaches: [
        {
          name: 'Sean Nalewanyj',
          principles: [
            'Effort matters: use a concrete gauge (RPE or reps in reserve), not vague “train hard.”',
            'Most working sets around RPE 8–9 (about 1–2 reps short of failure) is a practical sweet spot for many lifters.',
            'Training to true failure every set is usually unnecessary and raises fatigue; beginners can learn the effort zone without maxing out.'
          ],
          sources: ['https://www.seannal.com/articles/training/general/rpe-scale.php']
        }
      ],
      designNote:
        'Original 3-day full-body template. Double-progression mechanics in-app are our implementation; Sean’s article focuses on effort metrics rather than a named progression algorithm.'
    },
    progression: {
      autoBehavior:
        'Next-load tips still come from logged double progression. RPE/RIR is not auto-detected from your logs — you apply the effort target yourself.',
      effort:
        'Aim to finish most working sets about 1–2 reps short of failure (RIR 1–2 ≈ RPE 8–9). RIR means “reps in reserve”: how many clean reps you could still do.',
      effortTeen:
        'Stop each set when you still have 2–3 clean reps left. Learn hard training without all-out grinding or testing maxes.',
      setsReps:
        'Compounds: 3×6–10. Accessories: 2–3×8–15. Keep 60–120 seconds between harder sets.',
      whenToProgress:
        'When you hit the top of the rep range on all sets at the target effort, add the smallest load bump and drop back toward the bottom of the range.',
      increments:
        'Smallest available: often +5 lb barbell, next DB pair, or +1 machine notch.',
      ifMissed:
        'If you cannot reach the bottom reps at target effort, keep the weight. If you are always far from challenged, nudge effort up slightly before adding endless sets.',
      recovery:
        'Three days with rest between. If recovery tanks, keep loads and cut one accessory set per exercise for a week.'
    },
    days: [
      {
        name: 'Full Body A',
        exercises: ['Back Squat', 'Bench Press', 'Barbell Row', 'Lateral Raise', 'Plank']
      },
      {
        name: 'Full Body B',
        exercises: ['Romanian Deadlift', 'Overhead Press', 'Pull-Up', 'Walking Lunge', 'Face Pull']
      },
      {
        name: 'Full Body C',
        exercises: ['Front Squat', 'Incline Dumbbell Press', 'Seated Cable Row', 'Hip Thrust', 'Hanging Leg Raise']
      }
    ]
  },
  {
    id: 'size_wave_4day',
    name: 'Size Wave Upper/Lower',
    focus: 'hypertrophy',
    notes:
      'Upper/lower with a planned effort and volume wave across a few weeks, then easier recovery. Inspired by publicly shared principles; not affiliated or endorsed. Source: Mike Israetel / Renaissance Periodization “Progressing for Hypertrophy”.',
    inspiration: {
      coaches: [
        {
          name: 'Mike Israetel (Renaissance Periodization)',
          principles: [
            'Hypertrophy overload spans load, proximity to failure (RIR), and weekly set volume.',
            'Start a block with easier RIR and productive-but-moderate volume; progress effort/volume over weeks, then deload when fatigue is high.',
            'Small load increases often beat jumping intensity too fast; volume is a major hypertrophy driver within recoverability.'
          ],
          sources: ['https://rpstrength.com/blogs/articles/progressing-for-hypertrophy']
        }
      ],
      designNote:
        'Original upper/lower days. We paraphrase public RIR/volume-wave ideas; we do not claim RP app automation or copy mesocycle tables.'
    },
    progression: {
      autoBehavior:
        'The app does not auto-advance mesocycles or change your RIR for you. Logged double progression still suggests next session loads. Follow the wave text manually.',
      effort:
        'Example 4-week feel: week 1 ~3–4 RIR, week 2 ~2–3 RIR, week 3 ~1–2 RIR, week 4 deload (~4+ RIR, fewer sets). RIR = clean reps left in the tank.',
      effortTeen:
        'Use a gentle wave: start easier, get a bit harder for a couple of weeks, then take an easier week. Always keep 2+ reps in reserve. Skip all-out grinding.',
      setsReps:
        'Compounds: 3–4×6–12. Isolation: 2–3×10–15. Optionally add one set to a lagging movement in weeks 2–3 only.',
      whenToProgress:
        'Within a week: double progression on load/reps. Across the block: slightly closer to failure and/or +1 set on key lifts if recovering well.',
      increments:
        'Small load bumps (~5 lb / next DB). Volume bumps: +1 set at a time, not a sudden jump.',
      ifMissed:
        'Performance drop week to week → start deload early. Missed reps at planned effort → hold load; do not stack extra sets.',
      recovery:
        'Deload: cut sets ~40–50% and keep effort easy for 5–7 days, then restart a bit above where the last block began if it went well.'
    },
    days: [
      {
        name: 'Upper A',
        exercises: ['Bench Press', 'Barbell Row', 'Overhead Press', 'Lat Pulldown', 'Lateral Raise']
      },
      {
        name: 'Lower A',
        exercises: ['Back Squat', 'Romanian Deadlift', 'Walking Lunge', 'Leg Curl', 'Calf Raise']
      },
      {
        name: 'Upper B',
        exercises: ['Incline Dumbbell Press', 'Pull-Up', 'Dumbbell Shoulder Press', 'Seated Cable Row', 'Face Pull']
      },
      {
        name: 'Lower B',
        exercises: ['Trap Bar Deadlift', 'Front Squat', 'Bulgarian Split Squat', 'Hip Thrust', 'Pallof Press']
      }
    ]
  },
  {
    id: 'double_progress_2day',
    name: 'Double Progression Essentials',
    focus: 'hypertrophy',
    notes:
      'Two fuller sessions for busy schedules. Inspired by publicly shared principles; not affiliated or endorsed. Source: Jeremy Ethier / Built With Science progressive overload article (double progression section).',
    inspiration: {
      coaches: [
        {
          name: 'Jeremy Ethier (Built With Science)',
          principles: [
            'Progressive overload can use load, reps, sets, tempo, or cleaner form — not only heavier weights.',
            'Double progression: add reps within a range (e.g., 8–12) across sets, then add weight and restart near the bottom of the range.'
          ],
          sources: ['https://builtwithscience.com/fitness-tips/progressive-overload-techniques/']
        }
      ],
      designNote:
        'Original 2-day full-body list. Matches this app’s existing suggestNext behavior closely. Built With Science content is authored by Jeremy Ethier on the fetched page; Sean Nalewanyj is credited separately via seannal.com for effort/RIR guidance.'
    },
    progression: {
      autoBehavior:
        'This plan aligns with the app’s built-in double progression suggestions from your last logged working sets. Still not a full auto-coach — you confirm loads in the session.',
      effort:
        'Work ~1–3 RIR. Prefer clean reps over sloppy load jumps. Tempo or stricter form counts as progress when weight is stuck.',
      effortTeen:
        'Add reps with good form before adding weight. Keep 2–3 reps in reserve. No all-out grinding.',
      setsReps:
        'Most lifts: 3 sets of 8–12 (strength-leaning compounds may use 5–8). Core: 2–3 sets.',
      whenToProgress:
        'When every working set hits the top of the range, add the smallest weight bump and return toward the low end of the range.',
      increments:
        'Upper ~+5 lb / lower ~+10 lb (or kg equivalents); machines/DBs use the next step.',
      ifMissed:
        'Under ~20% of target reps last time → the app may suggest a small deload; otherwise hold and rebuild reps.',
      recovery:
        'Two sessions with at least one rest day between. If both days feel flat, cut one accessory set for a week.'
    },
    days: [
      {
        name: 'Session A',
        exercises: ['Goblet Squat', 'Bench Press', 'Seated Cable Row', 'Romanian Deadlift', 'Plank']
      },
      {
        name: 'Session B',
        exercises: ['Trap Bar Deadlift', 'Overhead Press', 'Lat Pulldown', 'Bulgarian Split Squat', 'Face Pull']
      }
    ]
  }
];
