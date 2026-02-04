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
      const script = document.createElement('script');
      script.src = '//code.tidio.co/umkdiuqjxuccie7jbxsnr0f6pj3lkfcs.js';
      script.async = true;
      document.body.appendChild(script);
      tidioLoaded = true;
    }
  }, []);
}

export function openTidioChat() {
  if (window.tidioChatApi) {
    window.tidioChatApi.show();
    window.tidioChatApi.open();
  }
}
