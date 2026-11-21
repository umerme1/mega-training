# S03E04 show me when — sched-prod incident board

`board/` is the incident board (static page) built for the MEGA.dev challenge "show me when"; it is deployed
from the student's machine to https://sched-board.umer-me12.workers.dev with `board/build.sh` + wrangler
(`app/config.js` holds the session key and is generated at build time, never committed).
`.github/workflows/prove.yml` at the repo root is the course's replay workflow, exactly as the starter shipped it.
