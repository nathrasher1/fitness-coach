/**
 * "About you" answers: the question catalog plus the small rules that use the answers.
 * Shared by the server (require) and the browser (window.AboutYou).
 * Everything here is private to the user; nothing is ever shown on profiles, search or shares.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AboutYou = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  // [value, label]. Teens see `teenLabel` where given (no fat-loss wording).
  const GOALS = [
    ['lose_fat', 'Lose fat', { goalType: 'lose', teenLabel: 'Get healthier / fitter' }],
    ['build_muscle', 'Build muscle', { goalType: 'gain' }],
    ['maintain', 'Maintain', { goalType: 'maintain' }],
    ['stronger', 'Get stronger', { goalType: 'maintain' }],
    ['endurance', 'Endurance', { goalType: 'maintain' }],
    ['feel_better', 'Feel better / move more', { goalType: 'maintain' }],
    ['sport', 'Sport performance', { goalType: 'maintain' }]
  ];
  const SEX = [['female', 'Female'], ['male', 'Male'], ['unspecified', 'Prefer not to say']];
  const EXPERIENCE = [['new', 'New to it'], ['some', 'Some (under 2 yrs)'], ['experienced', 'Experienced (2+ yrs)']];
  // Activity multipliers for the starting estimate (standard PAL bands, everyday activity only).
  const ACTIVITY = [
    ['sitting', 'Mostly sitting', 1.2],
    ['some', 'On my feet some', 1.375],
    ['most', 'On my feet most of the day', 1.55],
    ['physical', 'Physical job', 1.725]
  ];
  const EQUIPMENT = [
    ['gym', 'Full gym'], ['dumbbells', 'Dumbbells at home'], ['bands', 'Bands'],
    ['pullup', 'Pull-up bar'], ['bodyweight', 'Bodyweight only']
  ];
  const EASY_ON = [
    ['lower_back', 'Lower back'], ['knees', 'Knees'], ['shoulders', 'Shoulders'],
    ['wrists', 'Wrists'], ['hips', 'Hips'], ['neck', 'Neck']
  ];
  const DIET = [
    ['vegetarian', 'Vegetarian'], ['vegan', 'Vegan'], ['pescatarian', 'Pescatarian'],
    ['halal', 'Halal'], ['kosher', 'Kosher'], ['high_protein', 'High protein']
  ];
  const AVOID = [
    ['dairy', 'Dairy'], ['gluten', 'Gluten'], ['peanuts', 'Peanuts'], ['tree_nuts', 'Tree nuts'],
    ['shellfish', 'Shellfish'], ['eggs', 'Eggs'], ['soy', 'Soy']
  ];
  const values = (list) => list.map((x) => x[0]);
  const labelOf = (list, v) => (list.find((x) => x[0] === v) || [])[1] || v;

  // ---------- Starting calorie estimate (Mifflin-St Jeor x activity) ----------
  // "Prefer not to say" uses the average of the male (+5) and female (-161) constants.
  const SEX_CONST = { male: 5, female: -161, unspecified: -78 };
  function estimateMaintenance({ weightLbs, heightCm, age, sex, activity }) {
    if (!(weightLbs > 0) || !(heightCm > 0) || !(age > 0)) return null;
    const kg = weightLbs / 2.20462;
    const s = SEX_CONST[sex] != null ? SEX_CONST[sex] : SEX_CONST.unspecified;
    const bmr = 10 * kg + 6.25 * heightCm - 5 * age + s;
    const row = ACTIVITY.find((a) => a[0] === activity);
    const mult = row ? row[2] : 1.375;
    return { bmr: Math.round(bmr), maintenance: Math.round(bmr * mult), multiplier: mult, assumedActivity: !row };
  }

  // ---------- "Go easy on" exercise flags (muscle + movement based; not medical advice) ----------
  const EASY_RULES = {
    lower_back: { patterns: ['hinge', 'olympic'], muscles: [], names: /deadlift|good morning|bent.?over|back squat|t-?bar row|clean|snatch/i },
    knees: { patterns: ['squat', 'lunge', 'plyometric'], muscles: ['quads'], names: /jump|squat|lunge|step.?up|leg extension|burpee|box/i },
    shoulders: { patterns: ['vertical_push'], muscles: ['shoulders', 'reardelts'], names: /overhead|military|press|dip|upright row|snatch|handstand/i },
    wrists: { patterns: [], muscles: ['grip'], names: /push.?up|front squat|clean|snatch|plank|handstand|curl|bench press/i },
    hips: { patterns: ['lunge'], muscles: ['adductors'], names: /hip thrust|split squat|lunge|sumo|deadlift|adductor|abductor/i },
    neck: { patterns: [], muscles: ['traps'], names: /shrug|upright row|neck|farmer|overhead carry/i }
  };
  function easyOnFlags(ex, areas) {
    if (!ex || !Array.isArray(areas) || !areas.length) return [];
    const name = String(ex.name || ex.exerciseName || '');
    const muscles = [].concat(ex.primaryMuscles || [], ex.secondaryMuscles || []).map((m) => String(m).toLowerCase());
    return areas.filter((a) => {
      const r = EASY_RULES[a];
      if (!r) return false;
      return r.patterns.includes(ex.pattern) || r.muscles.some((m) => muscles.includes(m)) || r.names.test(name);
    });
  }

  // ---------- Equipment ----------
  // What the user can use, as exercise equipment tags. Empty answer or "Full gym" = everything.
  function availableEquipment(answer) {
    const a = Array.isArray(answer) ? answer : [];
    if (!a.length || a.includes('gym')) return null;
    const set = new Set(['bodyweight', 'other']);
    if (a.includes('dumbbells')) { set.add('dumbbell'); set.add('kettlebell'); }
    if (a.includes('bands')) set.add('band');
    if (a.includes('pullup')) set.add('pullup_bar');
    return set;
  }
  function canDo(ex, avail, name) {
    if (!avail) return true;
    const eq = (ex && ex.equipment) || [];
    if (!eq.length) return true;
    const n = String(name || (ex && (ex.name || ex.exerciseName)) || '');
    if (avail.has('pullup_bar') && /pull.?up|chin.?up|hanging/i.test(n)) return true;
    return eq.some((e) => avail.has(e));
  }
  // Order swap candidates: doable with your equipment and not flagged first.
  function rankSwaps(swaps, answers) {
    const avail = availableEquipment(answers && answers.equipment);
    const areas = (answers && answers.easyOn) || [];
    return (swaps || []).map((s, i) => {
      const flags = easyOnFlags(s, areas);
      const ok = canDo(s, avail);
      return { s, i, flags, ok, score: (ok ? 0 : 10) + flags.length };
    }).sort((a, b) => a.score - b.score || a.i - b.i);
  }

  // ---------- Diet / allergy warnings (food NAME only; full ingredients can't be checked) ----------
  const MEAT = /\b(chicken|beef|pork|bacon|ham|turkey|sausage|pepperoni|salami|steak|brisket|carnitas|barbacoa|chorizo|lamb|veal|venison|bison|duck|meatballs?|burger|whopper|big mac|mcrib|nuggets?|wings?|jerky|prosciutto|pastrami|hot dog|bratwurst|gyro|shawarma|kebab|pho|tikka|tandoori|bulgogi|teriyaki chicken|pulled pork|ribs?|rotisserie|mcchicken|baconator|philly|bmt|cold cut)\b/i;
  const FISH = /\b(salmon|tuna|cod|tilapia|fish|sardines?|anchov(y|ies)|halibut|trout|mahi|sushi|poke|filet-o-fish|mackerel|catfish|pollock)\b/i;
  const SHELLFISH = /\b(shrimp|prawns?|crab|lobster|clams?|oysters?|mussels?|scallops?|crawfish|calamari|squid|octopus)\b/i;
  const PORK = /\b(pork|bacon|ham|pepperoni|salami|prosciutto|chorizo|carnitas|mcrib|bratwurst|hot dog|pulled pork|ribs?|sausage|bmt|cold cut|spicy italian|pancetta|lard)\b/i;
  const DAIRY = /\b(milk|cheese|cheesy|cheddar|mozzarella|parmesan|feta|ricotta|brie|gouda|swiss|provolone|queso|yogurt|yoghurt|butter|cream|creamy|ice cream|whey|casein|latte|cappuccino|macchiato|frappuccino|mocha|milkshake|shake|frosty|mcflurry|alfredo|ghee|paneer|kefir|custard|pizza|quesadilla|mac & cheese|cheesecake|tzatziki|ranch)\b/i;
  const GLUTEN = /\b(bread|breadsticks?|wheat|flour|pasta|spaghetti|noodles?|macaroni|lasagna|bagel|croissant|muffin|biscuit|pancakes?|hotcakes|waffles?|tortilla|wrap|burrito|pizza|bun|sandwich|sub|footlong|burger|cookie|cake|donut|doughnut|munchkin|cruller|fritter|pretzel|crackers?|cereal|granola|couscous|seitan|gluten|barley|rye|beer|pie|pastry|naan|pita|roti|ramen|udon|dumplings?|potstickers?|egg roll|spring roll|breaded|crispy chicken|nuggets?|tenders|strips|chick-n|mcchicken|mcmuffin|mcgriddles|toast|french toast|panini|melt|bread bowl|cinnamon|twists|chow mein|lo mein|orange chicken|teriyaki|soy sauce)\b/i;
  const PEANUT = /\b(peanuts?|peanut butter|pb&j|satay|reese'?s|snickers|pad thai|kung pao)\b/i;
  const TREE_NUT = /\b(almonds?|almond milk|cashews?|walnuts?|pecans?|pistachios?|hazelnuts?|macadamia|brazil nuts?|pine nuts|nutella|pesto|praline|marzipan|mixed nuts|trail mix|baklava|banana nut|honey walnut)\b/i;
  const EGG = /\b(eggs?|omelets?|omelette|frittata|quiche|mayo|mayonnaise|aioli|meringue|custard|egg white|french toast|carbonara|egg roll|mcmuffin with egg|egg bites|hollandaise|caesar)\b/i;
  const SOY = /\b(soy|soya|tofu|edamame|tempeh|miso|tamari|teriyaki|sofritas|soy sauce|natto)\b/i;
  const HONEY = /\bhoney\b/i;
  const NOT_MEAT = /\b(impossible|beyond|veggie|plant.?based|meatless|vegan|tofu|tempeh|seitan|sofritas)\b/i;
  const NOT_DAIRY = /\b(dairy.?free|vegan|oat milk|oatmilk|almond milk|soy milk|coconut milk|non.?dairy|peanut butter|apple butter|cocoa butter|cream of wheat)\b/i;
  const NOT_GLUTEN = /\b(gluten.?free|corn tortilla|rice noodles?|rice cakes?)\b/i;
  const NOT_EGG = /\b(eggplant|egg.?free|eggless|vegan)\b/i;

  function dietWarnings(foodName, answers) {
    const name = String(foodName || '');
    const diet = (answers && answers.diet) || [];
    const avoid = (answers && answers.avoid) || [];
    if (!name || (!diet.length && !avoid.length)) return [];
    const out = [];
    const add = (s) => { if (!out.includes(s)) out.push(s); };
    const meat = MEAT.test(name) && !NOT_MEAT.test(name);
    const fish = FISH.test(name);
    const shell = SHELLFISH.test(name);
    const dairy = DAIRY.test(name) && !NOT_DAIRY.test(name);
    const egg = EGG.test(name) && !NOT_EGG.test(name);
    if (avoid.includes('dairy') && dairy) add('may contain dairy');
    if (avoid.includes('gluten') && GLUTEN.test(name) && !NOT_GLUTEN.test(name)) add('may contain gluten');
    if (avoid.includes('peanuts') && PEANUT.test(name)) add('may contain peanuts');
    if (avoid.includes('tree_nuts') && TREE_NUT.test(name)) add('may contain tree nuts');
    if (avoid.includes('shellfish') && shell) add('may contain shellfish');
    if (avoid.includes('eggs') && egg) add('may contain eggs');
    if (avoid.includes('soy') && SOY.test(name)) add('may contain soy');
    if (diet.includes('vegan')) {
      if (meat || fish || shell) add('not vegan (meat or fish)');
      else if (dairy || egg || HONEY.test(name)) add('may not be vegan');
    } else if (diet.includes('vegetarian')) {
      if (meat || fish || shell) add('not vegetarian');
    } else if (diet.includes('pescatarian')) {
      if (meat) add('not pescatarian (meat)');
    }
    if ((diet.includes('halal') || diet.includes('kosher')) && PORK.test(name) && !NOT_MEAT.test(name)) add(diet.includes('halal') ? 'may not be halal (pork)' : 'may not be kosher (pork)');
    if (diet.includes('kosher') && shell) add('may not be kosher (shellfish)');
    return out;
  }

  return {
    GOALS, SEX, EXPERIENCE, ACTIVITY, EQUIPMENT, EASY_ON, DIET, AVOID, values, labelOf,
    estimateMaintenance, easyOnFlags, availableEquipment, canDo, rankSwaps, dietWarnings
  };
});
