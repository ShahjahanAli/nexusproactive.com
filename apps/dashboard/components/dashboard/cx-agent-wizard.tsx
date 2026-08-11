'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CxAgent, CxSpecialist, PlanLimits } from '@nexus/shared-types';
import { Panel, PanelBody } from '@/components/dashboard/ui/panel';
import { Button, Input, Textarea } from '@/components/dashboard/ui/button';

const SPECIALISTS: { id: CxSpecialist; label: string; tip: string }[] = [
  { id: 'billing', label: 'Billing', tip: 'Orders, payments, refunds, invoices' },
  { id: 'technical', label: 'Technical', tip: 'How-to, troubleshooting, product setup' },
  { id: 'sales', label: 'Sales', tip: 'Pricing, plans, demos, upgrades' },
  { id: 'account', label: 'Account', tip: 'Profile, access, membership changes' },
];

const TONE_PRESETS = [
  'Warm and concise',
  'Professional and formal',
  'Friendly and upbeat',
  'Calm and reassuring',
];

const STEPS = [
  { id: 'identity', title: 'Identity', hint: 'Name visitors will see' },
  { id: 'role', title: 'Role & tone', hint: 'What this agent is for' },
  { id: 'capacity', title: 'Capacity', hint: 'How many chats at once' },
  { id: 'specialists', title: 'Specialists', hint: 'Skills it may call' },
  { id: 'sales', title: 'Sales & ratings', hint: 'Goals and feedback' },
  { id: 'review', title: 'Review', hint: 'Activate when ready' },
] as const;

