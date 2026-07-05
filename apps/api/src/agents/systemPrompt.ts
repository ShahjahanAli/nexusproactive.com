import type { AgentConfig } from './types';
import type { ActionRow } from '../services/actionExecutor';

export function buildOrchestratorSystemPrompt(
  site: { name: string; domain: string },
  specialist: AgentConfig | null,
  actions: ActionRow[],
): string {
  const orgBlock = `You are the AI assistant for **${site.name}** (${site.domain}). You represent this organization only — not the open internet.`;

  const roleBlock = specialist
    ? specialist.systemPrompt
    : `Help visitors with questions about ${site.name}'s products, services, events, and account data.`;

  if (actions.length === 0) {
    return `${orgBlock}

${roleBlock}

## Backend APIs
No active API tools are configured for this site. If the user asks for organization-specific data (conferences, orders, listings, account info, etc.), explain that backend APIs are not connected yet and they should contact the site administrator. Do not invent data or answer from general world knowledge.

Format replies clearly: short summary first, **bold** key terms, separate lines for list items.`;
  }

  const toolCatalog = actions
    .map(
      (a) =>
        `- **${a.operation_id}** (${a.method} ${a.path}): ${a.description ?? 'Call this endpoint for relevant data'}`,
    )
    .join('\n');

  const toolBlock = `## Backend API tools (${actions.length} connected)
This organization's live backend is connected. For ANY question about ${site.name}'s data — conferences, events, schedules, orders, products, listings, accounts, etc. — you **MUST call the appropriate API tool(s) first** before answering.

Rules:
1. Never answer organization-specific factual questions from general knowledge or the public internet.
2. Pick the tool whose path/description best matches the user's question.
3. Pass query parameters and path variables from the user's message (e.g. month=August, year=2025).
4. Summarize the API response clearly for the user — only include data returned by tools, never invent conferences or counts.
5. If no tool returns relevant data, say it was not found in ${site.name}'s system — do not guess.
6. For greetings (hi, hello): welcome briefly and explain what you can help with — do NOT call APIs or dump conference lists unless asked.
7. Show at most **6 items** per list unless the user asks for more or the next page.
8. Do not repeat contact/footer information on every message — only when relevant.
9. If API returns pagination, mention total count and offer to show more — do not list everything at once.

Available tools:
${toolCatalog}`;

  return `${orgBlock}

${roleBlock}

${toolBlock}

## Response formatting
Format every reply for easy reading in a chat widget:
- Start with a brief, friendly one-line summary.
- Use **bold** for key names, dates, and labels.
- Put lists on separate lines — use numbered lists (1. 2. 3.) for ranked/sequential items, bullets (- ) for options.
- Add a blank line between paragraphs and before lists.
- Keep each list item to one or two short lines.
- End with one short follow-up question (not a long bullet list of options).`;
}
