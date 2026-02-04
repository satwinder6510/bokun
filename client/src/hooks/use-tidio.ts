import { useEffect } from 'react';

declare global {
  interface Window {
    tidioChatApi?: {
      show: () => void;
      hide: () => void;
      open: () => void;
    };
    tidioIdentify?: object;
  }
}

let tidioLoaded = false;

export function useTidio() {
  useEffect(() => {
    // Load Tidio once across the entire site
    if (!tidioLoaded) {
      tidioLoaded = true;
      const script = document.createElement('script');
      script.src = 'https://code.tidio.co/umkdiuqjxuccie7jbxsnr0f6pj3lkfcs.js';
      script.async = true;
      script.onload = () => {
        console.log('[Tidio] Script loaded successfully');
      };
      script.onerror = () => {
        console.error('[Tidio] Failed to load script');
      };
      document.body.appendChild(script);
    }
  }, []);
}

export function openTidioChat() {
  if (window.tidioChatApi) {
    window.tidioChatApi.show();
    window.tidioChatApi.open();
  }
}
