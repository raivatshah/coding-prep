import {
  fetchRecent,
  normalizeLookbackDays
} from '../_lib/leetcode-api.mjs';

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');

  const username = String(req.query.username || '').trim();
  const days = normalizeLookbackDays(req.query.days);
  if (!username) {
    res.status(400).json({ error: 'Missing username' });
    return;
  }

  try {
    res.status(200).json(await fetchRecent(username, days));
  } catch (error) {
    res.status(502).json({ error: error.message || 'LeetCode recent sync failed' });
  }
}
