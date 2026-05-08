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
    
    // We scrape the HTML directly because the unofficial CodeChef APIs are unreliable
    const res = await fetch(`https://www.codechef.com/users/${username}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) return { rating: null, problemsSolved: null };

    const text = await res.text();

    // 1. Extract Problems Solved
    let problemsSolved: number | null = null;
    const probMatch = text.match(/Total Problems Solved:\s*(\d+)/i);
    if (probMatch) {
      problemsSolved = parseInt(probMatch[1], 10);
    }

    // 2. Extract Rating
    let rating: number | null = null;
    const ratingMatchHtml = text.match(/class=\"rating-number\"[^>]*>\s*(\d+)/i);
    if (ratingMatchHtml) {
      rating = parseInt(ratingMatchHtml[1], 10);
    } else {
      // Fallback: CodeChef often puts initial ratings in a JS object
      const jsMatch = text.match(/\"all\":(\d+),\"all_old\":/);
      if (jsMatch) rating = parseInt(jsMatch[1], 10);
    }

    return { rating, problemsSolved };
  } catch (err) {
    console.error('CodeChef sync error:', err);
    // Never crash the sync — just return null
    return { rating: null, problemsSolved: null };
  }
}

