/**
 * Serving units: turns "how much did you eat" (amount + unit) into a number of the
 * food's own servings. Nutrition is always stored per ONE serving of
 * servingSize x servingUnit; grams always mean real grams.
 * Shared by the server (require) and the browser (window.Servings).
 * Count/size weights are USDA FoodData Central (SR Legacy) household portions.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Servings = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const G_PER_OZ = 28.3495;
  const WEIGHT = { g: 1, kg: 1000, oz: G_PER_OZ, lb: 453.592 };
  const VOLUME = { ml: 1, l: 1000, tsp: 4.92892, tbsp: 14.7868, 'fl oz': 29.5735, cup: 236.588 };
  const VOLUME_LABEL = { ml: 'mL', l: 'L', tsp: 'tsp', tbsp: 'tbsp', 'fl oz': 'fl oz', cup: 'cup' };
  const ALIASES = {
    gram: 'g', grams: 'g', gr: 'g', ounce: 'oz', ounces: 'oz', 'oz.': 'oz', lbs: 'lb', pound: 'lb', pounds: 'lb',
    kilogram: 'kg', milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', mls: 'ml', liter: 'l', litre: 'l', liters: 'l',
    teaspoon: 'tsp', teaspoons: 'tsp', 'tsp.': 'tsp', tablespoon: 'tbsp', tablespoons: 'tbsp', 'tbsp.': 'tbsp', tbs: 'tbsp',
    cups: 'cup', floz: 'fl oz', 'fl. oz': 'fl oz', 'fl oz.': 'fl oz', 'fluid ounce': 'fl oz', 'fluid ounces': 'fl oz'
  };

  function norm(unit) {
    const u = String(unit || '').trim().toLowerCase().replace(/\s+/g, ' ');
    return ALIASES[u] || u;
  }
  const isWeightUnit = (u) => Object.prototype.hasOwnProperty.call(WEIGHT, baseUnit(u));
  const isVolumeUnit = (u) => Object.prototype.hasOwnProperty.call(VOLUME, baseUnit(u));
  function toGrams(size, unit) {
    const u = norm(unit);
    return WEIGHT[u] ? size * WEIGHT[u] : size;
  }

  // Grams per mL for foods measured by volume. Unlisted foods use 1.0 and are marked approximate.
  const DENSITY = [
    [/peanut butter|almond butter|nut butter|cashew butter|sunflower butter/, 1.08],
    [/\boil\b|olive oil/, 0.92],
    [/honey/, 1.42],
    [/syrup|molasses/, 1.33],
    [/mayo/, 0.93],
    [/ketchup|bbq|barbecue sauce/, 1.15],
    [/\bbutter\b|ghee/, 0.96],
    [/flour/, 0.53],
    [/powder(?!ed sugar)|protein powder/, 0.5],
    [/^(granulated |brown |white |cane )?sugar\b/, 0.85],
    [/milk|creamer|half.and.half|cream\b/, 1.03]
  ];
  function densityFor(food) {
    if (Number(food.density) > 0) return { d: Number(food.density), approx: false };
    const name = String(food.name || '').toLowerCase();
    for (const [re, d] of DENSITY) if (re.test(name)) return { d, approx: true };
    return { d: 1, approx: true };
  }

  // USDA household portions (grams). `match` is tested on the lower-case name; `not` excludes
  // dishes and products that only mention the fruit (banana bread, apple cider vinegar...).
  const NOT_WHOLE = /chip|bread|muffin|juice|jam|jelly|sauce|vinegar|pie|dried|cider|smoothie|sausage|cake|cereal|\bbar\b|yogurt|ice cream|candy|pudding|oatmeal|with|pancake|crisp|cookie|butter|spread|drink|soda|tea|flavou?r|syrup|fried|salad|salsa|powder|puree|canned|frozen|sorbet|sherbet|split/;
  const PORTIONS = [
    { match: /^bananas?\b/, sizes: [['small', 101], ['medium', 118], ['large', 136]], noun: 'banana' },
    { match: /^apples?\b/, sizes: [['small', 149], ['medium', 182], ['large', 223]], noun: 'apple' },
    { match: /^(navel )?oranges?\b/, sizes: [['small', 96], ['medium', 131], ['large', 184]], noun: 'orange' },
    { match: /^pears?\b/, sizes: [['small', 148], ['medium', 178], ['large', 230]], noun: 'pear' },
    { match: /^peach(es)?\b/, sizes: [['small', 130], ['medium', 150], ['large', 175]], noun: 'peach' },
    { match: /^nectarines?\b/, sizes: [['medium', 142]], noun: 'nectarine' },
    { match: /^plums?\b/, sizes: [['medium', 66]], noun: 'plum' },
    { match: /^apricots?\b/, sizes: [['medium', 35]], noun: 'apricot' },
    { match: /^figs?\b/, sizes: [['medium', 50]], noun: 'fig' },
    { match: /^lemons?\b/, sizes: [['medium', 58]], noun: 'lemon' },
    { match: /^limes?\b/, sizes: [['medium', 67]], noun: 'lime' },
    { match: /^persimmons?\b/, sizes: [['medium', 168]], noun: 'persimmon' },
    { match: /^kiwi/, sizes: [['medium', 69]], noun: 'kiwi' },
    { match: /^(clementines?|mandarins?|tangerines?)\b/, sizes: [['medium', 74]], noun: 'clementine' },
    { match: /^mango(es)?\b/, sizes: [['medium', 336]], noun: 'mango' },
    { match: /^avocados?\b/, sizes: [['medium', 201]], noun: 'avocado' },
    { match: /^grapefruit/, sizes: [['half', 123]], noun: 'grapefruit' },
    { match: /^(medjool )?dates?\b/, sizes: [['each', 24]], noun: 'date' },
    { match: /^blackberr/, count: 2.2, noun: 'blackberry' },
    { match: /^raspberr/, count: 1.9, noun: 'raspberry' },
    { match: /^blueberr/, count: 0.68, noun: 'blueberry' },
    { match: /^strawberr/, sizes: [['small', 7], ['medium', 12], ['large', 18]], noun: 'strawberry' },
    { match: /^grapes?\b/, count: 4.9, noun: 'grape' },
    { match: /^cherr(y|ies)\b(?! tomato)/, count: 8.2, noun: 'cherry' },
    { match: /^cherry tomato|^grape tomato/, count: 17, noun: 'tomato' },
    { match: /^tomato(es)?\b/, sizes: [['small', 91], ['medium', 123], ['large', 182]], noun: 'tomato' },
    { match: /^baby carrots?/, count: 10, noun: 'baby carrot' },
    { match: /^carrots?\b/, sizes: [['small', 50], ['medium', 61], ['large', 72]], noun: 'carrot' },
    { match: /^(bell )?peppers?\b|^(red|green|yellow) bell pepper/, sizes: [['small', 74], ['medium', 119], ['large', 164]], noun: 'pepper' },
    { match: /^onions?\b/, sizes: [['small', 70], ['medium', 110], ['large', 150]], noun: 'onion' },
    { match: /^(potato, baked|baked potato)/, sizes: [['small', 138], ['medium', 173], ['large', 299]], noun: 'potato', allowWith: true },
    { match: /^(russet |white )?potato(es)?\b/, sizes: [['small', 170], ['medium', 213], ['large', 299]], noun: 'potato' },
    { match: /^sweet potato/, sizes: [['medium', 114], ['large', 180]], noun: 'sweet potato' },
    { match: /^cucumbers?\b/, sizes: [['medium', 301]], noun: 'cucumber' },
    { match: /^almonds?\b/, count: 1.2, noun: 'almond' },
    { match: /^(whole )?eggs?\b(?! white)/, sizes: [['small', 38], ['medium', 44], ['large', 50], ['extra large', 56], ['jumbo', 63]], noun: 'egg', allowWith: true },
    { match: /^bacon\b(?!, raw)/, count: 8, noun: 'slice', allowWith: true }
  ];

  function portionRule(food) {
    if (food.brand) return null;
    const name = String(food.name || '').toLowerCase().trim();
    for (const rule of PORTIONS) {
      if (!rule.match.test(name)) continue;
      if (!rule.allowWith && NOT_WHOLE.test(name.replace(rule.match, ''))) return null;
      if (rule.allowWith && /white|substitute|salad|sandwich|muffin|bites|bacon bits/.test(name.replace(rule.match, ''))) return null;
      return rule;
    }
    return null;
  }

  // Weight of one serving in grams for count units ("1 medium", "1 banana", "1 egg").
  function countGrams(food, rule) {
    const unit = norm(food.servingUnit);
    const size = Number(food.servingSize) || 1;
    const fromName = String(food.name || '').match(/\((\d+(?:\.\d+)?)\s*g\)/i);
    if (fromName) return Number(fromName[1]);
    const nameSize = String(food.name || '').toLowerCase();
    if (rule && rule.sizes) {
      let pick = rule.sizes.find(([k]) => unit === k || unit.startsWith(k + ' ') || new RegExp('\\b' + k + '\\b').test(nameSize));
      if (!pick && (unit === rule.noun || unit === rule.noun + 's' || unit === 'each' || unit === 'piece' || unit === 'whole' || unit === 'fruit'))
        pick = rule.sizes.find(([k]) => k === 'medium' || k === 'large') || rule.sizes[0];
      if (rule.noun === 'egg' && pick && !rule.sizes.some(([k]) => new RegExp('\\b' + k + '\\b').test(nameSize)) && unit === 'egg') pick = rule.sizes.find(([k]) => k === 'large');
      if (pick) return pick[1] * size;
    }
    if (rule && rule.count && (unit === rule.noun || unit === rule.noun + 's' || unit === 'each' || unit === 'piece' || unit === 'slice'))
      return rule.count * size;
    return null;
  }

  /** What one serving of the food is, in real grams and/or mL. */
  // "fl oz can", "g (1 cup)", "oz (bowl/burrito portion)" -> the leading measurable unit.
  function baseUnit(unit) {
    const u = norm(unit);
    if (WEIGHT[u] || VOLUME[u]) return u;
    const m = u.match(/^(fl\.? ?oz|g|oz|ml|tbsp|tsp|cups?|lb|kg|l)\b/);
    return m ? norm(m[1] === 'cups' ? 'cup' : m[1].replace('fl. oz', 'fl oz').replace('floz', 'fl oz')) : u;
  }

  function measure(food) {
    const unit = baseUnit(food.servingUnit);
    const size = Number(food.servingSize) || 1;
    const rule = portionRule(food);
    let grams = null;
    let ml = null;
    let approxGrams = false;
    if (WEIGHT[unit]) grams = size * WEIGHT[unit];
    else if (VOLUME[unit]) ml = size * VOLUME[unit];
    if (Number(food.gramsPerServing) > 0) grams = Number(food.gramsPerServing);
    if (Number(food.mlPerServing) > 0) ml = Number(food.mlPerServing);
    if (grams == null && ml != null) {
      const { d, approx } = densityFor(food);
      grams = ml * d;
      approxGrams = approx;
    }
    if (grams == null) grams = countGrams(food, rule);
    return { grams, ml, approxGrams, rule };
  }

  function fmt(n) {
    const d = Math.abs(n) < 10 ? 100 : 10;
    const r = Math.round(n * d) / d;
    return String(r % 1 === 0 ? Math.round(r) : r);
  }

  function servingLabel(food) {
    const unit = String(food.servingUnit || 'serving');
    const size = Number(food.servingSize) || 1;
    const u = norm(unit);
    if (size === 1 && u === 'serving') return '1 serving';
    if (size === 1 && (u === 'medium' || u === 'small' || u === 'large')) return '1 ' + u;
    const shown = VOLUME_LABEL[u] || unit;
    return size === 1 && !WEIGHT[u] && !VOLUME[u] ? shown : `${fmt(size)} ${shown}`;
  }

  /**
   * Units this food can be logged in. Each option: { value, label, factor } where
   * factor = number of the food's servings in ONE of that unit.
   */
  function unitOptions(food) {
    const m = measure(food);
    const opts = [];
    const add = (value, label, factor, extra) => {
      if (!(factor > 0) || opts.some((o) => o.value === value)) return;
      opts.push(Object.assign({ value, label, factor }, extra || {}));
    };
    const base = servingLabel(food);
    const desc = [];
    if (m.grams && !isWeightUnit(food.servingUnit)) desc.push((m.approxGrams ? '≈' : '') + fmt(m.grams) + ' g');
    if (m.ml && !isVolumeUnit(food.servingUnit)) desc.push(fmt(m.ml) + ' mL');
    add('serving', base === 'serving' && !desc.length ? 'serving' : `serving (${base}${desc.length ? ' · ' + desc.join(' · ') : ''})`, 1, { kind: 'serving' });
    if (m.grams) {
      add('g', m.approxGrams ? 'g (≈)' : 'g', 1 / m.grams, { kind: 'weight', approx: m.approxGrams });
      add('oz', m.approxGrams ? 'oz (≈)' : 'oz', G_PER_OZ / m.grams, { kind: 'weight', approx: m.approxGrams });
    }
    if (m.ml) {
      for (const u of ['ml', 'tsp', 'tbsp', 'fl oz', 'cup']) add(u, VOLUME_LABEL[u], VOLUME[u] / m.ml, { kind: 'volume' });
    }
    if (m.rule && m.grams && !m.approxGrams) {
      if (m.rule.sizes) {
        for (const [k, g] of m.rule.sizes) {
          const label = m.rule.sizes.length === 1 && (k === 'each' || k === 'medium') ? `${m.rule.noun} (${fmt(g)} g)` : `${k} ${m.rule.noun} (${fmt(g)} g)`;
          add('p:' + k, label, g / m.grams, { kind: 'count', grams: g });
        }
      }
      if (m.rule.count) add('p:each', `${m.rule.noun} (${fmt(m.rule.count)} g)`, m.rule.count / m.grams, { kind: 'count', grams: m.rule.count });
    }
    // "11 crackers (30 g)" -> also "cracker (2.7 g)"
    const bu = baseUnit(food.servingUnit);
    const size = Number(food.servingSize) || 1;
    if (size > 1 && m.grams && !WEIGHT[bu] && !VOLUME[bu] && !/serving|portion/.test(bu) && /^[a-z ]{2,20}$/.test(bu)) {
      const one = bu.replace(/ies$/, 'y').replace(/(ch|sh|x|s)es$/, '$1').replace(/([^s])s$/, '$1');
      add('p:each', `${one} (${fmt(m.grams / size)} g)`, 1 / size, { kind: 'count', grams: m.grams / size });
    }
    for (const p of Array.isArray(food.portions) ? food.portions : []) {
      if (p && p.label && Number(p.grams) > 0 && m.grams) add('p:' + p.label, `${p.label} (${fmt(p.grams)} g)`, Number(p.grams) / m.grams, { kind: 'count', grams: Number(p.grams) });
    }
    return opts;
  }

  /** Servings of the food represented by `amount` of `unit`, or null if the unit doesn't apply. */
  function amountToServings(amount, unit, food) {
    const a = Number(amount);
    if (!Number.isFinite(a) || a < 0) return null;
    const u = String(unit || 'serving');
    const key = u.startsWith('p:') ? u : norm(u) === 'serving' ? 'serving' : norm(u);
    const opt = unitOptions(food).find((o) => o.value === key);
    if (opt) return a * opt.factor;
    if (norm(u) === norm(food.servingUnit)) return a / (Number(food.servingSize) || 1);
    return null;
  }

  /** Real grams for an amount, when known (used for the "impossible kcal per gram" guard). */
  function amountToGrams(amount, unit, food) {
    const s = amountToServings(amount, unit, food);
    const m = measure(food);
    return s != null && m.grams ? s * m.grams : null;
  }

  /** Short "1.5 tbsp" / "118 g" / "2 medium banana" label for a logged amount. */
  function plural(word) {
    if (/(s|x|ch|sh)$/.test(word)) return word + 'es';
    if (/[^aeiou]y$/.test(word)) return word.slice(0, -1) + 'ies';
    return word + 's';
  }
  function amountLabel(amount, unit, food) {
    const opt = unitOptions(food).find((o) => o.value === unit);
    if (!opt || unit === 'serving') {
      const base = servingLabel(food);
      return `${fmt(amount)} serving${Number(amount) === 1 ? '' : 's'}${base === 'serving' || base === '1 serving' ? '' : ' (' + base + ')'}`;
    }
    let name = opt.label.replace(/\s*\(.*\)$/, '');
    if (opt.kind === 'count' && Number(amount) !== 1) name = plural(name);
    return `${fmt(amount)} ${name}`;
  }

  /** Default amount + unit when a food is picked: the label serving, in its natural unit. */
  function defaultAmount(food) {
    const u = baseUnit(food.servingUnit);
    if (WEIGHT[u]) return { amount: Number(food.servingSize) || 100, unit: u === 'oz' ? 'oz' : 'g' };
    if (VOLUME[u]) return { amount: Number(food.servingSize) || 1, unit: u };
    return { amount: 1, unit: 'serving' };
  }

  /** Parse an Open Food Facts style serving string: "2 tbsp (30 ml)", "28 g", "1 bar (40g)". */
  function parseServingText(text) {
    const s = String(text || '').toLowerCase();
    const out = {};
    const g = s.match(/(\d+(?:[.,]\d+)?)\s*(g|gr|grams?)\b/);
    const ml = s.match(/(\d+(?:[.,]\d+)?)\s*(ml|millilit(?:er|re)s?)\b/);
    const flo = s.match(/(\d+(?:[.,]\d+)?)\s*fl\.?\s*oz/);
    if (g) out.grams = Number(g[1].replace(',', '.'));
    if (ml) out.ml = Number(ml[1].replace(',', '.'));
    else if (flo) out.ml = Number(flo[1].replace(',', '.')) * VOLUME['fl oz'];
    const lead = s.match(/^\s*(\d+(?:[.,]\d+)?|\d+\/\d+)?\s*([a-z][a-z .]*?)\s*(\(|$)/);
    if (lead && lead[2]) {
      let n = lead[1] || '1';
      n = n.includes('/') ? Number(n.split('/')[0]) / Number(n.split('/')[1]) : Number(n.replace(',', '.'));
      const unit = norm(lead[2]);
      if (!WEIGHT[unit] && !(unit === 'ml')) { out.size = n; out.unit = unit; }
      else if (VOLUME[unit] && !out.ml) out.ml = n * VOLUME[unit];
    }
    return out;
  }

  return {
    G_PER_OZ, WEIGHT, VOLUME, norm, baseUnit, isWeightUnit, isVolumeUnit, toGrams, measure, unitOptions,
    amountToServings, amountToGrams, amountLabel, defaultAmount, servingLabel, parseServingText, portionRule, fmt
  };
});
