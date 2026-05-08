import { User } from 'firebase/auth';

export async function authenticatedFetch(
  user: User | null,
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  if (!user) {
    throw new Error('You must be signed in to perform this action.');
  }

  const token = await user.getIdToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);

  return fetch(input, {
    ...init,
    headers,
  });
}
