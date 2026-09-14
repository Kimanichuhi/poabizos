import type { DomainEvent } from "./types";

type Handler<T> = (event: DomainEvent<T>) => void | Promise<void>;
// A registry that holds handlers for many different, unrelated event payload
// types keyed by string — there is no single T to parameterize the map with.
// Each `subscribe<T>` call site stays fully typed; only storage is erased.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = Handler<any>;

/**
 * Minimal in-memory, synchronous-dispatch domain event bus.
 *
 * Intentionally small: this decouples a *publishing* module (e.g. Expenses)
 * from any future *subscribing* module (e.g. Reports, Notifications) without
 * requiring a real queue yet. There is one bus instance per server process —
 * it is not durable and not for cross-process delivery. If/when background
 * workers or cross-process delivery are needed, this is the seam to swap out.
 */
class EventBus {
  private handlers = new Map<string, Set<AnyHandler>>();

  subscribe<T>(type: string, handler: Handler<T>): () => void {
    const set = this.handlers.get(type) ?? new Set();
    set.add(handler as AnyHandler);
    this.handlers.set(type, set);
    return () => set.delete(handler as AnyHandler);
  }

  async publish<T>(event: DomainEvent<T>): Promise<void> {
    const set = this.handlers.get(event.type);
    if (!set || set.size === 0) return;
    for (const handler of set) {
      await handler(event);
    }
  }
}

export const eventBus = new EventBus();
