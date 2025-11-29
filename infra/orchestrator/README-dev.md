# Lifebook Orchestrator – Dev Surface & Smoke Scripts (J1)

This doc captures the **J1 orchestrator dev surface** so Future You can quickly
drive and debug the sample workflow end-to-end.

It covers:

- `/dev/jobs` – Jobs Inspector
- `/dev/jobs/run` – Jobs Runner
- `infra/orchestrator/run-job-and-wait.ps1` – generic CLI helper
- `infra/orchestrator/smoke-hello-world.ps1` – CloudFront smoke

---

## Sample workflow: `sample_hello_world`

The J1 sample workflow is:

- workflowSlug: `sample_hello_world`
- Input shape (for local tools):

    {
      "workflowSlug": "sample_hello_world",
      "input": {
        "from": "dev-runner-ui | cli-runner",
        "note": "free-form debugging note"
      }
    }

On success it writes a `result.md` file to S3 under:

    workflows/manual/<jobId>/result.md

and that object is served via CloudFront under:

    https://files.uselifebook.ai/workflows/manual/<jobId>/result.md

(or `${NEXT_PUBLIC_FILES_BASE_URL}/workflows/manual/<jobId>/result.md`
if you override the CDN base URL).

---

## Dev URLs

### `/dev/jobs` – Jobs Inspector

Path: `app/dev/jobs/page.tsx`

Usage:

- Paste a `job-…` id from:
  - the CLI helper (`run-job-and-wait.ps1`)
  - the runner dev page (`/dev/jobs/run`)
  - orchestrator smoke / logs
- Optionally tick **“Include logs”** to pass `includeLogs=true` to
  `GET /api/jobs`.

The page calls:

- `GET /api/jobs?jobId=<jobId>&includeLogs=true|false`

and renders:

- basic job fields (`jobId`, `workflowSlug`, `status`, `clientRequestId`)
- the `input` as pretty JSON
- optional run logs (if `includeLogs=true`)
- a **Result (CloudFront)** section when a job is present

The CloudFront URL is derived as:

- Base: `NEXT_PUBLIC_FILES_BASE_URL` env var, or `https://files.uselifebook.ai`
- Path: `/workflows/manual/<jobId>/result.md`

So for any `jobId`, you can click through to the rendered `result.md` via
CloudFront.

### `/dev/jobs/run` – Jobs Runner

Path: `app/dev/jobs/run/page.tsx`

Usage:

- Click **“Run sample_hello_world job”** to call `POST /api/jobs`.
- The page then polls `GET /api/jobs` for that `jobId` until it hits a
  final status (`succeeded`, `failed`, `cancelled`).
- You can toggle **“Include logs when polling”** to pass `includeLogs=true`
  while polling.

The page:

- Shows the current `jobId`, `workflowSlug`, `status`, and `clientRequestId`
- Renders `input` as pretty JSON
- Renders a **Result (CloudFront)** link using the same helper as `/dev/jobs`
- Renders logs (if requested) under a `Logs (jobId=…)` section.

---

## CLI helper: `run-job-and-wait.ps1`

Path:

- `infra/orchestrator/run-job-and-wait.ps1`

Parameters:

- `-WorkflowSlug` (string, default: `sample_hello_world`)
- `-BaseUrl` (string, default: `$env:LFLBK_API_BASE_URL` or `http://localhost:3000`)
- `-PollSeconds` (int, default: `2`)
- `-MaxSeconds` (int, default: `60`)
- `-IncludeLogs` (switch)

Behavior:

1. POSTs to `<BaseUrl>/api/jobs` with:

       {
         "workflowSlug": "<WorkflowSlug>",
         "input": {
           "from": "cli-runner",
           "note": "triggered from infra/orchestrator/run-job-and-wait.ps1"
         }
       }

2. Polls:

   - `GET <BaseUrl>/api/jobs?jobId=<jobId>&includeLogs=true|false`

   until the job hits a final status or the `MaxSeconds` timeout.

3. Prints a final summary:

       jobId                job-…
       workflowSlug         sample_hello_world
       status               succeeded|failed|cancelled
       clientRequestId      …
       input                {...json...}

4. If `-IncludeLogs` is passed, it also prints logs in a
   `createdAt [level] message` format.

Examples (from repo root):

