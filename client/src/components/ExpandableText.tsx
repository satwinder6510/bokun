import { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sanitizeHtml } from "@/lib/sanitize";

interface ExpandableTextProps {
  html: string;
  maxLines?: number;
  className?: string;
  testId?: string;
}

export function ExpandableText({ 
  html, 
  maxLines = 4, 
  className = "",
  testId
}: ExpandableTextProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [needsExpansion, setNeedsExpansion] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      const lineHeight = parseInt(getComputedStyle(contentRef.current).lineHeight) || 24;
      const maxHeight = lineHeight * maxLines;
      const actualHeight = contentRef.current.scrollHeight;
      setNeedsExpansion(actualHeight > maxHeight + 10);
    }
  }, [html, maxLines]);

  const collapsedStyle = !isExpanded && needsExpansion ? {
    maxHeight: `${maxLines * 1.6}em`,
    overflow: 'hidden' as const,
    maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
    WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
  } : {};

  return (
    <div className="relative">
      <div 
        ref={contentRef}
        className={`prose prose-sm md:prose-base max-w-none dark:prose-invert ${className}`}
        style={collapsedStyle}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
        data-testid={testId}
      />
      {needsExpansion && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-2 text-secondary hover:text-secondary/80 p-0 h-auto font-medium"
          data-testid={testId ? `${testId}-toggle` : "button-expand-text"}
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-4 h-4 mr-1" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4 mr-1" />
              Read more
            </>
          )}
        </Button>
      )}
    </div>
  );
}
