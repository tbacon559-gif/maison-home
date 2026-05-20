// GET /api/share/sitter/[token]
// Public read-only sitter view. Validates the token, then fetches
// the owner's profile/kids/household_items with a service-role
// client and returns the shape the SitterShareView page expects.
//
// Token unknown / revoked / expired → 404 { status: 'ended' } (same
// shape for all three — no enumeration).

import { getServiceClient } from '../../_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const token = req.query?.token;
  if (!token || typeof token !== 'string') {
    return res.status(404).json({ status: 'ended' });
  }

  try {
    const supabase = getServiceClient();

    const { data: link } = await supabase
      .from('share_links')
      .select('token, owner_id, tonight_plan, created_at, expires_at, revoked_at')
      .eq('token', token)
      .eq('kind', 'sitter')
      .maybeSingle();

    if (!link) return res.status(404).json({ status: 'ended' });
    if (link.revoked_at) return res.status(404).json({ status: 'ended' });
    if (new Date(link.expires_at).getTime() <= Date.now()) {
      return res.status(404).json({ status: 'ended' });
    }

    const ownerId = link.owner_id;

    const [profileRes, kidsRes, householdRes] = await Promise.all([
      supabase.from('profiles')
        .select('greeting_name, sitter_notes')
        .eq('id', ownerId)
        .maybeSingle(),
      supabase.from('kids')
        .select('name, birthday, clothes_size, shoe_size, diaper_size, allergies')
        .eq('user_id', ownerId)
        .order('position'),
      supabase.from('household_items')
        .select('label, value')
        .eq('user_id', ownerId)
        .order('position'),
    ]);

    if (profileRes.error || kidsRes.error || householdRes.error) {
      console.error('share/sitter/[token]', {
        profile: profileRes.error,
        kids: kidsRes.error,
        household: householdRes.error,
      });
      return res.status(500).json({ status: 'error' });
    }

    return res.status(200).json({
      tonight_plan: link.tonight_plan || '',
      sitter_notes: profileRes.data?.sitter_notes || '',
      owner_name: profileRes.data?.greeting_name || '',
      kids: kidsRes.data || [],
      household: householdRes.data || [],
      created_at: link.created_at,
      expires_at: link.expires_at,
    });
  } catch (err) {
    console.error('share/sitter/[token]', err);
    return res.status(500).json({ status: 'error' });
  }
}
