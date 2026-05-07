import { LeetCodeData } from './scoring';

const LEETCODE_GRAPHQL = 'https://leetcode.com/graphql';

function extractLeetCodeUsername(profileUrl: string): string {
  const url = profileUrl.trim().replace(/[/?#].*$/, '').replace(/\/$/, '');
  // Handle https://leetcode.com/u/username/ and https://leetcode.com/username/
  const uMatch = profileUrl.match(/leetcode\.com\/u\/([^/?#]+)/i);
  if (uMatch) return uMatch[1];
  const directMatch = profileUrl.match(/leetcode\.com\/([^/?#]+)/i);
  if (directMatch && directMatch[1] !== 'u') return directMatch[1];
  throw new Error(`Invalid LeetCode URL: ${profileUrl}`);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const QUERY = `
  query getUserStats($username: String!) {
    matchedUser(username: $username) {
      submitStats {
        acSubmissionNum {
          difficulty
          count
        }
      }
      userContestRanking {
        rating
      }
    }
  }
`;

async function fetchLeetCodeOnce(username: string): Promise<LeetCodeData> {
  const res = await fetch(LEETCODE_GRAPHQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Referer': 'https://leetcode.com',
    },
    body: JSON.stringify({ query: QUERY, variables: { username } }),
    next: { revalidate: 0 },
  });

  if (res.status === 429) {
    throw new Error('RATE_LIMIT');
  }
  if (!res.ok) {
    throw new Error(`LeetCode API error: ${res.status}`);
  }

  const json = await res.json();
  const user = json?.data?.matchedUser;

  if (!user) {
    throw new Error(`LeetCode user "${username}" not found.`);
  }

  const submissions: { difficulty: string; count: number }[] =
    user.submitStats?.acSubmissionNum ?? [];

  const getCount = (difficulty: string) =>
    submissions.find((s) => s.difficulty === difficulty)?.count ?? 0;

  const easy = getCount('Easy');
  const medium = getCount('Medium');
  const hard = getCount('Hard');
  const totalSolved = getCount('All');
  const contestRating = user.userContestRanking?.rating
    ? Math.round(user.userContestRanking.rating)
    : null;

  return { totalSolved, easy, medium, hard, contestRating };
}

export async function fetchLeetCodeData(profileUrl: string): Promise<LeetCodeData> {
  const username = extractLeetCodeUsername(profileUrl);

  try {
    return await fetchLeetCodeOnce(username);
  } catch (err: any) {
    if (err.message === 'RATE_LIMIT') {
      // Wait 2 seconds and retry once
      await delay(2000);
      return await fetchLeetCodeOnce(username);
    }
    throw err;
  }
}
