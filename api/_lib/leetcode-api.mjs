const LEETCODE_GRAPHQL_URL = process.env.LEETCODE_GRAPHQL_URL || 'https://leetcode.com/graphql';
const LEETCODE_SESSION = process.env.LEETCODE_SESSION || '';
const LEETCODE_CSRF_TOKEN = process.env.LEETCODE_CSRF_TOKEN || process.env.CSRF_TOKEN || '';
const PUBLIC_RECENT_SUBMISSION_REQUEST_LIMIT = 100;

const QUESTION_QUERY = `
  query questionData($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
      questionFrontendId
      title
      titleSlug
      difficulty
      acRate
      isPaidOnly
      topicTags {
        name
        slug
      }
    }
  }
`;

const RECENT_SUBMISSIONS_QUERY = `
  query recentSubmissions($username: String!, $limit: Int!) {
    recentSubmissionList(username: $username, limit: $limit) {
      title
      titleSlug
      timestamp
      statusDisplay
      lang
    }
  }
`;

const AUTHENTICATED_SUBMISSIONS_QUERY = `
  query submissionList($offset: Int!, $limit: Int!, $lastKey: String) {
    submissionList(offset: $offset, limit: $limit, lastKey: $lastKey) {
      hasNext
      lastKey
      submissions {
        id
        title
        titleSlug
        timestamp
        statusDisplay
        lang
      }
    }
  }
`;

export function hasLeetcodeSession() {
  return Boolean(LEETCODE_SESSION);
}

export function hasLeetcodeCsrfToken() {
  return Boolean(LEETCODE_CSRF_TOKEN);
}

export function normalizeLookbackDays(value, fallback = 30) {
  const days = Number(value);
  if (!Number.isFinite(days)) return fallback;
  return Math.min(365, Math.max(1, Math.floor(days)));
}

function leetcodeHeaders() {
  const headers = {
    accept: 'application/json',
    'content-type': 'application/json',
    origin: 'https://leetcode.com',
    referer: 'https://leetcode.com',
    'user-agent': 'coding-prep-sync/1.0'
  };

  const cookies = [];
  if (LEETCODE_SESSION) cookies.push(`LEETCODE_SESSION=${LEETCODE_SESSION}`);
  if (LEETCODE_CSRF_TOKEN) {
    cookies.push(`csrftoken=${LEETCODE_CSRF_TOKEN}`);
    headers['x-csrftoken'] = LEETCODE_CSRF_TOKEN;
  }
  if (cookies.length) headers.cookie = cookies.join('; ');
  return headers;
}

async function leetcodeGraphQL(query, variables, operationName) {
  const response = await fetch(LEETCODE_GRAPHQL_URL, {
    method: 'POST',
    headers: leetcodeHeaders(),
    body: JSON.stringify({ query, variables, operationName })
  });

  const body = await response.text();
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new Error(`LeetCode returned non-JSON response (${response.status})`);
  }

  if (!response.ok) {
    throw new Error(payload.errors?.[0]?.message || `LeetCode returned HTTP ${response.status}`);
  }
  if (payload.errors?.length) {
    throw new Error(payload.errors.map(error => error.message).join('; '));
  }
  return payload.data;
}

export async function fetchProblem(titleSlug) {
  const data = await leetcodeGraphQL(
    QUESTION_QUERY,
    { titleSlug },
    'questionData'
  );
  if (!data.question) throw new Error(`No LeetCode problem found for "${titleSlug}"`);
  return data.question;
}

