/**
 * CLI 测试辅助函数
 * 用于执行 CLI 命令并验证输出
 * 使用用户真实的配置文件
 */

import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';

// CLI 命令路径
const CLI_PATH = join(import.meta.dirname, '../../bin/mem.mjs');

// 真实配置文件路径
const REAL_CONFIG_PATH = join(homedir(), '.config/memory-mcp/config.yaml');

/**
 * 获取真实的配置文件路径
 * @returns {string} 配置文件路径
 */
export function getConfigPath() {
  return REAL_CONFIG_PATH;
}

/**
 * 执行 CLI 命令
 * @param {string} command - CLI 命令（不含 mem 前缀）
 * @param {object} options - 选项
 * @param {string} options.config - 配置文件路径（默认使用真实配置）
 * @param {number} options.timeout - 超时时间（毫秒）
 * @param {string} options.cwd - 工作目录
 * @returns {{ success: boolean, output: string, exitCode: number }}
 */
export function runCli(command, options = {}) {
  const config = options.config || REAL_CONFIG_PATH;
  const timeout = options.timeout || 30000;
  const cwd = options.cwd || join(import.meta.dirname, '../..');
  
  // 使用环境变量指定配置文件路径
  const env = {
    ...process.env,
    MEM_CONFIG_PATH: config,
  };
  
  const fullCommand = `node ${CLI_PATH} ${command}`;
  
  try {
    const output = execSync(fullCommand, {
      encoding: 'utf-8',
      timeout,
      cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    
    return {
      success: true,
      output: output.trim(),
      exitCode: 0,
    };
  } catch (error) {
    return {
      success: false,
      output: error.stdout || error.stderr || error.message,
      exitCode: error.status || 1,
    };
  }
}

/**
 * 执行 CLI 命令并解析 JSON 输出
 * @param {string} command - CLI 命令
 * @param {object} options - 选项
 * @returns {{ success: boolean, data: any, exitCode: number }}
 */
export function runCliJson(command, options = {}) {
  const result = runCli(`${command} --json`, options);
  
  if (!result.success) {
    return { success: false, data: null, exitCode: result.exitCode };
  }
  
  try {
    // 从输出中提取 JSON 部分（跳过日志信息）
    const output = result.output;
    let jsonStart = output.indexOf('{');
    let jsonEnd = output.lastIndexOf('}');
    
    if (jsonStart === -1 || jsonEnd === -1) {
      return { success: false, data: null, exitCode: 1 };
    }
    
    const jsonStr = output.substring(jsonStart, jsonEnd + 1);
    const data = JSON.parse(jsonStr);
    return { success: true, data, exitCode: 0 };
  } catch (error) {
    return { success: false, data: null, exitCode: 1 };
  }
}

/**
 * 清理测试数据
 * 注意：使用真实配置时，需要谨慎操作，避免误删用户数据
 * @param {object} options - 选项
 * @param {string} options.scope - 要清理的 scope（可选）
 * @param {boolean} options.dryRun - 是否只预览不执行
 * @returns {boolean} 是否成功
 */
export function cleanupTestData(options = {}) {
  if (options.dryRun) {
    console.log('[DRY RUN] 将清理 scope:', options.scope || 'all');
    return true;
  }
  
  // 使用 CLI 命令清理，而不是直接删除文件
  const scopeArg = options.scope ? `--scope ${options.scope}` : '';
  const result = runCli(`memory cleanup ${scopeArg}`, { timeout: 10000 });
  
  if (result.success) {
    console.log('清理完成:', result.output);
    return true;
  } else {
    console.error('清理失败:', result.output);
    return false;
  }
}

/**
 * 生成随机测试数据
 * @param {number} count - 数据数量
 * @returns {Array} 测试数据数组
 */
export function generateRandomTestData(count = 10) {
  const data = [];
  
  for (let i = 0; i < count; i++) {
    data.push({
      text: `测试记忆 ${i}: ${Math.random().toString(36).substring(2, 15)}`,
      tags: [`tag${i}`, 'test'],
      category: i % 2 === 0 ? 'fact' : 'preference',
      importance: 0.1 + Math.random() * 0.9,
      scope: `test:project-${i % 3}`,
    });
  }
  
  return data;
}

/**
 * 等待一段时间
 * @param {number} ms - 毫秒数
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}