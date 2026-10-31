/*
 * Activity catalog shared by the server (require) and the browser (window.Activities).
 * Each activity maps to one or two training archetypes. Archetypes pick suggested
 * programs and recommended lifts. Names already saved by users are kept exactly as
 * they were (e.g. "Brazilian jiu-jitsu", "Track and field") so old settings still match.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Activities = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  // key -> label shown in the Activity dropdown, the programs it ranks first, and starter lifts
  const ARCHETYPES = {
    grappling: { label: 'Grappling (BJJ, wrestling, judo)', programs: ['bjj_strength'], lifts: ['Pull-Up', 'Romanian Deadlift', 'Farmer Carry', 'Pallof Press'] },
    striking: { label: 'Striking (boxing, Muay Thai, MMA)', programs: ['striking'], lifts: ['Medicine Ball Slam', 'Landmine Press', 'Trap Bar Deadlift', 'Jump Rope'] },
    field_power: { label: 'Collision field sports (football, rugby)', programs: ['football'], lifts: ['Back Squat', 'Trap Bar Deadlift', 'Bench Press', 'Box Jump'] },
    field_speed: { label: 'Running field sports (soccer, lacrosse)', programs: ['field_speed'], lifts: ['Trap Bar Deadlift', 'Bulgarian Split Squat', 'Broad Jump', 'Leg Curl'] },
    court: { label: 'Court & jumping (basketball, volleyball)', programs: ['court_jump'], lifts: ['Box Jump', 'Front Squat', 'Bulgarian Split Squat', 'Calf Raise'] },
    racket: { label: 'Racket sports (tennis, pickleball)', programs: ['racket'], lifts: ['Lateral Lunge', 'Landmine Press', 'Face Pull', 'Pallof Press'] },
    rotational: { label: 'Bat, club & throwing (baseball, golf)', programs: ['softball'], lifts: ['Landmine Press', 'Pallof Press', 'Front Squat', 'Single-Arm Dumbbell Row'] },
    skating: { label: 'Skating & ice (hockey, figure skating)', programs: ['snow', 'field_speed'], lifts: ['Lateral Lunge', 'Front Squat', 'Box Jump', 'Pallof Press'] },
    endurance: { label: 'Endurance (running, cycling, triathlon)', programs: ['endurance'], lifts: ['Romanian Deadlift', 'Calf Raise', 'Bulgarian Split Squat', 'Dead Bug'] },
    swim: { label: 'Swim & paddle (swimming, rowing, kayak)', programs: ['swim_paddle'], lifts: ['Lat Pulldown', 'Straight-Arm Pulldown', 'Face Pull', 'Dead Bug'] },
    board_water: { label: 'Board & water sports (wake, surf)', programs: ['wakeboard'], lifts: ['Romanian Deadlift', 'Pull-Up', 'Kettlebell Swing', 'Farmer Carry'] },
    snow: { label: 'Snow sports (ski, snowboard)', programs: ['snow'], lifts: ['Front Squat', 'Lateral Lunge', 'Box Jump', 'Romanian Deadlift'] },
    climbing: { label: 'Climbing (rock, bouldering)', programs: ['climbing'], lifts: ['Pull-Up', 'Chin-Up', 'Hanging Leg Raise', 'Farmer Carry'] },
    outdoor: { label: 'Hiking & outdoors (backpacking, rucking)', programs: ['endurance', 'mobility_core'], lifts: ['Step-Up', 'Walking Lunge', 'Suitcase Carry', 'Calf Raise'] },
    strength: { label: 'Strength & physique (lifting)', programs: ['full_body_3day', 'upper_lower'], lifts: ['Back Squat', 'Bench Press', 'Barbell Row', 'Overhead Press'] },
    olympic: { label: 'Olympic lifting & strongman', programs: ['football', 'full_body_3day'], lifts: ['Power Clean', 'Snatch', 'Front Squat', 'Push Press'] },
    conditioning: { label: 'Fitness racing & HIIT (CrossFit, HYROX)', programs: ['metcon'], lifts: ['Wall Ball', 'Sled Push', 'Kettlebell Swing', 'Rowing Machine'] },
    mobility: { label: 'Mind-body & mobility (yoga, Pilates)', programs: ['mobility_core'], lifts: ['Turkish Get-Up', 'Dead Bug', 'Goblet Squat', 'Pallof Press'] },
    dance: { label: 'Dance, gymnastics & cheer', programs: ['court_jump', 'mobility_core'], lifts: ['Box Jump', 'Bulgarian Split Squat', 'Hanging Leg Raise', 'Push-Up'] },
    adaptive: { label: 'Adaptive & seated (wheelchair, para sports)', programs: ['seated_upper'], lifts: ['Lat Pulldown', 'Seated Cable Row', 'Dumbbell Shoulder Press', 'Pallof Press'] },
    general: { label: 'General fitness', programs: ['full_body_3day', 'mobility_core'], lifts: ['Goblet Squat', 'Push-Up', 'Single-Arm Dumbbell Row', 'Plank'] }
  };

  // [name, archetype, optional secondary archetype]
  const GROUPS = [
    { label: 'Combat sports', items: [
      ['Brazilian jiu-jitsu', 'grappling'], ['Wrestling', 'grappling'], ['Judo', 'grappling'], ['Sambo', 'grappling'],
      ['Boxing', 'striking'], ['Kickboxing', 'striking'], ['Muay Thai', 'striking'], ['MMA', 'striking', 'grappling'],
      ['Karate', 'striking'], ['Taekwondo', 'striking'], ['Krav Maga', 'striking'], ['Fencing', 'racket'], ['Kendo', 'striking']
    ] },
    { label: 'Field & team sports', items: [
      ['Football', 'field_power'], ['Flag football', 'field_speed'], ['Rugby', 'field_power'], ['Australian rules football', 'field_power', 'field_speed'],
      ['Soccer', 'field_speed'], ['Lacrosse', 'field_speed'], ['Field hockey', 'field_speed'], ['Ultimate frisbee', 'field_speed'],
      ['Gaelic football', 'field_speed'], ['Hurling', 'field_speed', 'rotational']
    ] },
    { label: 'Court sports', items: [
      ['Basketball', 'court'], ['Volleyball', 'court'], ['Beach volleyball', 'court'], ['Netball', 'court'], ['Handball', 'court'], ['Dodgeball', 'court']
    ] },
    { label: 'Racket sports', items: [
      ['Tennis', 'racket'], ['Pickleball', 'racket'], ['Padel', 'racket'], ['Badminton', 'racket'], ['Squash', 'racket'],
      ['Racquetball', 'racket'], ['Table tennis', 'racket']
    ] },
    { label: 'Bat, club & throwing', items: [
      ['Baseball', 'rotational'], ['Softball', 'rotational'], ['Cricket', 'rotational'], ['Golf', 'rotational'],
      ['Disc golf', 'rotational'], ['Bowling', 'rotational'], ['Track throws', 'rotational', 'olympic'], ['Archery', 'rotational']
    ] },
    { label: 'Ice & skating', items: [
      ['Hockey', 'skating'], ['Figure skating', 'skating', 'dance'], ['Speed skating', 'skating', 'endurance'], ['Curling', 'rotational'],
      ['Roller derby', 'skating'], ['Inline skating', 'skating'], ['Skateboarding', 'board_water']
    ] },
    { label: 'Running & endurance', items: [
      ['Running', 'endurance'], ['Track and field', 'field_speed', 'endurance'], ['Sprinting', 'field_speed'], ['Trail running', 'endurance', 'outdoor'],
      ['Marathon', 'endurance'], ['Ultrarunning', 'endurance'], ['Cross-country', 'endurance'], ['Walking', 'endurance'],
      ['Triathlon', 'endurance', 'swim'], ['Duathlon', 'endurance'], ['Cycling', 'endurance'], ['Mountain biking', 'endurance', 'outdoor'],
      ['BMX', 'board_water'], ['Indoor cycling', 'endurance'], ['Rowing', 'swim', 'endurance'], ['Nordic skiing', 'snow', 'endurance']
    ] },
    { label: 'Water sports', items: [
      ['Swimming', 'swim'], ['Open-water swimming', 'swim', 'endurance'], ['Water polo', 'swim'], ['Diving', 'dance'],
      ['Surfing', 'board_water'], ['Wakeboarding', 'board_water'], ['Water skiing', 'board_water'], ['Kitesurfing', 'board_water'],
      ['Windsurfing', 'board_water'], ['Stand-up paddleboarding', 'board_water', 'swim'], ['Kayaking', 'swim'], ['Canoeing', 'swim'],
      ['Sailing', 'board_water'], ['Scuba diving', 'swim']
    ] },
    { label: 'Snow & mountain', items: [
      ['Skiing', 'snow'], ['Snowboarding', 'snow'], ['Backcountry skiing', 'snow', 'outdoor'], ['Snowshoeing', 'outdoor'],
      ['Rock climbing', 'climbing'], ['Bouldering', 'climbing'], ['Mountaineering', 'outdoor', 'climbing'], ['Hiking', 'outdoor'],
      ['Backpacking', 'outdoor'], ['Rucking', 'outdoor'], ['Hunting', 'outdoor'], ['Fishing', 'outdoor'], ['Horseback riding', 'mobility']
    ] },
    { label: 'Strength & gym', items: [
      ['Strength training', 'strength'], ['Powerlifting', 'strength'], ['Olympic lifting', 'olympic'], ['Bodybuilding', 'strength'],
      ['Strongman', 'olympic', 'conditioning'], ['Kettlebells', 'conditioning'], ['Calisthenics', 'climbing', 'dance'], ['Physique', 'strength'],
      ['Powerbuilding', 'strength']
    ] },
    { label: 'Fitness classes & conditioning', items: [
      ['CrossFit', 'conditioning'], ['HYROX', 'conditioning', 'endurance'], ['HIIT', 'conditioning'], ['Bootcamp', 'conditioning'],
      ['Obstacle course racing', 'conditioning', 'climbing'], ['Spin class', 'endurance'], ['Circuit training', 'conditioning'], ['Jump rope', 'conditioning']
    ] },
    { label: 'Mind-body & mobility', items: [
      ['Yoga', 'mobility'], ['Pilates', 'mobility'], ['Barre', 'mobility', 'dance'], ['Tai chi', 'mobility'], ['Stretching & mobility', 'mobility'],
      ['Qigong', 'mobility']
    ] },
    { label: 'Dance & movement', items: [
      ['Dance', 'dance'], ['Ballet', 'dance'], ['Hip-hop dance', 'dance'], ['Ballroom dance', 'dance'], ['Pole fitness', 'dance', 'climbing'],
      ['Aerial arts', 'climbing', 'dance'], ['Gymnastics', 'dance'], ['Cheerleading', 'dance', 'court'], ['Parkour', 'dance', 'climbing'],
      ['Martial arts forms', 'mobility']
    ] },
    { label: 'Adaptive & para sports', items: [
      ['Wheelchair basketball', 'adaptive', 'court'], ['Wheelchair rugby', 'adaptive'], ['Wheelchair tennis', 'adaptive', 'racket'],
      ['Wheelchair racing', 'adaptive', 'endurance'], ['Handcycling', 'adaptive', 'endurance'], ['Sitting volleyball', 'adaptive', 'court'],
      ['Para swimming', 'adaptive', 'swim'], ['Para powerlifting', 'adaptive', 'strength'], ['Adaptive climbing', 'adaptive', 'climbing'],
      ['Sled hockey', 'adaptive', 'skating'], ['Adaptive skiing', 'adaptive', 'snow'], ['Boccia', 'adaptive'], ['Goalball', 'adaptive', 'court'],
      ['Seated fitness', 'adaptive'], ['Blind & low-vision running', 'endurance']
    ] },
    { label: 'Everyday & recreation', items: [
      ['General fitness', 'general'], ['Weight loss', 'general', 'conditioning'], ['Active aging', 'mobility', 'general'],
      ['Pre/postnatal fitness', 'mobility'], ['Injury comeback', 'mobility'], ['Coaching', 'general'], ['Gardening', 'outdoor'],
      ['Dog walking', 'outdoor'], ['Playing with kids', 'general']
    ] }
  ];

  // Older non-sport interests. Hidden from the picker unless a user already chose them.
  const LEGACY = ['Music', 'Guitar', 'Spanish', 'Homeschool'];

  const BY_NAME = new Map();
  GROUPS.forEach((g) => g.items.forEach(([name, a, b]) => {
    BY_NAME.set(name.toLowerCase(), { name, group: g.label, archetypes: b ? [a, b] : [a] });
  }));

  // Old dropdown values (?focus=) keep working.
  const LEGACY_FOCUS = { general: 'general', 'jiu-jitsu': 'grappling', football: 'field_power', softball: 'rotational', wakeboarding: 'board_water' };

  // Loose keyword fallback for free-text or unknown saved interests.
  const KEYWORDS = [
    [/jiu|bjj|grappl|wrestl|judo|sambo/, 'grappling'], [/box|kick|thai|mma|karate|taekwon|strik|martial/, 'striking'],
    [/rugby|football/, 'field_power'], [/soccer|lacrosse|frisbee|sprint|field/, 'field_speed'],
    [/basketball|volley|netball|handball/, 'court'], [/tennis|pickle|padel|badminton|squash|racq|ping/, 'racket'],
    [/baseball|softball|cricket|golf|throw/, 'rotational'], [/hockey|skat/, 'skating'],
    [/run|marathon|cycl|bike|triath|walk/, 'endurance'], [/swim|row|kayak|canoe|paddle|polo/, 'swim'],
    [/wake|surf|water ?ski|kite|sail|skate ?board/, 'board_water'], [/ski|snow/, 'snow'], [/climb|boulder/, 'climbing'],
    [/hik|backpack|ruck|hunt|outdoor/, 'outdoor'], [/olympic|strongman|clean|snatch/, 'olympic'],
    [/power|strength|lift|bodybuild|physique/, 'strength'], [/crossfit|hyrox|hiit|bootcamp|circuit|metcon/, 'conditioning'],
    [/yoga|pilates|barre|tai chi|stretch|mobility/, 'mobility'], [/dance|ballet|gymnast|cheer|parkour/, 'dance'],
    [/wheelchair|adaptive|para|seated|sled hockey|boccia|goalball/, 'adaptive']
  ];

  function lookup(name) {
    return BY_NAME.get(String(name || '').trim().toLowerCase()) || null;
  }

  /** Archetypes for an activity name, an archetype key, or an old focus value. */
  function archetypesFor(value) {
    const v = String(value || '').trim().toLowerCase();
    if (!v) return [];
    if (ARCHETYPES[v]) return [v];
    if (LEGACY_FOCUS[v]) return [LEGACY_FOCUS[v]];
    const hit = BY_NAME.get(v);
    if (hit) return hit.archetypes;
    const kw = KEYWORDS.find(([re]) => re.test(v));
    return kw ? [kw[1]] : [];
  }

  /**
   * Score programs for a set of archetypes. weights: Map archetype -> weight.
   * Primary program for an archetype scores 3×weight, a later listed one 2×weight.
   */
  function rankPrograms(programs, weights) {
    const scores = new Map(programs.map((p) => [p.id, 0]));
    const why = new Map();
    weights.forEach((w, arch) => {
      const a = ARCHETYPES[arch];
      if (!a) return;
      a.programs.forEach((id, i) => {
        if (!scores.has(id)) return;
        scores.set(id, scores.get(id) + (i === 0 ? 3 : 2) * w);
        if (!why.has(id)) why.set(id, arch);
      });
    });
    return programs
      .map((p, i) => ({ p, i, score: scores.get(p.id) || 0, arch: why.get(p.id) || null }))
      .sort((a, b) => b.score - a.score || a.i - b.i);
  }

  return { ARCHETYPES, GROUPS, LEGACY, LEGACY_FOCUS, lookup, archetypesFor, rankPrograms };
});
