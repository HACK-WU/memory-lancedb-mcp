#!/usr/bin/env node
/**
 * import-kb.ts - 外部知识库导入
 *
 * 约定模式：目录 → Group，文件名 → Relation，文件内容 → 模块信息
 * 配置模式：按 mapping 文件显式指定 Group / Relation / code_refs
 */

import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { ensureScopeDir, readJson, writeJson } from './lib/store.js';
import {
  getGroupIndexPath,
  getRelationsCachePath,
  getLocalKbDir,
  validateScope,
} from './lib/scope.js';
import { DEFAULT_PARTITION_CONFIG, type PartitionConfig } from './lib/constants.js';
import type { Relation } from './lib/scoring.js';

const MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024;

interface GroupIndex {
  version: number;
  scope: string;
  roots: Record<string, Record<string, unknown>>;
  updatedAt: string | null;
}

interface GroupData {
  hot_relations: Relation[];
  word_cloud_keywords: string[];
  max_hot_count: number;
}

interface RelationsCache {
  version: number;
  scope: string;
  partition_config: PartitionConfig;
  groups: Record<string, GroupData>;
  updatedAt: string | null;
}

interface ScanIndexEntry {
  path: string;
  fullPath: string;
  summary: string;
  keywords: string[];
  enriched: boolean;
  vectorized: boolean;
  memoryId: string | null;
}

interface ScanIndex {
  version: number;
  scope: string;
  rootName: string;
  sourceDir: string;
  lastScannedCommit: string | null;
  scannedAt: string;
  entries: ScanIndexEntry[];
  stats: {
    total: number;
    scanned: number;
    enriched: number;
    vectorized: number;
  };
}

interface MappingSource {
  file: string;
  relation: string;
  code_refs?: string[];
}

interface MappingGroup {
  path: string;
  sources: MappingSource[];
}

interface MappingConfig {
  root_name?: string;
  groups: MappingGroup[];
}

interface FileEntry {
  absPath: string;
  relativePath: string;
  isMarkdown: boolean;
  size: number;
}

interface ImportSummary {
  ok: true;
  root_name: string;
  groups_created: number;
  relations_imported: number;
  files_skipped: number;
  errors: string[];
}

function output(result: Record<string, unknown>): void {
  console.log(JSON.stringify(result, null, 2));
}

function toPosix(input: string): string {
  return input.split(path.sep).join('/');
}

function trimSlashes(input: string): string {
  return input.replace(/^\/+|\/+$/g, '');
}

function stripMarkdownExtension(filename: string): string {
  return filename.replace(/\.md$/i, '');
}

function walkFiles(dir: string, rootDir: string = dir): FileEntry[] {
  const results: FileEntry[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const absPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(absPath, rootDir));
      continue;
    }

    if (!entry.isFile()) continue;

    const stat = fs.statSync(absPath);
    const relativePath = toPosix(path.relative(rootDir, absPath));
    results.push({
      absPath,
      relativePath,
      isMarkdown: /\.md$/i.test(entry.name),
      size: stat.size,
    });
  }

  return results.sort((a, b) => a.relativePath.localeCompare(b.relativePath, 'zh-CN'));
}

function loadKeywordMap(scanIndexFile?: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  if (!scanIndexFile) {
    console.warn('警告：未提供 --scan-index，导入的关键词将为空');
    return map;
  }
  if (!fs.existsSync(scanIndexFile)) return map;

  const scanIndex = readJson<ScanIndex>(scanIndexFile);
  if (!scanIndex?.entries) return map;

  for (const entry of scanIndex.entries) {
    map.set(entry.path, entry.keywords || []);
  }
  return map;
}

function ensureRootNode(index: GroupIndex, rootName: string): void {
  if (!index.roots[rootName]) {
    index.roots[rootName] = {};
  }
}

function checkRootNameConflict(index: GroupIndex, rootName: string): boolean {
  return !!index.roots[rootName];
}

function ensureGroupPath(index: GroupIndex, groupPath: string): number {
  const segments = trimSlashes(groupPath).split('/').filter(Boolean);
  if (segments.length === 0) return 0;

  const [rootName, ...rest] = segments;
  ensureRootNode(index, rootName);

  let created = 0;
  let current = index.roots[rootName];

  for (const segment of rest) {
    if (typeof current[segment] !== 'object' || current[segment] === null) {
      current[segment] = {};
      created++;
    }
    current = current[segment] as Record<string, unknown>;
  }

  return created;
}

function ensureCacheGroup(cache: RelationsCache, groupPath: string): GroupData {
  if (!cache.groups[groupPath]) {
    cache.groups[groupPath] = {
      hot_relations: [],
      word_cloud_keywords: [],
      max_hot_count: (cache.partition_config || DEFAULT_PARTITION_CONFIG).maxHotCount,
    };
  }
  return cache.groups[groupPath];
}

