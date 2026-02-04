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
  // Tidio is now loaded directly in index.html
  // This hook just ensures the widget is shown when ready
  useEffect(() => {
    if (!tidioLoaded) {
      tidioLoaded = true;
      
      // Show the widget when Tidio is ready
      const handleTidioReady = () => {
        console.log('[Tidio] Chat ready, showing widget');
        if (window.tidioChatApi) {
          window.tidioChatApi.show();
        }
      };
      
      document.addEventListener('tidioChat-ready', handleTidioReady);
      
      // Also poll for API availability as backup
      let attempts = 0;
      const checkApi = setInterval(() => {
        attempts++;
        if (window.tidioChatApi) {
          console.log('[Tidio] API available, showing widget');
          window.tidioChatApi.show();
          clearInterval(checkApi);
        } else if (attempts > 100) {
          console.log('[Tidio] API not available after 10s');
          clearInterval(checkApi);
        }
      }, 100);
      
      return () => {
        document.removeEventListener('tidioChat-ready', handleTidioReady);
        clearInterval(checkApi);
      };
    }
  }, []);
}

export function openTidioChat() {
  if (window.tidioChatApi) {
    window.tidioChatApi.show();
    window.tidioChatApi.open();
  }
}
