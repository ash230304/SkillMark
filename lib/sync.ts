import { fetchGitHubData } from './github';
import { fetchLeetCodeData } from './leetcode';
import { fetchCodeChefData } from './codechef';
import { calculateCompositeScore, GitHubData, LeetCodeData, CodeChefData } from './scoring';

export interface StudentPlatformUrls {
  githubUrl: string;
  leetcodeUrl: string;
  codechefUrl?: string | null;
}

export interface SyncResult {
  success: boolean;
  github: GitHubData | null;
  leetcode: LeetCodeData | null;
  codechef: CodeChefData | null;
  compositeScore: number;
  breakdown: {
    dsa: number;
    githubActivity: number;
    projectQuality: number;
    competitive: number;
    consistency: number;
  };
  errors: string[];
  syncError: boolean;
}

export async function syncStudent(urls: StudentPlatformUrls): Promise<SyncResult> {
  const errors: string[] = [];
  let githubData: GitHubData | null = null;
  let leetcodeData: LeetCodeData | null = null;
  let codechefData: CodeChefData | null = null;

  // Fetch GitHub
  try {
    githubData = await fetchGitHubData(urls.githubUrl);
  } catch (err: any) {
    errors.push(`GitHub: ${err.message}`);
    // Fallback empty data so scoring can still proceed
    githubData = {
      repos: 0,
      commits6m: 0,
      stars: 0,
      languages: {},
      reposWithReadme: 0,
    };
  }

  // Fetch LeetCode
  try {
    leetcodeData = await fetchLeetCodeData(urls.leetcodeUrl);
  } catch (err: any) {
    errors.push(`LeetCode: ${err.message}`);
    leetcodeData = {
      totalSolved: 0,
      easy: 0,
      medium: 0,
      hard: 0,
      contestRating: null,
    };
  }

  // Fetch CodeChef (optional)
  try {
    if (urls.codechefUrl) {
      codechefData = await fetchCodeChefData(urls.codechefUrl);
    }
  } catch (err: any) {
    errors.push(`CodeChef: ${err.message}`);
    codechefData = null;
  }

  const scoreResult = calculateCompositeScore(githubData, leetcodeData, codechefData);

  return {
    success: errors.length === 0,
    github: githubData,
    leetcode: leetcodeData,
    codechef: codechefData,
    compositeScore: scoreResult.total,
    breakdown: scoreResult.breakdown,
    errors,
    syncError: errors.length > 0,
  };
}
