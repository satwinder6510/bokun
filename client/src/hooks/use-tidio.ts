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
    // Check if current path is a tour or package detail page (including test pages)
    const isTourDetail = /^\/tour\/\d+/.test(location);
    const isPackageDetail = /^\/packages\/[^\/]+$/.test(location) || /^\/Holidays\/[^\/]+\/[^\/]+$/.test(location);
    const isTestPage = /^\/packages-test\/[^\/]+$/.test(location) || /^\/Holidays-test\/[^\/]+\/[^\/]+$/.test(location);
    
    if ((isTourDetail || isPackageDetail || isTestPage) && !tidioLoaded) {
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
