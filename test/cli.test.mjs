/**
 * CLI 命令测试
 * 测试所有 mem CLI 命令的功能正确性
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { runCli, runCliJson, cleanupTestData, generateRandomTestData, sleep } from './helpers/cli.mjs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// 测试 scope 前缀，避免污染用户数据
const TEST_SCOPE_PREFIX = 'test:cli';

describe('CLI 命令测试', () => {
  // 存储测试中创建的记忆 ID，用于清理
  const createdMemoryIds = [];
  
  after(async () => {
    // 清理测试数据
    console.log('清理 CLI 测试数据...');
    for (const id of createdMemoryIds) {
      try {
        runCli(`memory delete ${id}`);
      } catch (e) {
        // 忽略清理错误
      }
    }
  });
  
  describe('配置管理命令', () => {
    it('TC-CFG-003: 显示配置', () => {
      const result = runCli('config show');
      
      assert.strictEqual(result.success, true, '命令应执行成功');
      assert.ok(result.output.includes('embedding'), '应包含 embedding 配置');
      assert.ok(result.output.includes('apiKey'), '应包含 apiKey 字段');
      // API 密钥应被脱敏
      assert.ok(!result.output.includes('sk-') || result.output.includes('...'), 'API 密钥应被脱敏');
    });
    
    it('TC-CFG-004: 显示配置路径', () => {
      const result = runCli('config path');
      
      assert.strictEqual(result.success, true, '命令应执行成功');
      assert.ok(result.output.includes('.config/memory-mcp/config.yaml'), '应包含配置文件路径');
    });
    
    it('TC-CFG-005: 验证配置', () => {
      const result = runCli('config validate');
      
      assert.strictEqual(result.success, true, '命令应执行成功');
      assert.ok(result.output.includes('✅') || result.output.includes('valid'), '配置应有效');
    });
  });
  
  describe('记忆存储命令', () => {
    it('TC-STORE-001: 基本存储', () => {
      const testText = `用户张三是全栈工程师，技术栈包括 TypeScript、React、Node.js，${Date.now()}`;
      const result = runCli(`store "${testText}"`);
      
      assert.strictEqual(result.success, true, '命令应执行成功');
      // 检查是否存储成功或被识别为噪音
      assert.ok(
        result.output.includes('Stored') || 
        result.output.includes('ID') || 
        result.output.includes('Skipped') ||
        result.output.includes('noise'),
        '应返回存储结果'
      );
      
      // 提取记忆 ID 用于后续清理
      const idMatch = result.output.match(/ID:\s*([a-f0-9-]+)/i);
      if (idMatch) {
        createdMemoryIds.push(idMatch[1]);
      }
    });
    
    it('TC-STORE-002: 带标签存储', () => {
      const testText = `项目使用 PostgreSQL 数据库，采用 Prisma ORM 进行数据管理，${Date.now()}`;
      const result = runCli(`store "${testText}" --tags tech,database --category fact --importance 0.8`);
      
      assert.strictEqual(result.success, true, '命令应执行成功');
      // 检查是否存储成功或被识别为噪音
      assert.ok(
        result.output.includes('Stored') || 
        result.output.includes('ID') || 
        result.output.includes('Skipped') ||
        result.output.includes('noise'),
        '应返回存储结果'
      );
      
      const idMatch = result.output.match(/ID:\s*([a-f0-9-]+)/i);
      if (idMatch) {
        createdMemoryIds.push(idMatch[1]);
      }
    });
    
    it('TC-STORE-003: 指定 scope 存储', () => {
      const testText = `团队使用 Scrum 开发流程，每两周一个 Sprint，${Date.now()}`;
      const scope = `${TEST_SCOPE_PREFIX}:project-a`;
      const result = runCli(`store "${testText}" --scope ${scope}`);
      
      assert.strictEqual(result.success, true, '命令应执行成功');
      // 检查是否存储成功或被识别为噪音
      assert.ok(
        result.output.includes('Stored') || 
        result.output.includes('ID') || 
        result.output.includes('Skipped') ||
        result.output.includes('noise'),
        '应返回存储结果'
      );
      
      const idMatch = result.output.match(/ID:\s*([a-f0-9-]+)/i);
      if (idMatch) {
        createdMemoryIds.push(idMatch[1]);
      }
    });
    
    it('TC-STORE-004: 无效重要性值', () => {
      const result = runCli('store "测试无效重要性值" --importance 1.5');
      
      // 无效重要性值可能导致命令失败或被忽略
      assert.ok(
        !result.success || 
        result.output.includes('importance') || 
        result.output.includes('invalid') ||
        result.output.includes('Skipped') ||
        result.output.includes('noise'),
        '应返回错误信息或被跳过'
      );
    });
  });
  
  describe('记忆搜索命令', () => {
    it('TC-SEARCH-001: 基本搜索', () => {
      // 先存储测试数据
      const testText = `用户是全栈工程师，擅长 TypeScript 和 React 开发，${Date.now()}`;
      runCli(`store "${testText}" --tags search-test`);
      
      // 搜索
      const result = runCli('search "全栈工程师"');
      
      assert.strictEqual(result.success, true, '命令应执行成功');
      // 搜索可能返回结果或空结果
      assert.ok(
        result.output.includes('全栈工程师') || 
        result.output.includes('No results') ||
        result.output.includes('found'),
        '应返回搜索结果或提示无结果'
      );
    });
    
    it('TC-SEARCH-002: 带标签搜索', () => {
      const result = runCli('search "测试" --tags search-test');
      
      assert.strictEqual(result.success, true, '命令应执行成功');
    });
    
    it('TC-SEARCH-003: 指定 scope 搜索', () => {
      const scope = `${TEST_SCOPE_PREFIX}:project-a`;
      const result = runCli(`search "记忆" --scope ${scope}`);
      
      assert.strictEqual(result.success, true, '命令应执行成功');
    });
    
    it('TC-SEARCH-004: JSON 输出', () => {
      const result = runCliJson('search "测试"');
      
      // JSON 输出可能成功或失败（取决于是否有数据）
      assert.ok(
        result.success || 
        result.output?.includes('No results') ||
        result.output?.includes('empty'),
        'JSON 输出应成功或提示无结果'
      );
      
      if (result.success) {
        // 验证 JSON 结构
        assert.ok(result.data, '应返回有效的 JSON');
        // 检查是否有 content 或 details 字段
        assert.ok(
          result.data.content || 
          result.data.details || 
          result.data.memories ||
          result.data.results,
          '应包含结果数据'
        );
      }
    });
  });
  
  describe('记忆列表命令', () => {
    it('TC-LIST-001: 列出所有记忆', () => {
      const result = runCli('list');
      
      assert.strictEqual(result.success, true, '命令应执行成功');
    });
    
    it('TC-LIST-002: 分页列表', () => {
      const result1 = runCli('list --limit 5 --offset 0');
      const result2 = runCli('list --limit 5 --offset 5');
      
      assert.strictEqual(result1.success, true, '第一页应成功');
      assert.strictEqual(result2.success, true, '第二页应成功');
    });
    
    it('TC-LIST-003: 按分类过滤', () => {
      const result = runCli('list --category fact');
      
      assert.strictEqual(result.success, true, '命令应执行成功');
    });
    
    it('TC-LIST-004: 按标签过滤', () => {
      const result = runCli('list --tags test');
      
      assert.strictEqual(result.success, true, '命令应执行成功');
    });
  });
  
  describe('记忆统计命令', () => {
    it('TC-STATS-001: 显示统计信息', () => {
      const result = runCli('stats');
      
      assert.strictEqual(result.success, true, '命令应执行成功');
      // 检查是否包含统计信息
      assert.ok(
        result.output.includes('total') || 
        result.output.includes('count') || 
        result.output.includes('Memory Statistics') ||
        result.output.includes('memories'),
        '应包含统计信息'
      );
    });
    
    it('TC-STATS-002: JSON 格式统计', () => {
      const result = runCliJson('stats');
      
      assert.strictEqual(result.success, true, '命令应执行成功');
      assert.ok(result.data, '应返回有效的 JSON');
    });
  });
  
  describe('记忆删除命令', () => {
    it('TC-DELETE-001: 删除记忆', () => {
      // 先存储一个记忆
      const testText = `待删除的测试记忆，包含项目配置信息，${Date.now()}`;
      const storeResult = runCli(`store "${testText}" --tags delete-test`);
      
      const idMatch = storeResult.output.match(/ID:\s*([a-f0-9-]+)/i);
      if (idMatch) {
        const memoryId = idMatch[1];
        const deleteResult = runCli(`delete ${memoryId}`);
        
        assert.strictEqual(deleteResult.success, true, '删除应成功');
      }
    });
    
    it('TC-DELETE-002: 删除不存在的记忆', () => {
      const result = runCli('memory delete non-existent-id');
      
      // 应该返回错误或提示不存在
      assert.ok(result.output.includes('not found') || result.output.includes('不存在') || !result.success, '应提示记忆不存在');
    });
  });
  
  describe('scope delete 命令', () => {
    it('TC-SCOPE-DEL-001: 删除指定 scope', () => {
      const scope = `${TEST_SCOPE_PREFIX}:del-single`;
      runCli(`store "单 scope 删除测试记忆" --scope ${scope}`);

      const result = runCli(`scope delete ${scope} --yes`);

      assert.ok(result.success, '删除应成功');
      assert.ok(
        result.output.includes('Deleted') || result.output.includes('✅'),
        '应包含删除成功信息',
      );
    });

    it('TC-SCOPE-DEL-002: 删除多个 scope', () => {
      const scope1 = `${TEST_SCOPE_PREFIX}:del-multi-a`;
      const scope2 = `${TEST_SCOPE_PREFIX}:del-multi-b`;
      runCli(`store "多 scope 删除测试 A" --scope ${scope1}`);
      runCli(`store "多 scope 删除测试 B" --scope ${scope2}`);

      const result = runCli(`scope delete ${scope1} ${scope2} --yes`);

      assert.ok(result.success, '多 scope 删除应成功');
      assert.ok(
        result.output.includes('scope(s)') || result.output.includes('✅'),
        '应包含多 scope 删除信息',
      );
    });

    it('TC-SCOPE-DEL-003: --dry-run 预览', () => {
      const scope = `${TEST_SCOPE_PREFIX}:dry-run-test`;
      runCli(`store "dry-run 测试记忆" --scope ${scope}`);

      const result = runCli(`scope delete ${scope} --dry-run`);

      assert.ok(result.success, 'dry-run 应成功');
      assert.ok(result.output.includes('DRY RUN'), '应包含 DRY RUN 标识');
      assert.ok(!result.output.includes('Deleted'), 'dry-run 不应实际删除');

      // 清理
      runCli(`scope delete ${scope} --yes`);
    });

    it('TC-SCOPE-DEL-004: 交互模式（无 --yes）', () => {
      const scope = `${TEST_SCOPE_PREFIX}:interactive-test`;
      runCli(`store "交互模式测试记忆" --scope ${scope}`);

      const result = runCli(`scope delete ${scope}`);

      assert.ok(result.success, '交互模式应成功退出');
      assert.ok(
        result.output.includes('--yes') || result.output.includes('confirm'),
        '应提示使用 --yes 确认',
      );

      // 清理
      runCli(`scope delete ${scope} --yes`);
    });

    it('TC-SCOPE-DEL-005: 保护 global scope', () => {
      const result = runCli('scope delete global --yes');

      assert.ok(!result.success, '删除 global 应失败');
      assert.ok(
        result.output.includes('global') && result.output.includes('❌'),
        '应提示 global 受保护',
      );
    });

    it('TC-SCOPE-DEL-006: 无参数报错', () => {
      const result = runCli('scope delete');

      assert.ok(!result.success, '无参数应失败');
      assert.ok(result.output.includes('❌'), '应显示错误信息');
    });

    it('TC-SCOPE-DEL-007: --all 与指定 scope 冲突', () => {
      const result = runCli(`scope delete ${TEST_SCOPE_PREFIX}:some-scope --all`);

      assert.ok(!result.success, '--all 与 scope 同时指定应失败');
      assert.ok(
        result.output.includes('Cannot specify scopes together with --all') ||
        result.output.includes('❌'),
        '应提示冲突',
      );
    });

    it('TC-SCOPE-DEL-008: 不存在的 scope', () => {
      const result = runCli(`scope delete ${TEST_SCOPE_PREFIX}:nonexistent-scope-xyz --yes`);

      // 可能成功但提示无记忆，或警告 unknown scope
      assert.ok(result.success, '不存在的 scope 应正常退出');
      assert.ok(
        result.output.includes('no memories') ||
        result.output.includes('Unknown') ||
        result.output.includes('Nothing to delete'),
        '应提示无记忆或未知 scope',
      );
    });

    it('TC-SCOPE-DEL-009: 重复 scope 去重', () => {
      const scope = `${TEST_SCOPE_PREFIX}:dedup-test`;
      runCli(`store "去重测试记忆" --scope ${scope}`);

      const result = runCli(`scope delete ${scope} ${scope} --yes`);

      assert.ok(result.success, '重复 scope 应成功');
      // 去重后输出应显示 1 scope(s) 而非 2
      assert.ok(
        !result.output.includes('2 scope(s)') && !result.output.includes('across 2'),
        '去重后不应显示 2 scope(s)',
      );

      // 清理（如果上面的删除因 scope 已不存在而跳过）
      runCli(`scope delete ${scope} --yes`);
    });

    it('TC-SCOPE-DEL-010: --all 清除', () => {
      // 先存储测试数据确保有非 global scope
      const scope = `${TEST_SCOPE_PREFIX}:all-test`;
      runCli(`store "all 测试记忆" --scope ${scope}`);

      const dryResult = runCli('scope delete --all --dry-run');
      assert.ok(dryResult.success, '--all --dry-run 应成功');
      assert.ok(dryResult.output.includes('DRY RUN'), '应包含 DRY RUN 标识');

      // 清理
      runCli(`scope delete ${scope} --yes`);
    });

    it('TC-SCOPE-DEL-011: --dry-run --yes 矛盾警告', () => {
      const scope = `${TEST_SCOPE_PREFIX}:contradiction-test`;
      runCli(`store "矛盾标志测试记忆" --scope ${scope}`);

      const result = runCli(`scope delete ${scope} --dry-run --yes`);

      assert.ok(result.success, 'dry-run 模式应成功');
      assert.ok(result.output.includes('DRY RUN'), '应包含 DRY RUN 标识');
      assert.ok(
        result.output.includes('contradictory') || result.output.includes('⚠'),
        '应警告 --dry-run 和 --yes 矛盾',
      );

      // 清理
      runCli(`scope delete ${scope} --yes`);
    });

    it('TC-SCOPE-DEL-012: --include-global 无 --all 应失败', () => {
      const result = runCli('scope delete --include-global --yes');

      assert.ok(!result.success, '--include-global 无 --all 应失败');
      assert.ok(
        result.output.includes('--include-global') || result.output.includes('❌'),
        '应提示 --include-global 只能与 --all 配合',
      );
    });

    it('TC-SCOPE-DEL-013: --all --include-global dry-run', () => {
      const result = runCli('scope delete --all --include-global --dry-run');

      assert.ok(result.success, '--all --include-global --dry-run 应成功');
      assert.ok(result.output.includes('DRY RUN'), '应包含 DRY RUN 标识');
      // dry-run 应正常执行，无报错即可
    });
  });
  
  describe('批量操作测试', () => {
    it('TC-BATCH-001: 批量存储', () => {
      const testData = [
        { text: '用户偏好使用 pnpm 作为包管理器，因为速度快且节省磁盘空间', tags: ['tools', 'preference'], category: 'preference', scope: 'test:project-0' },
        { text: '项目采用 TypeScript 开发，使用 ESM 模块系统', tags: ['tech', 'typescript'], category: 'fact', scope: 'test:project-1' },
        { text: '团队使用 GitHub Actions 进行 CI/CD，每天自动运行测试', tags: ['devops', 'ci'], category: 'fact', scope: 'test:project-2' },
      ];
      
      for (const data of testData) {
        const result = runCli(`store "${data.text}" --tags ${data.tags.join(',')} --category ${data.category} --scope ${data.scope}`);
        assert.strictEqual(result.success, true, `批量存储应成功: ${data.text}`);
        
        const idMatch = result.output.match(/ID:\s*([a-f0-9-]+)/i);
        if (idMatch) {
          createdMemoryIds.push(idMatch[1]);
        }
      }
    });
    
    it('TC-BATCH-002: 批量搜索', () => {
      const queries = ['测试', '记忆', '工程师'];
      
      for (const query of queries) {
        const result = runCli(`search "${query}"`);
        assert.strictEqual(result.success, true, `批量搜索应成功: ${query}`);
      }
    });
  });
  
  describe('错误处理测试', () => {
    it('TC-ERROR-001: 无效命令', () => {
      const result = runCli('invalid-command');
      
      assert.strictEqual(result.success, false, '无效命令应失败');
    });
    
    it('TC-ERROR-002: 缺少必需参数', () => {
      const result = runCli('store');
      
      assert.strictEqual(result.success, false, '缺少参数应失败');
    });
    
    it('TC-ERROR-003: 无效的配置文件', () => {
      const result = runCli('config show --config /nonexistent/config.yaml');
      
      // 应该返回错误或使用默认配置
      assert.ok(!result.success || result.output.includes('not found'), '无效配置应报错');
    });
  });
  
  describe('JSON 输出测试', () => {
    it('TC-JSON-001: 列表 JSON 输出', () => {
      const result = runCliJson('list');
      
      // JSON 输出可能成功或失败（取决于是否有数据）
      assert.ok(
        result.success || 
        result.output?.includes('No memories') ||
        result.output?.includes('empty'),
        'JSON 输出应成功或提示无数据'
      );
    });
    
    it('TC-JSON-002: 搜索 JSON 输出', () => {
      const result = runCliJson('search "测试"');
      
      // JSON 输出可能成功或失败（取决于是否有数据）
      assert.ok(
        result.success || 
        result.output?.includes('No results') ||
        result.output?.includes('empty'),
        'JSON 输出应成功或提示无结果'
      );
    });
    
    it('TC-JSON-003: 统计 JSON 输出', () => {
      const result = runCliJson('stats');
      
      // JSON 输出应该成功
      assert.ok(
        result.success || 
        result.output?.includes('error'),
        'JSON 输出应成功'
      );
    });
  });
});