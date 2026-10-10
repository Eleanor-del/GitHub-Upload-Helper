const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 700,
    minHeight: 560,
    title: 'GitHub上传助手',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.setMenuBarVisibility(false);
  win.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// 选择文件夹（保留目录结构）
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  if (result.canceled || !result.filePaths.length) return null;
  const root = result.filePaths[0];
  return { root, files: collectFiles(root) };
});

// 读取本地文件为 base64（供 GitHub Contents API 上传）
ipcMain.handle('read-file-base64', async (_e, filePath) => {
  const data = fs.readFileSync(filePath);
  return data.toString('base64');
});

// 选择单个文件（用于 Release 附件上传）
ipcMain.handle('select-single-file', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openFile'] });
  if (result.canceled || !result.filePaths.length) return null;
  const p = result.filePaths[0];
  return { path: p, name: path.basename(p), size: fs.statSync(p).size };
});

const GITHUB_API = 'https://api.github.com';

// 创建 GitHub Release
ipcMain.handle('gh-create-release', async (_e, cfg) => {
  const { token, username, repo, tagName, name, body, draft, prerelease, branch } = cfg;
  const resp = await fetch(`${GITHUB_API}/repos/${username}/${repo}/releases`, {
    method: 'POST',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      tag_name: tagName,
      name: name || tagName,
      body: body || '',
      draft: !!draft,
      prerelease: !!prerelease,
      target_commitish: branch || 'main'
    })
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    let parsed = null;
    try { parsed = JSON.parse(t); } catch (e) {}
    const ghMsg = parsed && parsed.message;
    const err = parsed && parsed.errors && parsed.errors[0];
    let reason = `HTTP ${resp.status}`;
    if (err && err.message === 'Repository is empty.') {
      reason = '你的仓库当前是空的（还没有 main 分支）。请先切到「上传文件」页上传至少一个文件（如 README.md），创建 main 分支后再发布 Release。';
    } else if (err && err.field === 'target_commitish') {
      reason = '目标分支无效：仓库中不存在该分支。请先用「上传文件」上传一个文件创建 main 分支，再发布 Release。';
    } else if (resp.status === 422) {
      reason = '版本号 tag 已存在或格式不正确（发布新版本请换一个新的 tag，如 v1.0.1）';
    } else if (resp.status === 404) {
      reason = '仓库或令牌无效，请先测试连接';
    } else if (resp.status === 403) {
      reason = '令牌权限不足（需 repo 权限）';
    }
    throw new Error(reason + (ghMsg && ghMsg !== 'Validation Failed' ? ' | ' + ghMsg : ''));
  }
  return resp.json();
});

// 上传 Release 附件（支持大文件）
// 注意：GitHub 附件上传必须走 uploads.github.com，而不是 api.github.com，否则返回 404 Not Found
ipcMain.handle('gh-upload-asset', async (_e, cfg) => {
  const { token, username, repo, releaseId, filePath, assetName } = cfg;
  const data = fs.readFileSync(filePath);
  const resp = await fetch(
    `https://uploads.github.com/repos/${username}/${repo}/releases/${releaseId}/assets?name=${encodeURIComponent(assetName)}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(data.length)
      },
      body: new Uint8Array(data)
    }
  );
  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    let reason = `HTTP ${resp.status}`;
    if (resp.status === 422) reason = '同名附件已存在，请更换附件名或先删除旧附件';
    if (resp.status === 413) reason = '附件过大（Release 附件单文件上限 2GB）';
    if (resp.status === 403) reason = '令牌权限不足';
    throw new Error(reason + (t ? ' | ' + t.slice(0, 200) : ''));
  }
  return resp.json();
});

function collectFiles(root) {
  const out = [];
  function walk(dir, rel) {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const abs = path.join(dir, item.name);
      const relPath = rel ? `${rel}/${item.name}` : item.name;
      if (item.isDirectory()) {
        walk(abs, relPath);
      } else if (item.isFile()) {
        const size = fs.statSync(abs).size;
        out.push({ name: item.name, path: relPath, absPath: abs, size });
      }
    }
  }
  walk(root, '');
  return out;
}
