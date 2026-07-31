// 构建前置脚本：在执行 vite build 之前预创建输出目录 dist/assets。
//
// 背景：在部分虚拟化/沙箱文件系统（如 TRAE 挂载盘）中，Node 的异步
// fs.promises.mkdir 在“长路径修正模式(fixup mode)”下创建新目录可能失败，
// 导致 vite build 在写入产物时报 ENOENT。此处使用同步 mkdirSync（可正常工作）
// 预先创建输出目录，并配合 vite.config.ts 中 build.emptyOutDir=false，
// 使 rollup 写入时的 mkdir 成为对已存在目录的空操作，从而保证构建稳定通过。
// 在普通环境下该脚本同样安全无副作用。
const fs = require('fs');
const path = require('path');

const distDir = path.resolve(process.cwd(), 'dist');
const assetsDir = path.resolve(distDir, 'assets');

try {
  // 尝试清理旧产物（沙箱中可能无效，忽略错误）
  fs.rmSync(distDir, { recursive: true, force: true });
} catch {
  // 忽略删除失败
}

// 同步预创建输出目录
fs.mkdirSync(assetsDir, { recursive: true });
console.log('[prebuild] 已预创建输出目录:', assetsDir);
