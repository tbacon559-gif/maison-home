// ─── First-run seed data ──────────────────────────────────────────
// What Tiff sees the very first time she opens the app.
// After that, everything is editable and saved to her device.

// ─── Daily chores (resets every day at midnight) ─────────────────
export const INITIAL_DAILY = {
  day: [
    { id: 1, label: 'Wipe down counters', done: false },
    { id: 2, label: 'Toy basket reset', done: false },
    { id: 3, label: 'Switch laundry', done: false },
    { id: 4, label: 'Make the beds', done: false },
    { id: 5, label: 'Quick toilet swipe', done: false },
  ],
  night: [
    { id: 6, label: 'Run dishwasher', done: false },
    { id: 7, label: 'Sweep main floor', done: false },
    { id: 8, label: 'Tidy living room', done: false },
    { id: 9, label: 'Reset counters for morning', done: false },
  ],
};

// ─── Weekly chores (resets every Sunday) ─────────────────────────
export const INITIAL_WEEKLY = [
  { id: 1, label: 'Mop kitchen floor', done: false },
  { id: 2, label: 'Deep clean bathrooms', done: false },
  { id: 3, label: 'Vacuum the rugs', done: false },
  { id: 4, label: 'Change bed sheets', done: false },
  { id: 5, label: 'Dust surfaces', done: false },
  { id: 6, label: 'Wipe baseboards', done: false },
  { id: 7, label: 'Clean out fridge', done: false },
];

// ─── Streak settings ─────────────────────────────────────────────
export const STREAK_THRESHOLD = 0.8;
export const GRACE_PER_MONTH = 2;

export const INITIAL_STREAK = {
  current: 0,
  best: 0,
  lastCheckedDate: null,
  graceUsedThisMonth: 0,
  graceMonth: null,
};

// ─── Meals ────────────────────────────────────────────────────────
export const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const FULL_DAY = {
  Sun: 'Sunday',
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
};

export const INITIAL_MEALS = {
  Sun: { B: 'Yogurt parfaits + toast', L: 'PB&Js, apple slices, cheese', D: 'Sheet-pan chicken + rice' },
  Mon: { B: 'Cereal + berries', L: 'Mac and cheese', D: 'Taco night' },
  Tue: { B: 'Toast + scrambled eggs', L: 'Quesadillas', D: 'Spaghetti + salad' },
  Wed: { B: 'Oatmeal + bananas', L: 'Leftover spaghetti', D: 'Slow-cooker pulled pork' },
  Thu: { B: 'Smoothies', L: 'Grilled cheese + tomato soup', D: 'Pulled pork sandwiches' },
  Fri: { B: 'Pancakes', L: 'Hot dogs + fruit', D: 'Pizza night' },
  Sat: { B: 'Eggs + bacon', L: 'Out', D: 'Burgers on the grill' },
};

// ─── Lists ────────────────────────────────────────────────────────
export const INITIAL_GROCERIES = [
  { id: 1, item: 'Milk', got: false },
  { id: 2, item: 'Eggs', got: false },
  { id: 3, item: 'Berries', got: false },
];

export const INITIAL_TOBUY = [
  { id: 1, item: 'Paper towels', got: false },
  { id: 2, item: 'Dish soap refill', got: false },
];

export const INITIAL_NOTES = [];

// ─── Girls + household ────────────────────────────────────────────
export const INITIAL_GIRLS = [
  { id: 1, name: 'Mary Nolen', birthday: '2023-06-27', clothes: '3T', shoe: '7', diaper: 'Pull-Ups 3T', allergies: 'None known' },
  { id: 2, name: 'Ruth', birthday: '2025-03-17', clothes: '12-18 mo', shoe: '4', diaper: 'Size 4', allergies: 'None known' },
];

export const INITIAL_HOUSEHOLD = [
  { key: 'Pediatrician', value: '' },
  { key: 'Emergency', value: '' },
  { key: 'Wi-Fi', value: '' },
];

export const INITIAL_SITTER_NOTES = '';

export const INITIAL_MOMENTS = [];

export const INITIAL_SETTINGS = {
  calendarUrl: '',
  hasOpenedBefore: false,
};
