export interface GitHubData {
  repos: number;
  commits30d: number;
  stars: number;
  languages: Record<string, number>;
  reposWithReadme: number;
}

export interface LeetCodeData {
  totalSolved: number;
  easy: number;
  medium: number;
  hard: number;
  contestRating: number | null;
}

export interface CodeChefData {
  rating: number | null;
  problemsSolved: number | null;
}

export interface ScoreBreakdown {
  dsa: number;
  githubActivity: number;
  projectQuality: number;
  competitive: number;
  consistency: number;
}

export interface CompositeScoreResult {
  total: number;
  breakdown: ScoreBreakdown;
}

export function calculateCompositeScore(
  github: GitHubData,
  leetcode: LeetCodeData,
  codechef: CodeChefData | null
): CompositeScoreResult {
  const hasCodeChef = codechef !== null && codechef.rating !== null;

  // DSA Score — 30% weight (35% without CodeChef)
  const dsaRaw = (leetcode.easy * 1) + (leetcode.medium * 3) + (leetcode.hard * 5);
  const dsa = Math.min(100, dsaRaw / 2);

  // GitHub Activity Score — 25% weight (30% without CodeChef)
  const activityRaw = (github.commits30d * 3) + (github.repos * 2) + (github.stars * 5);
  const githubActivity = Math.min(100, activityRaw);

  // Project Quality Score — 20% weight (25% without CodeChef)
  const qualityRaw = (github.reposWithReadme * 15) + (Object.keys(github.languages).length * 10);
  const projectQuality = Math.min(100, qualityRaw);

  // Competitive Programming Score — 15% weight (0% without CodeChef)
  const rating = codechef?.rating ?? 0;
  const competitive = Math.min(100, rating / 10);

  // Consistency Bonus — 10% weight (same with or without CodeChef)
  const consistency =
    github.commits30d > 10 ? 80
    : github.commits30d > 5 ? 50
    : github.commits30d > 0 ? 30
    : 0;

  let total: number;
  if (hasCodeChef) {
    // Full weighting: DSA=30%, GitHub=25%, Quality=20%, Competitive=15%, Consistency=10%
    total =
      dsa * 0.30 +
      githubActivity * 0.25 +
      projectQuality * 0.20 +
      competitive * 0.15 +
      consistency * 0.10;
  } else {
    // Redistributed: DSA=35%, GitHub=30%, Quality=25%, Consistency=10%
    total =
      dsa * 0.35 +
      githubActivity * 0.30 +
      projectQuality * 0.25 +
      consistency * 0.10;
  }

  return {
    total: Math.round(total * 10) / 10,
    breakdown: { dsa, githubActivity, projectQuality, competitive, consistency },
  };
}
