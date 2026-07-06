import { queryOne } from '../db';
import { resolveVisitorId } from './visitorMemory';

export const SAVE_VISITOR_CONTACT_TOOL = 'save_visitor_contact';

export interface VisitorContact {
  id: string;
  site_id: string;
  visitor_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  company: string | null;
  consent_given: boolean;
  consent_at: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface UpsertContactInput {
  name?: string;
  email?: string;
  phone?: string;
  country?: string;
  company?: string;
  consent?: boolean;
  source?: string;
}

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

function normalizeEmail(email: string | null): string | null {
  if (!email) return null;
  const lower = email.toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lower) ? lower : null;
}

export async function getVisitorContact(
  siteId: string,
  visitorId: string,
): Promise<VisitorContact | null> {
  const canonical = await resolveVisitorId(siteId, visitorId);
  return queryOne<VisitorContact>(
    `SELECT * FROM visitor_contacts WHERE site_id = $1 AND visitor_id = $2`,
    [siteId, canonical],
  );
}

export function formatContactForPrompt(contact: VisitorContact | null): string {
  if (!contact) {
    return `## Visitor contact profile
No contact details saved yet. When appropriate (e.g. registration, follow-up, ticket purchase), politely ask for name and email (and phone/country if relevant). Confirm details before saving. Only save after the visitor agrees to be contacted.`;
  }

  const lines = [
    contact.name ? `- Name: ${contact.name}` : null,
    contact.email ? `- Email: ${contact.email}` : null,
    contact.phone ? `- Phone: ${contact.phone}` : null,
    contact.country ? `- Country: ${contact.country}` : null,
    contact.company ? `- Company: ${contact.company}` : null,
    `- Consent to contact: ${contact.consent_given ? 'yes' : 'no'}`,
  ].filter(Boolean);

  const missing: string[] = [];
  if (!contact.name) missing.push('name');
  if (!contact.email) missing.push('email');

  let block = `## Visitor contact profile (saved — do not re-ask unless updating)\n${lines.join('\n')}`;
  if (missing.length > 0) {
    block += `\nMissing optional fields you may still ask for when relevant: ${missing.join(', ')}.`;
  }
  return block;
}

export function contactCollectionToolDefinition() {
  return {
    type: 'function' as const,
    function: {
      name: SAVE_VISITOR_CONTACT_TOOL,
      description:
        'Save visitor contact details after they provided them and agreed to be contacted for follow-up. Call only when you have at least email or phone plus explicit consent.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Full name' },
          email: { type: 'string', description: 'Email address' },
          phone: { type: 'string', description: 'Phone / WhatsApp number' },
          country: { type: 'string', description: 'Country' },
          company: { type: 'string', description: 'Company or organization' },
          consent: {
            type: 'boolean',
            description: 'True only if visitor explicitly agreed to be contacted',
          },
        },
        required: ['consent'],
      },
    },
  };
}

export async function upsertVisitorContact(
  siteId: string,
  visitorId: string,
  input: UpsertContactInput,
): Promise<{ contact: VisitorContact; created: boolean }> {
  const canonical = await resolveVisitorId(siteId, visitorId);
  const existing = await getVisitorContact(siteId, canonical);

  const name = clean(input.name) ?? existing?.name ?? null;
  const email = normalizeEmail(clean(input.email)) ?? existing?.email ?? null;
  const phone = clean(input.phone) ?? existing?.phone ?? null;
  const country = clean(input.country) ?? existing?.country ?? null;
  const company = clean(input.company) ?? existing?.company ?? null;
  const consent = input.consent === true || existing?.consent_given === true;

  if (!consent) {
    throw new Error('Consent required before saving contact details');
  }
  if (!email && !phone) {
    throw new Error('At least email or phone is required');
  }

  if (existing) {
    const row = await queryOne<VisitorContact>(
      `UPDATE visitor_contacts SET
         name = $3, email = $4, phone = $5, country = $6, company = $7,
         consent_given = true,
         consent_at = COALESCE(consent_at, now()),
         source = $8,
         updated_at = now()
       WHERE site_id = $1 AND visitor_id = $2
       RETURNING *`,
      [siteId, canonical, name, email, phone, country, company, input.source ?? 'chat'],
    );
    if (!row) throw new Error('Failed to update contact');
    return { contact: row, created: false };
  }

  const row = await queryOne<VisitorContact>(
    `INSERT INTO visitor_contacts
       (site_id, visitor_id, name, email, phone, country, company, consent_given, consent_at, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, true, now(), $8)
     RETURNING *`,
    [siteId, canonical, name, email, phone, country, company, input.source ?? 'chat'],
  );
  if (!row) throw new Error('Failed to save contact');
  return { contact: row, created: true };
}

export async function mergeVisitorContacts(
  siteId: string,
  fromVisitorId: string,
  toVisitorId: string,
): Promise<void> {
  const canonical = await resolveVisitorId(siteId, toVisitorId);
  const from = await getVisitorContact(siteId, fromVisitorId);
  if (!from || from.visitor_id === canonical) return;

  const target = await getVisitorContact(siteId, canonical);
  if (!target) {
    await queryOne(
      `UPDATE visitor_contacts SET visitor_id = $1, updated_at = now()
       WHERE site_id = $2 AND visitor_id = $3`,
      [canonical, siteId, from.visitor_id],
    );
    return;
  }

  await queryOne(
    `UPDATE visitor_contacts SET
       name = COALESCE($3, name),
       email = COALESCE($4, email),
       phone = COALESCE($5, phone),
       country = COALESCE($6, country),
       company = COALESCE($7, company),
       updated_at = now()
     WHERE site_id = $1 AND visitor_id = $2`,
    [
      siteId,
      canonical,
      from.name,
      from.email,
      from.phone,
      from.country,
      from.company,
    ],
  );
  await queryOne(
    `DELETE FROM visitor_contacts WHERE site_id = $1 AND visitor_id = $2`,
    [siteId, from.visitor_id],
  );
}
