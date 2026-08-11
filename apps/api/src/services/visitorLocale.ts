/** Visitor-facing escalation strings by ISO language code. Agent brief stays English. */

export type VisitorMsgKey =
  | 'escalationNotified'
  | 'agentJoined'
  | 'aiResumed'
  | 'queueAck'
  | 'humanAck';

const EN: Record<VisitorMsgKey, string> = {
  escalationNotified:
    'A team member has been notified. Someone will join this chat shortly.',
  agentJoined: 'A team member has joined the chat.',
  aiResumed: 'This chat is back with the AI assistant. How can I help?',
  queueAck:
    'You are in the queue for a team member. Hang tight — someone will join soon.',
  humanAck: 'Your message was sent to our team. They will reply shortly.',
};

const FR: Record<VisitorMsgKey, string> = {
  escalationNotified:
    'Un membre de l’équipe a été notifié. Quelqu’un rejoindra bientôt cette conversation.',
  agentJoined: 'Un membre de l’équipe a rejoint la conversation.',
  aiResumed: 'Cette conversation est de nouveau avec l’assistant IA. Comment puis-je vous aider ?',
  queueAck:
    'Vous êtes en file d’attente pour un membre de l’équipe. Quelqu’un vous rejoindra bientôt.',
  humanAck: 'Votre message a été envoyé à notre équipe. Elle vous répondra sous peu.',
};

const ES: Record<VisitorMsgKey, string> = {
  escalationNotified:
    'Se ha notificado a un miembro del equipo. Alguien se unirá a este chat en breve.',
  agentJoined: 'Un miembro del equipo se ha unido al chat.',
  aiResumed: 'Este chat ha vuelto con el asistente de IA. ¿En qué puedo ayudarte?',
  queueAck:
    'Estás en la cola para un miembro del equipo. Alguien se unirá pronto.',
  humanAck: 'Tu mensaje se envió a nuestro equipo. Responderán en breve.',
};

const DE: Record<VisitorMsgKey, string> = {
  escalationNotified:
    'Ein Teammitglied wurde benachrichtigt. Jemand wird diesem Chat in Kürze beitreten.',
  agentJoined: 'Ein Teammitglied ist dem Chat beigetreten.',
  aiResumed: 'Dieser Chat ist wieder beim KI-Assistenten. Wie kann ich helfen?',
  queueAck:
    'Sie warten in der Warteschlange auf ein Teammitglied. Jemand wird bald beitreten.',
  humanAck: 'Ihre Nachricht wurde an unser Team gesendet. Sie antworten in Kürze.',
};

const LOCALES: Record<string, Record<VisitorMsgKey, string>> = {
  en: EN,
  fr: FR,
  es: ES,
  de: DE,
};

/** Normalize to a supported locale code (fallback: en). */
export function normalizeVisitorLang(code: string | null | undefined): string {
  if (!code?.trim()) return 'en';
  const base = code.trim().toLowerCase().slice(0, 2);
  return LOCALES[base] ? base : 'en';
}

export function visitorMessage(
  lang: string | null | undefined,
  key: VisitorMsgKey,
): string {
  const code = normalizeVisitorLang(lang);
  return LOCALES[code]?.[key] ?? EN[key];
}

/** Stable meta.kind values for escalation system messages (language-independent). */
export const MSG_KIND = {
  escalationNotified: 'escalation_notified',
  agentJoined: 'agent_joined',
  aiResumed: 'ai_resume',
} as const;
