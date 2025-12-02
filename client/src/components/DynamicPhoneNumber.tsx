import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Phone } from "lucide-react";

interface DynamicPhoneNumberProps {
  className?: string;
  showIcon?: boolean;
  iconClassName?: string;
}

const DEFAULT_PHONE = "0208 183 0518";

function getUtmParams(): { source: string | null; campaign: string | null; medium: string | null } {
  if (typeof window === "undefined") {
    return { source: null, campaign: null, medium: null };
  }
  
  const params = new URLSearchParams(window.location.search);
  
  let source = params.get("utm_source");
  let campaign = params.get("utm_campaign");
  let medium = params.get("utm_medium");
  
  const stored = sessionStorage.getItem("utm_params");
  if (stored) {
    try {
      const storedParams = JSON.parse(stored);
      source = source || storedParams.source;
      campaign = campaign || storedParams.campaign;
      medium = medium || storedParams.medium;
    } catch (e) {
    }
  }
  
  if (source || campaign || medium) {
    sessionStorage.setItem("utm_params", JSON.stringify({ source, campaign, medium }));
  }
  
  return { source, campaign, medium };
}

export function DynamicPhoneNumber({ className = "", showIcon = true, iconClassName = "w-4 h-4" }: DynamicPhoneNumberProps) {
  const [utmParams, setUtmParams] = useState<{ source: string | null; campaign: string | null; medium: string | null }>({
    source: null, campaign: null, medium: null
  });
  
  useEffect(() => {
    setUtmParams(getUtmParams());
  }, []);

  const { data } = useQuery<{ phoneNumber: string; id: number | null }>({
    queryKey: ["/api/tracking-number", utmParams],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (utmParams.source) params.set("source", utmParams.source);
      if (utmParams.campaign) params.set("campaign", utmParams.campaign);
      if (utmParams.medium) params.set("medium", utmParams.medium);
      
      const url = `/api/tracking-number${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url);
      if (!response.ok) {
        return { phoneNumber: DEFAULT_PHONE, id: null };
      }
      return response.json();
    },
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
  });

  const phoneNumber = data?.phoneNumber || DEFAULT_PHONE;

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
  const [utmParams, setUtmParams] = useState<{ source: string | null; campaign: string | null; medium: string | null }>({
    source: null, campaign: null, medium: null
  });
  
  useEffect(() => {
    setUtmParams(getUtmParams());
  }, []);

  const { data } = useQuery<{ phoneNumber: string; id: number | null }>({
    queryKey: ["/api/tracking-number", utmParams],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (utmParams.source) params.set("source", utmParams.source);
      if (utmParams.campaign) params.set("campaign", utmParams.campaign);
      if (utmParams.medium) params.set("medium", utmParams.medium);
      
      const url = `/api/tracking-number${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url);
      if (!response.ok) {
        return { phoneNumber: DEFAULT_PHONE, id: null };
      }
      return response.json();
    },
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
  });

  return data?.phoneNumber || DEFAULT_PHONE;
}

export default DynamicPhoneNumber;
