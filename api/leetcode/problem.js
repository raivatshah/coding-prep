import { fetchProblem } from '../_lib/leetcode-api.mjs';

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');

  const slug = String(req.query.slug || '').trim();
  if (!slug) {
    res.status(400).json({ error: 'Missing slug' });
    return;
  }

  try {
    res.status(200).json({ problem: await fetchProblem(slug) });
  } catch (error) {
    res.status(502).json({ error: error.message || 'LeetCode problem lookup failed' });
  }
}
