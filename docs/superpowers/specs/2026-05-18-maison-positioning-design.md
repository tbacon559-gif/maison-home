# Maison — Positioning & GTM Design

**Date:** 2026-05-18
**Status:** Approved positioning spec. Constraint document for the three downstream specs (Productize, Native packaging, Feature depth).
**Scope:** WHO Maison is for, WHAT it uniquely does, HOW it's priced, HOW it reaches the customer, WHAT success looks like. Not WHAT to build technically (that's *Feature depth*) or HOW to ship it (*Productize*, *Native packaging*).

---

## 1. Positioning statement & ICP

### Positioning statement (locked)
> **Maison is the only app that treats homemaking as a calling, not a chore.**

### One-sentence customer-facing line
> *A calm place for the work of the home — held with care, kept with you.*

### Ideal Customer Profile

Concentric circles, narrowest first:

1. **Core (bullseye).** Ministry wife — pastor, planter, missionary, chaplain — raising young kids at home. Reads Risen Motherhood, has bought Powersheets at least once, follows a few "intentional Christian mom" voices on Instagram. Likely 28–40. Single-income household. Aesthetic-conscious. Spends $30–80/yr on planners, journals, and Christian women's content.
2. **Reachable adjacent.** Christian SAHM, not married to clergy, otherwise identical profile. Larger pool, same wedge resonance.
3. **Possible spillover.** Intentional-living secular moms who like the aesthetic and don't bounce off the framing. Not targeted; welcomed if they show up.

### Anti-ICP (we are not building for)

