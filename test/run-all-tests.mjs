#!/usr/bin/env node

/**
 * 测试运行器
 * 运行所有测试模块并生成报告
 */

import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';

// 测试模块列表
const TEST_MODULES = [
  { name: 'CLI 命令测试', file: 'cli.test.mjs' },
  { name: 'MCP 工具测试', file: 'mcp.test.mjs' },
  // 可以添加更多测试模块
  // { name: '多项目隔离测试', file: 'isolation.test.mjs' },
  // { name: '标签系统测试', file: 'tags.test.mjs' },
  // { name: '生命周期测试', file: 'lifecycle.test.mjs' },
  // { name: '传输模式测试', file: 'transport.test.mjs' },
  // { name: '错误处理测试', file: 'error.test.mjs' },
  // { name: '性能测试', file: 'performance.test.mjs' },
  // { name: '端到端测试', file: 'e2e.test.mjs' },
];

// 测试报告目录
const REPORT_DIR = join(import.meta.dirname, '../test-reports');

/**
 * 运行单个测试模块
 * @param {string} testFile - 测试文件名
 * @returns {{ success: boolean, output: string, duration: number }}
 */
function runTestModule(testFile) {
  const testPath = join(import.meta.dirname, testFile);
  const startTime = Date.now();
  
  try {
    const output = execSync(`node --test ${testPath}`, {
      encoding: 'utf-8',
      timeout: 300000, // 5 分钟超时
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    
    const duration = Date.now() - startTime;
    
    return {
      success: true,
      output: output.trim(),
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    
    return {
      success: false,
      output: error.stdout || error.stderr || error.message,
      duration,
    };
  }
}

/**
 * 生成测试报告
 * @param {Array} results - 测试结果数组
 * @returns {string} 报告内容
 */
function generateReport(results) {
  const totalTests = results.length;
  const passedTests = results.filter(r => r.success).length;
  const failedTests = totalTests - passedTests;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  
  let report = `# memory-lancedb-mcp 测试报告

## 测试概览

- **测试时间**: ${new Date().toISOString()}
- **测试模块总数**: ${totalTests}
- **通过模块数**: ${passedTests}
- **失败模块数**: ${failedTests}
- **总耗时**: ${(totalDuration / 1000).toFixed(2)} 秒

## 测试结果详情

`;

  for (const result of results) {
    const status = result.success ? '✅ 通过' : '❌ 失败';
    const duration = (result.duration / 1000).toFixed(2);
    
    report += `### ${result.name}

- **状态**: ${status}
- **耗时**: ${duration} 秒

`;

    if (!result.success) {
      report += `**错误输出**:
\`\`\`
${result.output.slice(0, 1000)}${result.output.length > 1000 ? '\n... (截断)' : ''}
\`\`\`

`;
    }
  }

  report += `## 测试环境

- **操作系统**: ${process.platform}
- **Node.js 版本**: ${process.version}
- **配置文件**: ${join(homedir(), '.config/memory-mcp/config.yaml')}

## 建议

`;

  if (failedTests > 0) {
    report += `- 检查失败的测试模块，查看详细错误信息
- 确保所有依赖已安装
- 验证配置文件是否正确
- 检查 API 密钥是否有效
`;
  } else {
    report += `- 所有测试通过！可以继续进行集成测试或性能测试
- 建议定期运行测试以确保代码质量
`;
  }

  return report;
}

/**
 * 主函数
 */
async function main() {
  console.log('开始运行 memory-lancedb-mcp 测试...\n');
  
  const results = [];
  
  for (const module of TEST_MODULES) {
    console.log(`运行测试模块: ${module.name}...`);
    
    const result = runTestModule(module.file);
    results.push({
      ...module,
      ...result,
    });
    
    if (result.success) {
      console.log(`  ✅ 通过 (${(result.duration / 1000).toFixed(2)}s)\n`);
    } else {
      console.log(`  ❌ 失败 (${(result.duration / 1000).toFixed(2)}s)\n`);
    }
  }
  
  // 生成报告
  const report = generateReport(results);
  
  // 确保报告目录存在
  if (!existsSync(REPORT_DIR)) {
    mkdirSync(REPORT_DIR, { recursive: true });
  }
  
  // 保存报告
  const reportPath = join(REPORT_DIR, `test-report-${new Date().toISOString().replace(/[:.]/g, '-')}.md`);
  writeFileSync(reportPath, report, 'utf-8');
  
  console.log('测试完成！');
  console.log(`报告已保存到: ${reportPath}`);
  
  // 输出摘要
  const totalTests = results.length;
  const passedTests = results.filter(r => r.success).length;
  const failedTests = totalTests - passedTests;
  
  console.log(`\n测试摘要:`);
  console.log(`  总模块数: ${totalTests}`);
  console.log(`  通过: ${passedTests}`);
  console.log(`  失败: ${failedTests}`);
  
  // 如果有失败的测试，退出码为 1
  if (failedTests > 0) {
    process.exit(1);
  }
}

// 运行主函数
main().catch(error => {
  console.error('测试运行器错误:', error);
  process.exit(1);
});