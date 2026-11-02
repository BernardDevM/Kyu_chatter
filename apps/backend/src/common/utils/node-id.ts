/**
 * Returns the current node identifier for distributed logging and tracing.
 */
export function getNodeId(): string {
  return process.env.NODE_ID ?? 'node-1';
}
