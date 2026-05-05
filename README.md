# Maison

A calm place for the home. Built for Tiff, with love.

---

## What this is

A small Progressive Web App with five sections:

- **Today** — greeting, calendar, today's tidy zone, meals, quick note, wins
- **Tidy** — Mon–Fri zone rotation, all editable
- **Meals** — week planner + grocery list
- **Girls** — Mary Nolen and Ruth profiles, household info, sitter notes, shareable Sitter Card
- **Moments** — photo journal with native iOS share-sheet support

A welcome message appears each time the app opens — randomized from a library of ~50 in `src/data/welcome.js`. Edit those any time.

Data is stored on Tiff's device only. Nothing leaves her phone except the calendar fetch (which goes through this app's own serverless function — and only fetches her own Google Calendar feed).

---

## Phase 2 — Deploy (you, ~30 minutes)

### Step 1 — Create a GitHub account (skip if you have one)

1. Go to **github.com** → Sign up
2. Pick any username — it doesn't show up anywhere user-facing

### Step 2 — Put the code on GitHub

The easiest way:

1. On GitHub, click the **+** in the top right → **New repository**
2. Name it `maison-home`, leave it **Public** (Vercel's free tier requires public repos for the simplest setup)
3. Don't check "Add a README" — we already have one
4. Click **Create repository**

GitHub will show a page with commands. We're going to use the option called **"…or push an existing repository from the command line"**, but in a friendlier way:

1. On the new empty repo page, click **uploading an existing file** (it's a link in the middle of the page)
2. Drag the entire **`maison-home` folder's contents** into the upload area (open the folder first — drag what's inside, not the folder itself)
3. Scroll down, write any commit message ("Initial commit" is fine)
4. Click **Commit changes**

The whole project is now on GitHub.

### Step 3 — Deploy to Vercel

1. Go to **vercel.com** → **Sign Up** → choose **Continue with GitHub**
2. Approve the permissions Vercel asks for
3. On your Vercel dashboard, click **Add New… → Project**
4. Find `maison-home` in your repo list → click **Import**
5. **Important:** When you see "Configure Project," look for the **Project Name** field and set it to: `maison-home`
   - This becomes the URL: `maison-home.vercel.app`
   - If that name is taken globally, try `maison-home-tiff` or similar — Vercel will tell you
6. Leave everything else at its defaults
7. Click **Deploy**

Vercel takes about 60 seconds. When it's done, you'll see a screen with confetti and the live URL.

**Open it in your phone's browser to test.** The app should load with the welcome screen, then the Today tab.

### Step 4 — Get Tiff's Google Calendar URL

Do this on a desktop computer (it's hidden from mobile Google Calendar):

1. Open Tiff's Google Calendar at **calendar.google.com** (you'll need to be signed in as her — or have her do this part with you)
2. On the left, find **My calendars**
3. Hover over her main calendar → click the **⋮** (three dots) → **Settings and sharing**
4. Scroll all the way down to **Integrate calendar**
5. Find **Secret address in iCal format**
6. Copy that URL — it'll look like:
   `https://calendar.google.com/calendar/ical/her-email%40gmail.com/private-LONGTOKEN/basic.ics`

⚠️ **Important:** This is a private URL. Don't share it. Anyone with it can read her calendar.

### Step 5 — Plug in the URL

On the deployed app:
1. Open **Today** tab → tap the **⚙ gear** in the top-left
2. Paste the URL into the **Google Calendar** field
3. Tap **Save**
4. Go back to Today — her real upcoming events should appear within a few seconds

---

## Phase 3 — Setup night (Saturday, ~30 min)

Do this Saturday after the girls are in bed, with Tiff's phone in your hand.

### Personalize the data

Open the app, go through every tab, fill in real info:

- [ ] **Girls tab** → tap ✎ on each daughter, confirm sizes are current
- [ ] **Girls tab → If You Need It** → tap ✎, enter:
  - Pediatrician name + phone
  - Your phone (Emergency contact)
  - Wi-Fi name + password
- [ ] **Girls tab → Sitter Notes** → tap ✎, write nap times, snack rules, anything specific to your house
- [ ] **Tidy tab** → tap each zone, ✎ Edit, replace generic tasks with what actually needs doing in your home
- [ ] **Meals tab** → tap each day, ✎ Edit, plug in your real meal rotation
- [ ] **Meals tab → Grocery List** → ✎ Edit, add a few staples she always restocks

### Seed the Moments tab

This is the part that makes it feel alive on first open:

- [ ] **Moments tab** → tap "Today's Photos +"
- [ ] Pick 4–5 favorite recent photos of the girls
- [ ] Caption each one — short, sweet, in her voice ("Mary Nolen at the park last Tuesday — she insisted on the green swing")
- [ ] **Save all →**

When she opens the app Sunday morning, she'll scroll Moments and see a curated little memory wall already there. That sets the tone.

### Install on her home screen

Saturday night, when she's not looking:

1. Open the deployed URL (`https://maison-home.vercel.app/`) in **Safari** on her iPhone (must be Safari — not Chrome or any other browser)
2. Tap the **Share button** (the square with the arrow up) at the bottom
3. Scroll down → **Add to Home Screen**
4. Confirm the name says **Maison**, tap **Add**
5. The rose-gold "M" icon now lives on her home screen — drag it to a good spot
6. Open it from the home screen once to confirm it launches fullscreen (no Safari bars)

### Sunday morning

Hand her the phone. Let her find the icon. Don't say anything.

---

## Maintenance

**To update welcome messages:** edit `src/data/welcome.js`, commit to GitHub, Vercel auto-redeploys in ~60s.

**To change the seed/initial defaults** (only affects new installs — won't change what's on Tiff's phone): edit `src/data/initial.js`.

**If something breaks:** Vercel keeps every previous deployment. Roll back from the Vercel dashboard with one click.

**If the calendar stops working:** the Secret URL only breaks if she clicks "Reset" in Google Calendar settings. To get a new one, repeat Step 4 above.

---

## Tech (in case you ever want to know)

- **Vite** + **React 18** — frontend
- **Tailwind** via CDN — styling
- **localStorage** — small data (tasks, meals, settings)
- **IndexedDB** — photos
- **Vercel serverless function** — calendar CORS proxy
- **Web Share API** — native iOS share sheet for sitter card and moments

No tracking, no analytics, no third parties.
