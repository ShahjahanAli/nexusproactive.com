import { config } from '../config';
import { completeChat } from './llmClient';
import { getConversationMessages } from './conversationService';
import { LANGUAGE_NAMES, detectLanguage } from './languageDetect';

export interface HandoffContext {
  language: string;
  languageName: string;
  brief: string;
}

/** Cheap fallback when the LLM is unavailable. */
function heuristicLanguage(userTexts: string[]): { language: string; languageName: string } {
  const guess = detectLanguage(userTexts);
  return { language: guess.language, languageName: guess.languageName };
}

function formatTranscript(
  messages: Array<{ role: string; content: string | null; agent_name: string | null }>,
): string {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant' || m.role === 'system')
    .filter((m) => (m.content ?? '').trim().length > 0)
    .slice(-24)
    .map((m) => {
      const who =
        m.role === 'user'
          ? 'Visitor'
          : m.role === 'system'
            ? 'System'
            : m.agent_name?.trim() || 'Assistant';
      return `${who}: ${(m.content ?? '').trim()}`;
    })
    .join('\n');
}

function fallbackBrief(
  language: string,
  languageName: string,
  reason: string | undefined,
  userTexts: string[],
): string {
  const recent = userTexts.slice(-4).map((t) => `- ${t}`).join('\n') || '- (no visitor messages yet)';
  return [
    `Visitor language: ${languageName} (${language})`,
    `Escalation reason: ${reason?.trim() || 'Visitor or system requested a human agent'}`,
    '',
    'Summary: Automatic brief (LLM unavailable). Review the recent visitor messages below.',
    '',
    'Recent visitor messages:',
    recent,
    '',
    `Suggested next step: Acknowledge the visitor and continue in ${languageName} if you can; otherwise reply in English and keep answers clear.`,
  ].join('\n');
}

/**
 * Detect visitor language and produce an English handoff brief for human agents.
 * Brief is agent-only (stored on the conversation, never shown in the widget).
 */
export async function generateHandoffContext(
  conversationId: string,
  reason?: string,
): Promise<HandoffContext> {
  const messages = await getConversationMessages(conversationId);
  const userTexts = messages
    .filter((m) => m.role === 'user' && (m.content ?? '').trim())
    .map((m) => (m.content ?? '').trim());
  const transcript = formatTranscript(messages);
  const heuristic = heuristicLanguage(userTexts);

  if (!transcript.trim()) {
    return {
      language: heuristic.language,
      languageName: heuristic.languageName,
      brief: fallbackBrief(heuristic.language, heuristic.languageName, reason, userTexts),
    };
  }

  try {
    const { text: raw } = await completeChat({
      model: config.llm.fallbackModel,
      messages: [
        {
          role: 'system',
          content: `You prepare handoff briefs for human support agents.
Given a chat transcript (may be multilingual), reply with JSON only:
{"language":"ISO-639-1 code","languageName":"English name of visitor language","brief":"multiline English brief"}

The brief MUST be in clear English and include these labeled sections:
- Visitor language: Name (code)
- Intent: what the visitor wants now
- What happened so far: short chronology
- Key details: emails, order IDs, names, amounts, dates (or "none")
- AI already handled: what the bot already did or promised
- Suggested next step: one concrete action for the human
- Reply guidance: tell the agent which language to prefer when answering the visitor

Keep the brief under 220 words. Do not invent facts not present in the transcript.`,
        },
        {
          role: 'user',
          content: `Escalation reason: ${reason?.trim() || 'Human agent requested'}\n\nTranscript:\n${transcript}`,
        },
      ],
    });

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        language: heuristic.language,
        languageName: heuristic.languageName,
        brief: fallbackBrief(heuristic.language, heuristic.languageName, reason, userTexts),
      };
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      language?: string;
      languageName?: string;
      brief?: string;
    };

    const language = (parsed.language ?? heuristic.language).toLowerCase().slice(0, 8);
    const languageName =
      parsed.languageName?.trim() ||
      LANGUAGE_NAMES[language] ||
      heuristic.languageName;
    const brief =
      parsed.brief?.trim() ||
      fallbackBrief(language, languageName, reason, userTexts);

    return { language, languageName, brief };
  } catch {
    return {
      language: heuristic.language,
      languageName: heuristic.languageName,
      brief: fallbackBrief(heuristic.language, heuristic.languageName, reason, userTexts),
    };
  }
}
