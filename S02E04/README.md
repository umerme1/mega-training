# S02E04 two places — job 1 worker

`worker/job1-worker.mjs` runs job 1 (incident-lookup, skill v1) of the MEGA.dev challenge "two places"
in GitHub Actions (`.github/workflows/s02e04-job1.yml`, manual trigger). The job's MCP link comes from the
repository secret `S02E04_JOB1_URL`; the result and receipt leave the run only as the `job1-result` artifact.
Job 2 ran on the student's machine; the main agent merged both results.
