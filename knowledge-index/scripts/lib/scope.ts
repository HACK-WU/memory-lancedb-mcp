/**
 * Scope 校验与路径构造
 * 
 * scope 参数仅允许字母、数字、连字符、下划线，拒绝路径遍历字符
 */

import path from 'path';
import { KB_BASE_DIR } from './constants.js';

// scope 合法字符正则
const SCOPE_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * 校验 scope 参数合法性
 * @throws Error 如果 scope 不合法
 */
export function validateScope(scope: string): void {
  if (!scope || typeof scope !== 'string') {
    throw new Error('scope 不能为空');
  }
  if (!SCOPE_PATTERN.test(scope)) {
    throw new Error(
      `scope "${scope}" 不合法：仅允许字母、数字、连字符、下划线，禁止路径遍历字符`
    );
  }
}

/**
 * 获取 kb/{scope}/ 目录绝对路径
 */
export function getKbDir(scope: string): string {
  validateScope(scope);
  return path.join(KB_BASE_DIR, scope);
}

/**
 * 获取 group-index.json 绝对路径
 */
export function getGroupIndexPath(scope: string): string {
  return path.join(getKbDir(scope), 'group-index.json');
}

/**
 * 获取 relations-cache.json 绝对路径
 */
export function getRelationsCachePath(scope: string): string {
  return path.join(getKbDir(scope), 'relations-cache.json');
}

/**
 * 获取 scan-index.json 绝对路径
 */
export function getScanIndexPath(scope: string): string {
  return path.join(getKbDir(scope), 'scan-index.json');
}

/**
 * 获取本地 KB 中某个 Group 的 index.json 路径
 * @param scope 项目标识
 * @param groupPath Group 路径，如 "监控/告警中心"
 */
export function getLocalKbDir(scope: string, groupPath: string): string {
  validateScope(scope);
  return path.join(KB_BASE_DIR, scope, groupPath, 'index.json');
}
