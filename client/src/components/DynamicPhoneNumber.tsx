import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Phone } from "lucide-react";

interface DynamicPhoneNumberProps {
  className?: string;
  showIcon?: boolean;
  iconClassName?: string;
}

const DEFAULT_PHONE = "0208 183 0518";

function getReferrerDomain(): string | null {
  if (typeof window === "undefined" || !document.referrer) {
    return null;
  }
  
  try {
    const url = new URL(document.referrer);
    // Return the hostname (e.g., "google.com", "facebook.com")
    return url.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function getTrackingInfo(): { tag: string | null; domain: string | null } {
  if (typeof window === "undefined") {
    return { tag: null, domain: null };
  }
  
  // Check for tag in URL - looks for any query param that has no value (e.g., ?tzl)
  // or a tag param with value (e.g., ?tag=tzl)
  const params = new URLSearchParams(window.location.search);
  
  // First check for explicit tag param
  let tag = params.get("tag");
  
  // If no explicit tag, look for any param with empty value (e.g., ?tzl)
  if (!tag) {
    const entries = Array.from(params.entries());
    for (let i = 0; i < entries.length; i++) {
      const [key, value] = entries[i];
      if (value === "" || value === key) {
        tag = key;
        break;
      }
    }
  }
  
  // Check session storage for previously stored tag and domain
  const storedTag = sessionStorage.getItem("tracking_tag");
  const storedDomain = sessionStorage.getItem("tracking_domain");
  
  // Get referrer domain (only captured on first page load)
  const referrerDomain = getReferrerDomain();
  
  // Use current URL tag if present, otherwise use stored tag
  const finalTag = tag || storedTag;
  
  // Use referrer domain if present, otherwise use stored domain
  const finalDomain = referrerDomain || storedDomain;
  
  // Store in session storage so they persist during browsing
  if (tag) {
    sessionStorage.setItem("tracking_tag", tag);
  }
  if (referrerDomain) {
    sessionStorage.setItem("tracking_domain", referrerDomain);
  }
  
  return { tag: finalTag, domain: finalDomain };
}

function useTrackingInfo() {
  const [initialized, setInitialized] = useState(false);
  const [trackingInfo, setTrackingInfo] = useState<{ tag: string | null; domain: string | null }>({ tag: null, domain: null });
  
  useEffect(() => {
    const info = getTrackingInfo();
    setTrackingInfo(info);
    setInitialized(true);
  }, []);
  
  return { ...trackingInfo, initialized };
}

async function fetchTrackingNumber(tag: string | null, domain: string | null): Promise<{ phoneNumber: string; id: number | null }> {
  const params = new URLSearchParams();
  if (tag) params.set("tag", tag);
  if (domain) params.set("domain", domain);
  
  const url = params.toString() ? `/api/tracking-number?${params.toString()}` : "/api/tracking-number";
  const response = await fetch(url);
  if (!response.ok) {
    return { phoneNumber: DEFAULT_PHONE, id: null };
  }
  return response.json();
}

export function DynamicPhoneNumber({ className = "", showIcon = true, iconClassName = "w-4 h-4" }: DynamicPhoneNumberProps) {
  const { tag, domain, initialized } = useTrackingInfo();
  
  // Create a unique query key based on both tag and domain
  const queryKey = useMemo(() => {
    const parts = ["/api/tracking-number"];
    if (tag) parts.push(`tag:${tag}`);
    if (domain) parts.push(`domain:${domain}`);
    return parts.join(":");
  }, [tag, domain]);

  const { data, isFetching } = useQuery<{ phoneNumber: string; id: number | null }>({
    queryKey: [queryKey],
    queryFn: () => fetchTrackingNumber(tag, domain),
    enabled: initialized,
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
  });

  const phoneNumber = initialized && !isFetching && data?.phoneNumber ? data.phoneNumber : DEFAULT_PHONE;

  return (
    <a 
      href={`tel:${phoneNumber.replace(/\s/g, "")}`}
      className={className}
      data-testid="link-phone-number"
    >
      {showIcon && <Phone className={iconClassName} />}
      <span>{phoneNumber}</span>
    </a>
  );
}

export function useDynamicPhoneNumber(): string {
  const { tag, domain, initialized } = useTrackingInfo();
  
  // Create a unique query key based on both tag and domain
  const queryKey = useMemo(() => {
    const parts = ["/api/tracking-number"];
    if (tag) parts.push(`tag:${tag}`);
    if (domain) parts.push(`domain:${domain}`);
    return parts.join(":");
  }, [tag, domain]);

  const { data, isFetching } = useQuery<{ phoneNumber: string; id: number | null }>({
    queryKey: [queryKey],
    queryFn: () => fetchTrackingNumber(tag, domain),
    enabled: initialized,
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
  });

  return initialized && !isFetching && data?.phoneNumber ? data.phoneNumber : DEFAULT_PHONE;
}

export default DynamicPhoneNumber;
