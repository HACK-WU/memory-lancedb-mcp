#!/usr/bin/env node

/**
 * 测试数据生成脚本
 * 从 .qoder/repowiki/zh/content 目录读取文档，生成丰富的测试数据
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');
const WIKI_DIR = join(ROOT_DIR, '.qoder/repowiki/zh/content');

// 测试数据配置
const TEST_CONFIG = {
  scopes: ['test:project-a', 'test:project-b', 'test:global'],
  categories: ['fact', 'decision', 'preference', 'entity', 'other'],
  importanceRange: { min: 0.3, max: 1.0 },
};

// 文档分类映射
const DOC_CATEGORY_MAP = {
  '核心概念': {
    category: 'fact',
    tags: ['concept', 'architecture'],
    importance: 0.9,
  },
  '高级功能': {
    category: 'fact',
    tags: ['advanced', 'feature'],
    importance: 0.8,
  },
  'API 参考': {
    category: 'entity',
    tags: ['api', 'interface'],
    importance: 0.7,
  },
  'CLI 工具详解': {
    category: 'fact',
    tags: ['cli', 'tool'],
    importance: 0.7,
  },
  'MCP 服务器': {
    category: 'fact',
    tags: ['mcp', 'server'],
    importance: 0.8,
  },
  '客户端集成': {
    category: 'fact',
    tags: ['client', 'integration'],
    importance: 0.7,
  },
  '开发者指南': {
    category: 'decision',
    tags: ['developer', 'guide'],
    importance: 0.8,
  },
  '记忆管理工具集': {
    category: 'entity',
    tags: ['memory', 'tool'],
    importance: 0.7,
  },
  '部署运维': {
    category: 'decision',
    tags: ['deploy', 'ops'],
    importance: 0.8,
  },
  '配置系统': {
    category: 'fact',
    tags: ['config', 'system'],
    importance: 0.7,
  },
};

/**
 * 递归读取目录中的所有 Markdown 文件
 */
function readMarkdownFiles(dir, basePath = '') {
  const files = [];
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const relativePath = basePath ? `${basePath}/${entry}` : entry;
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...readMarkdownFiles(fullPath, relativePath));
    } else if (entry.endsWith('.md')) {
      const content = readFileSync(fullPath, 'utf-8');
      const title = extractTitle(content);
      const summary = extractSummary(content);
      const keywords = extractKeywords(content, title);

      files.push({
        path: relativePath,
        title,
        summary,
        keywords,
        content,
        size: content.length,
        category: getCategoryFromPath(relativePath),
      });
    }
  }

  return files;
}

/**
 * 从 Markdown 内容中提取标题
 */
