import { isRecord } from "@/util/record"

/**
 * A tool execution error that carries metadata to the persisted error state.
 * The structural fallback keeps the metadata available across runtime or realm
 * boundaries where `instanceof` is not reliable.
 */
export class ToolResultError extends Error {
  readonly toolResultMetadata: Record<string, unknown>

  constructor(message: string, metadata: Record<string, unknown>, options?: ErrorOptions) {
    super(message, options)
    this.name = "ToolResultError"
    this.toolResultMetadata = metadata
  }
}

export function getToolResultMetadata(error: unknown): Record<string, unknown> | undefined {
  if (error instanceof ToolResultError) return error.toolResultMetadata
  if (!isRecord(error) || !isRecord(error.toolResultMetadata)) return undefined
  return error.toolResultMetadata
}
