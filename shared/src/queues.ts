// Shared between @complianceos/server (producer — enqueues jobs from HTTP
// request handlers) and @complianceos/worker (consumer — processes them in
// a separate process). Both sides must agree on these names since BullMQ
// matches producer and worker purely by queue name + Redis connection, not
// by sharing any in-process object.
export const QUEUE_NAMES = {
  documentParse: "document-parse",
  discoveryRun: "discovery-run",
  dailySnapshot: "daily-snapshot",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
