// Serverless function: fetches an iCal feed and returns it.
// Solves CORS — browsers can't fetch calendar.google.com directly.
// Runs on Vercel's free tier as /api/calendar?url=...

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  // Whitelist: only allow Google Calendar's iCal endpoint, to prevent abuse.
  // Tiff's URL will look like:
  // https://calendar.google.com/calendar/ical/EMAIL/private-TOKEN/basic.ics
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  const allowedHosts = ['calendar.google.com', 'www.google.com'];
  if (!allowedHosts.includes(parsed.hostname)) {
    return res.status(400).json({ error: 'Only Google Calendar URLs are allowed' });
  }

  try {
    const upstream = await fetch(parsed.toString(), {
      headers: { 'User-Agent': 'Maison/1.0' },
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: `Calendar fetch failed: ${upstream.status}`,
      });
    }

    const text = await upstream.text();

    // Cache for 5 minutes — events don't change that fast, and this saves load.
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    return res.status(200).send(text);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch calendar', detail: String(err) });
  }
}
