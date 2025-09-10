// Peppy API 响应速度测试脚本
const PEPPY_API_URL = "https://u753844-b362-4a815360.nma1.seetacloud.com:8448/chat";

// 测试消息
const testMessages = [
  "你好",
  "我今天心情不太好",
  "能给我一些建议吗？",
  "谢谢你的帮助",
  "再见"
];

// 测试函数
async function testPeppyAPI() {
  console.log('🚀 开始测试Peppy API响应速度...\n');
  
  const results = [];
  
  for (let i = 0; i < testMessages.length; i++) {
    const message = testMessages[i];
    console.log(`📝 测试 ${i + 1}/${testMessages.length}: "${message}"`);
    
    try {
      // 记录开始时间
      const startTime = Date.now();
      
      // 调用API
      const response = await fetch(PEPPY_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: `用户：${message}\nPeppy：`
        })
      });
      
      // 记录响应时间
      const responseTime = Date.now() - startTime;
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.response) {
        throw new Error('响应格式异常');
      }
      
      const result = {
        message: message,
        responseTime: responseTime,
        responseLength: data.response.length,
        responsePreview: data.response.substring(0, 100) + (data.response.length > 100 ? "..." : ""),
        success: true
      };
      
      results.push(result);
      
      console.log(`✅ 成功 - 响应时间: ${responseTime}ms`);
      console.log(`📊 回复长度: ${data.response.length} 字符`);
      console.log(`💬 回复预览: ${result.responsePreview}`);
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
    } else {
      console.log(`   错误: ${result.error}`);
    }
  });
  
  return results;
}

// 运行测试
testPeppyAPI()
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