- Local dev, default base URL:

      pwsh -NoProfile -ExecutionPolicy Bypass `
        -File infra/orchestrator/run-job-and-wait.ps1 `
        -WorkflowSlug "sample_hello_world" `
        -IncludeLogs

- Explicit remote base URL:

      pwsh -NoProfile -ExecutionPolicy Bypass `
        -File infra/orchestrator/run-job-and-wait.ps1 `
        -BaseUrl "https://your-env.example.com" `
        -IncludeLogs

(or set `$env:LFLBK_API_BASE_URL` first).

---

## CloudFront smoke: `smoke-hello-world.ps1`

Path:

- `infra/orchestrator/smoke-hello-world.ps1`

Parameters:

- `-BaseUrl` (string, default: `$env:LFLBK_API_BASE_URL` or `http://localhost:3000`)
- `-IncludeLogs` (switch)

Behavior:

1. Locates `run-job-and-wait.ps1` in the same folder.
2. Invokes it with:

       -WorkflowSlug "sample_hello_world" -BaseUrl <BaseUrl> [-IncludeLogs]

3. Parses the helper’s output to extract the `jobId` from the final summary.
4. Builds the CloudFront URL for the result:

       <CDN_BASE>/workflows/manual/<jobId>/result.md

   where `CDN_BASE` is `NEXT_PUBLIC_FILES_BASE_URL` (if set) or
   `https://files.uselifebook.ai` (default).

5. Sends a `HEAD` request to that URL and prints the HTTP status code.
6. Exits `0` when the code is `2xx`, otherwise exits `1`.

Example local dev flow:

    # Terminal 1 (repo root)
    npm run dev

    # Terminal 2 (repo root)
    pwsh -NoProfile -ExecutionPolicy Bypass `
      -File infra/orchestrator/smoke-hello-world.ps1 `
      -IncludeLogs

Expected happy-path output:

- `Extracted jobId: job-…`
- `CloudFront status: 200`
- `SUCCESS: result.md is reachable via CloudFront.`

You can also force a specific API base URL:

    pwsh -NoProfile -ExecutionPolicy Bypass `
      -File infra/orchestrator/smoke-hello-world.ps1 `
      -BaseUrl "http://localhost:3000" `
      -IncludeLogs

---

## Environment variables

Main knobs for the dev surface:

- `LFLBK_API_BASE_URL`
  - Optional.
  - If set, `run-job-and-wait.ps1` and `smoke-hello-world.ps1` will use it as
    the default API base URL instead of `http://localhost:3000`.

- `NEXT_PUBLIC_FILES_BASE_URL`
  - Optional.
  - If set, both `/dev/jobs` and `/dev/jobs/run` will use it as the origin for
    `result.md` links instead of `https://files.uselifebook.ai`.

---

## Typical local J1 dev loop

From repo root:

1. Start the app:

       npm run dev

2. In another terminal, run the smoke:

       pwsh -NoProfile -ExecutionPolicy Bypass `
         -File infra/orchestrator/smoke-hello-world.ps1 `
         -IncludeLogs

3. Open the dev pages:

   - `http://localhost:3000/dev/jobs/run` – start a job and watch it complete.
   - `http://localhost:3000/dev/jobs` – paste the `jobId` and inspect status,
     input, logs, and the CloudFront result link.

Once the smoke is green (CloudFront `result.md` returns 2xx), you’ve proven:

- `/api/jobs` (create + get),
- orchestrator processing + S3 write,
- and CloudFront serving of `result.md`

for `sample_hello_world` end-to-end.
---

## Download helper: `download-result.ps1`

Path:

- `infra/orchestrator/download-result.ps1`

Parameters:

- `-JobId` (string, required)
- `-OutFile` (string, optional; defaults to `job-<jobId>-result.md`)

Behavior:

1. Derives the CDN base from:
   - `NEXT_PUBLIC_FILES_BASE_URL` (if set), otherwise
   - `https://files.uselifebook.ai`
2. Builds the result URL for the job:
   - `<CDN_BASE>/workflows/manual/<jobId>/result.md`
3. Downloads `result.md` to `OutFile`.
4. Prints the first 20 lines as a quick preview.

Example usage (from repo root, after you have a jobId):

    pwsh -NoProfile -ExecutionPolicy Bypass `
      -File infra/orchestrator/download-result.ps1 `
      -JobId 'job-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'

Optional explicit output file:

    pwsh -NoProfile -ExecutionPolicy Bypass `
      -File infra/orchestrator/download-result.ps1 `
      -JobId 'job-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' `
      -OutFile 'sample-result.md'
