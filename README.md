# File Processing Pipeline

Async file upload and processing pipeline built in Node.js. Presigned URL uploads, a reliable queue built on raw Redis, and a file state machine driving stages like malware scanning, metadata stripping, and OCR.

## Status

Working end-to-end today: presigned upload → hand-rolled Redis queue (lease + reaper) → magic-bytes MIME validation → move to final storage → presigned download.

Not built yet: retry/backoff + DLQ, malware scanning (ClamAV), metadata/EXIF stripping, OCR, real-time status (SSE), resumable uploads.

## Getting started

Requirements: Docker, Docker Compose, Node.js 20+.

Copy the .env.example to .env and set the credentials, start docker compose:

```bash
cp .env.example .env
docker compose up -d
```

Install the dependencies and run the migrations:

```bash
npm install
npm run db:migrate
```

Run the api and the worker in separate terminals:

```bash
npm run dev:api      # terminal 1
npm run dev:worker   # terminal 2
```

Fast checks:
- Health check: `curl http://localhost:3000/health`
- MinIO console: `http://localhost:9001` (login with `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` from `.env`)

## Running the tests

Tests run against the real Postgres/Redis/MinIO from `docker compose`, so the infra needs to be up first. Run everything (`api`, `worker`, and the `db`/`queue`/`storage` packages) with:

```bash
npm test
```

Or a single workspace: `npm run test --workspace=api` (also: `worker`, `db`, `queue`, `storage`).

The e2e test (`api/src/e2e/full-pipeline.test.js`) starts its own Express server on port `3000` to actually receive the MinIO webhook, so you can't run `npm run dev:api` at the same time (port conflict).
