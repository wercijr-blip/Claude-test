/**
 * Analytics helper for Facilita PrEP
 * Sends events to GTM dataLayer and fires platform-specific conversion signals.
 * Safe to import server-side — all functions guard against missing `window`.
 */

type EventParams = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer: EventParams[];
    fbq?: (action: string, event: string, params?: EventParams) => void;
    gtag?: (...args: unknown[]) => void;
    ttq?: { track: (event: string, params?: EventParams) => void };
    __fp_click_listener_attached__?: boolean;
  }
}

function pushDataLayer(event: string, params?: EventParams): void {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ event, ...params });
}

// ─── Initialisation ──────────────────────────────────────────────────────────

/** Explicitly initialise GTM (called by CookieConsent after user accepts). */
export function initGTM(id: string): void {
  if (typeof window === "undefined" || !id) return;
  if (document.getElementById("gtm-script")) return;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
  const s = document.createElement("script");
  s.id = "gtm-script";
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtm.js?id=${id}`;
  document.head.appendChild(s);
}

/**
 * Attach a global click listener for elements with [data-event].
 * Idempotent — safe to call multiple times.
 */
export function initClickListener(): void {
  if (typeof window === "undefined") return;
  if (window.__fp_click_listener_attached__) return;
  window.__fp_click_listener_attached__ = true;
  document.addEventListener("click", (e) => {
    const el = (e.target as Element).closest("[data-event]");
    if (!el) return;
    const name = el.getAttribute("data-event") ?? "";
    const label =
      el.getAttribute("data-event-label") ??
      el.textContent?.trim().slice(0, 60);
    pushDataLayer(name, { event_label: label ?? undefined });
  });
}

/** Send a generic event to GTM dataLayer (and, by extension, to any tag listening in GTM). */
export function trackEvent(eventName: string, params?: EventParams): void {
  pushDataLayer(eventName, params);
}

// ─── Conversion events ───────────────────────────────────────────────────────

/** User starts the intake/payment flow. */
export function trackBeginCheckout(
  type: "particular" | "plano",
  origin: string,
): void {
  pushDataLayer("begin_checkout", {
    intake_type: type,
    cta_origin: origin,
    currency: "BRL",
    value: type === "particular" ? 150 : 0,
  });
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("track", "InitiateCheckout", { content_name: `PrEP_${type}` });
  }
}

/** Stripe purchase confirmed — fires from /pagamento/sucesso. */
export function trackPurchase(sessionId: string, value = 150): void {
  pushDataLayer("purchase", {
    transaction_id: sessionId,
    value,
    currency: "BRL",
    item_name: "Consulta PrEP",
  });
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("track", "Purchase", { value, currency: "BRL" });
  }
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", "purchase", {
      transaction_id: sessionId,
      value,
      currency: "BRL",
    });
  }
}

/** User submitted the pre-registration (pre-cadastro) form. */
export function trackFormSubmitPrecadastro(tipo: "particular" | "plano"): void {
  pushDataLayer("form_submit_precadastro", { intake_type: tipo });
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("track", "Lead", { content_name: `PrEP_precadastro_${tipo}` });
  }
}

/** Patient submitted the full clinical questionnaire. */
export function trackFormSubmitClinico(): void {
  pushDataLayer("form_submit_clinico", { event_category: "intake" });
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("track", "CompleteRegistration");
  }
}

/** Fire a conversion event with optional monetary value. */
export function trackConversion(value?: number, currency = "BRL"): void {
  pushDataLayer("conversion", {
    event_category: "ecommerce",
    value,
    currency,
  });

  // Meta Pixel — Purchase / Lead
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("track", value !== undefined ? "Purchase" : "Lead", {
      value,
      currency,
    });
  }

  // TikTok Pixel — CompletePayment / SubmitForm
  if (typeof window !== "undefined" && window.ttq) {
    window.ttq.track(value !== undefined ? "CompletePayment" : "SubmitForm", {
      value,
      currency,
    });
  }
}

/** Fire when the user begins interacting with the intake form. */
export function trackFormStart(): void {
  pushDataLayer("form_start", { event_category: "intake" });

  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("track", "InitiateCheckout");
  }

  if (typeof window !== "undefined" && window.ttq) {
    window.ttq.track("InitiateCheckout");
  }
}

/** Fire on successful form submission. */
export function trackFormSubmit(type: "particular" | "plano"): void {
  pushDataLayer("form_submit", { event_category: "intake", intake_type: type });

  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("track", "Lead", { content_name: type });
  }

  if (typeof window !== "undefined" && window.ttq) {
    window.ttq.track("SubmitForm", { content_name: type });
  }
}

/** Fire on SPA navigation (e.g. after router pushes a new URL). */
export function trackPageView(url: string): void {
  pushDataLayer("page_view", { page_path: url });

  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("track", "PageView");
  }
}

/** Fire when user clicks any scheduling / CTA button. */
export function trackAgendarClick(local: string): void {
  pushDataLayer("cta_click", {
    cta_local: local,
    page_path: typeof window !== "undefined" ? window.location.pathname : "",
  });

  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("track", "ViewContent", {
      content_name: "CTA Agendar",
      content_category: "PrEP",
    });
  }
}

/** Fire when a lead is successfully generated (form submitted). */
export function trackLeadGerado(origem: string): void {
  pushDataLayer("lead_gerado", { origem, currency: "BRL" });

  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("track", "Lead", {
      content_name: "Consulta PrEP",
      currency: "BRL",
    });
  }

  if (typeof window !== "undefined" && window.ttq) {
    window.ttq.track("SubmitForm", { content_name: "Consulta PrEP" });
  }
}

/** Fire when user clicks the WhatsApp button. */
export function trackWhatsApp(local: string): void {
  pushDataLayer("whatsapp_click", { local });

  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("track", "Contact");
  }
}

/**
 * Configure GA4 cross-domain linker so sessions aren't broken when users navigate
 * between www.facilitaprep.com.br, facilitaprep.com.br, and blog.facilitaprep.com.br.
 * Call once after GA4 is initialised (e.g. from CookieConsent accept handler).
 */
export function configCrossDomainLinker(ga4Id: string): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function' || !ga4Id) return
  window.gtag('config', ga4Id, {
    linker: {
      domains: ['facilitaprep.com.br', 'www.facilitaprep.com.br', 'blog.facilitaprep.com.br'],
      accept_incoming: true,
    },
  })
}
