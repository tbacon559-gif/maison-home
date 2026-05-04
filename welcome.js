// ─── Welcome messages library ─────────────────────────────────────
// Edit these freely. Each message:
//   - eyebrow: small uppercase tag at the top
//   - body: the main message (italic serif)
//   - attribution (optional): smaller line below
//
// A random one is shown each time the app is opened. Mix the categories so
// it stays fresh — love notes mixed with affirmations mixed with smiles.
//
// To personalize: replace generic ones with messages in your real voice,
// inside jokes, or specific memories.

export const WELCOME_MESSAGES = [
  // ─── Love notes from her husband ────────────────────────────────
  { eyebrow: 'A note', body: 'You are the reason this house feels like home.', attribution: '— love, your husband' },
  { eyebrow: 'A note', body: "I see how hard you work. Even on the days you don't feel seen.", attribution: '— love, your husband' },
  { eyebrow: 'A note', body: 'Mary Nolen and Ruth are lucky. So am I.', attribution: '— love, your husband' },
  { eyebrow: 'A note', body: "The girls won't remember a clean house. They'll remember you.", attribution: '— love, your husband' },
  { eyebrow: 'A note', body: "You are doing one of the hardest jobs in the world. And you're doing it beautifully.", attribution: '— love, your husband' },
  { eyebrow: 'A note', body: "Whatever today holds — I'm proud of you.", attribution: '— love, your husband' },
  { eyebrow: 'A note', body: 'Thank you for choosing this life with me.', attribution: '— love, your husband' },
  { eyebrow: 'A note', body: 'I fall in love with you a little more every time I watch you with our girls.', attribution: '— love, your husband' },

  // ─── Affirmations ───────────────────────────────────────────────
  { eyebrow: 'A reminder', body: 'You are enough — exactly as you are, today.' },
  { eyebrow: 'A reminder', body: "Rest is not a reward for finishing. It's part of the work." },
  { eyebrow: 'A reminder', body: 'A messy house with happy children is a life well-lived.' },
  { eyebrow: 'A reminder', body: "You don't have to do it all today." },
  { eyebrow: 'A reminder', body: 'Slow is okay. Small is okay. Showing up is the whole thing.' },
  { eyebrow: 'A reminder', body: 'Your patience today is shaping who they will become.' },
  { eyebrow: 'A reminder', body: 'The most important work happens off-camera.' },
  { eyebrow: 'A reminder', body: 'You are allowed to be tired. You are allowed to be human.' },
  { eyebrow: 'A reminder', body: 'Imperfect days still count. They might count the most.' },

  // ─── Reframes (for the days the house stayed messy) ────────────
  { eyebrow: 'Today', body: "The laundry will keep. The toddlers won't." },
  { eyebrow: 'Today', body: 'Whatever gets done, gets done. The rest can wait.' },
  { eyebrow: 'Today', body: 'Snuggles count as productivity.' },
  { eyebrow: 'Today', body: 'You are building something invisible and unbreakable.' },
  { eyebrow: 'Today', body: 'The little moments are the big moments.' },
  { eyebrow: 'Today', body: 'Be where your feet are.' },
  { eyebrow: 'Today', body: 'You are their whole world. Try to remember how good that is.' },

  // ─── Soft starts ────────────────────────────────────────────────
  { eyebrow: 'Take a breath', body: 'Inhale slowly. Hold. Exhale even slower. Now begin.' },
  { eyebrow: 'Take a breath', body: 'Whatever yesterday was — today is new.' },
  { eyebrow: 'Take a breath', body: 'There is grace for this morning.' },
  { eyebrow: 'Take a breath', body: "You don't have to figure it all out before the coffee." },
  { eyebrow: 'Take a breath', body: 'Soft start. Slow morning. Gentle pace.' },

  // ─── Gentle wisdom ──────────────────────────────────────────────
  { eyebrow: 'A small thought', body: 'Comparison is the thief of joy. Stay in your lane today.', attribution: '— Theodore Roosevelt, paraphrased' },
  { eyebrow: 'A small thought', body: 'Do small things with great love.', attribution: '— Mother Teresa' },
  { eyebrow: 'A small thought', body: 'She who plants a garden plants happiness.' },
  { eyebrow: 'A small thought', body: 'And so I think the bravest thing you can do is keep going.' },
  { eyebrow: 'A small thought', body: 'Joy is what happens to us when we allow ourselves to recognize how good things really are.', attribution: '— Marianne Williamson' },
  { eyebrow: 'A small thought', body: 'There is no way to be a perfect mother, and a million ways to be a good one.', attribution: '— Jill Churchill' },

  // ─── Smiles ─────────────────────────────────────────────────────
  { eyebrow: 'A small smile', body: "Today's forecast: 100% chance of being needed for snacks." },
  { eyebrow: 'A small smile', body: "You've changed approximately 14,000 diapers. Approximately." },
  { eyebrow: 'A small smile', body: "Coffee is a love language. Drink it while it's hot." },
  { eyebrow: 'A small smile', body: 'Hide-and-seek champion. Snack negotiator. Sock locator. CEO of this house.' },
  { eyebrow: 'A small smile', body: "Today's goal: keep two tiny humans alive and somewhat happy. The bar is appropriately low." },
  { eyebrow: 'A small smile', body: 'You are a mom. You can do hard things. And also — naps are encouraged.' },

  // ─── Family-specific ────────────────────────────────────────────
  { eyebrow: 'Just so you know', body: 'Mary Nolen thinks you hung the moon. Ruth agrees, in her own way.' },
  { eyebrow: 'Just so you know', body: 'Two little girls are going to remember being raised by you. What a gift.' },
  { eyebrow: 'Just so you know', body: 'Their first home is you.' },
  { eyebrow: 'Just so you know', body: 'The way you love them is the way they will love.' },
  { eyebrow: 'Just so you know', body: "You're not just raising daughters. You're raising women." },

  // ─── Closing notes ──────────────────────────────────────────────
  { eyebrow: 'For today', body: "Be kind to yourself. You're doing the work that matters." },
  { eyebrow: 'For today', body: 'Choose one thing and let the rest go.' },
  { eyebrow: 'For today', body: 'Even on the messy days, you are enough.' },
  { eyebrow: 'For today', body: 'The good days outnumber the hard ones. Hold onto that.' },
];

export function pickWelcomeMessage() {
  return WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];
}