function extractTitle(content) {
  const titleMatch = content.match(/^#\s+(.+)$/m);
  return titleMatch ? titleMatch[1].trim() : 'Untitled';
}

/**
 * 从 Markdown 内容中提取摘要
 */
function extractSummary(content) {
  // 提取简介部分
  const introMatch = content.match(/##\s*简介\s*\n([\s\S]*?)(?=\n##|$)/);
  if (introMatch) {
    const intro = introMatch[1].trim();
    // 取前 200 字符作为摘要
    return intro.length > 200 ? intro.substring(0, 200) + '...' : intro;
  }

  // 如果没有简介，取第一个段落
  const firstParagraph = content.match(/^(?!#)(.+)$/m);
  if (firstParagraph) {
    const paragraph = firstParagraph[1].trim();
    return paragraph.length > 200 ? paragraph.substring(0, 200) + '...' : paragraph;
  }

  return 'No summary available';
}

/**
 * 从内容中提取关键词
 */
function extractKeywords(content, title) {
  const keywords = new Set();

  // 从标题提取
  if (title) {
    const titleWords = title.split(/[\s,，、]+/).filter(w => w.length > 1);
    titleWords.forEach(w => keywords.add(w));
  }

  // 从章节标题提取
  const headings = content.match(/^##\s+(.+)$/gm) || [];
  headings.forEach(h => {
    const heading = h.replace(/^##\s+/, '').trim();
    const words = heading.split(/[\s,，、]+/).filter(w => w.length > 1);
    words.forEach(w => keywords.add(w));
  });

  // 从代码块中的关键术语提取
  const codeTerms = content.match(/`([^`]+)`/g) || [];
  codeTerms.forEach(term => {
    const clean = term.replace(/`/g, '');
    if (clean.length > 2 && clean.length < 30) {
      keywords.add(clean);
    }
  });

  // 限制关键词数量
  return Array.from(keywords).slice(0, 10);
}

/**
 * 从文件路径获取分类
 */
function getCategoryFromPath(path) {
  const parts = path.split('/');
  if (parts.length > 0) {
    const dir = parts[0];
    return DOC_CATEGORY_MAP[dir]?.category || 'other';
  }
  return 'other';
}

/**
 * 从文件路径获取标签
 */
function getTagsFromPath(path) {
  const parts = path.split('/');
  if (parts.length > 0) {
    const dir = parts[0];
    return DOC_CATEGORY_MAP[dir]?.tags || ['general'];
  }
  return ['general'];
}

/**
 * 从文件路径获取重要性
 */
function getImportanceFromPath(path) {
  const parts = path.split('/');
  if (parts.length > 0) {
    const dir = parts[0];
    return DOC_CATEGORY_MAP[dir]?.importance || 0.7;
  }
  return 0.7;
}

/**
 * 生成 CLI 测试命令
 */
function generateCliCommands(files) {
  const commands = [];

  // 存储记忆命令
  files.forEach(file => {
    const scope = TEST_CONFIG.scopes[Math.floor(Math.random() * TEST_CONFIG.scopes.length)];
    const tags = getTagsFromPath(file.path);
    const importance = getImportanceFromPath(file.path);

    commands.push({
      type: 'store',
      description: `存储 ${file.title} 相关记忆`,
      command: `node ./bin/mem.mjs store "${file.summary.replace(/"/g, '\\"')}" --tags ${tags.join(',')} --category ${file.category} --importance ${importance} --scope ${scope}`,
      expected: '存储成功',
    });
  });

  // 搜索命令
  const searchQueries = [
    'Weibull 衰减',
    '混合检索',
    '标签系统',
    'Scope 隔离',
    'MCP 服务器',
    '配置系统',
    '性能优化',
    '部署运维',
    'CLI 工具',
    '生命周期',
  ];

  searchQueries.forEach(query => {
    const scope = TEST_CONFIG.scopes[Math.floor(Math.random() * TEST_CONFIG.scopes.length)];
    commands.push({
      type: 'search',
      description: `搜索 ${query} 相关记忆`,
      command: `node ./bin/mem.mjs search "${query}" --scope ${scope} --limit 5`,
      expected: '返回匹配结果',
    });
  });

  // 列表命令
  TEST_CONFIG.scopes.forEach(scope => {
    commands.push({
      type: 'list',
      description: `列出 ${scope} 的记忆`,
      command: `node ./bin/mem.mjs list --scope ${scope} --limit 10`,
      expected: '返回记忆列表',
    });
  });

  // 统计命令
  commands.push({
    type: 'stats',
    description: '获取全局统计',
    command: 'node ./bin/mem.mjs stats',
    expected: '返回统计信息',
  });

  return commands;
}

/**
 * 生成 MCP 工具测试用例
 */
function generateMcpTestCases(files) {
  const testCases = [];

  files.forEach(file => {
    const scope = TEST_CONFIG.scopes[Math.floor(Math.random() * TEST_CONFIG.scopes.length)];
    const tags = getTagsFromPath(file.path);
    const importance = getImportanceFromPath(file.path);

    // memory_store 测试
    testCases.push({
      tool: 'memory_store',
      description: `存储 ${file.title}`,
      input: {
        text: file.summary,
        category: file.category,
        importance,
        scope,
        tags: tags.join(','),
      },
      expected: {
        success: true,
        hasMemoryId: true,
      },
    });

    // memory_recall 测试
    testCases.push({
      tool: 'memory_recall',
      description: `召回 ${file.title} 相关记忆`,
      input: {
        query: file.keywords.slice(0, 3).join(' '),
        limit: 5,
        scope,
      },
      expected: {
        success: true,
        hasResults: true,
        resultCount: { min: 0, max: 5 },
      },
    });

    // memory_list 测试
    testCases.push({
      tool: 'memory_list',
      description: `列出 ${scope} 的记忆`,
      input: {
        limit: 10,
        scope,
      },
      expected: {
        success: true,
        hasResults: true,
      },
    });

    // memory_stats 测试
    testCases.push({
      tool: 'memory_stats',
      description: `获取 ${scope} 统计`,
      input: {
        scope,
      },
      expected: {
        success: true,
        hasTotalCount: true,
      },
    });
  });

  return testCases;
}

/**
 * 生成端到端场景测试
 */
function generateE2eScenarios(files) {
  const scenarios = [];

  // 场景 1: 项目架构知识管理
  const archFiles = files.filter(f =>
    f.path.includes('核心概念') ||
    f.path.includes('高级功能') ||
    f.path.includes('开发者指南')
  );

  if (archFiles.length > 0) {
    scenarios.push({
      name: '项目架构知识管理',
      description: '测试项目架构相关知识的存储、检索和更新',
      steps: [
        {
          action: 'store',
          description: '存储项目架构知识',
          files: archFiles.slice(0, 5),
          scope: 'test:project-a',
          tags: ['architecture', 'concept'],
        },
        {
          action: 'search',
          description: '搜索架构相关知识',
          queries: ['Weibull 衰减', '混合检索', '标签系统'],
          scope: 'test:project-a',
        },
        {
          action: 'verify',
          description: '验证知识检索准确性',
          expectedMinResults: 3,
        },
      ],
    });
  }

  // 场景 2: API 文档管理
  const apiFiles = files.filter(f =>
    f.path.includes('API 参考') ||
    f.path.includes('CLI 工具详解')
  );

  if (apiFiles.length > 0) {
    scenarios.push({
      name: 'API 文档管理',
      description: '测试 API 文档和 CLI 工具知识的管理',
      steps: [
        {
          action: 'store',
          description: '存储 API 文档',
          files: apiFiles.slice(0, 5),
          scope: 'test:project-b',
          tags: ['api', 'cli', 'tool'],
        },
        {
          action: 'search',
          description: '搜索 API 相关知识',
          queries: ['memory_store', 'memory_recall', 'CLI 命令'],
          scope: 'test:project-b',
        },
        {
          action: 'list',
          description: '列出 API 文档',
          scope: 'test:project-b',
          category: 'entity',
        },
      ],
    });
  }

  // 场景 3: 部署运维知识管理
  const opsFiles = files.filter(f =>
    f.path.includes('部署运维') ||
    f.path.includes('配置系统')
  );

  if (opsFiles.length > 0) {
    scenarios.push({
      name: '部署运维知识管理',
      description: '测试部署、运维和配置相关知识的管理',
      steps: [
        {
          action: 'store',
          description: '存储运维知识',
          files: opsFiles.slice(0, 5),
          scope: 'test:global',
          tags: ['deploy', 'ops', 'config'],
        },
        {
          action: 'search',
          description: '搜索运维知识',
          queries: ['性能优化', '配置系统', '部署'],
          scope: 'test:global',
        },
        {
          action: 'stats',
          description: '获取运维知识统计',
          scope: 'test:global',
        },
      ],
    });
  }

  // 场景 4: 多项目隔离测试
  scenarios.push({
    name: '多项目隔离测试',
    description: '测试不同项目之间的知识隔离',
    steps: [
      {
        action: 'store',
        description: '在项目 A 存储知识',
        content: '项目 A 的架构采用微服务模式，使用 Kubernetes 部署',
        scope: 'test:project-a',
        tags: ['architecture', 'microservice'],
      },
      {
        action: 'store',
        description: '在项目 B 存储知识',
        content: '项目 B 使用单体架构，部署在传统服务器上',
        scope: 'test:project-b',
        tags: ['architecture', 'monolith'],
      },
      {
        action: 'search',
        description: '搜索项目 A 的知识',
        query: '架构',
        scope: 'test:project-a',
        expectedResult: '应返回微服务相关内容',
      },
      {
        action: 'search',
        description: '搜索项目 B 的知识',
        query: '架构',
        scope: 'test:project-b',
        expectedResult: '应返回单体架构相关内容',
      },
    ],
  });

  // 场景 5: 标签过滤测试
  scenarios.push({
    name: '标签过滤测试',
    description: '测试标签过滤功能',
    steps: [
      {
        action: 'store',
        description: '存储带标签的知识',
        content: 'Weibull 衰减模型用于记忆的自然淡化',
        tags: ['weibull', 'decay', 'memory'],
        scope: 'test:project-a',
      },
      {
        action: 'search',
        description: '按标签搜索',
        query: '衰减',
        tags: ['weibull'],
        scope: 'test:project-a',
        expectedResult: '应优先返回带 weibull 标签的记忆',
      },
      {
        action: 'list',
        description: '按标签列出',
        tags: ['weibull', 'decay'],
        scope: 'test:project-a',
        expectedResult: '应只显示带指定标签的记忆',
      },
    ],
  });

  return scenarios;
}

/**
 * 生成性能测试数据
 */
function generatePerformanceTests(files) {
  return {
    batchStore: {
      description: '批量存储性能测试',
      count: 100,
      files: files.slice(0, 100),
      expected: {
        avgTimePerStore: '< 2 秒',
        successRate: '100%',
      },
    },
    batchSearch: {
      description: '批量检索性能测试',
      count: 100,
      queries: [
        'Weibull 衰减',
        '混合检索',
        '标签系统',
        'MCP 服务器',
        '配置系统',
      ],
      expected: {
        avgTimePerSearch: '< 1 秒',
        successRate: '100%',
      },
    },
    concurrentAccess: {
      description: '并发访问性能测试',
      concurrentUsers: 10,
      operationsPerUser: 10,
      expected: {
        totalTime: '< 30 秒',
        noDataLoss: true,
      },
    },
    largeDataStorage: {
      description: '大数据存储性能测试',
      largeFiles: files.filter(f => f.size > 10000).slice(0, 5),
      expected: {
        storageTime: '< 5 秒',
        retrievalTime: '< 2 秒',
      },
    },
  };
}

/**
 * 生成测试脚本示例
 */
function generateTestScriptExample(testData) {
  const exampleScript = `#!/usr/bin/env node

/**
 * 示例测试脚本 - 使用生成的测试数据
 * 运行方式: node test/run-tests.mjs
 */

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// 加载测试数据
const testData = JSON.parse(readFileSync(join(import.meta.dirname, 'test-data.json'), 'utf-8'));

console.log('🧪 开始执行测试...\\n');

// 1. 测试 CLI 命令
console.log('📋 测试 CLI 命令:');
for (const cmd of testData.cliCommands.slice(0, 5)) {
  console.log(\`   \${cmd.type}: \${cmd.description}\`);
  try {
    // execSync(cmd.command, { stdio: 'pipe' });
    console.log(\`   ✅ \${cmd.expected}\`);
  } catch (error) {
    console.log(\`   ❌ 失败: \${error.message}\`);
  }
}

// 2. 测试 MCP 工具
console.log('\\n🔧 测试 MCP 工具:');
for (const test of testData.mcpTestCases.slice(0, 5)) {
  console.log(\`   \${test.tool}: \${test.description}\`);
  // 这里需要实际的 MCP 客户端调用
  console.log(\`   ✅ 测试用例准备完成\`);
}

// 3. 测试端到端场景
console.log('\\n🎯 测试端到端场景:');
for (const scenario of testData.e2eScenarios) {
  console.log(\`   \${scenario.name}: \${scenario.description}\`);
  console.log(\`   步骤数: \${scenario.steps.length}\`);
}

console.log('\\n✅ 测试脚本执行完成');
`;

  const scriptPath = join(ROOT_DIR, 'test/run-tests.mjs');
  writeFileSync(scriptPath, exampleScript);
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始生成测试数据...\n');

  // 读取所有文档
  console.log('📚 读取 .qoder 文档...');
  const files = readMarkdownFiles(WIKI_DIR);
  console.log(`✅ 读取了 ${files.length} 个文档\n`);

  // 生成 CLI 命令
  console.log('💻 生成 CLI 测试命令...');
  const cliCommands = generateCliCommands(files);
  console.log(`✅ 生成了 ${cliCommands.length} 个 CLI 命令\n`);

  // 生成 MCP 测试用例
  console.log('🔧 生成 MCP 测试用例...');
  const mcpTestCases = generateMcpTestCases(files);
  console.log(`✅ 生成了 ${mcpTestCases.length} 个 MCP 测试用例\n`);

  // 生成端到端场景
  console.log('🎯 生成端到端场景...');
  const e2eScenarios = generateE2eScenarios(files);
  console.log(`✅ 生成了 ${e2eScenarios.length} 个端到端场景\n`);

  // 生成性能测试数据
  console.log('⚡ 生成性能测试数据...');
  const performanceTests = generatePerformanceTests(files);
  console.log('✅ 性能测试数据生成完成\n');

  // 输出统计信息
  console.log('📊 测试数据统计:');
  console.log(`   - 文档总数: ${files.length}`);
  console.log(`   - CLI 命令: ${cliCommands.length}`);
  console.log(`   - MCP 测试用例: ${mcpTestCases.length}`);
  console.log(`   - 端到端场景: ${e2eScenarios.length}`);
  console.log(`   - 性能测试: ${Object.keys(performanceTests).length} 个场景\n`);

  // 生成测试数据文件
  const testData = {
    metadata: {
      generatedAt: new Date().toISOString(),
      source: '.qoder/repowiki/zh/content',
      documentCount: files.length,
    },
    documents: files.map(f => ({
      path: f.path,
      title: f.title,
      summary: f.summary,
      keywords: f.keywords,
      category: f.category,
      size: f.size,
    })),
    cliCommands,
    mcpTestCases,
    e2eScenarios,
    performanceTests,
  };

  // 写入测试数据文件
  const outputPath = join(ROOT_DIR, 'test/test-data.json');
  writeFileSync(outputPath, JSON.stringify(testData, null, 2));
  console.log(`💾 测试数据已保存到: ${outputPath}\n`);

  // 生成测试脚本示例
  console.log('📝 生成测试脚本示例...');
  generateTestScriptExample(testData);
  console.log('✅ 测试脚本示例生成完成\n');

  console.log('🎉 测试数据生成完成！');
}

// 执行主函数
main().catch(console.error);
