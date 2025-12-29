declare global {
  interface Window {
    fbq?: (
      action: 'track' | 'trackCustom' | 'init',
      event: string,
      params?: Record<string, unknown>
    ) => void;
  }
}

function getMetaPixel() {
  return typeof window !== 'undefined' ? window.fbq : undefined;
}

function isMetaPixelAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.fbq === 'function';
}

export function trackMetaEvent(
  eventName: string,
  params?: Record<string, unknown>
): void {
  const fbq = getMetaPixel();
  if (fbq) {
    fbq('track', eventName, params);
  }
}

export function trackMetaCustomEvent(
  eventName: string,
  params?: Record<string, unknown>
): void {
  const fbq = getMetaPixel();
  if (fbq) {
    fbq('trackCustom', eventName, params);
  }
}

export function trackContact(params?: {
  content_name?: string;
  content_category?: string;
}): void {
  trackMetaEvent('Contact', params);
}

export function trackLead(params?: {
  content_name?: string;
  content_category?: string;
  value?: number;
  currency?: string;
}): void {
  trackMetaEvent('Lead', {
    ...params,
    currency: params?.currency || 'GBP',
  });
}

export function trackViewContent(params: {
  content_name: string;
  content_category?: string;
  content_ids?: string[];
  content_type?: string;
  value?: number;
  currency?: string;
}): void {
  trackMetaEvent('ViewContent', {
    ...params,
    currency: params?.currency || 'GBP',
  });
}

export function trackSearch(params: {
  search_string: string;
  content_category?: string;
}): void {
  trackMetaEvent('Search', params);
}

export function trackInitiateCheckout(params?: {
  content_name?: string;
  content_ids?: string[];
  value?: number;
  currency?: string;
  num_items?: number;
}): void {
  trackMetaEvent('InitiateCheckout', {
    ...params,
    currency: params?.currency || 'GBP',
  });
}

export function trackCallCta(params?: {
  content_name?: string;
  content_category?: string;
}): void {
  trackMetaCustomEvent('CallCTA', params);
}

export function trackChatCta(params?: {
  content_name?: string;
  content_category?: string;
}): void {
  trackMetaCustomEvent('ChatCTA', params);
}

export function trackEnquireCta(params?: {
  content_name?: string;
  content_category?: string;
  value?: number;
  currency?: string;
}): void {
  trackMetaEvent('Lead', {
    ...params,
    currency: params?.currency || 'GBP',
  });
}

export function trackEnquirySubmitted(params?: {
  content_name?: string;
  content_category?: string;
  value?: number;
  currency?: string;
}): void {
  trackMetaEvent('SubmitApplication', {
    ...params,
    currency: params?.currency || 'GBP',
  });
}

export function trackContactFormSubmitted(params?: {
  content_name?: string;
}): void {
  trackMetaEvent('Contact', params);
}

export { isMetaPixelAvailable };
