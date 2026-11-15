/**
 * Gym machine catalog (selectorized, plate-loaded, Smith, assisted, and cable stations).
 * Equipment uses the existing Exercise enum. Cable-station movements are tagged
 * ['cable', 'machine'] so they appear in the Machine filter, matching Lat Pulldown.
 * Names must not duplicate seed-exercises.js (insert is by exact system name).
 */
module.exports = [
  // Legs / squat
  { name: '45-Degree Leg Press', pattern: 'squat', equipment: ['machine'], primaryMuscles: ['quads', 'glutes'], category: 'compound' },
  { name: 'Horizontal Seated Leg Press', pattern: 'squat', equipment: ['machine'], primaryMuscles: ['quads', 'glutes'], category: 'compound' },
  { name: 'Single-Leg Leg Press', pattern: 'squat', equipment: ['machine'], primaryMuscles: ['quads', 'glutes'], category: 'compound' },
  { name: 'Pendulum Squat', pattern: 'squat', equipment: ['machine'], primaryMuscles: ['quads', 'glutes'], category: 'compound' },
  { name: 'Belt Squat', pattern: 'squat', equipment: ['machine'], primaryMuscles: ['quads', 'glutes'], category: 'compound' },
  { name: 'V-Squat Machine', pattern: 'squat', equipment: ['machine'], primaryMuscles: ['quads', 'glutes'], category: 'compound' },
  { name: 'Seated Leg Curl', pattern: 'isolation', equipment: ['machine'], primaryMuscles: ['hamstrings'], category: 'isolation' },
  { name: 'Lying Leg Curl', pattern: 'isolation', equipment: ['machine'], primaryMuscles: ['hamstrings'], category: 'isolation' },
  { name: 'Standing Leg Curl', pattern: 'isolation', equipment: ['machine'], primaryMuscles: ['hamstrings'], category: 'isolation' },
  { name: 'Hip Abductor Machine', pattern: 'isolation', equipment: ['machine'], primaryMuscles: ['abductors', 'glutes'], category: 'isolation' },
  { name: 'Hip Adductor Machine', pattern: 'isolation', equipment: ['machine'], primaryMuscles: ['adductors'], category: 'isolation' },
  { name: 'Glute Kickback Machine', pattern: 'isolation', equipment: ['machine'], primaryMuscles: ['glutes'], category: 'isolation' },
  { name: 'Hip Thrust Machine', pattern: 'hinge', equipment: ['machine'], primaryMuscles: ['glutes'], category: 'compound' },
  { name: 'Standing Calf Raise Machine', pattern: 'isolation', equipment: ['machine'], primaryMuscles: ['calves'], category: 'isolation' },
  { name: 'Seated Calf Raise Machine', pattern: 'isolation', equipment: ['machine'], primaryMuscles: ['calves'], category: 'isolation' },
  { name: 'Donkey Calf Raise Machine', pattern: 'isolation', equipment: ['machine'], primaryMuscles: ['calves'], category: 'isolation' },
  { name: 'Reverse Hyperextension Machine', pattern: 'hinge', equipment: ['machine'], primaryMuscles: ['glutes', 'hamstrings', 'back'], category: 'isolation' },

  // Chest
  { name: 'Incline Chest Press Machine', pattern: 'horizontal_push', equipment: ['machine'], primaryMuscles: ['chest', 'shoulders'], category: 'compound' },
  { name: 'Decline Chest Press Machine', pattern: 'horizontal_push', equipment: ['machine'], primaryMuscles: ['chest', 'triceps'], category: 'compound' },
  { name: 'Pec Deck', pattern: 'horizontal_push', equipment: ['machine'], primaryMuscles: ['chest'], category: 'isolation' },
  { name: 'Machine Chest Fly', pattern: 'horizontal_push', equipment: ['machine'], primaryMuscles: ['chest'], category: 'isolation' },
  { name: 'Plate-Loaded Chest Press', pattern: 'horizontal_push', equipment: ['machine'], primaryMuscles: ['chest', 'triceps'], category: 'compound' },
  { name: 'Plate-Loaded Incline Chest Press', pattern: 'horizontal_push', equipment: ['machine'], primaryMuscles: ['chest', 'shoulders'], category: 'compound' },
  { name: 'Seated Dip Machine', pattern: 'horizontal_push', equipment: ['machine'], primaryMuscles: ['chest', 'triceps'], category: 'compound' },

  // Shoulders
  { name: 'Shoulder Press Machine', pattern: 'vertical_push', equipment: ['machine'], primaryMuscles: ['shoulders', 'triceps'], category: 'compound' },
  { name: 'Plate-Loaded Shoulder Press', pattern: 'vertical_push', equipment: ['machine'], primaryMuscles: ['shoulders', 'triceps'], category: 'compound' },
  { name: 'Rear Delt Machine', pattern: 'isolation', equipment: ['machine'], primaryMuscles: ['rear delts'], category: 'isolation' },
  { name: 'Reverse Pec Deck', pattern: 'isolation', equipment: ['machine'], primaryMuscles: ['rear delts', 'upper back'], category: 'isolation' },
  { name: 'Lateral Raise Machine', pattern: 'isolation', equipment: ['machine'], primaryMuscles: ['shoulders'], category: 'isolation' },

  // Back / pulldown / row
  { name: 'Wide-Grip Lat Pulldown', pattern: 'vertical_pull', equipment: ['cable', 'machine'], primaryMuscles: ['lats'], category: 'compound' },
  { name: 'Close-Grip Lat Pulldown', pattern: 'vertical_pull', equipment: ['cable', 'machine'], primaryMuscles: ['lats', 'biceps'], category: 'compound' },
  { name: 'Reverse-Grip Lat Pulldown', pattern: 'vertical_pull', equipment: ['cable', 'machine'], primaryMuscles: ['lats', 'biceps'], category: 'compound' },
  { name: 'Neutral-Grip Lat Pulldown', pattern: 'vertical_pull', equipment: ['cable', 'machine'], primaryMuscles: ['lats', 'biceps'], category: 'compound' },
  { name: 'Seated Row Machine', pattern: 'horizontal_pull', equipment: ['machine'], primaryMuscles: ['back'], category: 'compound' },
  { name: 'Wide-Grip Seated Row Machine', pattern: 'horizontal_pull', equipment: ['machine'], primaryMuscles: ['back', 'upper back'], category: 'compound' },
  { name: 'Close-Grip Seated Row Machine', pattern: 'horizontal_pull', equipment: ['machine'], primaryMuscles: ['back', 'lats'], category: 'compound' },
  { name: 'T-Bar Row', pattern: 'horizontal_pull', equipment: ['machine', 'barbell'], primaryMuscles: ['back'], category: 'compound' },
  { name: 'Chest-Supported T-Bar Row', pattern: 'horizontal_pull', equipment: ['machine'], primaryMuscles: ['back'], category: 'compound' },
  { name: 'Assisted Pull-Up', pattern: 'vertical_pull', equipment: ['machine'], primaryMuscles: ['lats', 'biceps'], category: 'compound', difficulty: 'beginner' },
  { name: 'Assisted Dip', pattern: 'horizontal_push', equipment: ['machine'], primaryMuscles: ['chest', 'triceps'], category: 'compound', difficulty: 'beginner' },
  { name: 'Machine Pullover', pattern: 'vertical_pull', equipment: ['machine'], primaryMuscles: ['lats', 'chest'], category: 'isolation' },
  { name: 'High Row Machine', pattern: 'horizontal_pull', equipment: ['machine'], primaryMuscles: ['upper back', 'lats'], category: 'compound' },
  { name: 'Low Row Machine', pattern: 'horizontal_pull', equipment: ['machine'], primaryMuscles: ['back', 'lats'], category: 'compound' },
  { name: 'Plate-Loaded Low Row', pattern: 'horizontal_pull', equipment: ['machine'], primaryMuscles: ['back', 'lats'], category: 'compound' },

  // Smith machine
  { name: 'Smith Machine Back Squat', pattern: 'squat', equipment: ['machine'], primaryMuscles: ['quads', 'glutes'], category: 'compound' },
  { name: 'Smith Machine Front Squat', pattern: 'squat', equipment: ['machine'], primaryMuscles: ['quads', 'core'], category: 'compound' },
  { name: 'Smith Machine Split Squat', pattern: 'lunge', equipment: ['machine'], primaryMuscles: ['quads', 'glutes'], category: 'compound' },
  { name: 'Smith Machine Lunge', pattern: 'lunge', equipment: ['machine'], primaryMuscles: ['quads', 'glutes'], category: 'compound' },
  { name: 'Smith Machine Bench Press', pattern: 'horizontal_push', equipment: ['machine'], primaryMuscles: ['chest', 'triceps'], category: 'compound' },
  { name: 'Smith Machine Incline Bench Press', pattern: 'horizontal_push', equipment: ['machine'], primaryMuscles: ['chest', 'shoulders'], category: 'compound' },
  { name: 'Smith Machine Shoulder Press', pattern: 'vertical_push', equipment: ['machine'], primaryMuscles: ['shoulders', 'triceps'], category: 'compound' },
  { name: 'Smith Machine Romanian Deadlift', pattern: 'hinge', equipment: ['machine'], primaryMuscles: ['hamstrings', 'glutes'], category: 'compound' },
  { name: 'Smith Machine Calf Raise', pattern: 'isolation', equipment: ['machine'], primaryMuscles: ['calves'], category: 'isolation' },
  { name: 'Smith Machine Hip Thrust', pattern: 'hinge', equipment: ['machine'], primaryMuscles: ['glutes'], category: 'compound' },
  { name: 'Smith Machine Bent-Over Row', pattern: 'horizontal_pull', equipment: ['machine'], primaryMuscles: ['back'], category: 'compound' },

  // Cable stations / attachments (also tagged machine for the Machine filter)
  { name: 'Cable Crossover', pattern: 'horizontal_push', equipment: ['cable', 'machine'], primaryMuscles: ['chest'], category: 'isolation' },
  { name: 'Low Cable Fly', pattern: 'horizontal_push', equipment: ['cable', 'machine'], primaryMuscles: ['chest'], category: 'isolation' },
  { name: 'High Cable Fly', pattern: 'horizontal_push', equipment: ['cable', 'machine'], primaryMuscles: ['chest'], category: 'isolation' },
  { name: 'Cable Rear Delt Fly', pattern: 'isolation', equipment: ['cable', 'machine'], primaryMuscles: ['rear delts'], category: 'isolation' },
  { name: 'Cable Pullover', pattern: 'vertical_pull', equipment: ['cable', 'machine'], primaryMuscles: ['lats'], category: 'isolation' },
  { name: 'Cable Pull-Through', pattern: 'hinge', equipment: ['cable', 'machine'], primaryMuscles: ['glutes', 'hamstrings'], category: 'compound' },
  { name: 'Cable Glute Kickback', pattern: 'isolation', equipment: ['cable', 'machine'], primaryMuscles: ['glutes'], category: 'isolation' },
  { name: 'Cable Hip Abduction', pattern: 'isolation', equipment: ['cable', 'machine'], primaryMuscles: ['abductors', 'glutes'], category: 'isolation' },
  { name: 'Cable Bicep Curl', pattern: 'isolation', equipment: ['cable', 'machine'], primaryMuscles: ['biceps'], category: 'isolation' },
  { name: 'Rope Hammer Curl', pattern: 'isolation', equipment: ['cable', 'machine'], primaryMuscles: ['biceps'], category: 'isolation' },
  { name: 'Rope Tricep Pushdown', pattern: 'isolation', equipment: ['cable', 'machine'], primaryMuscles: ['triceps'], category: 'isolation' },
  { name: 'Reverse-Grip Tricep Pushdown', pattern: 'isolation', equipment: ['cable', 'machine'], primaryMuscles: ['triceps'], category: 'isolation' },
  { name: 'Overhead Cable Tricep Extension', pattern: 'isolation', equipment: ['cable', 'machine'], primaryMuscles: ['triceps'], category: 'isolation' },
  { name: 'Cable Woodchop', pattern: 'core', equipment: ['cable', 'machine'], primaryMuscles: ['core'], category: 'isolation' },
  { name: 'Cable Lateral Raise', pattern: 'isolation', equipment: ['cable', 'machine'], primaryMuscles: ['shoulders'], category: 'isolation' },
  { name: 'Single-Arm Cable Row', pattern: 'horizontal_pull', equipment: ['cable', 'machine'], primaryMuscles: ['back'], category: 'compound' },

  // Core / arms machines
  { name: 'Ab Crunch Machine', pattern: 'core', equipment: ['machine'], primaryMuscles: ['abs'], category: 'isolation' },
  { name: 'Rotary Torso Machine', pattern: 'core', equipment: ['machine'], primaryMuscles: ['core'], category: 'isolation' },
  { name: "Captain's Chair Knee Raise", pattern: 'core', equipment: ['machine'], primaryMuscles: ['abs'], category: 'isolation' },
  { name: 'Preacher Curl Machine', pattern: 'isolation', equipment: ['machine'], primaryMuscles: ['biceps'], category: 'isolation' },
  { name: 'Bicep Curl Machine', pattern: 'isolation', equipment: ['machine'], primaryMuscles: ['biceps'], category: 'isolation' },
  { name: 'Tricep Extension Machine', pattern: 'isolation', equipment: ['machine'], primaryMuscles: ['triceps'], category: 'isolation' }
];
