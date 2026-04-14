export const SELF_SERVE_PAYMENT_STATES = [
  "draft",
  "checkout_started",
  "payment_pending",
  "payment_confirmed",
  "payment_failed",
  "payment_cancelled",
];

export const SELF_SERVE_ACTIVATION_STATES = [
  "draft",
  "awaiting_review",
  "awaiting_activation",
  "activated",
  "cancelled",
];

export const SELF_SERVE_WEBHOOK_EVENT_TYPES = {
  checkoutCreated: "checkout.session.created",
  checkoutExpired: "checkout.session.expired",
  paymentSucceeded: "checkout.payment.succeeded",
  paymentFailed: "checkout.payment.failed",
  paymentCancelled: "checkout.payment.cancelled",
};

export function buildSelfServeActivationState({
  checkoutState = "draft",
  paymentState = "draft",
  activationState = "draft",
  checkoutSessionId = "",
  checkoutUrl = "",
  provider = "fintoc",
  createdAt = new Date().toISOString(),
} = {}) {
  return {
    provider,
    checkoutState,
    paymentState,
    activationState,
    checkoutSessionId,
    checkoutUrl,
    createdAt,
    updatedAt: createdAt,
    history: [],
  };
}

export function appendSelfServeActivationEvent(current = {}, event = {}) {
  const now = new Date().toISOString();
  return {
    ...current,
    updatedAt: now,
    history: [
      ...(Array.isArray(current?.history) ? current.history : []),
      {
        at: now,
        type: event.type || "unknown",
        detail: event.detail || "",
        payload: event.payload || null,
      },
    ],
  };
}

export function markSelfServeCheckoutCreated(current = {}, session = {}) {
  return appendSelfServeActivationEvent({
    ...current,
    checkoutState: "checkout_started",
    paymentState: "payment_pending",
    activationState: current?.activationState || "awaiting_review",
    checkoutSessionId: session?.sessionId || current?.checkoutSessionId || "",
    checkoutUrl: session?.redirectUrl || current?.checkoutUrl || "",
  }, {
    type: SELF_SERVE_WEBHOOK_EVENT_TYPES.checkoutCreated,
    detail: "Checkout session creada",
    payload: { sessionId: session?.sessionId || "", redirectUrl: session?.redirectUrl || "" },
  });
}

export function markSelfServePaymentSucceeded(current = {}, payload = {}) {
  return appendSelfServeActivationEvent({
    ...current,
    paymentState: "payment_confirmed",
    activationState: "awaiting_activation",
  }, {
    type: SELF_SERVE_WEBHOOK_EVENT_TYPES.paymentSucceeded,
    detail: "Pago confirmado",
    payload,
  });
}

export function markSelfServePaymentFailed(current = {}, payload = {}) {
  return appendSelfServeActivationEvent({
    ...current,
    paymentState: "payment_failed",
  }, {
    type: SELF_SERVE_WEBHOOK_EVENT_TYPES.paymentFailed,
    detail: "Pago fallido",
    payload,
  });
}

export function markSelfServePaymentCancelled(current = {}, payload = {}) {
  return appendSelfServeActivationEvent({
    ...current,
    paymentState: "payment_cancelled",
    checkoutState: "checkout_started",
  }, {
    type: SELF_SERVE_WEBHOOK_EVENT_TYPES.paymentCancelled,
    detail: "Pago cancelado",
    payload,
  });
}

export function markSelfServeActivated(current = {}, payload = {}) {
  return appendSelfServeActivationEvent({
    ...current,
    activationState: "activated",
  }, {
    type: "activation.completed",
    detail: "Empresa activada",
    payload,
  });
}

export function buildSelfServeWebhookContract() {
  return {
    path: "/api/webhooks/fintoc/self-serve",
    method: "POST",
    provider: "fintoc",
    expectedMetadata: [
      "acquisitionLeadId",
      "companyDraftId",
      "totalUF",
      "totalClp",
      "addonCodes",
    ],
    eventRouting: {
      [SELF_SERVE_WEBHOOK_EVENT_TYPES.paymentSucceeded]: {
        paymentState: "payment_confirmed",
        activationState: "awaiting_activation",
      },
      [SELF_SERVE_WEBHOOK_EVENT_TYPES.paymentFailed]: {
        paymentState: "payment_failed",
      },
      [SELF_SERVE_WEBHOOK_EVENT_TYPES.paymentCancelled]: {
        paymentState: "payment_cancelled",
      },
      [SELF_SERVE_WEBHOOK_EVENT_TYPES.checkoutExpired]: {
        paymentState: "payment_cancelled",
      },
    },
  };
}