function generateNextId(cache: RelationsCache): string {
  let maxNum = 0;
  for (const data of Object.values(cache.groups)) {
    for (const rel of data.hot_relations) {
      const match = rel.id.match(/^rel_(\d+)$/);
      if (!match) continue;
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  return `rel_${String(maxNum + 1).padStart(3, '0')}`;
}

function upsertImportedRelation(
  cache: RelationsCache,
  groupPath: string,
  relationText: string,
  keywords: string[]
): void {
  const groupData = ensureCacheGroup(cache, groupPath);
  const existing = groupData.hot_relations.find((item) => item.text === relationText);
  const uniqueKeywords = [...new Set((keywords || []).map((kw) => kw.trim()).filter(Boolean))];

  if (existing) {
    existing.keywords = uniqueKeywords;
    existing.isImported = true;
    existing.score = 0;
    existing.useCount = 0;
    existing.lastUsedTime = null;
    return;
  }

  groupData.hot_relations.push({
    id: generateNextId(cache),
    text: relationText,
    score: 0,
    useCount: 0,
    lastUsedTime: null,
    keywords: uniqueKeywords,
    isImported: true,
  });
}

function loadLocalKb(localKbPath: string): Record<string, unknown> {
  if (!fs.existsSync(localKbPath)) return {};
  return readJson<Record<string, unknown>>(localKbPath) || {};
}

function writeLocalKb(scope: string, groupPath: string, relationText: string, moduleInfo: string): void {
  const localKbPath = getLocalKbDir(scope, groupPath);
  fs.mkdirSync(path.dirname(localKbPath), { recursive: true });
  const localKb = loadLocalKb(localKbPath);
  localKb[relationText] = moduleInfo;
  writeJson(localKbPath, localKb);
}

function appendCodeRefs(moduleInfo: string, codeRefs?: string[]): string {
  if (!codeRefs || codeRefs.length === 0) return moduleInfo;
  const normalizedRefs = codeRefs.map((item) => item.trim()).filter(Boolean);
  if (normalizedRefs.length === 0) return moduleInfo;

  const suffix = `\n\n## 代码定位\n${normalizedRefs.map((item) => `- ${item}`).join('\n')}`;
  return `${moduleInfo}${suffix}`;
}

function importConventionMode(
  scope: string,
  sourceDir: string,
  rootName: string,
  groupIndex: GroupIndex,
  relationsCache: RelationsCache,
  keywordMap: Map<string, string[]>,
  summary: ImportSummary
): void {
  const files = walkFiles(sourceDir);
  ensureRootNode(groupIndex, rootName);

  for (const file of files) {
    if (!file.isMarkdown) {
      summary.files_skipped++;
      continue;
    }

    if (file.size > MAX_IMPORT_FILE_SIZE) {
      summary.files_skipped++;
      const msg = `跳过超大文件：${file.relativePath}`;
      summary.errors.push(msg);
      console.warn(`警告：${msg}`);
      continue;
    }

    const content = fs.readFileSync(file.absPath, 'utf-8');
    if (!content.trim()) {
      summary.files_skipped++;
      console.warn(`警告：跳过空文件：${file.relativePath}`);
      continue;
    }

    const rawRelationText = stripMarkdownExtension(path.posix.basename(file.relativePath));
    // 移除 Markdown 格式字符和代码符号
    const relationText = rawRelationText.replace(/[*~`#\[\](){}<>]/g, '').trim() || stripMarkdownExtension(path.posix.basename(file.relativePath));
    const dirName = path.posix.dirname(file.relativePath);
    const groupPath = dirName === '.' ? rootName : `${rootName}/${dirName}`;
    const moduleInfo = content;
    const keywords = keywordMap.get(file.relativePath) || [];

    summary.groups_created += ensureGroupPath(groupIndex, groupPath);
    upsertImportedRelation(relationsCache, groupPath, relationText, keywords);
    writeLocalKb(scope, groupPath, relationText, moduleInfo);
    summary.relations_imported++;
  }
}

function importMappingMode(
  scope: string,
  sourceDir: string,
  rootName: string,
  mapping: MappingConfig,
  groupIndex: GroupIndex,
  relationsCache: RelationsCache,
  keywordMap: Map<string, string[]>,
  summary: ImportSummary
): void {
  ensureRootNode(groupIndex, rootName);

  for (const group of mapping.groups || []) {
    const trimmedGroupPath = trimSlashes(group.path || '');
    const fullGroupPath = trimmedGroupPath ? `${rootName}/${trimmedGroupPath}` : rootName;
    summary.groups_created += ensureGroupPath(groupIndex, fullGroupPath);

    for (const source of group.sources || []) {
      const fileRelativePath = toPosix(source.file);
      const filePath = path.resolve(sourceDir, source.file);

      if (!fs.existsSync(filePath)) {
        summary.errors.push(`映射文件不存在：${fileRelativePath}`);
        continue;
      }

      const stat = fs.statSync(filePath);
      if (!stat.isFile()) {
        summary.errors.push(`映射目标不是文件：${fileRelativePath}`);
        continue;
      }

      if (stat.size > MAX_IMPORT_FILE_SIZE) {
        summary.files_skipped++;
        const msg = `跳过超大文件：${fileRelativePath}`;
        summary.errors.push(msg);
        console.warn(`警告：${msg}`);
        continue;
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      if (!content.trim()) {
        summary.files_skipped++;
        console.warn(`警告：跳过空文件：${fileRelativePath}`);
        continue;
      }

      const moduleInfo = appendCodeRefs(content, source.code_refs);
      const rawRelationText = source.relation?.trim();

      if (!rawRelationText) {
        summary.errors.push(`映射 relation 为空：${fileRelativePath}`);
        continue;
      }

      // 移除 Markdown 格式字符和代码符号
      const relationText = rawRelationText.replace(/[*~`#\[\](){}<>]/g, '').trim() || rawRelationText;

      const keywords = keywordMap.get(fileRelativePath) || [];
      upsertImportedRelation(relationsCache, fullGroupPath, relationText, keywords);
      writeLocalKb(scope, fullGroupPath, relationText, moduleInfo);
      summary.relations_imported++;
    }
  }
}

const program = new Command();

program
  .name('import-kb')
  .description('外部知识库导入：约定模式 / 配置模式')
  .requiredOption('--scope <scope>', '项目隔离标识')
  .requiredOption('--source <sourceDir>', '外部知识库根目录路径')
  .requiredOption('--root-name <rootName>', '导入根节点名称')
  .option('--scan-index <scanIndexFile>', '扫描索引文件路径，用于复用关键词')
  .option('--mapping <mappingFile>', '映射配置文件路径')
  .action(async (opts) => {
    try {
      const scope = String(opts.scope);
      const sourceDir = path.resolve(String(opts.source));
      const mappingFile = opts.mapping ? path.resolve(String(opts.mapping)) : null;
      const scanIndexFile = opts.scanIndex ? path.resolve(String(opts.scanIndex)) : undefined;

      validateScope(scope);
      ensureScopeDir(scope);

      if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
        output({ ok: false, error: `source 目录不存在或不是目录：${sourceDir}` });
        process.exit(1);
      }

      let rootName = String(opts.rootName).trim();
      let mapping: MappingConfig | null = null;
      if (mappingFile) {
        if (!fs.existsSync(mappingFile)) {
          output({ ok: false, error: `mapping 文件不存在：${mappingFile}` });
          process.exit(1);
        }
        mapping = JSON.parse(fs.readFileSync(mappingFile, 'utf-8')) as MappingConfig;
        if (mapping.root_name?.trim()) {
          rootName = mapping.root_name.trim();
        }
      }

      if (!rootName) {
        output({ ok: false, error: 'root-name 不能为空' });
        process.exit(1);
      }

      const groupIndexPath = getGroupIndexPath(scope);
      const relationsCachePath = getRelationsCachePath(scope);
      const groupIndex = readJson<GroupIndex>(groupIndexPath);
      const relationsCache = readJson<RelationsCache>(relationsCachePath);

      if (!groupIndex || !relationsCache) {
        output({ ok: false, error: 'scope 初始化失败，缺少基础索引文件' });
        process.exit(1);
      }

      // 根节点已存在时发出警告，允许幂等重新导入
      if (checkRootNameConflict(groupIndex, rootName)) {
        console.warn(`警告：根节点已存在：${rootName}，将覆盖更新已有内容`);
      }

      const keywordMap = loadKeywordMap(scanIndexFile);
      const summary: ImportSummary = {
        ok: true,
        root_name: rootName,
        groups_created: 0,
        relations_imported: 0,
        files_skipped: 0,
        errors: [],
      };

      if (mapping) {
        importMappingMode(
          scope,
          sourceDir,
          rootName,
          mapping,
          groupIndex,
          relationsCache,
          keywordMap,
          summary
        );
      } else {
        importConventionMode(
          scope,
          sourceDir,
          rootName,
          groupIndex,
          relationsCache,
          keywordMap,
          summary
        );
      }

      writeJson(groupIndexPath, groupIndex as unknown as Record<string, unknown>);
      writeJson(relationsCachePath, relationsCache as unknown as Record<string, unknown>);

      output(summary);
    } catch (err) {
      output({ ok: false, error: (err as Error).message });
      process.exit(1);
    }
  });

program.parse();
