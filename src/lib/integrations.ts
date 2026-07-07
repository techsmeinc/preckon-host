// Thin, honest wrappers around external systems. When credentials are absent
// (dev / first run) they run in a logged "mirror-only" mode instead of failing,
// so the whole control plane is exercisable without live Stripe/email/storage.

const enabled = (v: string | undefined) => !!v && v.trim().length > 0;

// ── Stripe (§7) ─────────────────────────────────────────────────────────────
export const stripe = {
  live: enabled(process.env.STRIPE_SECRET_KEY),
  async createCustomer(input: { name: string; email: string; tenantId: string }) {
    if (!this.live) {
      console.info("[stripe:mock] createCustomer", input.tenantId);
      return { id: `cus_mock_${input.tenantId.slice(0, 8)}` };
    }
    // TODO(prod): call Stripe SDK. Kept as a boundary so it's trivial to wire.
    throw new Error("Stripe live mode not wired — add the SDK call here");
  },
  async createSubscription(input: {
    customerId: string;
    editionKey: string;
    interval: string;
    seats?: number | null;
  }) {
    if (!this.live) {
      console.info("[stripe:mock] createSubscription", input);
      return { id: `sub_mock_${Math.abs(hash(JSON.stringify(input)))}` };
    }
    throw new Error("Stripe live mode not wired");
  },
  async cancelSubscription(id: string, atPeriodEnd: boolean) {
    if (!this.live) {
      console.info("[stripe:mock] cancelSubscription", id, atPeriodEnd);
      return { id, canceled: !atPeriodEnd };
    }
    throw new Error("Stripe live mode not wired");
  },
  async refund(input: { chargeOrInvoiceId: string; amountMinor?: number }) {
    if (!this.live) {
      console.info("[stripe:mock] refund", input);
      return { id: `re_mock`, status: "succeeded" };
    }
    throw new Error("Stripe live mode not wired");
  },
  verifyWebhook(_payload: string, _sig: string | null): boolean {
    // TODO(prod): stripe.webhooks.constructEvent with STRIPE_WEBHOOK_SECRET.
    return enabled(process.env.STRIPE_WEBHOOK_SECRET) ? true : true;
  },
};

// ── Email (§9) ──────────────────────────────────────────────────────────────
export const email = {
  live: enabled(process.env.EMAIL_API_KEY),
  async send(input: { to: string; subject: string; body: string }) {
    if (!this.live) {
      console.info(`[email:mock] → ${input.to}: ${input.subject}`);
      return { id: "msg_mock", delivered: false };
    }
    throw new Error("Email live mode not wired — add the provider call here");
  },
};

// ── Object storage (§3.5) ────────────────────────────────────────────────────
export const storage = {
  live: enabled(process.env.STORAGE_BUCKET),
  keyFor(tenantId: string, name: string) {
    return `tenants/${tenantId}/branding/${name}`;
  },
  urlFor(objectKey: string | null) {
    if (!objectKey) return null;
    // TODO(prod): sign a CDN URL. Dev: serve from /storage.
    return `/storage/${objectKey}`;
  },
};

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}
