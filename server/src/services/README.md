# Services

Business logic shared across routes, kept out of route files so route
handlers stay thin (parse input, call service, shape response). Anything
that needs to run as a background job (document parsing, discovery runs,
daily snapshots) is enqueued here via `jobs/queue.ts` but actually *processed*
in the separate `@complianceos/worker` package/process - see
`../../worker/src/jobs/` for those handlers.
