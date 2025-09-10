// Edge Function for Peppy AI Chat Integration - Streaming Version
Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE, PATCH",
    "Access-Control-Max-Age": "86400",
    "Access-Control-Allow-Credentials": "false",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { message, conversationHistory } = await req.json();
    console.log("接收到Peppy流式请求:", {
      message: message?.substring(0, 50),
      historyLength: conversationHistory?.length,
    });

    if (!message || typeof message !== "string") {
      throw new Error("有效的消息内容是必需的");
    }

    // Peppy API 配置
    const PEPPY_API_URL =
      "https://u753844-b362-4a815360.nma1.seetacloud.com:8448/chat";

    // 系统提示词 - 为Peppy添加活泼开朗的性格
    const systemPrompt = ``;

    // 拼接完整消息
    let fullMessage = systemPrompt + "\n\n";
    if (conversationHistory && conversationHistory.length > 0) {
      fullMessage += "对话历史：\n";
      conversationHistory.forEach((msg) => {
        if (msg.role === "user") {
          fullMessage += `用户：${msg.content}\n`;
        } else if (msg.role === "assistant") {
          fullMessage += `Peppy：${msg.content}\n`;
        }
      });
      fullMessage += "\n";
    }
    // 添加当前用户消息
    fullMessage += `用户：${message}\nPeppy：`;

    console.log("准备调用Peppy API:", {
      url: PEPPY_API_URL,
      messageLength: fullMessage.length,
      messagePreview: fullMessage.substring(0, 100) + "...",
    });

    // 调用 Peppy API
    const response = await fetch(PEPPY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: fullMessage,
      }),
    });

    console.log("Peppy API响应状态:", {
      status: response.status,
      statusText: response.statusText,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Peppy API错误:", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        url: PEPPY_API_URL,
      });
      throw new Error(`Peppy API调用失败: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("Peppy API响应数据:", {
      hasResponse: !!data.response,
      responseLength: data.response?.length,
      responsePreview:
        data.response?.substring(0, 100) +
        (data.response?.length > 100 ? "..." : ""),
    });

    if (!data.response) {
      console.error("Peppy API响应格式异常:", data);
      throw new Error("Peppy API响应格式异常");
    }

    const aiResponse = data.response;

    const stream = new ReadableStream({
      start(controller) {
        try {
          // 将完整响应按词分割，模拟流式输出
          const words = aiResponse.split(/(\s+|[，。！？；：])/);

          let index = 0;
          const sendNextChunk = () => {
            if (index < words.length) {
              const word = words[index];
              if (word.trim()) {
                const chunk = { content: word };
                controller.enqueue(
                  new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`)
                );

                // 根据内容调整延迟：标点符号稍长，普通字符较短
                const delay = /[，。！？；：]/.test(word) ? 100 : 30;
                setTimeout(sendNextChunk, delay);
              } else {
                // 跳过空白字符
                index++;
                sendNextChunk();
              }
            } else {
              // 发送结束标记
              controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
              controller.close();
            }
            index++;
          };

          // 开始发送
          sendNextChunk();
        } catch (error) {
          console.error("Peppy流式处理错误:", error);
          const errorChunk = {
            content:
              "哎呀！我刚刚有点小故障呢～😅 不过没关系，我还在这里陪着你！你可以再试一次，或者换个话题聊聊～ 我永远是你的阳光小助手！✨",
          };
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify(errorChunk)}\n\n`)
          );
          controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Peppy AI聊天错误 - 详细信息:", {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
      timestamp: new Date().toISOString(),
    });

    // 返回流式错误响应
    const stream = new ReadableStream({
      start(controller) {
        const errorChunk = {
          content:
            "哎呀！我刚刚有点小故障呢～😅 不过没关系，我还在这里陪着你！你可以再试一次，或者换个话题聊聊～ 我永远是你的阳光小助手！✨",
        };
        controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify(errorChunk)}\n\n`)
        );
        controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }
});
