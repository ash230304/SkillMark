export interface GitHubData {
  repos: number;
  commits6m: number;
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
  // Only count competitive weight if they have actually participated in contests
  // CodeChef defaults to 1000 for unrated/new users.
  const hasCompetitiveData = (codechef?.rating ?? 0) > 1000;

  // DSA Score — 30% weight (35% without Competitive)
  const ccProblems = codechef?.problemsSolved ?? 0;
  // Weight CodeChef problems at 2 points each (between LeetCode Easy and Medium)
  const dsaRaw = (leetcode.easy * 1) + (leetcode.medium * 3) + (leetcode.hard * 5) + (ccProblems * 2);
  const dsa = Math.min(100, dsaRaw / 2);

  // GitHub Activity Score — 25% weight (30% without Competitive)
  const activityRaw = (github.commits6m * 0.5) + (github.repos * 2) + (github.stars * 5);
  const githubActivity = Math.min(100, activityRaw);

  // Project Quality Score — 20% weight (25% without Competitive)
  const qualityRaw = (github.reposWithReadme * 15) + (Object.keys(github.languages).length * 10);
  const projectQuality = Math.min(100, qualityRaw);

  // Competitive Programming Score — 15% weight (0% without Competitive)
  const rating = codechef?.rating ?? 0;
  // CodeChef ratings start around 1000 and go up to 2500+.
  // Subtracting 800 gives a baseline, and scaling to 1200 means a 2000 rating = 100% score.
  const adjustedRating = Math.max(0, rating - 800);
  const competitive = Math.min(100, (adjustedRating / 1200) * 100);

  // Consistency Bonus — 10% weight (same with or without Competitive)
  const consistency =
    github.commits6m > 100 ? 80
    : github.commits6m > 50 ? 50
    : github.commits6m > 10 ? 30
    : 0;

  let total: number;
  if (hasCompetitiveData) {
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
