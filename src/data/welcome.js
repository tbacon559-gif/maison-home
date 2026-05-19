// ─── Welcome messages library ─────────────────────────────────────
// A short message is shown each time the app is opened. The whole
// library is read aloud over a long time; the goal is for any one of
// these to feel sturdy in a tired moment.
//
// Voice rules (from positioning spec, May 2026):
//   - Contemplative. Dignified. Quiet beats cheerful.
//   - No exclamation marks. No hashtag-mom. No "you got this."
//   - Borrow the cadence of Wendell Berry, Tish Warren, Mary Oliver.
//   - The work of the home is real work. We never speak down to it.
//
// To add a message: append to the array below. Aim for short — one
// breath. Attribution is optional.

export const WELCOME_MESSAGES = [
  { eyebrow: 'A reminder', body: 'Rest is not a reward for finishing. It is part of the work.' },
  { eyebrow: 'A reminder', body: 'Slow is okay. Small is okay. Showing up is the whole thing.' },
  { eyebrow: 'A reminder', body: 'You are allowed to be tired. You are allowed to be human.' },
  { eyebrow: 'A reminder', body: 'Imperfect days still count. They might count the most.' },
  { eyebrow: 'A small thought', body: 'Do small things with great love.', attribution: '— Mother Teresa' },
  { eyebrow: 'A small thought', body: 'There is no way to be a perfect mother, and a million ways to be a good one.', attribution: '— Jill Churchill' },
  { eyebrow: 'For today', body: 'Choose one thing and let the rest go.' },
  { eyebrow: 'For today', body: 'The work of the home is real work. So is the rest from it.' },
  { eyebrow: 'For today', body: 'A folded sheet, a peeled apple, the back of a small head. The day is made of these.' },
  { eyebrow: 'For today', body: 'What you tend, tends you back.' },
];

export function pickWelcomeMessage() {
  return WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];
}
