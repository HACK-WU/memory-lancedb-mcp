/**
 * MCP 测试辅助函数
 * 用于测试 MCP 工具和服务器功能
 */

import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';

// CLI 命令路径
const CLI_PATH = join(import.meta.dirname, '../../bin/mem.mjs');

// 真实配置文件路径
const REAL_CONFIG_PATH = join(homedir(), '.config/memory-mcp/config.yaml');

/**
 * 启动 MCP 服务器（stdio 模式）
 * @param {object} options - 选项
 * @param {string} options.config - 配置文件路径
 * @param {number} options.timeout - 超时时间（毫秒）
 * @returns {Promise<{ process: ChildProcess, sendMessage: Function, waitForResponse: Function }>}
 */
export function startMcpServer(options = {}) {
  const config = options.config || REAL_CONFIG_PATH;
  const timeout = options.timeout || 30000;
  
  // 使用环境变量指定配置文件路径
  const env = {
    ...process.env,
    MEM_CONFIG_PATH: config,
  };
  
  return new Promise((resolve, reject) => {
    const serverProcess = spawn('node', [CLI_PATH, 'serve'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
    });
    
    let output = '';
    let errorOutput = '';
    
    serverProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    serverProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    // 等待服务器启动
    const startupTimeout = setTimeout(() => {
      reject(new Error(`MCP 服务器启动超时: ${errorOutput || output}`));
      serverProcess.kill();
    }, timeout);
    
    serverProcess.on('error', (error) => {
      clearTimeout(startupTimeout);
      reject(error);
    });
    
    // 发送初始化请求
    const initRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0',
        },
      },
    };
    
    serverProcess.stdin.write(JSON.stringify(initRequest) + '\n');
    
    // 等待初始化响应
    let responseBuffer = '';
    const responseTimeout = setTimeout(() => {
      clearTimeout(startupTimeout);
      reject(new Error('等待初始化响应超时'));
      serverProcess.kill();
    }, 15000);
    
    serverProcess.stdout.on('data', (data) => {
      responseBuffer += data.toString();
      
      // 检查是否有完整的 JSON 响应
      try {
        const lines = responseBuffer.split('\n');
        for (const line of lines) {
          if (line.trim()) {
            // 跳过日志信息
            if (line.startsWith('[mem:info]') || line.startsWith('[mem:')) {
              continue;
            }
            
            try {
              const response = JSON.parse(line);
              if (response.id === 1 && response.result) {
                clearTimeout(startupTimeout);
                clearTimeout(responseTimeout);
                
                resolve({
                  process: serverProcess,
                  sendMessage: (method, params = {}) => {
                    const requestId = Date.now();
                    const request = {
                      jsonrpc: '2.0',
                      id: requestId,
                      method,
                      params,
                    };
                    const message = JSON.stringify(request) + '\n';
                    serverProcess.stdin.write(message);
                    return requestId;
                  },
                  waitForResponse: (requestId, timeoutMs = 30000) => {
                    return new Promise((resolveResponse, rejectResponse) => {
                      const waitTimeout = setTimeout(() => {
                        rejectResponse(new Error(`等待响应超时，请求 ID: ${requestId}`));
                      }, timeoutMs);
                      
                      let responseBuffer = '';
                      const onData = (data) => {
                        responseBuffer += data.toString();
                        
                        const lines = responseBuffer.split('\n');
                        for (const line of lines) {
                          if (line.trim()) {
                            // 跳过日志信息
                            if (line.startsWith('[mem:info]') || line.startsWith('[mem:')) {
                              continue;
                            }
                            
                            try {
                              const response = JSON.parse(line);
                              if (response.id === requestId) {
                                clearTimeout(waitTimeout);
                                serverProcess.stdout.removeListener('data', onData);
                                resolveResponse(response);
                              }
                            } catch (e) {
                              // 忽略解析错误
                            }
                          }
                        }
                      };
                      
                      serverProcess.stdout.on('data', onData);
                    });
                  },
                });
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      } catch (e) {
        // 继续等待
      }
    });
  });
}

/**
 * 调用 MCP 工具
 * @param {object} server - MCP 服务器对象
 * @param {string} toolName - 工具名称
 * @param {object} params - 工具参数
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise<object>} 工具执行结果
 */
export async function callMcpTool(server, toolName, params = {}, timeout = 60000) {
  const requestId = server.sendMessage('tools/call', {
    name: toolName,
    arguments: params,
  });
  
  return server.waitForResponse(requestId, timeout);
}

/**
 * 列出可用的 MCP 工具
 * @param {object} server - MCP 服务器对象
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise<Array>} 工具列表
 */
export async function listMcpTools(server, timeout = 60000) {
  const requestId = server.sendMessage('tools/list', {});
  
  const response = await server.waitForResponse(requestId, timeout);
  return response.result?.tools || [];
}

/**
 * 停止 MCP 服务器
 * @param {object} server - MCP 服务器对象
 */
export function stopMcpServer(server) {
  if (server && server.process) {
    server.process.kill('SIGTERM');
    
    // 等待进程退出
    return new Promise((resolve) => {
      server.process.on('exit', () => {
        resolve();
      });
      
      // 超时强制退出
      setTimeout(() => {
        server.process.kill('SIGKILL');
        resolve();
      }, 5000);
    });
  }
}

/**
 * 执行 MCP 工具调用并返回结果（单次调用模式）
 * @param {string} toolName - 工具名称
 * @param {object} params - 工具参数
 * @param {object} options - 选项
 * @returns {Promise<object>} 执行结果
 */
export async function executeMcpTool(toolName, params = {}, options = {}) {
  const server = await startMcpServer(options);
  
  try {
    const result = await callMcpTool(server, toolName, params, options.timeout);
    return {
      success: true,
      result: result.result,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      result: null,
      error: error.message,
    };
  } finally {
    await stopMcpServer(server);
  }
}

/**
 * 解析 MCP 响应中的文本内容
 * @param {object} response - MCP 响应
 * @returns {string} 文本内容
 */
export function extractTextFromResponse(response) {
  if (!response || !response.result || !response.result.content) {
    return '';
  }
  
  const content = response.result.content;
  if (Array.isArray(content)) {
    return content
      .filter(item => item.type === 'text')
      .map(item => item.text)
      .join('\n');
  }
  
  return '';
}

/**
 * 解析 MCP 响应中的 JSON 内容
 * @param {object} response - MCP 响应
 * @returns {object|null} JSON 对象
 */
export function extractJsonFromResponse(response) {
  const text = extractTextFromResponse(response);
  
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}