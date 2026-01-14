declare global {
  interface Window {
    posthog?: {
      capture: (eventName: string, properties?: Record<string, unknown>) => void;
      identify: (distinctId: string, properties?: Record<string, unknown>) => void;
      reset: () => void;
      register: (properties: Record<string, unknown>) => void;
      register_once: (properties: Record<string, unknown>) => void;
      unregister: (property: string) => void;
      get_distinct_id: () => string;
      opt_out_capturing: () => void;
      opt_in_capturing: () => void;
      has_opted_out_capturing: () => boolean;
      set_config: (config: Record<string, unknown>) => void;
      startSessionRecording: () => void;
      stopSessionRecording: () => void;
      isFeatureEnabled: (key: string) => boolean | undefined;
      getFeatureFlag: (key: string) => string | boolean | undefined;
      onFeatureFlags: (callback: (flags: string[]) => void) => void;
      reloadFeatureFlags: () => void;
    };
  }
}

type PageType = 
  | 'homepage'
  | 'packages_list'
  | 'package_detail'
  | 'tour_detail'
  | 'tours_list'
  | 'destination'
  | 'destinations_list'
  | 'collection'
  | 'collections_list'
  | 'blog'
  | 'blog_post'
  | 'contact'
  | 'faq'
  | 'terms'
  | 'other';

interface PackageProperties {
  package_id?: number;
  package_title?: string;
  package_slug?: string;
  package_country?: string;
  package_duration?: string;
  package_price?: number;
}

interface TourProperties {
  tour_id?: string | number;
  tour_title?: string;
  tour_duration?: string;
  tour_price?: number;
}

interface SearchProperties {
  search_query?: string;
  search_type?: 'packages' | 'tours' | 'destinations' | 'global' | 'search_page';
  results_count?: number;
}

interface DateSelectionProperties {
  selected_date?: string;
  departure_airport?: string;
  departure_airport_code?: string;
  price?: number;
  product_title?: string;
}

interface FormSubmissionProperties {
  form_type: 'enquiry' | 'contact' | 'newsletter' | 'quote_request';
  success: boolean;
  error_message?: string;
}

function getPostHog() {
  return window.posthog;
}

function isPostHogAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.posthog;
}

export function captureEvent(eventName: string, properties?: Record<string, unknown>): void {
  const posthog = getPostHog();
  if (posthog) {
    posthog.capture(eventName, {
      ...properties,
      timestamp: new Date().toISOString(),
    });
  }
}

export function capturePageView(pageType: PageType, properties?: Record<string, unknown>): void {
  captureEvent('$pageview', {
    page_type: pageType,
    url: window.location.href,
    pathname: window.location.pathname,
    referrer: document.referrer || undefined,
    ...properties,
  });
}

export function capturePackageViewed(properties: PackageProperties): void {
  captureEvent('package_viewed', {
    ...properties,
    page_type: 'package_detail',
  });
}

export function captureTourViewed(properties: TourProperties): void {
  captureEvent('tour_viewed', {
    ...properties,
    page_type: 'tour_detail',
  });
}

export function captureDestinationViewed(destinationName: string, packageCount?: number): void {
  captureEvent('destination_viewed', {
    destination_name: destinationName,
    package_count: packageCount,
    page_type: 'destination',
  });
}

export function captureCollectionViewed(collectionTag: string, collectionTitle: string, packageCount?: number): void {
  captureEvent('collection_viewed', {
    collection_tag: collectionTag,
    collection_title: collectionTitle,
    package_count: packageCount,
    page_type: 'collection',
  });
}

export function captureSearch(properties: SearchProperties): void {
  captureEvent('search_performed', { ...properties });
}

export function captureAISearch(properties: {
  destination: string;
  duration: number;
  budget: number;
  travelers: number;
  holiday_types: string[];
  results_count: number;
  packages_count: number;
  tours_count: number;
}): void {
  captureEvent('ai_search_performed', {
    ...properties,
    page_type: 'ai_search',
  });
}

export function captureSearchResultClicked(properties: {
  search_query: string;
  result_type: 'package' | 'tour';
  result_id: number | string;
  result_title: string;
  result_position: number;
}): void {
  captureEvent('search_result_clicked', { ...properties });
}

export function captureDateSelected(packageId: number | undefined, properties: DateSelectionProperties): void {
  captureEvent('date_selected', {
    package_id: packageId,
    ...properties,
  });
}

