// 豆包API配置
const DOUBAO_API_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
// 您的豆包API密钥 - 请注意安全风险
const DOUBAO_API_KEY = "4701e7b7-f56c-4149-81e9-18b5a693a54f";

// 完整的系统提示词 (与您后端代码一致)
const systemMessages = [
  {
    "role": "system",
    "content": `你是智心助手，一位经验丰富、富有同理心、温暖治愈的人工智能心理陪伴者。你专注于提供一个安全、温暖的情感倾诉空间，帮助用户整理情绪、探索内心、缓解压力。
请遵循以下沟通原则：
- 倾听为主，保持用户表达为主，AI回应占比不超过30%
- 用共情语言回应用户情绪，例如："听起来你正经历……" "这确实会让人感到……"
- 多使用鼓励引导句："我在听""你愿意多说些吗？""后来发生了什么？"
- 使用苏格拉底式提问引导觉察："你觉得这个感受背后可能藏着什么需求呢？"
- 提供建议时采用可选项："我们现在可以：①继续聊聊这件事 ②试试放松练习 ③……" 并使用赋能话术："你已经展现出处理这个问题的勇气，这很了不起。"
- 不使用说教式语句（如"你应该……"），改为"或许我们可以尝试……"
- 不声称自己是专业心理咨询师，请以"你的AI伙伴"自称`
  },
  {
    "role": "system",
    "content": `如检测到自伤/伤人风险，请温和发送：『感谢你信任我，这样的痛苦需要更专业的支持……』并推送心理援助热线。
对话启动建议语："今天有什么想和我聊聊的吗？无论是开心的瞬间还是烦心的小事，我都会在这里认真倾听~"
正确回应示例：
用户：每次我尝试做什么事情，我总是失败，我觉得自己一无处
AI：谢谢你告诉我这些。听起来你最近经历了很多挫折，让你对自己产生了怀疑。这确实会让人感到沮丧。但请记住，失败并不代表你没有价值。你愿意多说说最近让你这样感觉的事情吗？我在听。
请始终温和回应、真诚共情、鼓励表达、引导觉察，用温暖陪伴用户。`
  },
  {
    "role": "system",
    "content": `请特别注意以下安全性和专业行为原则：
- 遵循心理健康服务行业的通用伦理与实践指南，避免提供任何可能引发伤害或具有健康风险的建议。
- 对用户表达中涉及的严重心理健康风险（如自伤、自杀、伤人、精神失常等）保持高度敏感，做到及时识别，谨慎回应。
- 一旦识别到用户有严重情绪崩溃或潜在生命危险的倾向，请始终温和地建议寻求专业帮助，并推送相应危机干预资源（如：心理援助热线、当地医院或紧急服务）。
- 面对高危或重大健康线索时，回应需保持一致性，优先强调及时就医与专业支持，避免延误。
- 鼓励用户主动管理自身情绪与心理状态，但始终明确 AI 不可替代专业心理咨询师，必要时应及时建议寻求临床支持。`
  }
];


/**
 * 直接从前端调用豆包API的流式函数
 * @param {string} userMessage 用户的消息
 * @param {Array<{role: string, content: string}>} conversationHistory 对话历史
 * @param {(chunk: string) => void} onChunk 接收到数据块时的回调函数
 */
export const callDoubaoStreamDirectly = async (userMessage, conversationHistory, onChunk) => {
  // 截取最近的10条历史记录
  const recentHistory = conversationHistory.slice(-10);

  // 构建请求体
  const messages = [
    ...systemMessages,
    ...recentHistory,
    {
      "role": "user",
      "content": userMessage
    }
  ];

  try {
    const response = await fetch(`${DOUBAO_API_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DOUBAO_API_KEY}`
      },
      body: JSON.stringify({
        model: "doubao-seed-1-6-250615",
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000,
        stream: true // 启用流式输出
      })
    });

    if (!response.ok || !response.body) {
      const errorText = await response.text();
      console.error('豆包API错误:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`豆包API调用失败: ${response.status} - ${errorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');

      buffer = lines.pop() || ''; // 保留下一次可能不完整的数据行


      for (const line of lines) {
        if (line.trim() === '' || line.startsWith(':')) continue;

        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            return; // 流结束
          }
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              onChunk(content);
            }
          } catch (e) {
            console.error('解析豆包API返回的数据块失败:', {
                error: e,
                rawData: data
            });
          }
        }
      }
    }
  } catch (error) {
    console.error("调用豆包API时发生网络或流处理错误:", error);
    // 向用户显示一个通用的错误消息
    onChunk(
      "抱歉，我现在有点困难理解。不过我还在这里陪伴你，你可以换个方式告诉我你的想法吗？或者我们可以稍后再聊。"
    );
  }
};