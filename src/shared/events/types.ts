/**
 * Base shape for every domain event published on the shared event bus.
 * Modules define their own concrete event types (see e.g.
 * `src/modules/expenses/events/expense.events.ts`) as `DomainEvent<Payload>`.
 */
export interface DomainEvent<TPayload = unknown> {
  type: string;
  tenantId: string;
  payload: TPayload;
  occurredAt: string;
}