- The mom optimizing her household with spreadsheets and Notion.
- The mom who wants the family calendar shared with her husband first (that's Cozi).
- The mom looking for a chore-rotation gamification app (Tody / Sweepy).
- Any SAHM segment that finds religious framing alienating. They are not the buyer.

### The wedge

The one true thing Maison does that nothing else does: **dignify the work of the home as a calling, not a productivity surface.** Every existing feature (Tidy, Kitchen, Girls, Moments) becomes liturgy, not productivity. The real competition is not Cozi or Notion — it is **paper planners** (Powersheets, Cultivate What Matters, The Daily Grace Co., Lara Casey) and **inertia** (most moms use nothing structured).

---

## 2. Voice & tone

Modeled on Mantle's brand-doc structure so the two products' voice docs are legible to the same reader.

### We are
- **Contemplative** — sentences that breathe. Room between phrases.
- **Dignified** — the work of the home is real work. We never speak down to it.
- **Literary** — borrowed grammar from Wendell Berry, Tish Warren, Robin Wall Kimmerer, Mary Oliver. Particular nouns. Active verbs. Almost no adverbs.
- **Warm** — never austere. The Mantle voice is a granite cathedral; Maison's voice is a kitchen with afternoon light in it.
- **Plainspoken** — short words when short words will do. "The work of the home," not "household management."
- **Particular** — *folded laundry, a peeled apple, the back of a small head, the third reading of the book.* Specifics carry the dignity. Abstractions kill it.

### We are not
- **Cute or twee** — no "mama," no "tribe," no "you got this," no hand-lettered exclamations.
- **Hashtag-mom** — no "#momlife," no "wine o'clock," no irony about parenting being hard.
- **Productivity-bro** — no streaks, no "crush your day," no metrics dressed as motivation.
- **Performatively religious** — no scripture verses as decoration, no "Bible-verse-of-the-day," no prayer prompts inside tasks. The framing is Christian; the surface is not.
- **Prescriptive** — we do not tell her how to be a good mom. We hold what she already carries.
- **Cheerful** — quiet beats cheerful. A pastor's wife at 9pm does not need a cheerleader.

### Voice in practice — current copy vs. revised

| Current Maison string | Revised |
|---|---|
| "Today's Wins" + "Every small thing counts." | "Today's Work" + "Small, particular, real." |
| "A clear head. Nothing pending." | "Nothing pending. A quiet head." |
| "The good stuff. Capture it before you forget." | "The ordinary, before it goes." |
| "Tap 'Today's Photos' to start your journal." | "When something matters today, keep it here." |
| Streak count + "X days" | *removed entirely* |

### Discipline rule

Every welcome note, empty state, button label, and empty-list line is hand-written. No template strings. No fill-in-the-blank. The product is one long piece of writing.

---

## 3. Product implications

Positioning forces choices about what the product *is*, not just how it talks. Three buckets: cut, reframe, add. Anything bigger (multi-user, native shell, sync) is deferred to its own spec.

### Cut

| Thing | Where it lives | Why cut |
|---|---|---|
| Streak system | `streak.js`, `INITIAL_STREAK`, `evaluateStreak`, `resetDaily/Weekly`, `shouldResetWeekly` | A streak is the most chore-ifying mechanic in software. "Calling, not chore" cannot coexist with it. |
| "Today's Wins" counter (big number) | `App.jsx` Today tab footer | Quietly scoring her day. Reframed below. |
| Any "X tasks done" surface | misc empty/state strings | Same. |

### Reframe

| Surface | Today | Becomes |
|---|---|---|
| Today tab footer | "Today's Wins" + count | "Today's Work" — no number, just a single hand-written line of acknowledgment that varies by time of day |
| Tidy | 5-day zone rotation with streak | Same rotation, no streak. Tab name workshopped (candidate: "The Keeping"). The week has a rhythm, not a scoreboard. |
| Kitchen | "Meals" + grocery list | Kept as Kitchen. Framed as *feeding people*, not *meal planning*. Empty state: "Who's home for dinner?" |
| Welcome notes (~50 templates) | Mixed quality, casual voice | Full rewrite. Cut to ~30 hand-crafted lines in the new voice. Rotate slowly so each is felt. |
| Moments | "The good stuff. Capture it before you forget." | "The ordinary, before it goes." Lighter prompts, more weight on photo + caption. |
| Empty states / button labels / microcopy | Mixed | Every string hand-rewritten. The product is one long piece of writing. |

### Add

Two new surfaces that directly express the wedge. Both are small, both buildable in the current PWA before any productization work.

1. **The Keep — a small library of founder-written readings.** Same pattern as Mantle's Library. 8–12 short essays from the founder in the Tish Warren / Wendell Berry tradition, on the dignity of ordinary domestic work. Lives behind a quiet entry point (not pushed). One new reading is gently surfaced on the Today tab per week as a single italicized line ("This week: *On the laundry that is never done*") that taps through. Never forced. Never read-it-now. This is where the wedge gets thickest inside the product.

2. **The Seventh Day — Sunday in Maison goes quiet.** Echoes Mantle's Sabbath without copying it. On Sundays the Today tab hides the task lists and shows: the week's Moments, one short line of acknowledgment, nothing to do. The app does not ask anything of her on Sunday. Distinctive (no competitor does this), reinforces the wedge in a single felt gesture, small to build.

### Out of scope (deferred)

- Multi-user / accounts / household onboarding → *Productize* spec
- Native packaging (Capacitor vs. SwiftUI) → *Native packaging* spec
- Partner / sitter live-sharing, push notifications, school calendar imports → *Feature depth* spec
- Cloud sync, backups, account restore → *Productize* spec
- AI of any kind → out of scope, period (matches Mantle V1)

---

## 4. Pricing & packaging

### Tier (one)
**Maison — $4.99/mo or $39/yr.** No bundle with Mantle. No freemium. No free tier.

**Why one tier:** the wedge is dignity, not features. A free version would force a value split ("which features are 'worth paying for'?") that breaks the framing. Either she is in or she is not.

### Trial
**14-day free trial, no credit card at signup.** Card requested at end of trial. Apple's App Store flow supports this cleanly.

### Annual discount
$39/yr = $3.25/mo, a 35% discount on monthly. Significant for a single-income household; small enough that monthly still works.

### Hardship pricing
**Mirrored from Mantle's Hardship Grant.** Free access for any woman in genuine crisis (postpartum, ministry burnout, divorce, financial hardship, caregiving for a sick child or parent). No proof, no shame, no application form. Surfaces as a "Request Access" link on the sign-in screen. Creates a flagged account in a `hardship_requests` table for manual approval. The underlying account system is *Productize* spec scope; this is the policy commitment.

### Founding members
**First 200 paying users: $29/yr for life.** Conversion incentive during launch window + creates a small named cohort the founder can write to directly when product changes ship.

### Refund policy
Apple handles via App Store. No proactive promise.

### Family / shared seat
Out of scope for V1. A single subscription = a single woman's devices. Husband / sitter access is *Feature depth* spec territory.

### Open
*How* payment is collected (Apple IAP vs. Stripe vs. both) is a *Native packaging* concern. Either works at this price point.

---

## 5. GTM channels & sequencing

Two channels, started in order. Content first (slow, compounding, free). Sponsorships second (paid acceleration once content has proof of voice).

### Phase 0 — before launch (months -2 to 0)

Founder-voice IG + Substack go live *before* the App Store listing does. The audience cannot be built post-launch; it must pre-exist or the launch lands on no one.

- **Target by launch day:** ~500 Substack subscribers, ~1k Instagram followers. Modest numbers — a small genuinely-listening audience of the right women converts at much higher rates than a big algorithmic one.
- **Cadence:** 1 Substack essay every 2 weeks; 2–3 IG posts per week.
- **Themes:** drawn from the brand thesis itself — the dignity of small work, the rhythms of a week at home, what "calling" means when it looks like folding clothes.
- **Discipline:** Tiff is the test reader for every essay. If she would not nod, it does not ship.

### Phase 1 — launch (months 0 to +2)

App Store listing goes live. First 200 founding-member spots open.

- Founder content shifts to weekly.
- Launch story (*I built this for my wife. Now I am sharing it.*) runs across IG, Substack, and is offered as a guest post to 3–5 aligned Christian-mom Substacks (no money, just trade).

### Phase 2 — sponsorships (month +3 onward, once founding spots are claimed)

**Target list, in priority order:** Risen Motherhood, Coffee + Crumbs, Tish Harrison Warren's Substack, The Lazy Genius (Kendra Adachi), Cultivate What Matters (Lara Casey).

- Start with one mid-tier sponsorship and measure (signup attribution via vanity URL or unique code).
- Scale only what converts.
- Budget ceiling for the first six months: a deliberately small number set by the founder, not an open spigot.

### Explicitly not doing (re-confirmed)

- No Mantle pricing bundle.
- No formal pastor's-wife network outreach.
- No paid IG / FB ads.
- No App Store paid placement.

These are doors closed on purpose — not forever, but not in V1.

### Measurement — one number per phase

- **Phase 0:** Substack subscriber growth rate.
- **Phase 1:** founding-member fill rate (how fast the 200 spots go).
- **Phase 2:** cost per acquired paying user from each sponsorship, judged at 90 days (not at click).

---

## 6. Success criteria & out-of-scope

### V1 success — first 12 months

1. **The product reads right.** Voice is consistent across every surface. No template strings, no copy that contradicts the wedge. Tiff and 3–5 other real ministry wives confirm "this is for me" on first open.
2. **The wedge is felt in customers' own words.** When founding members describe Maison in a sentence, they use *calling, dignity, calm, kept, ordinary* — not *calendar, to-do, meal planner.* Spot-checked via survey at day 30.
3. **The 200 founding-member spots fill within 90 days of App Store launch.** $5,800 first-year revenue is small in absolute terms — but it is the *is anyone actually buying* signal. If 200 women will not pay $29 for a year, the positioning is wrong.
4. **At least 1 of the 5 priority sponsorship voices accepts a paid spot in Phase 2.** Validates the channel.
5. **Day-90 paying-user retention ≥ 60%.** Subscription products live or die here.

### Fail signals — when we revisit positioning, not just the product

- Founding spots do not fill within 90 days → wedge or audience is wrong.
- Retention below 50% at day 90 → product is not holding up daily.
- Founding members describe Maison primarily in feature terms → voice failed to carry the framing.

### Out of scope — for the design doc's record

- Multi-user / accounts / household onboarding → *Productize* spec
- Native packaging (Capacitor vs. SwiftUI rewrite) → *Native packaging* spec
- Partner / sitter live-sharing, push notifications, school calendar imports → *Feature depth* spec
- Cloud sync, backups, account restore → *Productize* spec
- AI of any kind → out of scope, period (matches Mantle V1)
- The actual content calendar / specific essay topics → marketing brief, separate doc
- The founding-member email sequence and ops flow → ops doc, separate

This positioning spec is the constraint document. The three other specs (Productize, Native packaging, Feature depth) all have to read this one first and not contradict it.
