import {
  hasLeetcodeCsrfToken,
  hasLeetcodeSession
} from './_lib/leetcode-api.mjs';

export default function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  res.status(200).json({
    ok: true,
    runtime: 'vercel-serverless',
    leetcodeSessionConfigured: hasLeetcodeSession(),
    csrfConfigured: hasLeetcodeCsrfToken()
  });
}
