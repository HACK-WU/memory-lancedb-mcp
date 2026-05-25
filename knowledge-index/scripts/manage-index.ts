#!/usr/bin/env node
/**
 * manage-index.ts - Group 树索引管理 CLI
 * 
 * 用法:
 *   npx jiti knowledge-index/scripts/manage-index.ts --scope <scope> --action create-root --root-name <name>
 *   npx jiti knowledge-index/scripts/manage-index.ts --scope <scope> --action create --parent <path> --name <name>
 *   npx jiti knowledge-index/scripts/manage-index.ts --scope <scope> --action delete --parent <path> --name <name> [--force]
 */

import { Command } from 'commander';
import { readJson, writeJson, ensureScopeDir } from './lib/store.js';
import { getGroupIndexPath, validateScope } from './lib/scope.js';
import { DEFAULT_ROOT_NAME } from './lib/constants.js';

// ─── 类型定义 ───

interface GroupIndex {
  version: number;
  scope: string;
  roots: Record<string, Record<string, unknown>>;
  updatedAt: string | null;
}

// ─── 辅助函数 ───

/**
 * 在树中按路径查找节点
 * @param roots 根节点对象
 * @param parentPath 父节点路径（如 "监控/告警中心"）
 * @returns [父节点对象, 路径段数组] 或 null
 */
function findParentNode(
  roots: Record<string, Record<string, unknown>>,
  parentPath: string
): [Record<string, unknown>, string[]] | null {
  const segments = parentPath.split('/').filter(Boolean);
  if (segments.length === 0) return null;

  // 第一段是根节点名
  const rootName = segments[0];
  let current: Record<string, unknown> | undefined = roots[rootName];
  if (current === undefined) return null;

  // 遍历后续段
  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];
    if (typeof current[seg] !== 'object' || current[seg] === null) {
      return null;
    }
    current = current[seg] as Record<string, unknown>;
  }

  return [current, segments];
}

/**
 * 检查节点是否为空（无子节点）
 */
function isEmptyNode(node: Record<string, unknown>): boolean {
  return Object.keys(node).length === 0;
}

/**
 * 输出 JSON 结果并退出
 */
function output(result: Record<string, unknown>): void {
  console.log(JSON.stringify(result, null, 2));
}

// ─── CLI 定义 ───

const program = new Command();

program
  .name('manage-index')
  .description('Group 树索引管理')
  .requiredOption('--scope <scope>', '项目隔离标识')
  .option('--action <action>', '操作：create | delete | create-root', 'create')
  .option('--parent <parent>', '父节点路径（create/delete 时使用）')
  .option('--name <name>', '节点名称（create 时使用）')
  .option('--root-name <rootName>', '根节点名称（create-root 时使用）')
  .option('--force', '强制删除非空节点', false)
  .action(async (opts) => {
    try {
      const { scope, action, parent, name, rootName, force } = opts;

      // 校验 scope
      validateScope(scope);

      // 确保 scope 目录存在
      ensureScopeDir(scope);

      const indexPath = getGroupIndexPath(scope);
      const data = readJson<GroupIndex>(indexPath);

      if (!data) {
        output({ ok: false, error: `group-index.json 不存在：${indexPath}` });
        process.exit(1);
      }

      switch (action) {
        // ─── 创建根节点 ───
        case 'create-root': {
          if (!rootName) {
            output({ ok: false, error: 'create-root 需要 --root-name 参数' });
            process.exit(1);
          }
          if (data.roots[rootName]) {
            output({ ok: false, error: `根节点 "${rootName}" 已存在` });
            process.exit(1);
          }
          data.roots[rootName] = {};
          writeJson(indexPath, data);
          output({ ok: true, path: rootName });
          break;
        }

        // ─── 创建子节点 ───
        case 'create': {
          if (!parent) {
            output({ ok: false, error: 'create 需要 --parent 参数' });
            process.exit(1);
          }
          if (!name) {
            output({ ok: false, error: 'create 需要 --name 参数' });
            process.exit(1);
          }

          const result = findParentNode(data.roots, parent);
          if (!result) {
            output({ ok: false, error: `父节点路径不存在：${parent}` });
            process.exit(1);
          }

          const [parentNode] = result;
          if (parentNode[name] !== undefined) {
            output({ ok: false, error: `节点 "${name}" 已存在于 "${parent}" 下` });
            process.exit(1);
          }

          parentNode[name] = {};
          writeJson(indexPath, data);
          output({ ok: true, path: `${parent}/${name}` });
          break;
        }

        // ─── 删除节点 ───
        case 'delete': {
          if (!parent) {
            output({ ok: false, error: 'delete 需要 --parent 参数' });
            process.exit(1);
          }
          if (!name) {
            output({ ok: false, error: 'delete 需要 --name 参数' });
            process.exit(1);
          }

          // 默认根节点不可删除
          if (name === DEFAULT_ROOT_NAME && parent.split('/')[0] === name) {
            output({ ok: false, error: `默认根节点 "${DEFAULT_ROOT_NAME}" 不可删除` });
            process.exit(1);
          }

          const result = findParentNode(data.roots, parent);
          if (!result) {
            output({ ok: false, error: `父节点路径不存在：${parent}` });
            process.exit(1);
          }

          const [parentNode] = result;
          if (parentNode[name] === undefined) {
            output({ ok: false, error: `节点 "${name}" 不存在于 "${parent}" 下` });
            process.exit(1);
          }

          const targetNode = parentNode[name] as Record<string, unknown>;

          // 非空节点需要 --force
          if (!isEmptyNode(targetNode) && !force) {
            output({
              ok: false,
              error: `节点 "${name}" 非空，包含子节点。使用 --force 强制删除`,
              children: Object.keys(targetNode),
            });
            process.exit(1);
          }

          delete parentNode[name];
          writeJson(indexPath, data);
          output({ ok: true, path: `${parent}/${name}` });
          break;
        }

        default:
          output({ ok: false, error: `未知操作：${action}` });
          process.exit(1);
      }
    } catch (err) {
      output({ ok: false, error: (err as Error).message });
      process.exit(1);
    }
  });

program.parse();
