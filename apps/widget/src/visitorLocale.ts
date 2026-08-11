/** Visitor widget chrome + known system-message display strings. */

export type WidgetUiKey =
  | 'waitingBannerTitle'
  | 'waitingBannerBody'
  | 'humanBannerTitle'
  | 'humanBannerBody'
  | 'statusWaiting'
  | 'statusHuman'
  | 'statusOnline'
  | 'btnInQueue'
  | 'btnWithHuman'
  | 'btnHuman'
  | 'titleWaiting'
  | 'titleWithHuman'
  | 'titleTalkHuman'
  | 'newChatLocked'
  | 'newChatFresh'
  | 'placeholderHuman'
  | 'placeholderQueue'
  | 'placeholderDefault'
  | 'traceToggle'
  | 'send'
  | 'freshAiThread'
  | 'escalateNeedMessage'
  | 'escalateFailed'
  | 'ratingPrompt'
  | 'ratingThanks'
  | 'ratingCommentPlaceholder'
  | 'ratingSubmit'
  | 'ratingSkip';

type Catalog = Record<WidgetUiKey, string>;

const EN: Catalog = {
  waitingBannerTitle: 'Waiting for a team member',
  waitingBannerBody: 'You are in the queue. Messages still go to our team.',
  humanBannerTitle: 'Connected to a human',
  humanBannerBody: 'A team member is in this chat with you.',
  statusWaiting: '● Waiting for human',
  statusHuman: '● Human agent',
  statusOnline: '● Online',
  btnInQueue: 'In queue',
  btnWithHuman: 'With human',
  btnHuman: 'Human',
  titleWaiting: 'Waiting for a team member',
  titleWithHuman: 'A team member is handling this chat',
  titleTalkHuman: 'Talk to a human',
  newChatLocked: 'Finish with the team member before starting a new chat',
  newChatFresh: 'Start a fresh AI conversation',
  placeholderHuman: 'Message the team member…',
  placeholderQueue: 'Message while you wait in queue…',
  placeholderDefault: 'Type a message…',
  traceToggle: 'See how this was handled',
  send: 'Send',
  freshAiThread:
    'You are back with the AI assistant. Continuing in a fresh chat thread — send your message whenever you are ready.',
  escalateNeedMessage: 'Send a message first, then we can connect you with our team.',
  escalateFailed: 'Could not reach support right now. Please try again.',
  ratingPrompt: 'How was this conversation?',
  ratingThanks: 'Thanks for your feedback!',
  ratingCommentPlaceholder: 'Optional comment…',
  ratingSubmit: 'Submit',
  ratingSkip: 'Skip',
};

const FR: Catalog = {
  waitingBannerTitle: 'En attente d’un membre de l’équipe',
  waitingBannerBody: 'Vous êtes en file d’attente. Vos messages sont bien transmis à notre équipe.',
  humanBannerTitle: 'Connecté à un conseiller',
  humanBannerBody: 'Un membre de l’équipe est en conversation avec vous.',
  statusWaiting: '● En attente d’un conseiller',
  statusHuman: '● Conseiller humain',
  statusOnline: '● En ligne',
  btnInQueue: 'En file',
  btnWithHuman: 'Avec un conseiller',
  btnHuman: 'Humain',
  titleWaiting: 'En attente d’un membre de l’équipe',
  titleWithHuman: 'Un membre de l’équipe gère cette conversation',
  titleTalkHuman: 'Parler à un humain',
  newChatLocked: 'Terminez avec le conseiller avant de démarrer une nouvelle conversation',
  newChatFresh: 'Démarrer une nouvelle conversation avec l’IA',
  placeholderHuman: 'Écrire au conseiller…',
  placeholderQueue: 'Écrire pendant l’attente…',
  placeholderDefault: 'Écrire un message…',
  traceToggle: 'Voir comment cela a été traité',
  send: 'Envoyer',
  freshAiThread:
    'Vous êtes de nouveau avec l’assistant IA. Nouvelle conversation — envoyez votre message quand vous voulez.',
  escalateNeedMessage:
    'Envoyez d’abord un message, puis nous pourrons vous mettre en relation avec notre équipe.',
  escalateFailed: 'Impossible de joindre le support pour le moment. Réessayez.',
  ratingPrompt: 'Comment s’est passée cette conversation ?',
  ratingThanks: 'Merci pour votre avis !',
  ratingCommentPlaceholder: 'Commentaire optionnel…',
  ratingSubmit: 'Envoyer',
  ratingSkip: 'Passer',
};

const LOCALES: Record<string, Catalog> = { en: EN, fr: FR };

export function normalizeWidgetLang(code: string | null | undefined): string {
  if (!code?.trim()) return 'en';
  const base = code.trim().toLowerCase().slice(0, 2);
  return LOCALES[base] ? base : 'en';
}

export function widgetT(lang: string | null | undefined, key: WidgetUiKey): string {
  const code = normalizeWidgetLang(lang);
  return LOCALES[code]?.[key] ?? EN[key];
}

/** Map known English (or FR) system messages to the visitor language for display. */
export function localizeSystemMessage(
  lang: string | null | undefined,
  content: string,
  meta?: Record<string, unknown> | null,
): string {
  const code = normalizeWidgetLang(lang);
  if (code === 'en') return content;

  const kind = typeof meta?.kind === 'string' ? meta.kind : '';
  if (kind === 'escalation_notified') {
    return widgetSystem(code, 'escalationNotified');
  }
  if (kind === 'agent_joined') {
    return widgetSystem(code, 'agentJoined');
  }
  if (kind === 'ai_resume') {
    return widgetSystem(code, 'aiResumed');
  }

  const c = content.trim();
  if (/team member has been notified|membre de l’équipe a été notifié|membre de l'équipe a été notifié/i.test(c)) {
    return widgetSystem(code, 'escalationNotified');
  }
  if (/team member has joined|membre de l’équipe a rejoint|membre de l'équipe a rejoint/i.test(c)) {
    return widgetSystem(code, 'agentJoined');
  }
  if (/back with the AI assistant|de nouveau avec l’assistant|de nouveau avec l'assistant/i.test(c)) {
    return widgetSystem(code, 'aiResumed');
  }
  return content;
}

function widgetSystem(
  code: string,
  key: 'escalationNotified' | 'agentJoined' | 'aiResumed',
): string {
  const fr = {
    escalationNotified:
      'Un membre de l’équipe a été notifié. Quelqu’un rejoindra bientôt cette conversation.',
    agentJoined: 'Un membre de l’équipe a rejoint la conversation.',
    aiResumed:
      'Cette conversation est de nouveau avec l’assistant IA. Comment puis-je vous aider ?',
  };
  if (code === 'fr') return fr[key];
  const en = {
    escalationNotified:
      'A team member has been notified. Someone will join this chat shortly.',
    agentJoined: 'A team member has joined the chat.',
    aiResumed: 'This chat is back with the AI assistant. How can I help?',
  };
  return en[key];
}

/** Cheap client-side guess from visitor text (before server language is known). */
export function guessLangFromText(sample: string): string | null {
  const s = sample.toLowerCase();
  if (!s.trim()) return null;
  if (
    /[àâäéèêëïîôùûüçœæ]/.test(s) ||
    /\b(bonjour|merci|salut|quoi|comment|pouvez|s'il vous plaît|aujourd'hui)\b/.test(s)
  ) {
    return 'fr';
  }
  return null;
}
