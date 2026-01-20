import { PostHog } from "posthog-node";

export const posthog = new PostHog(process.env.POSTHOG_API_KEY!, {
  host: process.env.POSTHOG_HOST || "https://us.i.posthog.com"
});

export function trackAICrawl(url: string, ua: string) {
  const bot = detectBot(ua);

  if (!bot) return;

  posthog.capture({
    distinctId: `ai-bot:${bot}`,
    event: "ai_crawl",
    properties: {
      bot,
      url,
      user_agent: ua,
      timestamp: new Date().toISOString()
    }
  });
}

function detectBot(ua: string): string | null {
  const bots = {
    gptbot: /GPTBot/i,
    chatgpt_user: /ChatGPT-User/i,
    claude: /ClaudeBot/i,
    perplexity: /PerplexityBot/i,
    cohere: /cohere-ai/i,
    gemini_training: /Google-Extended/i,
    google_ai: /GoogleOther/i,
    facebook_ai: /facebookexternalhit/i,
    amazon_ai: /amazon|Amazonbot|amazon-kt/i
  };

  for (const [name, regex] of Object.entries(bots)) {
    if (regex.test(ua)) return name;
  }

  return null;
}
