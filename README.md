# SkillMark

SkillMark is a private Next.js dashboard for placement and academic admins to rank students using coding-platform signals from GitHub, LeetCode, and CodeChef.

## Features

- Firebase email/password admin login
- Student add and CSV import flows
- GitHub, LeetCode, and CodeChef sync
- Composite score calculation and score breakdowns
- Dashboard filters, ranking table, student detail pages, and CSV export
- Protected API routes using Firebase ID tokens

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from `.env.example` and fill in Firebase plus optional GitHub credentials.

3. Start the dev server:

```bash
npm run dev
```

4. Open `http://localhost:3000`.

## Firebase Setup

- Enable Firebase Authentication with email/password sign-in.
- Create admin users in the Firebase Console.
- Add Firestore collections through the app: `students` and `scores`.
- Deploy the included Firestore rules before using production data:

```bash
firebase deploy --only firestore:rules
```

The client can read and write student records for signed-in users. Score writes are intentionally blocked from the client and should happen through the authenticated server API routes.

## Environment Variables

Required public Firebase client values:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

Required Firebase Admin values:

- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`

Optional:

- `GITHUB_TOKEN`: recommended for higher GitHub rate limits and contribution data.

## Checks

```bash
npm run lint
npm run build
```