function FieldTip({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs leading-5 text-zinc-500">{children}</p>;
}

function StepRail({ step }: { step: number }) {
  return (
    <ol className="mb-8 flex flex-wrap gap-2">
      {STEPS.map((s, i) => {
        const active = i === step;
        const done = i < step;
        return (
          <li
            key={s.id}
            className={`rounded-lg border px-3 py-2 text-xs ${
              active
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : done
                  ? 'border-zinc-700 text-zinc-300'
                  : 'border-zinc-800 text-zinc-600'
            }`}
          >
            <span className="font-mono text-[10px] uppercase tracking-wider opacity-70">
              {i + 1}. {s.title}
            </span>
            <p className="mt-0.5">{s.hint}</p>
          </li>
        );
      })}
    </ol>
  );
}

export function CxAgentWizard({
  mode,
  agentId,
}: {
  mode: 'create' | 'edit';
  agentId?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [limits, setLimits] = useState<PlanLimits | null>(null);
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [roleSummary, setRoleSummary] = useState('');
  const [tone, setTone] = useState(TONE_PRESETS[0]);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [maxConcurrent, setMaxConcurrent] = useState(5);
  const [specialists, setSpecialists] = useState<CxSpecialist[]>([
    'billing',
    'technical',
    'sales',
    'account',
  ]);
  const [status, setStatus] = useState<'draft' | 'active' | 'paused'>('draft');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [salesPitch, setSalesPitch] = useState('');
  const [salesProducts, setSalesProducts] = useState('');
  const [salesCta, setSalesCta] = useState('');
  const [salesSoft, setSalesSoft] = useState(true);
  const [askAfterResolve, setAskAfterResolve] = useState(true);
  const [allowComment, setAllowComment] = useState(true);

  useEffect(() => {
    async function init() {
      const listRes = await fetch('/api/cx-agents', { cache: 'no-store' });
      const listData = (await listRes.json().catch(() => ({}))) as {
        limits?: PlanLimits;
      };
      if (listData.limits) {
        setLimits(listData.limits);
        if (mode === 'create') {
          setMaxConcurrent(listData.limits.default_max_concurrent_chats ?? 5);
        }
      }

      if (mode === 'edit' && agentId) {
        const res = await fetch(`/api/cx-agents/${agentId}`, { cache: 'no-store' });
        const data = (await res.json().catch(() => ({}))) as {
          agent?: CxAgent;
          error?: string;
        };
        setLoading(false);
        if (!res.ok || !data.agent) {
          setError(data.error ?? 'Agent not found');
          return;
        }
        const a = data.agent;
        setName(a.name);
        setDisplayName(a.display_name);
        setRoleSummary(a.role_summary ?? '');
        setTone(a.tone ?? TONE_PRESETS[0]);
        setSystemPrompt(a.system_prompt ?? '');
        setMaxConcurrent(a.max_concurrent_chats);
        setSpecialists((a.allowed_specialists as CxSpecialist[]) ?? []);
        setStatus(a.status);
        const goals = (a.sales_goals ?? {}) as {
          pitch?: string;
          products?: string;
          cta?: string;
          soft?: boolean;
        };
        setSalesPitch(goals.pitch ?? '');
        setSalesProducts(goals.products ?? '');
        setSalesCta(goals.cta ?? '');
        setSalesSoft(goals.soft !== false);
        const policy = (a.rating_policy ?? {}) as {
          ask_after_resolve?: boolean;
          allow_comment?: boolean;
        };
        setAskAfterResolve(policy.ask_after_resolve !== false);
        setAllowComment(policy.allow_comment !== false);
      } else {
        setLoading(false);
      }
    }
    void init();
  }, [mode, agentId]);

  function toggleSpecialist(id: CxSpecialist) {
    setSpecialists((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }

  function validateStep(): string | null {
    if (step === 0) {
      if (!name.trim()) return 'Give the agent an internal name.';
      if (!displayName.trim()) return 'Set the display name visitors will see.';
    }
    if (step === 1 && !roleSummary.trim()) {
      return 'Add a short role summary so the agent knows its job.';
    }
    if (step === 2) {
      const cap = limits?.max_concurrent_chats_cap ?? 50;
      if (maxConcurrent < 1 || maxConcurrent > cap) {
        return `Concurrent chats must be between 1 and ${cap} on your plan.`;
      }
    }
    if (step === 3 && specialists.length === 0) {
      return 'Select at least one specialist the agent may call when needed.';
    }
    return null;
  }

  function next() {
    const err = validateStep();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function back() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function save(activate: boolean) {
    const err = validateStep();
    if (err && step < STEPS.length - 1) {
      setError(err);
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      name: name.trim(),
      displayName: displayName.trim(),
      roleSummary: roleSummary.trim(),
      tone: tone.trim(),
      systemPrompt: systemPrompt.trim() || undefined,
      maxConcurrentChats: maxConcurrent,
      allowedSpecialists: specialists,
      status: activate ? 'active' : status === 'active' && mode === 'edit' ? 'active' : 'draft',
      salesGoals: {
        pitch: salesPitch.trim(),
        products: salesProducts.trim(),
        cta: salesCta.trim(),
        soft: salesSoft,
      },
      ratingPolicy: {
        ask_after_resolve: askAfterResolve,
        scale: 5,
        allow_comment: allowComment,
      },
    };

    const res =
      mode === 'create'
        ? await fetch('/api/cx-agents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/cx-agents/${agentId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

    const data = (await res.json().catch(() => ({}))) as {
      agent?: CxAgent;
      error?: string;
    };
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? 'Save failed');
      return;
    }
    router.push('/app/cx-agents');
    router.refresh();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (step < STEPS.length - 1) {
      next();
      return;
    }
    await save(false);
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading…</p>;
  }

  const cap = limits?.max_concurrent_chats_cap ?? 50;

  return (
    <div>
      <StepRail step={step} />

      <Panel>
        <PanelBody>
          <form onSubmit={onSubmit} className="space-y-5">
            {step === 0 && (
              <div className="space-y-4">
                <div>
                  <Input
                    label="Internal name"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (!displayName || displayName === name) {
                        setDisplayName(e.target.value);
                      }
                    }}
                    placeholder="e.g. Product Concierge"
                    required
                  />
                  <FieldTip>
                    Used in your dashboard and logs. Visitors do not see this name.
                  </FieldTip>
                </div>
                <div>
                  <Input
                    label="Display name (widget)"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Alex from Support"
                    required
                  />
                  <FieldTip>
                    This is what visitors see when the agent joins the chat. Keep it human and
                    short.
                  </FieldTip>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <Textarea
                    label="Role summary"
                    rows={3}
                    value={roleSummary}
                    onChange={(e) => setRoleSummary(e.target.value)}
                    placeholder="Helps visitors understand products, answers FAQs, and guides them toward the right purchase."
                    required
                  />
                  <FieldTip>
                    One or two sentences describing the job. Knowledge snippets and sales goals
                    come later — keep this focused on the role.
                  </FieldTip>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-400">Tone</label>
                  <div className="flex flex-wrap gap-2">
                    {TONE_PRESETS.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTone(t)}
                        className={`rounded-lg border px-3 py-1.5 text-xs ${
                          tone === t
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                            : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <FieldTip>Pick a preset, or type a custom tone below in Advanced.</FieldTip>
                </div>
                <button
                  type="button"
                  className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
                  onClick={() => setShowAdvanced((v) => !v)}
                >
                  {showAdvanced ? 'Hide advanced prompt' : 'Show advanced prompt'}
                </button>
                {showAdvanced && (
                  <div>
                    <Textarea
                      label="Custom instructions (advanced)"
                      rows={5}
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      placeholder="Optional detailed rules, boundaries, and phrasing preferences…"
                    />
                    <FieldTip>
                      Optional. Use for boundaries (“never invent prices”) and style. Prefer short
                      role + tone for most setups.
                    </FieldTip>
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <Input
                    label="Max concurrent chats"
                    type="number"
                    min={1}
                    max={cap}
                    value={maxConcurrent}
                    onChange={(e) => setMaxConcurrent(parseInt(e.target.value, 10) || 1)}
                  />
                  <FieldTip>
                    How many live customer threads this agent can own at once. Your plan caps this
                    at {cap}. When full, new chats go to another available CX Agent (or wait).
                  </FieldTip>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-xs leading-5 text-zinc-500">
                  Tip: Start lower (3–5) while you tune the persona, then raise capacity once
                  quality looks good.
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <p className="text-sm text-zinc-400">
                  The CX Agent stays in the conversation. When it needs domain depth, it can call
                  these platform specialists on a need basis (Phase 2 expands the consult channel).
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {SPECIALISTS.map((s) => {
                    const on = specialists.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleSpecialist(s.id)}
                        className={`rounded-lg border px-3 py-3 text-left ${
                          on
                            ? 'border-emerald-500/40 bg-emerald-500/10'
                            : 'border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <p className="text-sm font-medium text-zinc-200">{s.label}</p>
                        <p className="mt-1 text-xs text-zinc-500">{s.tip}</p>
                      </button>
                    );
                  })}
                </div>
                <FieldTip>
                  When this agent needs domain help, it calls <code className="text-zinc-400">consult_specialist</code>.
                  The specialist stays internal — the visitor keeps talking to this CX Agent. Uncheck a
                  specialist to block that skill.
                </FieldTip>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <div>
                  <Textarea
                    label="Sales pitch focus"
                    rows={2}
                    value={salesPitch}
                    onChange={(e) => setSalesPitch(e.target.value)}
                    placeholder="Help visitors choose the right conference package…"
                  />
                  <FieldTip>
                    Guides suggestions when buying intent appears. Leave blank to stay purely
                    support-focused.
                  </FieldTip>
                </div>
                <Input
                  label="Products / services to highlight"
                  value={salesProducts}
                  onChange={(e) => setSalesProducts(e.target.value)}
                  placeholder="Author tickets, VIP passes…"
                />
                <Input
                  label="Preferred CTA"
                  value={salesCta}
                  onChange={(e) => setSalesCta(e.target.value)}
                  placeholder="Register now / Book a demo"
                />
                <label className="flex items-center gap-2 text-sm text-zinc-400">
                  <input
                    type="checkbox"
                    checked={salesSoft}
                    onChange={(e) => setSalesSoft(e.target.checked)}
                  />
                  Soft sell (suggest gently — recommended)
                </label>
                <div className="border-t border-zinc-800 pt-4">
                  <p className="text-sm font-medium text-zinc-200">Visitor ratings</p>
                  <FieldTip>
                    After a helpful exchange, the widget can ask for a 1–5 score. Ask once per
                    conversation.
                  </FieldTip>
                  <label className="mt-3 flex items-center gap-2 text-sm text-zinc-400">
                    <input
                      type="checkbox"
                      checked={askAfterResolve}
                      onChange={(e) => setAskAfterResolve(e.target.checked)}
                    />
                    Ask for a rating after helpful exchanges
                  </label>
                  <label className="mt-2 flex items-center gap-2 text-sm text-zinc-400">
                    <input
                      type="checkbox"
                      checked={allowComment}
                      onChange={(e) => setAllowComment(e.target.checked)}
                    />
                    Allow an optional comment with the rating
                  </label>
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-3 text-sm text-zinc-400">
                <p className="font-medium text-zinc-200">Ready to save</p>
                <ul className="space-y-1.5 font-mono text-xs text-zinc-500">
                  <li>Display: {displayName || '—'}</li>
                  <li>Role: {roleSummary || '—'}</li>
                  <li>Tone: {tone || '—'}</li>
                  <li>
                    Capacity: {maxConcurrent} concurrent (plan cap {cap})
                  </li>
                  <li>Specialists: {specialists.join(', ') || 'none'}</li>
                  <li>Sales pitch: {salesPitch ? 'set' : 'none'}</li>
                  <li>Ratings: {askAfterResolve ? 'on' : 'off'}</li>
                </ul>
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-xs leading-5 text-zinc-500">
                  After activate, open this agent to add <strong className="text-zinc-300">Knowledge</strong>{' '}
                  snippets (FAQ / product facts).
                </div>
              </div>
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-4">
              {step > 0 && (
                <Button type="button" variant="secondary" onClick={back} disabled={saving}>
                  Back
                </Button>
              )}
              {step < STEPS.length - 1 ? (
                <Button type="submit">Continue</Button>
              ) : (
                <>
                  <Button type="submit" variant="secondary" disabled={saving}>
                    {saving ? 'Saving…' : mode === 'create' ? 'Save as draft' : 'Save changes'}
                  </Button>
                  <Button
                    type="button"
                    disabled={saving}
                    onClick={() => void save(true)}
                  >
                    {saving ? 'Saving…' : 'Save & activate'}
                  </Button>
                </>
              )}
            </div>
          </form>
        </PanelBody>
      </Panel>
    </div>
  );
}
