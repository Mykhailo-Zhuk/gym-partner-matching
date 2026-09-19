export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/** Single abstraction — feature code never calls Firebase directly (cross-cutting rule #2). */
export interface PushProvider {
  send(deviceTokens: string[], message: PushMessage): Promise<{ delivered: number }>;
}

export const PUSH_PROVIDER = Symbol('PUSH_PROVIDER');
