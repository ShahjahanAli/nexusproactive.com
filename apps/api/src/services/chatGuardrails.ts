import { queryOne } from '../db';
import type { WidgetTheme } from './widgetConfig';
import { DEFAULT_THEME, getWidgetConfig } from './widgetConfig';

export interface GuardrailConfig {
  maxUserMessages: number;
  whatsappNumber: string | null;
  whatsappPrefillMessage: string;
  guardrailMessage: string;
}

export interface GuardrailPayload {
  message: string;
  whatsappUrl: string | null;
  whatsappNumber: string | null;
  maxUserMessages: number;
}

const DEFAULT_GUARDRAIL_MESSAGE =
  "You've reached the limit for automated replies in this chat. Our team has been notified. For faster help, continue on WhatsApp.";

export function guardrailFromTheme(theme: WidgetTheme): GuardrailConfig {
  const maxRaw = theme.maxUserMessages;
  const maxUserMessages =
    typeof maxRaw === 'number' && maxRaw >= 0 ? maxRaw : 20;

  const whatsappNumber = normalizeWhatsAppNumber(theme.whatsappNumber);
  const whatsappPrefillMessage =
    theme.whatsappPrefillMessage?.trim() ||
    'Hi, I need help continuing a conversation from your website chat.';

  const guardrailMessage = theme.guardrailMessage?.trim() || DEFAULT_GUARDRAIL_MESSAGE;

  return {
    maxUserMessages,
    whatsappNumber,
    whatsappPrefillMessage,
    guardrailMessage,
  };
}

export async function getGuardrailConfig(siteId: string): Promise<GuardrailConfig> {
  const { theme } = await getWidgetConfig(siteId);
  return guardrailFromTheme({ ...DEFAULT_THEME, ...theme });
}

export async function countUserMessages(conversationId: string): Promise<number> {
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM messages
     WHERE conversation_id = $1 AND role = 'user'`,
    [conversationId],
  );
  return parseInt(row?.count ?? '0', 10);
}

export function buildWhatsAppUrl(number: string, prefill: string): string {
  const digits = number.replace(/\D/g, '');
  const text = encodeURIComponent(prefill);
  return `https://wa.me/${digits}?text=${text}`;
}

export function buildGuardrailPayload(config: GuardrailConfig): GuardrailPayload {
  const whatsappUrl = config.whatsappNumber
    ? buildWhatsAppUrl(config.whatsappNumber, config.whatsappPrefillMessage)
    : null;

  return {
    message: config.guardrailMessage,
    whatsappUrl,
    whatsappNumber: config.whatsappNumber,
    maxUserMessages: config.maxUserMessages,
  };
}

export async function shouldTriggerGuardrail(
  siteId: string,
  conversationId: string,
): Promise<{ trigger: boolean; config: GuardrailConfig; payload: GuardrailPayload }> {
  const config = await getGuardrailConfig(siteId);
  if (config.maxUserMessages <= 0) {
    return { trigger: false, config, payload: buildGuardrailPayload(config) };
  }

  const count = await countUserMessages(conversationId);
  const trigger = count >= config.maxUserMessages;
  return { trigger, config, payload: buildGuardrailPayload(config) };
}

function normalizeWhatsAppNumber(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, '');
  return digits.length >= 8 ? trimmed : null;
}
