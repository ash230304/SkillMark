import { GitHubData } from './scoring';

const GITHUB_API_BASE = 'https://api.github.com';

interface GitHubRepo {
  stargazers_count?: number;
  description?: string | null;
  language?: string | null;
}

interface GitHubGraphQLResponse {
  data?: {
    user?: {
      contributionsCollection?: {
        totalCommitContributions?: number;
        restrictedContributionsCount?: number;
      };
    };
  };
}

function extractGitHubUsername(profileUrl: string): string {
  const url = profileUrl.trim().replace(/\/$/, '');
  const match = url.match(/^https?:\/\/github\.com\/([^/?#]+)/i);
  if (!match) throw new Error(`Invalid GitHub URL: ${profileUrl}`);
  return match[1];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function githubFetch(path: string): Promise<Response> {
  const token = process.env.GITHUB_TOKEN;
  const headers: HeadersInit = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${GITHUB_API_BASE}${path}`, { headers, next: { revalidate: 0 } });
  if (res.status === 403 || res.status === 429) {
    throw new Error('GitHub API rate limit exceeded. Try again in an hour.');
  }
  return res;
}

export async function fetchGitHubData(profileUrl: string): Promise<GitHubData> {
  const username = extractGitHubUsername(profileUrl);

  // Fetch user profile
  const userRes = await githubFetch(`/users/${username}`);
  if (userRes.status === 404) throw new Error(`GitHub user "${username}" not found.`);
  if (!userRes.ok) throw new Error(`GitHub API error: ${userRes.status}`);

  await delay(200);

  // Fetch repos for stars and languages
  const reposRes = await githubFetch(`/users/${username}/repos?per_page=100&sort=updated`);
  if (!reposRes.ok) throw new Error(`Failed to fetch GitHub repos: ${reposRes.status}`);
  const repos = (await reposRes.json()) as GitHubRepo[];

  await delay(200);

  // Fetch commits for the last 6 months using GraphQL
  // This is superior because it covers 6 months AND includes private commits (restrictedContributionsCount)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const fromDate = sixMonthsAgo.toISOString();

  const query = `
    query($login: String!, $from: DateTime!) {
      user(login: $login) {
        contributionsCollection(from: $from) {
          totalCommitContributions
          restrictedContributionsCount
        }
      }
    }
  `;

  let commits6m = 0;
  if (process.env.GITHUB_TOKEN) {
    const gqlRes = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query, variables: { login: username, from: fromDate } }),
      next: { revalidate: 0 }
    });

    if (gqlRes.ok) {
      const gqlData = (await gqlRes.json()) as GitHubGraphQLResponse;
      const contribs = gqlData?.data?.user?.contributionsCollection;
      if (contribs) {
        commits6m = (contribs.totalCommitContributions || 0) + (contribs.restrictedContributionsCount || 0);
      }
    }
  }

  // Process repos
  let totalStars = 0;
  const languages: Record<string, number> = {};

  for (const repo of repos) {
    totalStars += repo.stargazers_count ?? 0;
    if (repo.language) {
      languages[repo.language] = (languages[repo.language] ?? 0) + 1;
    }
  }

  // Count repos with README heuristic
  const reposWithReadme = repos.filter((r) => r.description && r.description.length > 0).length;

  return {
    repos: repos.length,
    commits6m,
    stars: totalStars,
    languages,
    reposWithReadme,
  };
}
