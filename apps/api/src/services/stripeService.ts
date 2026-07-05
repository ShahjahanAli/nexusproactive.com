import Stripe from 'stripe';
import { DEFAULT_PLAN_LIMITS, Plan } from '@nexus/shared-types';
import { config } from '../config';
import { query, queryOne } from '../db';

let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  if (!config.stripeSecretKey) {
    throw Object.assign(new Error('Stripe is not configured'), {
      status: 503,
      code: 'STRIPE_NOT_CONFIGURED',
    });
  }
  if (!stripeClient) {
    stripeClient = new Stripe(config.stripeSecretKey);
  }
  return stripeClient;
}

const PLAN_BY_PRICE: Record<string, Plan> = {};

function registerPrice(priceId: string, plan: Plan): void {
  if (priceId) PLAN_BY_PRICE[priceId] = plan;
}

registerPrice(config.stripePrices.starter, 'starter');
registerPrice(config.stripePrices.growth, 'growth');
registerPrice(config.stripePrices.scale, 'scale');

export async function createCheckoutSession(
  tenantId: string,
  plan: Plan,
): Promise<string | null> {
  if (plan === 'trial') {
    return null;
  }

  const stripe = getStripe();
  const tenant = await queryOne<{
    owner_email: string;
    company_name: string;
    stripe_customer_id: string | null;
  }>('SELECT owner_email, company_name, stripe_customer_id FROM tenants WHERE id = $1', [
    tenantId,
  ]);

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  let customerId = tenant.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: tenant.owner_email,
      name: tenant.company_name,
      metadata: { tenant_id: tenantId },
    });
    customerId = customer.id;
    await queryOne('UPDATE tenants SET stripe_customer_id = $1 WHERE id = $2', [
      customerId,
      tenantId,
    ]);
  }

  const priceId = config.stripePrices[plan as keyof typeof config.stripePrices];
  if (!priceId) {
    throw Object.assign(new Error(`No Stripe price configured for plan: ${plan}`), {
      status: 400,
      code: 'PRICE_NOT_CONFIGURED',
    });
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${config.dashboardUrl}/app/onboarding?checkout=success`,
    cancel_url: `${config.dashboardUrl}/signup?checkout=cancelled`,
    metadata: { tenant_id: tenantId, plan },
    subscription_data: {
      trial_period_days: plan === 'starter' ? 14 : undefined,
      metadata: { tenant_id: tenantId, plan },
    },
  });

  return session.url;
}

export async function createBillingPortalSession(tenantId: string): Promise<string> {
  const stripe = getStripe();
  const tenant = await queryOne<{ stripe_customer_id: string | null }>(
    'SELECT stripe_customer_id FROM tenants WHERE id = $1',
    [tenantId],
  );

  if (!tenant?.stripe_customer_id) {
    throw Object.assign(new Error('No billing account found'), {
      status: 400,
      code: 'NO_BILLING_ACCOUNT',
    });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: tenant.stripe_customer_id,
    return_url: `${config.dashboardUrl}/app/billing`,
  });

  return session.url;
}

async function updateTenantPlan(
  tenantId: string,
  plan: Plan,
  subscriptionId: string | null,
): Promise<void> {
  const planLimits = DEFAULT_PLAN_LIMITS[plan];
  await query(
    `UPDATE tenants SET plan = $1, plan_limits = $2, stripe_subscription_id = $3 WHERE id = $4`,
    [plan, JSON.stringify(planLimits), subscriptionId, tenantId],
  );
}

export async function handleStripeWebhook(
  payload: Buffer,
  signature: string,
): Promise<void> {
  if (!config.stripeWebhookSecret) {
    throw new Error('Stripe webhook secret not configured');
  }

  const stripe = getStripe();
  const event = stripe.webhooks.constructEvent(
    payload,
    signature,
    config.stripeWebhookSecret,
  );

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const tenantId = session.metadata?.tenant_id;
      const plan = (session.metadata?.plan as Plan) ?? 'starter';
      if (tenantId) {
        await updateTenantPlan(tenantId, plan, session.subscription as string | null);
      }
      break;
    }
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const tenantId = subscription.metadata?.tenant_id;
      const priceId = subscription.items.data[0]?.price.id;
      const plan = priceId ? (PLAN_BY_PRICE[priceId] ?? 'starter') : 'starter';
      if (tenantId && subscription.status === 'active') {
        await updateTenantPlan(tenantId, plan, subscription.id);
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const tenantId = subscription.metadata?.tenant_id;
      if (tenantId) {
        await updateTenantPlan(tenantId, 'trial', null);
      }
      break;
    }
    default:
      break;
  }
}

export { getStripe };
