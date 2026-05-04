// ─── First-run seed data ──────────────────────────────────────────
// What Tiff sees the very first time she opens the app.
// After that, everything is editable and saved to her device.

export const ZONE_ORDER = [
  'The Kitchen',
  'The Bathrooms',
  'Living Areas',
  'The Bedrooms',
  'Laundry & Floors',
];

export const INITIAL_TASKS = {
  'The Kitchen': [
    { id: 1, label: 'Wipe down counters', done: false },
    { id: 2, label: 'Clear sink + run dishwasher', done: false },
    { id: 3, label: 'Sweep under the high chair', done: false },
  ],
  'The Bathrooms': [
    { id: 4, label: 'Wipe sinks + mirrors', done: false },
    { id: 5, label: 'Quick toilet swipe', done: false },
    { id: 6, label: 'Toss towels in the wash', done: false },
  ],
  'Living Areas': [
    { id: 7, label: 'Toy basket reset', done: false },
    { id: 8, label: 'Wipe coffee table', done: false },
    { id: 9, label: 'Vacuum the rug', done: false },
  ],
  'The Bedrooms': [
    { id: 10, label: 'Make beds', done: false },
    { id: 11, label: 'Clear nightstands', done: false },
    { id: 12, label: 'Tidy closets', done: false },
  ],
  'Laundry & Floors': [
    { id: 13, label: 'One load through', done: false },
    { id: 14, label: 'Sweep main floor', done: false },
    { id: 15, label: 'Mop kitchen', done: false },
  ],
};

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

export const INITIAL_GROCERIES = [
  { id: 1, item: 'Milk', got: false },
  { id: 2, item: 'Eggs', got: false },
  { id: 3, item: 'Berries', got: false },
];

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
