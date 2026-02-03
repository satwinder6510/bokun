import { useEffect } from 'react';
import { useLocation } from 'wouter';

declare global {
  interface Window {
    HFCHAT_CONFIG?: {
      EMBED_TOKEN: string;
      ASSETS_URL: string;
    };
    HappyFoxChat?: {
      open: () => void;
      close: () => void;
      toggle: () => void;
      expandWidget: () => void;
      collapseWidget: () => void;
    };
  }
}

let happyfoxLoaded = false;

export function useHappyFox() {
  const [location] = useLocation();

  useEffect(() => {
    const isTourDetail = /^\/tour\/\d+/.test(location);
    const isPackageDetail = /^\/packages\/[^\/]+$/.test(location) || /^\/Holidays\/[^\/]+\/[^\/]+$/.test(location);
    const isTestPage = /^\/packages-test\/[^\/]+$/.test(location) || /^\/Holidays-test\/[^\/]+\/[^\/]+$/.test(location);
    
    if ((isTourDetail || isPackageDetail || isTestPage) && !happyfoxLoaded) {
      window.HFCHAT_CONFIG = {
        EMBED_TOKEN: '0799b060-00fb-11f1-a7bb-77728896a359',
        ASSETS_URL: 'https://widget.happyfoxchat.com/v2/visitor'
      };

      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.async = true;
      script.src = window.HFCHAT_CONFIG.ASSETS_URL + '/js/widget-loader.js';
      
      const s = document.getElementsByTagName('script')[0];
      if (s && s.parentNode) {
        s.parentNode.insertBefore(script, s);
      } else {
        document.head.appendChild(script);
      }
      
      happyfoxLoaded = true;
    }
  }, [location]);
}

export function openHappyFoxChat() {
  if (window.HappyFoxChat) {
    window.HappyFoxChat.expandWidget();
    window.HappyFoxChat.open();
  }
}
