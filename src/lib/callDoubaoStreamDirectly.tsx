import { Language, normalizeLanguage, useLanguageStore } from "@/store/languageStore";

const DOUBAO_API_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
const DOUBAO_API_KEY = "4701e7b7-f56c-4149-81e9-18b5a693a54f";

const LANGUAGE_PROMPTS: Record<Language, string[]> = {
  "zh-CN": [
    `与您匹配的参与者会以描述最近的烦恼或担忧来开启对话，您的任务是倾听并给予回应。
为了帮助我们维持一个尊重且高质量的研究环境，我们请您遵循以下准则：
- 回复长度不超过200字。
- 请以尊重的态度进行交流，避免使用任何不适当或具有伤害性的语言。
- 请认真参与对话。
- 安全提示：若在交流过程中发现自伤、自杀或其他严重风险信号，请立即停止对话，并建议对方尽快寻求专业帮助或联系紧急资源（12356 全国统一心理援助热线，400-161-9995 全国希望24小时热线）。`,
    `你必须始终使用简体中文回复用户，包括打招呼、追问、安慰和安全提醒。除非用户明确要求切换语言，否则不要输出英文。`,
  ],
  en: [
    `The participant matched with you will begin the conversation by describing a recent worry or concern, and your task is to listen and respond.
To help us maintain a respectful and high-quality research environment, please follow these rules:
- Keep each reply under 200 words.
- Communicate respectfully and avoid any inappropriate or harmful language.
- Participate seriously and stay focused on the other person's sharing.
- Safety alert: if you notice signs of self-harm, suicide, or any other serious risk during the conversation, stop the conversation immediately and advise the user to seek professional help or contact emergency resources, such as the 988 Suicide & Crisis Lifeline or local emergency services.`,
    `You must always reply in English, including greetings, follow-up questions, emotional support, and safety guidance. Do not switch to Chinese unless the user explicitly asks you to.`,
  ],
};

const FALLBACK_RESPONSE: Record<Language, string> = {
  "zh-CN":
    "抱歉，我现在暂时无法顺利回复。你可以换一种方式再告诉我你的想法，或者稍后我们再继续。",
  en: "Sorry, I can't respond properly right now. You can try saying it another way, or we can continue a bit later.",
};

interface ConversationMessage {
  role: string;
  content: string;
}

function buildSystemMessages(language: Language) {
  return LANGUAGE_PROMPTS[language].map((content) => ({
    role: "system",
    content,
  }));
}

export const callDoubaoStreamDirectly = async (
  userMessage: string,
  conversationHistory: ConversationMessage[],
  onChunk: (chunk: string) => void,
  language?: string
) => {
  const resolvedLanguage = normalizeLanguage(
    language || useLanguageStore.getState().language
  );
  const recentHistory = conversationHistory.slice(-10);
  const messages = [
    ...buildSystemMessages(resolvedLanguage),
    ...recentHistory,
    {
      role: "user",
      content: userMessage,
    },
  ];

  try {
    const response = await fetch(`${DOUBAO_API_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DOUBAO_API_KEY}`,
      },
      body: JSON.stringify({
        model: "doubao-seed-1-6-250615",
        messages,
        temperature: 0.7,
        max_tokens: 1000,
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      const errorText = await response.text();
      console.error("Doubao API error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      throw new Error(`Doubao API request failed: ${response.status} - ${errorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.trim() === "" || line.startsWith(":")) continue;

        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") {
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              onChunk(content);
            }
          } catch (error) {
            console.error("Failed to parse Doubao streaming payload:", {
              error,
              rawData: data,
            });
          }
        }
      }
    }
  } catch (error) {
    console.error("Doubao stream request failed:", error);
    onChunk(FALLBACK_RESPONSE[resolvedLanguage]);
  }
};
