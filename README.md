# CronStorm

CronStorm (aka Pocketwatch, aka Kairoi) is a SaaS I created at the beginning of 2018. 

I've opensourced the repositories that I serve it with on AWS and GCP.
For simplicity I have merged the separate services into a monorepo for this open-source release.
If you want to mirror my configuration on AWS or GCP you will have to break each subdirectory module into 
its own repo, install its dependencies and deploy it to the appropriate service. As well as setting up the
external services (such as redis and datastore).

## System Overview

There's 6 services:

- redis cache (ElastiCache) (pocketwatch-cache)
- GCP Datastore (gstore)
- Timekeeper (An EB SQS worker that runs the cron jobs and manages message delays) (pocketwatch-mechanism)
- Supervisor (An EB SQS worker that manages the Timekeeper and makes sure all jobs that are supposed to be running are running and restarts any that have missed their calls)
- An API service (the root directory, cronstorm-services aka pocketwatch-api) combined with a buy a subscription flow
- A web UI to purcash a one-off time (pocketwatch)

