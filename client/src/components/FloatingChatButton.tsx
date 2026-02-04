import { useState } from "react";
import { MessageCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    tidioChatApi?: {
      show: () => void;
      hide: () => void;
      open: () => void;
    };
  }
}

export function FloatingChatButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = () => {
    if (window.tidioChatApi) {
      window.tidioChatApi.show();
      window.tidioChatApi.open();
    } else {
      setIsLoading(true);
      const handleReady = () => {
        setIsLoading(false);
        if (window.tidioChatApi) {
          window.tidioChatApi.show();
          window.tidioChatApi.open();
        }
        document.removeEventListener("tidioChat-ready", handleReady);
      };
      document.addEventListener("tidioChat-ready", handleReady);
      setTimeout(() => {
        setIsLoading(false);
        document.removeEventListener("tidioChat-ready", handleReady);
      }, 5000);
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={isLoading}
      className="fixed bottom-5 right-5 z-[999999] rounded-full w-14 h-14 p-0 shadow-lg bg-primary hover:bg-primary/90"
      data-testid="button-floating-chat"
    >
      {isLoading ? (
        <Loader2 className="w-6 h-6 animate-spin text-white" />
      ) : (
        <MessageCircle className="w-6 h-6 text-white" />
      )}
    </Button>
  );
}
