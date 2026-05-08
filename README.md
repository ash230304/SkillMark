# SkillMark

SkillMark is a private Next.js dashboard for placement and academic admins to rank students using coding-platform signals from GitHub, LeetCode, and CodeChef.

## Features

- Firebase email/password admin login
- Student add and CSV import flows
- GitHub, LeetCode, and CodeChef sync
- Composite score calculation and score breakdowns
- Dashboard filters, ranking table, student detail pages, and CSV export
- Protected API routes using Firebase ID tokens

## Student Scoring Logic

SkillMark evaluates each student by syncing their public coding profiles and writing the result to the Firestore `scores` collection. The dashboard then ranks students by `compositeScore`.

### Sync Flow

1. A signed-in admin adds, imports, resyncs, or bulk-syncs students.
2. The client calls the protected sync API with the admin's Firebase ID token.
3. The server reads the student's GitHub, LeetCode, and optional CodeChef URLs from Firestore.
4. The server fetches platform data, calculates a score, stores the score document, and updates `lastSyncedAt`.
5. If a platform fetch fails, SkillMark records the error, uses zero/default data for that platform, and still calculates the rest of the score.

### Platform Signals

GitHub contributes:

- Repository count from the user's latest public repositories.
- Total stars across those repositories.
- Primary language diversity across repositories.
- Repositories with descriptions, used as the current README/project-quality heuristic.
- Commit contributions from the last six months when `GITHUB_TOKEN` is configured. Without a token, this value is `0`.

LeetCode contributes:

- Accepted Easy, Medium, and Hard problem counts from LeetCode GraphQL.
- Contest rating is currently not used because the public LeetCode API no longer exposes it in this implementation.

CodeChef contributes, when a URL is present:

- Current rating scraped from the CodeChef profile page.
- Total problems solved scraped from the profile page.

### Category Scores

Each category is normalized to a maximum of `100`.

DSA score:

```text
dsaRaw = easy + (medium * 3) + (hard * 5) + (codechefProblemsSolved * 2)
dsa = min(100, dsaRaw / 2)
```

GitHub activity score:

```text
githubActivity = min(100, (commits6m * 0.5) + (repos * 2) + (stars * 5))
```

Project quality score:

```text
projectQuality = min(100, (reposWithDescription * 15) + (uniqueLanguages * 10))
```

Competitive programming score:

```text
competitive = min(100, max(0, codechefRating - 800) / 1200 * 100)
```

Consistency score:

```text
commits6m > 100 => 80
commits6m > 50  => 50
commits6m > 10  => 30
otherwise       => 0
```

### Composite Score

If the student has meaningful CodeChef contest data (`rating > 1000`), SkillMark uses the full weighting:

```text
total =
  dsa * 0.30 +
  githubActivity * 0.25 +
  projectQuality * 0.20 +
  competitive * 0.15 +
  consistency * 0.10
```

If the student has no CodeChef URL, no rating, or only the default/new-user CodeChef rating, the competitive weight is redistributed:

```text
total =
  dsa * 0.35 +
  githubActivity * 0.30 +
  projectQuality * 0.25 +
  consistency * 0.10
```

The final `compositeScore` is rounded to one decimal place. The individual category values are stored in `breakdown` so admins can see why a student ranked where they did.

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
