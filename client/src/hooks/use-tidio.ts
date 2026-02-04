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
  // Tidio is loaded directly in index.html
  // This hook ensures the widget is shown and visible
  useEffect(() => {
    if (!tidioLoaded) {
      tidioLoaded = true;
      
      const showTidioWidget = () => {
        // Call the API to show the widget
        if (window.tidioChatApi) {
          window.tidioChatApi.show();
        }
        
        // Also force the iframe to be visible via DOM
        const tidioFrame = document.getElementById('tidio-chat-code');
        if (tidioFrame) {
          tidioFrame.style.display = 'block';
          console.log('[Tidio] Forced iframe visible');
        }
        
        // Also check for the button iframe
        const tidioButton = document.getElementById('tidio-chat');
        if (tidioButton) {
          tidioButton.style.display = 'block';
        }
      };
      
      // Show when Tidio is ready
      const handleTidioReady = () => {
        console.log('[Tidio] Chat ready');
        showTidioWidget();
      };
      
      document.addEventListener('tidioChat-ready', handleTidioReady);
      
      // Poll for Tidio elements and make them visible
      let attempts = 0;
      const checkApi = setInterval(() => {
        attempts++;
        showTidioWidget();
        
        if (window.tidioChatApi && attempts > 20) {
          console.log('[Tidio] Widget should be visible now');
          clearInterval(checkApi);
        } else if (attempts > 100) {
          console.log('[Tidio] Giving up after 10s');
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
