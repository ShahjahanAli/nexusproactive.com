import { addVisitorMemory } from './visitorMemory';
import {
  upsertVisitorContact,
  type UpsertContactInput,
  type VisitorContact,
} from './visitorContacts';
import { requestEscalation } from './escalations';
import { dispatchWebhook } from './webhooks';

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

export interface ExtractedContact {
  name?: string;
  email?: string;
  phone?: string;
  country?: string;
  consent: boolean;
}

export function extractContactFromMessage(text: string): Omit<ExtractedContact, 'consent'> {
  const email = text.match(EMAIL_RE)?.[0] ?? undefined;

  let phone: string | undefined;
  const phoneLabel = text.match(
    /(?:phone|mobile|whatsapp|tel)(?:\s*(?:number|no\.?))?\s*(?:is|:)?\s*([+\d\s()-]{8,20})/i,
  );
  if (phoneLabel?.[1]) {
    phone = phoneLabel[1].replace(/\s+/g, ' ').trim();
  } else {
    const plusMatch = text.match(/(\+\d{10,15})/);
    if (plusMatch) phone = plusMatch[1];
  }

  let name: string | undefined;
  const nameMatch = text.match(
    /(?:my name is|i am|i'm|name is|full name is)\s+([A-Za-z][A-Za-z\s'.-]{1,60}?)(?=\s*,|\s+email|\s+and|\s+phone|$)/i,
  );
  if (nameMatch?.[1]) name = nameMatch[1].trim();

  let country: string | undefined;
  const countryMatch = text.match(
    /(?:i'?m from|i am from|from|country is|country:)\s+([A-Za-z][A-Za-z\s]{1,40}?)(?=\s*$|\s*,|\s+and)/i,
  );
  if (countryMatch?.[1]) country = countryMatch[1].trim();

  return { name, email, phone, country };
}

const CONSENT_PHRASES =
  /\b(yes|yeah|sure|ok|okay|agree|i agree|please contact|you can contact|go ahead|that'?s fine|sounds good)\b/i;

const CONTACT_ASK_PHRASES =
  /agree to be contacted|share those|your name|email address|phone number|follow up|get you registered/i;

export function inferContactConsent(
  userMessage: string,
  recentAssistantText: string,
): boolean {
  if (CONSENT_PHRASES.test(userMessage)) return true;

  const hasEmail = EMAIL_RE.test(userMessage);
  const assistantAsked = CONTACT_ASK_PHRASES.test(recentAssistantText);
  if (hasEmail && assistantAsked) return true;

  return false;
}

export function looksLikeContactSubmission(text: string): boolean {
  return EMAIL_RE.test(text);
}

export async function tryAutoSaveContactFromMessage(
  siteId: string,
  visitorId: string,
  userMessage: string,
  recentAssistantText: string,
): Promise<{ contact: VisitorContact; created: boolean } | null> {
  const extracted = extractContactFromMessage(userMessage);
  if (!extracted.email && !extracted.phone) return null;

  const consent = inferContactConsent(userMessage, recentAssistantText);
  if (!consent) return null;

  const input: UpsertContactInput = {
    ...extracted,
    consent: true,
    source: 'chat-auto',
  };

  try {
    return await upsertVisitorContact(siteId, visitorId, input);
  } catch {
    return null;
  }
}

export async function finalizeLeadCapture(params: {
  siteId: string;
  visitorId: string;
  conversationId: string;
  tenantId: string | null;
  contact: VisitorContact;
  created: boolean;
  escalate?: boolean;
}): Promise<void> {
  const { siteId, visitorId, conversationId, tenantId, contact, created } = params;
  const escalate = params.escalate !== false;

  const label = [contact.name, contact.email ?? contact.phone].filter(Boolean).join(' · ');
  if (label) {
    await addVisitorMemory(
      siteId,
      visitorId,
      `Contact on file: ${label}`,
      'contact',
      created ? 'auto' : 'ai',
    );
  }

  if (tenantId) {
    void dispatchWebhook(tenantId, created ? 'lead.created' : 'lead.updated', {
      siteId,
      visitorId,
      conversationId,
      contact,
    });
  }

  if (created && escalate) {
    const reason = `New lead: ${contact.name ?? 'Visitor'} (${contact.email ?? contact.phone ?? 'no email'}) — follow up for registration`;
    await requestEscalation(siteId, visitorId, conversationId, reason);
  }
}
