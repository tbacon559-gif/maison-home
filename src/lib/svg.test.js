import { describe, it, expect } from 'vitest';
import { buildSitterCardSVG, buildMomentSVG } from './svg.js';

const sampleGirls = [
  {
    id: 1,
    name: 'Mary Nolen',
    birthday: '2023-06-27',
    clothes: '3T',
    shoe: '7',
    diaper: 'Pull-Ups 3T',
    allergies: 'None known',
  },
  {
    id: 2,
    name: 'Ruth',
    birthday: '2025-03-17',
    clothes: '12-18 mo',
    shoe: '4',
    diaper: 'Size 4',
    allergies: '',
  },
];

const sampleHousehold = [
  { key: 'Pediatrician', value: 'Dr. Smith — 555-0100' },
  { key: 'Emergency', value: '555-0199' },
  { key: 'Wi-Fi', value: '' },
];

describe('buildSitterCardSVG', () => {
  it('returns a complete SVG document', () => {
    const out = buildSitterCardSVG(sampleGirls, sampleHousehold, 'Naps at 1pm');
    expect(out).toMatch(/^<svg /);
    expect(out).toMatch(/<\/svg>$/);
    expect(out).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it("includes each girl's name", () => {
    const out = buildSitterCardSVG(sampleGirls, [], '');
    expect(out).toContain('>Mary Nolen<');
    expect(out).toContain('>Ruth<');
  });

  it('includes the household section header when any value is present', () => {
    const out = buildSitterCardSVG(sampleGirls, sampleHousehold, '');
    expect(out).toContain('IF YOU NEED IT');
    expect(out).toContain('Dr. Smith');
  });

  it('omits the household section when all values are blank', () => {
    const blank = sampleHousehold.map((h) => ({ ...h, value: '' }));
    const out = buildSitterCardSVG(sampleGirls, blank, '');
    expect(out).not.toContain('IF YOU NEED IT');
  });

  it('omits individual rows whose value is empty', () => {
    const out = buildSitterCardSVG(sampleGirls, sampleHousehold, '');
    // Wi-Fi row had empty value; its uppercase label should not appear.
    expect(out).not.toMatch(/>WI-FI</);
  });

  it('includes the NOTES section when sitterNotes is present', () => {
    const out = buildSitterCardSVG(sampleGirls, [], 'Naps at 1pm. No nuts.');
    expect(out).toContain('NOTES');
    expect(out).toContain('Naps at 1pm');
  });

  it('omits NOTES when sitterNotes is blank or whitespace only', () => {
    expect(buildSitterCardSVG(sampleGirls, [], '')).not.toContain('NOTES');
    expect(buildSitterCardSVG(sampleGirls, [], '   \n  ')).not.toContain('NOTES');
  });

  it('escapes XML-special characters in user data', () => {
    const evilGirls = [{ ...sampleGirls[0], name: '<script>&"', allergies: "Tom's & Co." }];
    const out = buildSitterCardSVG(evilGirls, [], '');
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;script&gt;');
    expect(out).toContain('&amp;');
    expect(out).toContain('Tom&apos;s');
  });

  it('skips fields that are missing on a girl', () => {
    const partial = [{ id: 1, name: 'Solo', birthday: '', clothes: '', shoe: '', diaper: '', allergies: '' }];
    const out = buildSitterCardSVG(partial, [], '');
    expect(out).toContain('>Solo<');
    expect(out).not.toMatch(/>BIRTHDAY</);
    expect(out).not.toMatch(/>CLOTHES</);
  });
});

describe('buildMomentSVG', () => {
  it('returns a complete SVG document', () => {
    const out = buildMomentSVG({ id: 1, date: 'Jun 10', text: 'A good day' }, null, null);
    expect(out).toMatch(/^<svg /);
    expect(out).toMatch(/<\/svg>$/);
  });

  it('embeds the photo data url as <image href>', () => {
    const dataUrl = 'data:image/png;base64,abc';
    const out = buildMomentSVG({ id: 1, date: 'Jun 10', text: 'cap' }, dataUrl, { w: 100, h: 75 });
    expect(out).toContain(`href="${dataUrl}"`);
  });

  it('omits the <image> element when no photo data is supplied', () => {
    const out = buildMomentSVG({ id: 1, date: 'Jun 10', text: 'cap' }, null, null);
    expect(out).not.toContain('<image ');
  });

  it("uppercases the moment's date in the footer band", () => {
    const out = buildMomentSVG({ id: 1, date: 'Jun 10', text: 'cap' }, null, null);
    expect(out).toContain('JUN 10');
  });

  it('escapes caption content', () => {
    const out = buildMomentSVG({ id: 1, date: 'Jun 10', text: 'a < b & c' }, null, null);
    expect(out).not.toMatch(/>a < b/);
    expect(out).toContain('&lt;');
    expect(out).toContain('&amp;');
  });

  it('wraps long captions across multiple text nodes', () => {
    const longCaption = 'one two three four five six seven eight nine ten eleven twelve thirteen';
    const out = buildMomentSVG({ id: 1, date: 'Jun 10', text: longCaption }, null, null);
    // wrapText splits at ~38 chars, so this caption produces 2+ <text> lines.
    const captionMatches = out.match(/font-size="44"/g) || [];
    expect(captionMatches.length).toBeGreaterThanOrEqual(2);
  });
});
