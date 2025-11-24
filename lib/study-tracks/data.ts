import type { StudyTrack, StudyTrackId } from './types';

export const STUDY_TRACKS: StudyTrack[] = [
  {
    id: 'aws-foundations',
    title: 'AWS Foundations: S3 and Core Services',
    tagline: 'Learn AWS by shipping a secure S3-backed project into your Library.',
    description:
      'This track gets you comfortable with AWS accounts, S3, CloudFront, and basic security. Every step ends with a real artifact saved into your Personal Library so you can review it later.',
    level: 'beginner',
    estimatedDurationMinutes: 180,
    steps: [
      {
        id: 'aws-env-check',
        title: 'Confirm your AWS environment',
        summary:
          'Verify your AWS SSO profile, region, and budgets so you can experiment safely without surprise bills.',
        expectedArtifact:
          'A short environment checklist note saved in your Library describing your AWS profile, region, and guardrails.',
        href: '/library',
      },
      {
        id: 's3-secure-bucket',
        title: 'Create a secure S3 bucket',
        summary:
          'Use the S3 console or CLI to create a private, KMS-encrypted bucket that follows the same patterns Lifebook uses.',
        expectedArtifact:
          'A run log or note in your Library that captures the exact configuration you used (bucket name, region, encryption, public access block).',
        href: '/workflows',
      },
      {
        id: 'cloudfront-oac',
        title: 'Front the bucket with CloudFront and OAC',
        summary:
          'Configure CloudFront with an Origin Access Control so only the distribution can read from your bucket.',
        expectedArtifact:
          'A short architecture diagram or markdown note saved into your Library that explains how requests flow through CloudFront to S3.',
        href: '/workflows',
      },
      {
        id: 's3-versioning-lifecycle',
        title: 'Enable versioning and lifecycle rules',
        summary:
          'Turn on versioning and add a basic lifecycle policy so older versions transition to cheaper storage automatically.',
        expectedArtifact:
          'A policy snippet or screenshot summary stored in your Library showing your lifecycle rule and versioning settings.',
        href: '/workflows',
      },
      {
        id: 'ship-static-site',
        title: 'Ship a tiny static site behind CloudFront',
        summary:
          'Upload a simple static site to S3 and serve it through CloudFront using HTTPS, then capture what you did.',
        expectedArtifact:
          'A brief runbook or page in your Library that includes the CloudFront URL and notes about how you deployed.',
        href: '/captures',
      },
    ],
  },
  {
    id: 'devops-essentials',
    title: 'DevOps Essentials: CI, Smoke Tests, and Observability',
    tagline: 'Wire a simple CI pipeline that runs useful checks every time you push.',
    description:
      'This track walks you through setting up CI, basic smoke tests, and lightweight observability so you can trust your changes.',
    level: 'intermediate',
    estimatedDurationMinutes: 180,
    steps: [
      {
        id: 'repo-audit',
        title: 'Audit your repo and branch protections',
        summary:
          'Confirm that your main branch is protected and that you have a minimal set of required checks before merge.',
        expectedArtifact:
          'A short audit note saved into your Library summarizing your current protections and any gaps you found.',
        href: '/library',
      },
      {
        id: 'ci-workflow',
        title: 'Create a CI workflow for lint and tests',
        summary:
          'Add a GitHub Actions workflow that runs linting and tests on every push and pull request.',
        expectedArtifact:
          'A CI run log or summary page in your Library describing the workflow file and what it runs.',
        href: '/workflows',
      },
      {
        id: 'smoke-script',
        title: 'Add a smoke script and wire it to CI',
        summary:
          'Create a small PowerShell smoke script (like your library smokes) and run it from CI on each commit.',
        expectedArtifact:
          'A Library item that documents the smoke script entry points and what endpoints or checks it covers.',
        href: '/workflows',
      },
      {
        id: 'basic-observability',
        title: 'Hook logs and basic metrics into your stack',
        summary:
          'Ensure your app is sending useful logs and basic metrics so you can see when something breaks after deploy.',
        expectedArtifact:
          'A screenshot or note saved to your Library showing your dashboard or metric graphs for one deploy.',
        href: '/captures',
      },
      {
        id: 'tiny-incident-drill',
        title: 'Run a tiny incident drill',
        summary:
          'Simulate a small failure (like a bad deploy) and practice rolling back or fixing it quickly.',
        expectedArtifact:
          'A retrospective note in your Library capturing what failed, how you diagnosed it, and how you fixed it.',
        href: '/library',
      },
    ],
  },
];