async function mapLimit(items, limit, worker) {
  const results = [];
  let index = 0;

  async function run() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await worker(items[current], current);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

function groupSubmissions(submissions) {
  const bySlug = new Map();

  submissions.forEach(submission => {
    if (!submission.titleSlug) return;
    const group = bySlug.get(submission.titleSlug) || {
      titleSlug: submission.titleSlug,
      title: submission.title,
      attempts: 0,
      status: 'Attempted',
      lastStatus: '',
      lastSubmittedAt: '',
      lastAcceptedAt: '',
      languages: new Set()
    };

    group.attempts += 1;
    if (submission.lang) group.languages.add(submission.lang);

    const timestamp = Number(submission.timestamp || 0);
    if (!group.lastSubmittedAt || timestamp > Number(group.lastSubmittedAt || 0)) {
      group.lastSubmittedAt = String(timestamp);
      group.lastStatus = submission.statusDisplay || group.lastStatus;
    }

    if (submission.statusDisplay === 'Accepted') {
      group.status = 'Solved';
      if (!group.lastAcceptedAt || timestamp > Number(group.lastAcceptedAt || 0)) {
        group.lastAcceptedAt = String(timestamp);
      }
    }

    bySlug.set(submission.titleSlug, group);
  });

  return [...bySlug.values()].map(group => ({
    ...group,
    languages: [...group.languages]
  }));
}

function unixSeconds(date) {
  return Math.floor(date.getTime() / 1000);
}

function isoFromUnixSeconds(value) {
  const seconds = Number(value || 0);
  return seconds ? new Date(seconds * 1000).toISOString() : '';
}

async function fetchAuthenticatedSubmissions(days) {
  const pageSize = 20;
  const maxPages = 60;
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceSeconds = unixSeconds(since);
  const submissions = [];
  let offset = 0;
  let lastKey = null;

  for (let page = 0; page < maxPages; page += 1) {
    const data = await leetcodeGraphQL(
      AUTHENTICATED_SUBMISSIONS_QUERY,
      { offset, limit: pageSize, lastKey },
      'submissionList'
    );
    const pageData = data.submissionList;
    if (!pageData?.submissions?.length) break;

    submissions.push(...pageData.submissions);
    const oldestInPage = Math.min(...pageData.submissions.map(item => Number(item.timestamp || 0)).filter(Boolean));
    if (oldestInPage && oldestInPage < sinceSeconds) break;
    if (!pageData.hasNext) break;

    offset += pageSize;
    lastKey = pageData.lastKey || lastKey;
  }

  return submissions;
}

async function decorateGroupedProblems(grouped) {
  return mapLimit(grouped, 5, async problem => {
    try {
      const details = await fetchProblem(problem.titleSlug);
      return {
        ...problem,
        ...details,
        titleSlug: problem.titleSlug,
        status: problem.status,
        attempts: problem.attempts,
        lastStatus: problem.lastStatus,
        lastSubmittedAt: problem.lastSubmittedAt,
        lastAcceptedAt: problem.lastAcceptedAt,
        languages: problem.languages
      };
    } catch (error) {
      return {
        ...problem,
        difficulty: 'Medium',
        topicTags: [],
        metadataError: error.message
      };
    }
  });
}

export async function fetchRecent(username, days = 30) {
  const lookbackDays = normalizeLookbackDays(days);
  const requestedLimit = PUBLIC_RECENT_SUBMISSION_REQUEST_LIMIT;
  const since = new Date();
  since.setDate(since.getDate() - lookbackDays);
  const sinceSeconds = unixSeconds(since);
  let submissions = [];
  let source = 'public-recent';
  let requestedRawLimit = requestedLimit;
  let authError = '';

  if (LEETCODE_SESSION) {
    try {
      submissions = await fetchAuthenticatedSubmissions(lookbackDays);
      source = 'authenticated-submission-list';
      requestedRawLimit = submissions.length;
    } catch (error) {
      authError = error.message;
    }
  }

  if (source === 'public-recent') {
    const data = await leetcodeGraphQL(
      RECENT_SUBMISSIONS_QUERY,
      { username, limit: requestedLimit },
      'recentSubmissions'
    );
    submissions = data.recentSubmissionList || [];
  }

  const filteredSubmissions = submissions.filter(submission => Number(submission.timestamp || 0) >= sinceSeconds);
  const grouped = groupSubmissions(filteredSubmissions);
  const problems = await decorateGroupedProblems(grouped);
  const timestamps = submissions.map(submission => Number(submission.timestamp || 0)).filter(Boolean);
  const oldestReturned = timestamps.length ? Math.min(...timestamps) : 0;
  const publicRecentCapLikely = source === 'public-recent' && submissions.length >= 20 && requestedLimit > submissions.length;
  const coverageComplete = !publicRecentCapLikely || !oldestReturned || oldestReturned <= sinceSeconds;

  return {
    username,
    days: lookbackDays,
    source,
    authError,
    fetchedAt: new Date().toISOString(),
    submissions: filteredSubmissions,
    problems,
    range: {
      days: lookbackDays,
      since: since.toISOString(),
      requestedLimit: requestedRawLimit,
      returnedSubmissions: submissions.length,
      includedSubmissions: filteredSubmissions.length,
      uniqueProblems: problems.length,
      oldestReturnedAt: isoFromUnixSeconds(oldestReturned),
      coverageComplete,
      publicRecentCapLikely
    }
  };
}
