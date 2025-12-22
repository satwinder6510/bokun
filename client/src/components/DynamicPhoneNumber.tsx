import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Phone } from "lucide-react";

interface DynamicPhoneNumberProps {
  className?: string;
  showIcon?: boolean;
  iconClassName?: string;
}

const DEFAULT_PHONE = "0208 183 0518";

function getTrackingTag(): string | null {
  if (typeof window === "undefined") {
    return null;
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
  
  // Check session storage for previously stored tag
  const storedTag = sessionStorage.getItem("tracking_tag");
  
  // Use current URL tag if present, otherwise use stored tag
  const finalTag = tag || storedTag;
  
  // Store the tag in session storage so it persists during browsing
  if (tag) {
    sessionStorage.setItem("tracking_tag", tag);
  }
  
  return finalTag;
}

function useTrackingTag() {
  const [initialized, setInitialized] = useState(false);
  const [tag, setTag] = useState<string | null>(null);
  
  useEffect(() => {
    const foundTag = getTrackingTag();
    setTag(foundTag);
    setInitialized(true);
  }, []);
  
  return { tag, initialized };
}

async function fetchTrackingNumber(tag: string | null): Promise<{ phoneNumber: string; id: number | null }> {
  const url = tag ? `/api/tracking-number?tag=${encodeURIComponent(tag)}` : "/api/tracking-number";
  const response = await fetch(url);
  if (!response.ok) {
    return { phoneNumber: DEFAULT_PHONE, id: null };
  }
  return response.json();
}

export function DynamicPhoneNumber({ className = "", showIcon = true, iconClassName = "w-4 h-4" }: DynamicPhoneNumberProps) {
  const { tag, initialized } = useTrackingTag();
  
  const queryKey = useMemo(() => tag ? `/api/tracking-number:${tag}` : "/api/tracking-number", [tag]);

  const { data, isFetching } = useQuery<{ phoneNumber: string; id: number | null }>({
    queryKey: [queryKey],
    queryFn: () => fetchTrackingNumber(tag),
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
  const { tag, initialized } = useTrackingTag();
  
  const queryKey = useMemo(() => tag ? `/api/tracking-number:${tag}` : "/api/tracking-number", [tag]);

  const { data, isFetching } = useQuery<{ phoneNumber: string; id: number | null }>({
    queryKey: [queryKey],
    queryFn: () => fetchTrackingNumber(tag),
    enabled: initialized,
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
  });

  return initialized && !isFetching && data?.phoneNumber ? data.phoneNumber : DEFAULT_PHONE;
}

export default DynamicPhoneNumber;
