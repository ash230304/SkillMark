import { CodeChefData } from './scoring';

const CODECHEF_API = 'https://codechef-api.vercel.app/handle';

function extractCodeChefUsername(profileUrl: string): string {
  const url = profileUrl.trim();
  const match = url.match(/codechef\.com\/users\/([^/?#]+)/i);
  if (!match) throw new Error(`Invalid CodeChef URL: ${profileUrl}`);
  return match[1];
}

export async function fetchCodeChefData(
  profileUrl: string | null | undefined
): Promise<CodeChefData | null> {
  if (!profileUrl || profileUrl.trim() === '') return null;

  try {
    const username = extractCodeChefUsername(profileUrl);
    const res = await fetch(`${CODECHEF_API}/${username}`, {
      next: { revalidate: 0 },
    });

    if (!res.ok) return { rating: null, problemsSolved: null };

    const data = await res.json();

    return {
      rating: data.currentRating ?? null,
      problemsSolved: data.totalProblemsSolved ?? null,
    };
  } catch {
    // Never crash the sync — just return null
    return { rating: null, problemsSolved: null };
  }
}
