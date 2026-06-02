import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');
const failures = [];

function normalize(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function contains(haystack, needle) {
  const normalizedNeedle = normalize(needle);
  return normalizedNeedle.length > 0 && normalize(haystack).includes(normalizedNeedle);
}

function fail(message) {
  failures.push(message);
}

function extractConst(name, endMarker) {
  const marker = `const ${name} = `;
  const start = html.indexOf(marker);
  if (start < 0) throw new Error(`Missing ${name}`);

  const exprStart = start + marker.length;
  const end = html.indexOf(endMarker, exprStart);
  if (end < 0) throw new Error(`Missing end marker for ${name}`);

  return html.slice(exprStart, end).trim().replace(/;$/, '');
}

for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
  try {
    new Function(match[1]);
  } catch (error) {
    fail(`Inline script does not parse: ${error.message}`);
  }
}

const studioDecks = Function(`return (${extractConst('STUDIO_DECKS', '\n\n  let trackerProblems')});`)();
const titleByMode = {
  recognize: 'Read the Statement',
  contrast: 'Choose the Boundary',
  invariant: 'Pick the Invariant'
};

const requiredPatterns = [
  'Arrays / Hashing',
  'Two Pointers',
  'Sliding Window',
  'Binary Search',
  'Stack',
  'Heap',
  'Intervals / Greedy',
  'Trees',
  'Graph BFS/DFS',
  'Backtracking',
  'Dynamic Programming'
];

const recognitionAliases = {
  'Arrays / Hashing': ['arrays / hashing'],
  'Binary Search': ['binary search', 'binary-search'],
  'Sliding Window': ['sliding window'],
  'Two Pointers': ['two pointers', 'two-pointer'],
  Stack: ['stack', 'monotonic stack'],
  Heap: ['heap', 'heapq', 'priority queue'],
  'Graph BFS/DFS': ['graph bfs/dfs', 'bfs/dfs', 'bfs', 'dfs'],
  Backtracking: ['backtracking'],
  'Dynamic Programming': ['dynamic programming', 'dp'],
  'Intervals / Greedy': ['intervals / greedy', 'interval greedy']
};

const coverage = new Map(requiredPatterns.map(pattern => [pattern, 0]));
const bumpCoverage = pattern => {
  if (!pattern) return;
  coverage.set(pattern, (coverage.get(pattern) || 0) + 1);
};

for (const [mode, cards] of Object.entries(studioDecks)) {
  if (!Array.isArray(cards) || cards.length === 0) {
    fail(`${mode}: deck is empty or not an array`);
    continue;
  }

  cards.forEach((card, index) => {
    const label = `${mode}[${index}]`;
    bumpCoverage(card.pattern);

    if (mode === 'atlas') {
      for (const field of ['from', 'to', 'title', 'decision', 'exampleA', 'exampleB']) {
        if (!card[field]) fail(`${label}: missing ${field}`);
      }
      bumpCoverage(card.from);
      bumpCoverage(card.to);
      return;
    }

    if (!card.pattern) fail(`${label}: missing pattern`);
    if (!card.statement) fail(`${label}: missing statement`);

    if (['recognize', 'contrast', 'invariant'].includes(mode)) {
      const choices = card.choices || [];
      const preRevealVisible = `${titleByMode[mode]} Answer hidden ${card.statement || ''} Reveal Next Card`;

      if (choices.length !== 4) fail(`${label}: expected exactly 4 choices`);
      if (new Set(choices).size !== choices.length) fail(`${label}: duplicate choices`);
      if (!choices.includes(card.answer)) fail(`${label}: answer missing from choices`);
      if (contains(preRevealVisible, card.answer)) fail(`${label}: answer appears before reveal`);
      if (contains(preRevealVisible, card.clue)) fail(`${label}: clue appears before reveal`);
      if (contains(preRevealVisible, card.boundary)) fail(`${label}: boundary appears before reveal`);

      if (mode === 'recognize') {
        for (const alias of recognitionAliases[card.pattern] || [card.pattern]) {
          if (contains(preRevealVisible, alias)) {
            fail(`${label}: recognition pattern appears before reveal (${alias})`);
          }
        }
      }
    }

    if (['mutation', 'trap'].includes(mode)) {
      const title = mode === 'mutation' ? 'Template Mutation' : 'Bug Diagnosis';
      const preRevealVisible = `${title} Pattern hidden ${card.statement || ''} ${card.base || ''} ${card.code || ''} Reveal Got It Missed Next Card`;

      if (!card.answer) fail(`${label}: missing answer`);
      if (mode === 'mutation' && !card.why) fail(`${label}: missing mutation why`);
      if (mode === 'trap' && !card.fix) fail(`${label}: missing trap fix`);
      if (contains(preRevealVisible, card.answer)) fail(`${label}: answer appears before reveal`);
      if (contains(preRevealVisible, card.why)) fail(`${label}: why appears before reveal`);
      if (contains(preRevealVisible, card.fix)) fail(`${label}: fix appears before reveal`);
    }
  });
}

for (const pattern of requiredPatterns) {
  if ((coverage.get(pattern) || 0) < 2) {
    fail(`${pattern}: needs at least 2 Studio reps/edges`);
  }
}

if (!html.includes('Answer hidden')) fail('Studio answer cards should render "Answer hidden" before reveal');
if (!html.includes('Pattern hidden')) fail('Studio reveal cards should render "Pattern hidden" before reveal');
if (!html.includes("titleByMode")) fail('Studio answer cards should use generic mode titles before reveal');

const totals = Object.fromEntries(Object.entries(studioDecks).map(([mode, cards]) => [mode, cards.length]));
const coverageSummary = Object.fromEntries([...coverage.entries()].sort((a, b) => a[0].localeCompare(b[0])));

if (failures.length > 0) {
  console.error('Pattern Studio audit failed');
  console.error(JSON.stringify({ totals, coverage: coverageSummary, failures }, null, 2));
  process.exit(1);
}

console.log('Pattern Studio audit passed');
console.log(JSON.stringify({ totals, coverage: coverageSummary }, null, 2));
