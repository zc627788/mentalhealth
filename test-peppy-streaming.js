// Peppy API 流式响应测试脚本
const PEPPY_API_URL = "https://u753844-b362-4a815360.nma1.seetacloud.com:8448/chat";

async function testPeppyStreaming() {
  console.log('🚀 开始测试Peppy API流式响应性能...\n');
  
  const testMessage = "你好，我是Peppy助手！我是一个活泼开朗的AI伙伴，专门为你提供积极正面的心理支持！";
  
  try {
    console.log(`📝 测试消息: "${testMessage}"`);
    console.log('⏱️  开始计时...\n');
    
    // 记录开始时间
    const startTime = Date.now();
    
    // 调用API
    const response = await fetch(PEPPY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: `用户：${testMessage}\nPeppy：`
      })
    });
    
    // 记录API响应时间
    const apiResponseTime = Date.now() - startTime;
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.response) {
      throw new Error('响应格式异常');
    }
    
    console.log(`✅ API响应时间: ${apiResponseTime}ms`);
    console.log(`📊 回复长度: ${data.response.length} 字符`);
    console.log(`💬 完整回复: ${data.response}\n`);
    
    // 模拟流式输出测试
    console.log('🔄 开始模拟流式输出测试...');
    
    const words = data.response.split(/(\s+|[，。！？；：])/);
    let totalStreamTime = 0;
    let chunkCount = 0;
    
    console.log(`📝 分割成 ${words.filter(w => w.trim()).length} 个词块\n`);
    
    for (const word of words) {
      if (word.trim()) {
        chunkCount++;
        const chunkStartTime = Date.now();
        
        // 模拟发送chunk
        const chunk = { content: word };
        const chunkData = `data: ${JSON.stringify(chunk)}\n\n`;
        
        // 模拟延迟
        const delay = /[，。！？；：]/.test(word) ? 100 : 30;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        const chunkTime = Date.now() - chunkStartTime;
        totalStreamTime += chunkTime;
        
        console.log(`Chunk ${chunkCount}: "${word}" (${chunkTime}ms)`);
      }
    }
    
    // 发送结束标记
    console.log(`Chunk ${chunkCount + 1}: "[DONE]" (0ms)`);
    
    const avgChunkTime = totalStreamTime / chunkCount;
    const totalStreamDuration = chunkCount * 30; // 基于30ms延迟计算
    
    console.log('\n📈 流式输出性能统计:');
    console.log('======================');
    console.log(`总词块数: ${chunkCount}`);
    console.log(`平均词块处理时间: ${avgChunkTime.toFixed(2)}ms`);
    console.log(`总流式输出时间: ${totalStreamDuration}ms`);
    console.log(`API响应时间: ${apiResponseTime}ms`);
    console.log(`总体验时间: ${apiResponseTime + totalStreamDuration}ms`);
    
    // 性能评估
    console.log('\n🎯 性能评估:');
    if (apiResponseTime < 1000) {
      console.log('🚀 API响应: 优秀 (< 1秒)');
    } else if (apiResponseTime < 3000) {
      console.log('⚡ API响应: 良好 (1-3秒)');
    } else {
      console.log('🐌 API响应: 需要优化 (> 3秒)');
    }
    
    if (totalStreamDuration < 2000) {
      console.log('🚀 流式输出: 流畅 (< 2秒)');
    } else if (totalStreamDuration < 5000) {
      console.log('⚡ 流式输出: 可接受 (2-5秒)');
    } else {
      console.log('🐌 流式输出: 较慢 (> 5秒)');
    }
    
    // 用户体验评分
    const totalExperienceTime = apiResponseTime + totalStreamDuration;
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
    if (totalStreamDuration > 5000) {
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
testPeppyStreaming()
  .then(() => {
    console.log('\n🎉 测试完成！');
  })
  .catch(error => {
    console.error('❌ 测试脚本执行失败:', error);
  });
