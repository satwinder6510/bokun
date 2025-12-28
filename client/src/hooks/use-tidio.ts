import { useEffect } from 'react';
import { useLocation } from 'wouter';

declare global {
  interface Window {
    tidioChatApi?: {
      show: () => void;
      hide: () => void;
      open: () => void;
    };
  }
}

let tidioLoaded = false;

export function useTidio() {
  const [location] = useLocation();

  useEffect(() => {
    // Check if current path is a tour or package detail page
    const isTourDetail = /^\/tour\/\d+/.test(location);
    const isPackageDetail = /^\/packages\/[^\/]+$/.test(location) || /^\/Holidays\/[^\/]+\/[^\/]+$/.test(location);
    
    if ((isTourDetail || isPackageDetail) && !tidioLoaded) {
      // Load Tidio script
      const script = document.createElement('script');
      script.src = '//code.tidio.co/umkdiuqjxuccie7jbxsnr0f6pj3lkfcs.js';
      script.async = true;
      document.body.appendChild(script);
      tidioLoaded = true;
    }
  }, [location]);
}

export function openTidioChat() {
  if (window.tidioChatApi) {
    window.tidioChatApi.open();
  }
}