export function captureCalendarOpened(packageId: number | undefined, packageTitle: string | undefined): void {
  captureEvent('calendar_opened', {
    package_id: packageId,
    package_title: packageTitle,
  });
}

export function captureCtaClicked(
  ctaType: 'call' | 'chat' | 'enquire' | 'book' | 'view_package' | 'view_tour' | 'check_availability',
  pageType: PageType,
  properties?: Record<string, unknown>
): void {
  captureEvent('cta_clicked', {
    cta_type: ctaType,
    page_type: pageType,
    ...properties,
  });
}

export function captureCallCtaClicked(properties: PackageProperties & { phone_number?: string }): void {
  captureEvent('call_cta_clicked', {
    ...properties,
    page_type: 'package_detail',
  });
}

export function captureChatCtaClicked(properties: PackageProperties): void {
  captureEvent('chat_cta_clicked', {
    ...properties,
    page_type: 'package_detail',
  });
}

export function captureEnquireCtaClicked(properties: PackageProperties): void {
  captureEvent('enquire_cta_clicked', {
    ...properties,
    page_type: 'package_detail',
  });
}

export function captureFormSubmission(properties: FormSubmissionProperties & Record<string, unknown>): void {
  captureEvent('form_submitted', properties);
}

export function captureEnquirySubmitted(
  success: boolean, 
  properties: PackageProperties & { error_message?: string }
): void {
  captureEvent('enquiry_submitted', {
    success,
    form_type: 'enquiry',
    ...properties,
  });
}

export function captureNewsletterSignup(success: boolean, email?: string): void {
  captureEvent('newsletter_signup', {
    success,
    form_type: 'newsletter',
    email_domain: email ? email.split('@')[1] : undefined,
  });
}

export function captureContactFormSubmitted(success: boolean, properties?: Record<string, unknown>): void {
  captureEvent('contact_form_submitted', {
    success,
    form_type: 'contact',
    ...properties,
  });
}

export function captureFilterApplied(
  filterType: 'duration' | 'price' | 'destination' | 'date' | 'departure_airport' | 'sort',
  filterValue: string | number | undefined,
  pageType: PageType
): void {
  captureEvent('filter_applied', {
    filter_type: filterType,
    filter_value: filterValue,
    page_type: pageType,
  });
}

export function captureGalleryInteraction(
  action: 'image_viewed' | 'gallery_opened' | 'gallery_closed',
  imageIndex?: number,
  totalImages?: number
): void {
  captureEvent('gallery_interaction', {
    action,
    image_index: imageIndex,
    total_images: totalImages,
  });
}

export function captureItineraryExpanded(dayNumber: number, packageId?: number): void {
  captureEvent('itinerary_expanded', {
    day_number: dayNumber,
    package_id: packageId,
  });
}

export function captureTabChanged(tabName: string, pageType: PageType): void {
  captureEvent('tab_changed', {
    tab_name: tabName,
    page_type: pageType,
  });
}

export function captureExternalLinkClicked(url: string, linkType: 'social' | 'partner' | 'other'): void {
  captureEvent('external_link_clicked', {
    url,
    link_type: linkType,
  });
}

export function captureScrollDepth(
  depth: number,
  pageType: PageType,
  properties?: Record<string, unknown>
): void {
  captureEvent('scroll_depth', {
    depth_percent: depth,
    page_type: pageType,
    ...properties,
  });
}

export function identifyUser(userId: string, properties?: Record<string, unknown>): void {
  const posthog = getPostHog();
  if (posthog) {
    posthog.identify(userId, properties);
  }
}

export function resetUser(): void {
  const posthog = getPostHog();
  if (posthog) {
    posthog.reset();
  }
}

export function registerSuperProperties(properties: Record<string, unknown>): void {
  const posthog = getPostHog();
  if (posthog) {
    posthog.register(properties);
  }
}

export function isFeatureEnabled(featureKey: string): boolean {
  const posthog = getPostHog();
  if (posthog) {
    return posthog.isFeatureEnabled(featureKey) ?? false;
  }
  return false;
}

export function getFeatureFlag(featureKey: string): string | boolean | undefined {
  const posthog = getPostHog();
  if (posthog) {
    return posthog.getFeatureFlag(featureKey);
  }
  return undefined;
}

export function startSessionRecording(): void {
  const posthog = getPostHog();
  if (posthog) {
    posthog.startSessionRecording();
  }
}

export function stopSessionRecording(): void {
  const posthog = getPostHog();
  if (posthog) {
    posthog.stopSessionRecording();
  }
}

export { isPostHogAvailable };
