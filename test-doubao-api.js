// 豆包API 响应速度测试脚本
const DOUBAO_API_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
const DOUBAO_API_KEY = "4701e7b7-f56c-4149-81e9-18b5a693a54f";

// 测试消息
const testMessages = [
  "你好",
  "我今天心情不太好",
  "能给我一些建议吗？",
  "谢谢你的帮助",
  "再见"
];

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

// 测试函数
async function testDoubaoAPI() {
  console.log('🚀 开始测试豆包API响应速度...\n');
  
  const results = [];
  
  for (let i = 0; i < testMessages.length; i++) {
    const message = testMessages[i];
    console.log(`📝 测试 ${i + 1}/${testMessages.length}: "${message}"`);
    
    try {
      // 记录开始时间
      const startTime = Date.now();
      
      // 构建消息
      const messages = [
        ...systemMessages,
        {
          "role": "user",
          "content": message
        }
      ];
      
      // 调用豆包API
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
          stream: false
        })
      });
      
      // 记录响应时间
      const responseTime = Date.now() - startTime;
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('AI响应格式异常');
      }
      
      const aiResponse = data.choices[0].message.content;
      
      const result = {
        message: message,
        responseTime: responseTime,
        responseLength: aiResponse.length,
        responsePreview: aiResponse.substring(0, 100) + (aiResponse.length > 100 ? "..." : ""),
        usage: data.usage,
        success: true
      };
      
      results.push(result);
      
      console.log(`✅ 成功 - 响应时间: ${responseTime}ms`);
      console.log(`📊 回复长度: ${aiResponse.length} 字符`);
      console.log(`💬 回复预览: ${result.responsePreview}`);
      if (data.usage) {
        console.log(`🔢 Token使用: ${JSON.stringify(data.usage)}`);
      }
      console.log('---');
      
    } catch (error) {
      const result = {
        message: message,
        responseTime: null,
        error: error.message,
        success: false
      };
      
      results.push(result);
      
      console.log(`❌ 失败 - ${error.message}`);
      console.log('---');
    }
    
    // 等待1秒再测试下一个
    if (i < testMessages.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // 统计结果
  console.log('\n📈 测试结果统计:');
  console.log('==================');
  
  const successfulTests = results.filter(r => r.success);
  const failedTests = results.filter(r => !r.success);
  
  console.log(`总测试数: ${results.length}`);
  console.log(`成功: ${successfulTests.length}`);
  console.log(`失败: ${failedTests.length}`);
  
  if (successfulTests.length > 0) {
    const responseTimes = successfulTests.map(r => r.responseTime);
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const minResponseTime = Math.min(...responseTimes);
    const maxResponseTime = Math.max(...responseTimes);
    
    console.log(`\n⏱️  响应时间统计:`);
    console.log(`平均响应时间: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`最快响应时间: ${minResponseTime}ms`);
    console.log(`最慢响应时间: ${maxResponseTime}ms`);
    
    // Token使用统计
    const totalTokens = successfulTests.reduce((sum, r) => {
      return sum + (r.usage?.total_tokens || 0);
    }, 0);
    const avgTokens = totalTokens / successfulTests.length;
    
    console.log(`\n🔢 Token使用统计:`);
    console.log(`总Token使用: ${totalTokens}`);
    console.log(`平均Token使用: ${avgTokens.toFixed(2)}`);
    
    // 响应时间分级
    console.log(`\n📊 响应时间分级:`);
    const fast = responseTimes.filter(t => t < 1000).length;
    const medium = responseTimes.filter(t => t >= 1000 && t < 3000).length;
    const slow = responseTimes.filter(t => t >= 3000).length;
    
    console.log(`快速 (<1s): ${fast} 次`);
    console.log(`中等 (1-3s): ${medium} 次`);
    console.log(`慢速 (>3s): ${slow} 次`);
  }
  
  if (failedTests.length > 0) {
    console.log(`\n❌ 失败详情:`);
    failedTests.forEach(test => {
      console.log(`- "${test.message}": ${test.error}`);
    });
  }
  
  // 详细结果
  console.log(`\n📋 详细结果:`);
  results.forEach((result, index) => {
    console.log(`${index + 1}. "${result.message}"`);
    if (result.success) {
      console.log(`   响应时间: ${result.responseTime}ms`);
      console.log(`   回复长度: ${result.responseLength} 字符`);
      if (result.usage) {
        console.log(`   Token使用: ${JSON.stringify(result.usage)}`);
      }
    } else {
      console.log(`   错误: ${result.error}`);
    }
  });
  
  return results;
}

// 运行测试
testDoubaoAPI()
  .then(results => {
    console.log('\n🎉 测试完成！');
    
    // 判断API性能
    const successfulTests = results.filter(r => r.success);
    if (successfulTests.length > 0) {
      const avgResponseTime = successfulTests.reduce((sum, r) => sum + r.responseTime, 0) / successfulTests.length;
      
      if (avgResponseTime < 1000) {
        console.log('🚀 API性能: 优秀 (平均响应时间 < 1秒)');
      } else if (avgResponseTime < 3000) {
        console.log('⚡ API性能: 良好 (平均响应时间 1-3秒)');
      } else {
        console.log('🐌 API性能: 需要优化 (平均响应时间 > 3秒)');
      }
    }
  })
  .catch(error => {
    console.error('❌ 测试脚本执行失败:', error);
  });
