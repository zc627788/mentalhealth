// 豆包API 流式响应测试脚本
const DOUBAO_API_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
const DOUBAO_API_KEY = "4701e7b7-f56c-4149-81e9-18b5a693a54f";

// 系统提示词
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
  }
];

async function testDoubaoStreaming() {
  console.log('🚀 开始测试豆包API流式响应性能...\n');
  
  const testMessage = "你好，我是智心助手！我是一个温暖治愈的AI心理陪伴者，专门为你提供安全、温暖的情感倾诉空间。";
  
  try {
    console.log(`📝 测试消息: "${testMessage}"`);
    console.log('⏱️  开始计时...\n');
    
    // 构建消息
    const messages = [
      ...systemMessages,
      {
        "role": "user",
        "content": testMessage
      }
    ];
    
    // 记录开始时间
    const startTime = Date.now();
    
    // 调用豆包API - 启用流式
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
        stream: true  // 启用流式输出
      })
    });
    
    // 记录API响应时间
    const apiResponseTime = Date.now() - startTime;
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    console.log(`✅ API响应时间: ${apiResponseTime}ms`);
    console.log(`📊 响应头:`, Object.fromEntries(response.headers.entries()));
    
    // 检查是否是流式响应
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('text/event-stream')) {
      console.log('⚠️  警告: 响应不是流式格式，可能是普通JSON响应');
      
      // 尝试解析为JSON
      const data = await response.json();
      console.log('📄 JSON响应:', data);
      return;
    }
    
    console.log('✅ 确认是流式响应\n');
    
    // 处理流式数据
    console.log('🔄 开始处理流式数据...');
    
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法读取响应流');
    }
    
    const decoder = new TextDecoder();
    let buffer = '';
    let chunkCount = 0;
    let totalContent = '';
    let firstChunkTime = null;
    let lastChunkTime = null;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      if (firstChunkTime === null) {
        firstChunkTime = Date.now();
      }
      lastChunkTime = Date.now();
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            console.log(`\n✅ 流式数据接收完成`);
            break;
          }
          
          try {
            const parsed = JSON.parse(data);
            if (parsed.choices?.[0]?.delta?.content) {
              chunkCount++;
              const content = parsed.choices[0].delta.content;
              totalContent += content;
              
              console.log(`Chunk ${chunkCount}: "${content}"`);
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }
    
    const totalStreamTime = lastChunkTime - firstChunkTime;
    const avgChunkTime = totalStreamTime / chunkCount;
    
    console.log('\n📈 流式输出性能统计:');
    console.log('======================');
    console.log(`总词块数: ${chunkCount}`);
    console.log(`总内容长度: ${totalContent.length} 字符`);
    console.log(`流式输出时间: ${totalStreamTime}ms`);
    console.log(`平均词块间隔: ${avgChunkTime.toFixed(2)}ms`);
    console.log(`API响应时间: ${apiResponseTime}ms`);
    console.log(`总体验时间: ${apiResponseTime + totalStreamTime}ms`);
    
    console.log(`\n💬 完整回复: ${totalContent}`);
    
    // 性能评估
    console.log('\n🎯 性能评估:');
    if (apiResponseTime < 1000) {
      console.log('🚀 API响应: 优秀 (< 1秒)');
    } else if (apiResponseTime < 3000) {
      console.log('⚡ API响应: 良好 (1-3秒)');
    } else {
      console.log('🐌 API响应: 需要优化 (> 3秒)');
    }
    
    if (totalStreamTime < 2000) {
      console.log('🚀 流式输出: 流畅 (< 2秒)');
    } else if (totalStreamTime < 5000) {
      console.log('⚡ 流式输出: 可接受 (2-5秒)');
    } else {
      console.log('🐌 流式输出: 较慢 (> 5秒)');
    }
    
    // 用户体验评分
    const totalExperienceTime = apiResponseTime + totalStreamTime;
    let userExperienceScore;
    
    if (totalExperienceTime < 2000) {
      userExperienceScore = '优秀 (5/5)';
    } else if (totalExperienceTime < 4000) {
      userExperienceScore = '良好 (4/5)';
    } else if (totalExperienceTime < 6000) {
      userExperienceScore = '一般 (3/5)';
    } else if (totalExperienceTime < 10000) {
      userExperienceScore = '较差 (2/5)';
    } else {
      userExperienceScore = '很差 (1/5)';
    }
    
    console.log(`\n👤 用户体验评分: ${userExperienceScore}`);
    console.log(`总体验时间: ${totalExperienceTime}ms`);
    
    // 建议
    console.log('\n💡 优化建议:');
    if (apiResponseTime > 3000) {
      console.log('- 考虑优化API响应速度');
    }
    if (totalStreamTime > 5000) {
      console.log('- 考虑减少流式输出延迟');
    }
    if (totalExperienceTime > 6000) {
      console.log('- 整体性能需要优化');
    }
    if (totalExperienceTime < 3000) {
      console.log('- 性能表现良好，无需优化');
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

// 运行测试
testDoubaoStreaming()
  .then(() => {
    console.log('\n🎉 测试完成！');
  })
  .catch(error => {
    console.error('❌ 测试脚本执行失败:', error);
  });
