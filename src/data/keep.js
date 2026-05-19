// ─── The Keep — a small library of readings ───────────────────────
// Short essays in the tradition of Tish Warren, Wendell Berry,
// Henri Nouwen. One is surfaced per week on the Today tab.
//
// To add an essay: append to KEEP_ESSAYS. The library rotates
// weekly using ISO week-of-year, so the cycle length matches the
// library size. Aim for short — 200 to 400 words. Plain paragraphs
// separated by blank lines.

export const KEEP_ESSAYS = [
  {
    slug: 'on-the-laundry-that-is-never-done',
    title: 'On the laundry that is never done',
    body: `The laundry is never done. The dishes are never done. The hallway is never quite tidy. This is not a failure of will. It is the shape of the work.

A house with people in it produces. A child eats and the plate is dirty; the child sleeps and the bed is mussed; the child plays and the floor is strewn. The work of a home is not a project that finishes. It is a tending — one that lasts as long as the love does.

To accept this is not to give up. It is to stop being defeated by what was never a defeat. The laundry will be there tomorrow. So will you. So will they. Tend what is in front of you, and then put the basket down.`,
  },
  {
    slug: 'a-small-table-set-for-four',
    title: 'A small table set for four',
    body: `Most of what a mother does is invisible. The crusts trimmed, the song hummed at 3 a.m., the third reading of the same book. None of it photographs well. None of it is what the world calls accomplishment.

But these are the materials of a life. A child does not remember the cleaned baseboards. She remembers the table set for four, the same way, week after week, in a house where someone made it so.

You are making it so. The setting of a small table is not a small thing.`,
  },
  {
    slug: 'the-day-asks-only-what-the-day-asks',
    title: 'The day asks only what the day asks',
    body: `The day is not a competition. It is not a list to be defeated. It is the hours that are given to you, and the people who are in them, and the small acts that connect one hour to the next.

When the day asks for patience, give patience. When it asks for soup, make soup. When it asks for you to sit on the floor with a small person who is upset, sit on the floor. Do not measure the day by what you have crossed off. The crossings off are only one kind of work, and not the most important one.

What was done with love today was enough. The rest will keep until tomorrow.`,
  },
];

// Returns the essay whose index matches the ISO week-of-year modulo
// the library size. Same essay all week; rotates on the week boundary.
export function essayOfWeek(today = new Date()) {
  const week = isoWeek(today);
  const idx = (week - 1) % KEEP_ESSAYS.length;
  return KEEP_ESSAYS[idx];
}

export function essayBySlug(slug) {
  return KEEP_ESSAYS.find((e) => e.slug === slug);
}

export function allEssays() {
  return KEEP_ESSAYS;
}

// ISO 8601 week number. Week 1 contains the year's first Thursday.
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}
