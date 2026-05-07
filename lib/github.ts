import { GitHubData } from './scoring';

const GITHUB_API_BASE = 'https://api.github.com';

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

  // Fetch repos
  const reposRes = await githubFetch(`/users/${username}/repos?per_page=100&sort=updated`);
  if (!reposRes.ok) throw new Error(`Failed to fetch GitHub repos: ${reposRes.status}`);
  const repos: any[] = await reposRes.json();

  await delay(200);

  // Fetch events (for commits in last 30 days)
  const eventsRes = await githubFetch(`/users/${username}/events?per_page=100`);
  if (!eventsRes.ok) throw new Error(`Failed to fetch GitHub events: ${eventsRes.status}`);
  const events: any[] = await eventsRes.json();

  // Process repos
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  let totalStars = 0;
  let reposWithReadme = 0;
  const languages: Record<string, number> = {};

  for (const repo of repos) {
    totalStars += repo.stargazers_count ?? 0;
    if (repo.has_pages || repo.description || repo.homepage) {
      reposWithReadme++;
    }
    if (repo.language) {
      languages[repo.language] = (languages[repo.language] ?? 0) + 1;
    }
  }

  // Count repos with README heuristic (repos that have a description are likely to have README)
  reposWithReadme = repos.filter(
    (r) => r.description && r.description.length > 0
  ).length;

  // Count push events (commits) in last 30 days
  let commits30d = 0;
  for (const event of events) {
    if (event.type === 'PushEvent') {
      const eventDate = new Date(event.created_at);
      if (eventDate >= thirtyDaysAgo) {
        commits30d += event.payload?.size ?? 1;
      }
    }
  }

  return {
    repos: repos.length,
    commits30d,
    stars: totalStars,
    languages,
    reposWithReadme,
  };
}
