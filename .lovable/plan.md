
## 1. AI Assistant upgrades

### 1a. Persistence (threaded, per tenant + user)
New tables via `supabase--migration`:
- `ai_chat_threads`: `id, tenant_id, user_id, title, created_at, updated_at`
- `ai_chat_messages`: `id, thread_id, tenant_id, user_id, role ('user'|'assistant'|'system'), content, created_at`
RLS: users see only their own threads/messages within their tenant. GRANT to authenticated + service_role. Trigger to touch `updated_at` on threads when new messages inserted.

### 1b. Streaming route (SSE) with cancel
Replace `chatWithAssistant` server-fn call with a server route `src/routes/api/ai-assistant.ts` (POST). Uses AI SDK + Lovable AI Gateway helper (`createLovableAiGatewayProvider`) with `streamText` + `abortSignal: request.signal`, returns `toUIMessageStreamResponse`. Route validates auth from Supabase bearer, verifies user has role `tenant_admin` or `manager` and feature `ai_assistant`, persists user message before streaming, and persists final assistant message in `onFinish` (skip when aborted; client saves partial on abort).

Frontend rewrites `dashboard.ai-assistant.tsx` using AI Elements (install `conversation message prompt-input shimmer response`). `useChat` with `DefaultChatTransport({ api: "/api/ai-assistant" })`, threaded sidebar listing past threads (react-query), "New chat" button, thread page route `/_authenticated/dashboard/ai-assistant/$threadId`. Stop button toggles from submit via `PromptInputSubmit` `onStop={stop}`. Client `onFinish({ isAbort })` persists partial with `_Stopped._` marker via a `saveMessage` server-fn.

### 1c. Role + feature guard
Wrap route with `<FeatureGuard featureKey="ai_assistant"><RoleGuard roles={["tenant_admin","manager"]}>…</RoleGuard></FeatureGuard>`. Server route double-checks role/feature; returns 403 with clear JSON error.

### 1d. Data-aware, professional answers
Server-fn `getAssistantContext` (auth'd, RLS) gathers a compact snapshot: last-30d sales totals + top 5 products, low-stock items (<= reorder_level), top 5 debtors + total outstanding, month-to-date expenses by category, employee count + last payroll total, active package name + enabled feature keys. Injected into the system prompt each turn as a "Live business data" block.

System prompt requirements:
- Professional tone, concise, direct answers only to what was asked.
- No leading/trailing asterisks or markdown emphasis stars — instruct model: "Do not use `*` characters anywhere in your output; use plain text or hyphen bullets."
- Post-process assistant text server-side to strip `*` and `**` wrappers as a safety net.
- List all modules included in the tenant's active package when asked "what can I do".

### 1e. Errors + logging
Route maps gateway errors:
- 429 → user message "AI is busy right now. Please try again in a few seconds."
- 402 → "Your workspace has run out of AI credits. Ask an admin to add credits in billing."
- 401/403 → "You don't have access to the AI assistant."
- other → "Something went wrong contacting the AI. Please try again."
All original details logged via `console.error("[ai-assistant]", { status, body, runId })` server-side (visible in server-function-logs), including gateway `X-Lovable-AIG-Run-ID`. Toast on client shows the friendly message only.

## 2. Super-admin dashboard

New routes under `/_authenticated/platform/`:
- `platform.packages.tsx` — list `subscription_packages`, create/edit dialog (name, code, monthly_price, user_limit, description, active), assign features via `package_features` checkboxes from `features` table.
- `platform.subscriptions.tsx` — list `tenant_subscriptions` joined to tenants + packages. Actions: change package (calls existing `change_tenant_package`-style admin RPC — new SECURITY DEFINER `admin_change_tenant_package(_tenant_id, _package_code)` restricted to platform_super_admin), suspend/reactivate (update `tenants.subscription_status`), extend trial (update `end_date`).
- `platform.ui-content.tsx` — new table `ui_content(key text pk, value jsonb, updated_at, updated_by)` for editable landing/marketing copy + announcements. Public read policy (`TO anon SELECT`), write restricted to platform_super_admin. Landing page (`src/routes/index.tsx`) reads a couple of keys (`hero_title`, `hero_subtitle`, `announcement`) via a public server-fn using publishable-key server client.
- `platform.index.tsx` gains links to the three new sections.

Navigation: extend sidebar in `platform.tsx` with Packages, Subscriptions, UI Content.

### Notifications on changes
New table `notifications(id, tenant_id, user_id nullable, kind, title, body, metadata jsonb, read_at, created_at)` with RLS: users read their tenant notifications (or user_id = auth.uid()). Server-fns invoked from admin actions insert notifications:
- Package changed for a tenant → notify all users in that tenant.
- Subscription suspended/reactivated → same.
- Package features edited → notify all tenants on that package.
- UI content change → optional "site announcement" checkbox to broadcast to all tenants.

Bell icon in `dashboard-shell.tsx` header shows unread count + dropdown list; realtime via `supabase.channel` subscribed to `notifications` filtered by tenant_id. Mark-as-read server-fn.

## 3. Verification
- Playwright: sign in as tenant_admin, open AI assistant, send message, verify streaming, stop mid-stream, reload thread, verify partial saved with `_Stopped._`.
- Sign in as staff → assistant route shows role-locked screen.
- Platform admin: create a package, assign features, switch a tenant, confirm a notification appears in that tenant's bell.

## Files (technical detail)

Create:
- `supabase/migrations/<ts>_ai_chat_and_admin.sql` (all tables, RLS, GRANTs, RPCs)
- `src/lib/ai-gateway.server.ts` (Lovable gateway helper block)
- `src/routes/api/ai-assistant.ts` (streaming route)
- `src/lib/ai-assistant-context.server.ts` (data snapshot builder)
- `src/lib/ai-chat.functions.ts` (list/create/rename/delete threads, save-partial-on-abort, list messages)
- `src/lib/notifications.functions.ts` (list, mark read)
- `src/lib/platform-admin.functions.ts` (packages CRUD, subscriptions ops, ui-content CRUD, notification broadcasts)
- `src/routes/_authenticated/dashboard.ai-assistant.tsx` (rewrite — thread list + chat)
- `src/routes/_authenticated/dashboard.ai-assistant.$threadId.tsx`
- `src/routes/_authenticated/platform.packages.tsx`
- `src/routes/_authenticated/platform.subscriptions.tsx`
- `src/routes/_authenticated/platform.ui-content.tsx`
- `src/components/notification-bell.tsx`

Edit:
- `src/routes/_authenticated/platform.tsx` (nav)
- `src/routes/_authenticated/platform.index.tsx` (cards)
- `src/components/dashboard-shell.tsx` (bell)
- `src/routes/index.tsx` (read ui_content)
- `src/start.ts` (only if bearer middleware missing — likely already present)
- Delete old `src/lib/ai-assistant.functions.ts` after cutover.

Dependencies via `bun add`: `ai`, `@ai-sdk/react`, `@ai-sdk/openai-compatible`, plus `ai-elements` CLI install.
