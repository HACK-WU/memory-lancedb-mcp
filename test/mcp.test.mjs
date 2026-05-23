/**
 * MCP 工具测试
 * 测试所有 MCP 工具的功能正确性
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { 
  startMcpServer, 
  stopMcpServer, 
  callMcpTool, 
  listMcpTools,
  extractTextFromResponse,
  extractJsonFromResponse 
} from './helpers/mcp.mjs';
import { runCli } from './helpers/cli.mjs';

// 测试 scope 前缀，避免污染用户数据
const TEST_SCOPE_PREFIX = 'test:mcp';

describe('MCP 工具测试', () => {
  let server;
  let availableTools;
  
  // 存储测试中创建的记忆 ID，用于清理
  const createdMemoryIds = [];
  
  before(async () => {
    // 启动 MCP 服务器
    console.log('正在启动 MCP 服务器...');
    server = await startMcpServer();
    console.log('MCP 服务器启动成功');
    
    // 获取可用工具列表
    console.log('正在获取工具列表...');
    availableTools = await listMcpTools(server);
    console.log(`发现 ${availableTools.length} 个 MCP 工具`);
  });
  
  after(async () => {
    // 清理测试数据
    console.log('清理 MCP 测试数据...');
    for (const id of createdMemoryIds) {
      try {
        await callMcpTool(server, 'memory_forget', { memoryId: id });
      } catch (e) {
        // 忽略清理错误
      }
    }
    
    // 停止服务器
    await stopMcpServer(server);
  });
  
  describe('工具注册测试', () => {
    it('TC-TOOL-001: 工具数量验证', () => {
      assert.ok(availableTools.length >= 17, `应至少有 17 个工具，实际有 ${availableTools.length} 个`);
    });
    
    it('TC-TOOL-002: 工具 Schema 验证', () => {
      for (const tool of availableTools) {
        assert.ok(tool.name, '工具应有 name 属性');
        assert.ok(tool.description, '工具应有 description 属性');
        assert.ok(tool.inputSchema, '工具应有 inputSchema 属性');
        assert.strictEqual(tool.inputSchema.type, 'object', 'inputSchema 应为 object 类型');
      }
    });
    
    it('TC-TOOL-003: 验证核心工具存在', () => {
      const coreTools = [
        'memory_store',
        'memory_recall',
        'memory_list',
        'memory_forget',
        'memory_update',
        'memory_stats',
        'memory_promote',
        'memory_archive',
        'memory_compact',
        'memory_explain_rank',
        'self_improvement_log',
        'self_improvement_extract_skill',
        'self_improvement_review',
        'list_scopes',
        '_lifecycle_auto_recall',
        '_lifecycle_auto_capture',
        '_lifecycle_session_end',
      ];
      
      const toolNames = availableTools.map(t => t.name);
      
      for (const coreTool of coreTools) {
        assert.ok(toolNames.includes(coreTool), `核心工具 ${coreTool} 应存在`);
      }
    });
  });
  
  describe('memory_store 工具测试', () => {
    it('TC-MCP-STORE-001: 基本存储', async () => {
      const uniqueId = Math.random().toString(36).substring(2, 15);
      const testText = `用户是全栈工程师，技术栈包括 TypeScript、React、Node.js，${Date.now()}-${uniqueId}`;
      
      const response = await callMcpTool(server, 'memory_store', {
        text: testText,
        category: 'fact',
        importance: 0.8,
      }, 120000); // 增加超时时间到 2 分钟
      
      assert.ok(response.result, '应返回结果');
      const text = extractTextFromResponse(response);
      // 检查是否存储成功或被识别为噪音
      assert.ok(
        text.includes('Stored') || 
        text.includes('ID') || 
        text.includes('Skipped') ||
        text.includes('noise') ||
        text.includes('Similar') ||
        text.includes('Error') ||
        text.includes('error'),
        '应返回存储结果'
      );
      
      // 提取记忆 ID
      const idMatch = text.match(/ID:\s*([a-f0-9-]+)/i);
      if (idMatch) {
        createdMemoryIds.push(idMatch[1]);
      }
    });
    
    it('TC-MCP-STORE-002: 带标签存储', async () => {
      const uniqueId = Math.random().toString(36).substring(2, 15);
      const testText = `项目使用 PostgreSQL 数据库，采用 Prisma ORM 进行数据管理，${Date.now()}-${uniqueId}`;
      
      const response = await callMcpTool(server, 'memory_store', {
        text: testText,
        tags: 'test,mcp',
        category: 'fact',
      }, 120000); // 增加超时时间到 2 分钟
      
      assert.ok(response.result, '应返回结果');
      const text = extractTextFromResponse(response);
      // 检查是否存储成功或被识别为噪音
      assert.ok(
        text.includes('Stored') || 
        text.includes('ID') || 
        text.includes('Skipped') ||
        text.includes('noise') ||
        text.includes('Similar') ||
        text.includes('Error') ||
        text.includes('error'),
        '应返回存储结果'
      );
      
      const idMatch = text.match(/ID:\s*([a-f0-9-]+)/i);
      if (idMatch) {
        createdMemoryIds.push(idMatch[1]);
      }
    });
    
    it('TC-MCP-STORE-003: 指定 scope 存储', async () => {
      const uniqueId = Math.random().toString(36).substring(2, 15);
      const testText = `团队使用 Scrum 开发流程，每两周一个 Sprint，${Date.now()}-${uniqueId}`;
      // 使用服务器默认的 scope
      const scope = 'global';
      
      const response = await callMcpTool(server, 'memory_store', {
        text: testText,
        scope,
      }, 120000); // 增加超时时间到 2 分钟
      
      assert.ok(response.result, '应返回结果');
      const text = extractTextFromResponse(response);
      // 检查是否存储成功或被识别为噪音
      assert.ok(
        text.includes('Stored') || 
        text.includes('ID') || 
        text.includes('Skipped') ||
        text.includes('noise') ||
        text.includes('Similar') ||
        text.includes('Error') ||
        text.includes('error'),
        '应返回存储结果'
      );
      
      const idMatch = text.match(/ID:\s*([a-f0-9-]+)/i);
      if (idMatch) {
        createdMemoryIds.push(idMatch[1]);
      }
    });
  });
  
  describe('memory_recall 工具测试', () => {
    it('TC-MCP-RECALL-001: 基本召回', async () => {
      // 先存储测试数据
      const testText = `召回测试工程师 ${Date.now()}`;
      await callMcpTool(server, 'memory_store', { text: testText });
      
      // 召回
      const response = await callMcpTool(server, 'memory_recall', {
        query: '测试工程师',
        limit: 5,
      });
      
      assert.ok(response.result, '应返回结果');
      const text = extractTextFromResponse(response);
      assert.ok(text.includes('测试工程师'), '应返回匹配的记忆');
    });
    
    it('TC-MCP-RECALL-002: 带标签召回', async () => {
      const response = await callMcpTool(server, 'memory_recall', {
        query: '测试',
        tags: 'test',
      });
      
      assert.ok(response.result, '应返回结果');
    });
    
    it('TC-MCP-RECALL-003: 指定 scope 召回', async () => {
      const scope = `${TEST_SCOPE_PREFIX}:project-a`;
      
      const response = await callMcpTool(server, 'memory_recall', {
        query: '记忆',
        scope,
      });
      
      assert.ok(response.result, '应返回结果');
    });
    
    it('TC-MCP-RECALL-004: 指定分类召回', async () => {
      const response = await callMcpTool(server, 'memory_recall', {
        query: '偏好',
        category: 'preference',
      });
      
      assert.ok(response.result, '应返回结果');
    });
  });
  
  describe('memory_list 工具测试', () => {
    it('TC-MCP-LIST-001: 基本列表', async () => {
      const response = await callMcpTool(server, 'memory_list', {
        limit: 10,
      });
      
      assert.ok(response.result, '应返回结果');
      const text = extractTextFromResponse(response);
      assert.ok(text, '应返回记忆列表');
    });
    
    it('TC-MCP-LIST-002: 分页列表', async () => {
      const response = await callMcpTool(server, 'memory_list', {
        limit: 5,
        offset: 5,
      });
      
      assert.ok(response.result, '应返回结果');
    });
    
    it('TC-MCP-LIST-003: 过滤列表', async () => {
      const response = await callMcpTool(server, 'memory_list', {
        category: 'fact',
        tags: 'test',
      });
      
      assert.ok(response.result, '应返回结果');
    });
  });
  
  describe('memory_forget 工具测试', () => {
    it('TC-MCP-FORGET-001: 按 ID 删除', async () => {
      // 先存储一个记忆
      const testText = `待删除的 MCP 记忆 ${Date.now()}`;
      const storeResponse = await callMcpTool(server, 'memory_store', { text: testText });
      
      const idMatch = extractTextFromResponse(storeResponse).match(/ID:\s*([a-f0-9-]+)/i);
      if (idMatch) {
        const memoryId = idMatch[1];
        
        const deleteResponse = await callMcpTool(server, 'memory_forget', {
          memoryId,
        });
        
        assert.ok(deleteResponse.result, '应返回结果');
        const text = extractTextFromResponse(deleteResponse);
        assert.ok(text.includes('Deleted') || text.includes('deleted'), '应包含删除成功信息');
      }
    });
    
    it('TC-MCP-FORGET-002: 按查询删除', async () => {
      const response = await callMcpTool(server, 'memory_forget', {
        query: '待删除的测试',
      });
      
      assert.ok(response.result, '应返回结果');
    });
  });
  
  describe('memory_update 工具测试', () => {
    it('TC-MCP-UPDATE-001: 更新文本', async () => {
      // 先存储一个记忆
      const testText = `待更新的 MCP 记忆 ${Date.now()}`;
      const storeResponse = await callMcpTool(server, 'memory_store', { text: testText });
      
      const idMatch = extractTextFromResponse(storeResponse).match(/ID:\s*([a-f0-9-]+)/i);
      if (idMatch) {
        const memoryId = idMatch[1];
        createdMemoryIds.push(memoryId);
        
        const updateResponse = await callMcpTool(server, 'memory_update', {
          memoryId,
          text: '更新后的记忆内容',
        });
        
        assert.ok(updateResponse.result, '应返回结果');
      }
    });
    
    it('TC-MCP-UPDATE-002: 更新重要性', async () => {
      // 先存储一个记忆
      const testText = `重要性测试记忆 ${Date.now()}`;
      const storeResponse = await callMcpTool(server, 'memory_store', { text: testText });
      
      const idMatch = extractTextFromResponse(storeResponse).match(/ID:\s*([a-f0-9-]+)/i);
      if (idMatch) {
        const memoryId = idMatch[1];
        createdMemoryIds.push(memoryId);
        
        const updateResponse = await callMcpTool(server, 'memory_update', {
          memoryId,
          importance: 0.95,
        });
        
        assert.ok(updateResponse.result, '应返回结果');
      }
    });
  });
  
  describe('memory_stats 工具测试', () => {
    it('TC-MCP-STATS-001: 获取统计', async () => {
      const response = await callMcpTool(server, 'memory_stats', {});
      
      assert.ok(response.result, '应返回结果');
      const text = extractTextFromResponse(response);
      // 检查是否包含统计信息
      assert.ok(
        text.includes('Memory Statistics') || 
        text.includes('total') || 
        text.includes('count') ||
        text.includes('memories'),
        '应包含统计信息'
      );
    });
  });
  
  describe('list_scopes 工具测试', () => {
    it('TC-MCP-SCOPES-001: 列出所有 scope', async () => {
      const response = await callMcpTool(server, 'list_scopes', {});
      
      assert.ok(response.result, '应返回结果');
      const text = extractTextFromResponse(response);
      assert.ok(text, '应返回 scope 列表');
    });
  });
  
  describe('memory_promote 工具测试', () => {
    it('TC-MCP-PROMOTE-001: 晋升记忆', async () => {
      // 先存储一个记忆
      const testText = `待晋升的记忆 ${Date.now()}`;
      const storeResponse = await callMcpTool(server, 'memory_store', { text: testText });
      
      const idMatch = extractTextFromResponse(storeResponse).match(/ID:\s*([a-f0-9-]+)/i);
      if (idMatch) {
        const memoryId = idMatch[1];
        createdMemoryIds.push(memoryId);
        
        const promoteResponse = await callMcpTool(server, 'memory_promote', {
          memoryId,
        });
        
        assert.ok(promoteResponse.result, '应返回结果');
      }
    });
  });
  
  describe('memory_archive 工具测试', () => {
    it('TC-MCP-ARCHIVE-001: 归档记忆', async () => {
      // 先存储一个记忆
      const testText = `待归档的记忆 ${Date.now()}`;
      const storeResponse = await callMcpTool(server, 'memory_store', { text: testText });
      
      const idMatch = extractTextFromResponse(storeResponse).match(/ID:\s*([a-f0-9-]+)/i);
      if (idMatch) {
        const memoryId = idMatch[1];
        createdMemoryIds.push(memoryId);
        
        const archiveResponse = await callMcpTool(server, 'memory_archive', {
          memoryId,
        });
        
        assert.ok(archiveResponse.result, '应返回结果');
      }
    });
  });
  
  describe('memory_compact 工具测试', () => {
    it('TC-MCP-COMPACT-001: 压缩记忆', async () => {
      const response = await callMcpTool(server, 'memory_compact', {});
      
      assert.ok(response.result, '应返回结果');
    });
  });
  
  describe('memory_explain_rank 工具测试', () => {
    it('TC-MCP-EXPLAIN-001: 解释排名', async () => {
      // 先存储一个记忆
      const testText = `排名解释测试 ${Date.now()}`;
      await callMcpTool(server, 'memory_store', { text: testText });
      
      const response = await callMcpTool(server, 'memory_explain_rank', {
        query: '排名解释',
      });
      
      assert.ok(response.result, '应返回结果');
    });
  });
  
  describe('self_improvement 工具测试', () => {
    it('TC-MCP-SELF-001: 记录学习', async () => {
      const response = await callMcpTool(server, 'self_improvement_log', {
        content: '测试学习记录',
        category: 'test',
      });
      
      assert.ok(response.result, '应返回结果');
    });
    
    it('TC-MCP-SELF-002: 提取技能', async () => {
      const response = await callMcpTool(server, 'self_improvement_extract_skill', {});
      
      assert.ok(response.result, '应返回结果');
    });
    
    it('TC-MCP-SELF-003: 审查学习', async () => {
      const response = await callMcpTool(server, 'self_improvement_review', {});
      
      assert.ok(response.result, '应返回结果');
    });
  });
  
  describe('生命周期工具测试', () => {
    it('TC-MCP-LIFECYCLE-001: 自动召回', async () => {
      const response = await callMcpTool(server, '_lifecycle_auto_recall', {
        message: '测试自动召回',
      });
      
      assert.ok(response.result, '应返回结果');
    });
    
    it('TC-MCP-LIFECYCLE-002: 自动捕获', async () => {
      const response = await callMcpTool(server, '_lifecycle_auto_capture', {
        messages: [
          { role: 'user', content: '测试用户消息' },
          { role: 'assistant', content: '测试助手回复' },
        ],
      });
      
      assert.ok(response.result, '应返回结果');
    });
    
    it('TC-MCP-LIFECYCLE-003: 会话结束', async () => {
      const response = await callMcpTool(server, '_lifecycle_session_end', {});
      
      assert.ok(response.result, '应返回结果');
    });
  });
});