import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiFetch } from '@/lib/server-api';
import { PageHeader } from '@/components/dashboard/ui/page-header';
import { Panel, PanelBody, PanelHeader } from '@/components/dashboard/ui/panel';
import { StatCard } from '@/components/dashboard/ui/stat-card';
import { Badge } from '@/components/dashboard/ui/badge';
import { VisitorMemoryForm } from '@/components/dashboard/visitor-memory-form';
import { formatDateTime, formatDate } from '@/lib/datetime';

interface VisitorProfile {
  visitor_id: string;
  totals: { conversations: number; messages: number; tokens_used: number };
  conversations: Array<{
    id: string;
    site_id: string;
    site_name: string;
    active_agent: string;
    status: string;
    message_count: number;
    tokens_used: number;
    created_at: string;
    last_message_at: string | null;
  }>;
}

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export default async function VisitorProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const visitorId = decodeURIComponent(id);
  const profile = await apiFetch<VisitorProfile>(
    `/visitors/${encodeURIComponent(visitorId)}`,
  ).catch(() => null);

  if (!profile) notFound();

  const primarySiteId = profile.conversations[0]?.site_id;
  const memories = primarySiteId
    ? await apiFetch<{ memories: Array<{ id: string; fact: string; category: string; source: string; created_at: string }> }>(
        `/visitors/${encodeURIComponent(visitorId)}/memories`,
      ).catch(() => ({ memories: [] }))
    : { memories: [] };

  const contactData = primarySiteId
    ? await apiFetch<{
        contact: {
          name: string | null;
          email: string | null;
          phone: string | null;
          country: string | null;
          company: string | null;
          consent_given: boolean;
          consent_at: string | null;
          updated_at: string;
        } | null;
      }>(`/visitors/${encodeURIComponent(visitorId)}/contact?siteId=${primarySiteId}`).catch(
        () => ({ contact: null }),
      )
    : { contact: null };

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        code={`visitor/${visitorId.slice(0, 8)}`}
        title="Visitor profile"
        description={`Activity for visitor ${visitorId.slice(0, 16)}…`}
        action={
          <Link
            href="/app/visitors"
            className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
          >
            ← All visitors
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard label="Conversations" value={profile.totals.conversations} />
        <StatCard label="Messages" value={profile.totals.messages} />
        <StatCard
          label="Tokens used"
          value={formatTokens(profile.totals.tokens_used)}
        />
      </div>

      <Panel accent>
        <PanelHeader code="conversations" title="Conversation history" />
        <PanelBody className="space-y-2">
          {profile.conversations.map((c) => (
            <Link
              key={c.id}
              href={`/app/conversations/${c.id}`}
              className="flex flex-col gap-2 rounded-lg border border-zinc-800/60 px-4 py-3 transition hover:border-emerald-500/20 hover:bg-zinc-900/40 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-zinc-100">{c.site_name}</p>
                  <Badge variant="tactical" size="sm">
                    {c.active_agent}
                  </Badge>
                  <Badge variant={c.status === 'open' ? 'success' : 'default'} size="sm">
                    {c.status}
                  </Badge>
                </div>
                <p className="mt-1 font-mono text-[10px] text-zinc-600">
                  {c.message_count} messages · {formatTokens(c.tokens_used)} tokens ·{' '}
                  {formatDateTime(c.created_at)}
                </p>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-500">
                Open log →
              </span>
            </Link>
          ))}
        </PanelBody>
      </Panel>

      {primarySiteId && (
        <Panel>
          <PanelHeader code="contact" title="Contact profile" subtitle="Collected by AI during chat" />
          <PanelBody>
            {contactData.contact ? (
              <dl className="grid gap-2 sm:grid-cols-2 text-sm">
                {contactData.contact.name && (
                  <>
                    <dt className="text-zinc-500">Name</dt>
                    <dd className="text-zinc-200">{contactData.contact.name}</dd>
                  </>
                )}
                {contactData.contact.email && (
                  <>
                    <dt className="text-zinc-500">Email</dt>
                    <dd className="text-zinc-200">{contactData.contact.email}</dd>
                  </>
                )}
                {contactData.contact.phone && (
                  <>
                    <dt className="text-zinc-500">Phone</dt>
                    <dd className="text-zinc-200">{contactData.contact.phone}</dd>
                  </>
                )}
                {contactData.contact.country && (
                  <>
                    <dt className="text-zinc-500">Country</dt>
                    <dd className="text-zinc-200">{contactData.contact.country}</dd>
                  </>
                )}
                {contactData.contact.company && (
                  <>
                    <dt className="text-zinc-500">Company</dt>
                    <dd className="text-zinc-200">{contactData.contact.company}</dd>
                  </>
                )}
                <dt className="text-zinc-500">Consent</dt>
                <dd>
                  <Badge variant={contactData.contact.consent_given ? 'success' : 'warning'} size="sm">
                    {contactData.contact.consent_given ? 'Agreed to contact' : 'No consent'}
                  </Badge>
                </dd>
              </dl>
            ) : (
              <p className="text-sm text-zinc-500">
                No contact saved yet. The AI will ask when the visitor shows interest in follow-up or registration.
              </p>
            )}
          </PanelBody>
        </Panel>
      )}

      {primarySiteId && (
        <Panel accent>
          <PanelHeader code="memory" title="Visitor memory" subtitle="Injected into AI context across sessions" />
          <PanelBody className="space-y-4">
            <VisitorMemoryForm visitorId={visitorId} siteId={primarySiteId} />
            {memories.memories.length === 0 ? (
              <p className="text-sm text-zinc-500">No memories yet — add notes the AI should remember.</p>
            ) : (
              <ul className="space-y-2">
                {memories.memories.map((m) => (
                  <li key={m.id} className="rounded border border-zinc-800/80 px-3 py-2 text-sm text-zinc-300">
                    {m.fact}
                    <span className="ml-2 font-mono text-[10px] text-zinc-600">
                      {m.source} · {formatDate(m.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </PanelBody>
        </Panel>
      )}

      <Panel>
        <PanelHeader code="embed_hint" title="Logged-in visitor ID" />
        <PanelBody>
          <p className="text-sm text-zinc-400">
            To tie this visitor to a logged-in user on your site, set the widget attribute:
          </p>
          <pre className="mt-3 overflow-x-auto rounded border border-zinc-800 bg-zinc-950 p-4 font-mono text-[11px] text-emerald-400/90">{`<nexus-chat site-id="..." visitor-id="user_12345"></nexus-chat>`}</pre>
        </PanelBody>
      </Panel>
    </div>
  );
}
