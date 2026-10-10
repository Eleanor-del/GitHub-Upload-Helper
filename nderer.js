// ===== 状态 =====
const state = {
  token: '',
  username: '',
  repo: '',
  branch: 'main',
  targetDir: '',
  rememberToken: false,
  connected: false,
  files: [],
  log: []
};

const $ = (id) => document.getElementById(id);

// ===== 配置持久化（支持记住令牌）=====
function saveConfig() {
  const cfg = {
    username: state.username,
    repo: state.repo,
    branch: state.branch,
    targetDir: state.targetDir,
    rememberToken: state.rememberToken,
    token: state.rememberToken ? state.token : ''
  };
  localStorage.setItem('ghu_config', JSON.stringify(cfg));
}
function loadConfig() {
  try {
    const c = JSON.parse(localStorage.getItem('ghu_config') || '{}');
    state.username = c.username || '';
    state.repo = c.repo || '';
    state.branch = c.branch || 'main';
    state.targetDir = c.targetDir || '';
    state.rememberToken = !!c.rememberToken;
    if (c.token) state.token = c.token;
    // 回填到界面
    $('username').value = state.username;
    $('repo').value = state.repo;
    $('branch').value = state.branch;
    $('targetDir').value = state.targetDir;
    $('rememberToken').checked = state.rememberToken;
    if (state.token) $('token').value = state.token;
  } catch (e) {}
}

// ===== GitHub API =====
const GITHUB_API = 'https://api.github.com';

async function testConnection() {
  state.token = $('token').value.trim();
  state.username = $('username').value.trim();
  state.repo = $('repo').value.trim().replace(/\s+/g, '-');
  state.branch = $('branch').value.trim() || 'main';
  state.targetDir = $('targetDir').value.trim();
  state.rememberToken = $('rememberToken').checked;
  const status = $('connStatus');
  if (!state.token || !state.username || !state.repo) {
    status.className = 'status err';
    status.textContent = '⚠️ 请先填写令牌、用户名和仓库名。';
    return;
  }
  status.className = 'status loading';
  status.textContent = '正在连接 GitHub，请稍候…';
  $('enterApp').classList.add('hidden');
  try {
    const resp = await fetch(`${GITHUB_API}/repos/${state.username}/${state.repo}`, {
      headers: { 'Authorization': `token ${state.token}`, 'Accept': 'application/vnd.github+json' }
    });
    if (resp.status === 404) {
      // 仓库不存在：进入一键创建仓库面板
      state.connected = false;
      status.className = 'status loading';
      status.textContent = 'ℹ️ 你的账户下还没有这个仓库，请在下方创建。';
      $('newRepoName').value = state.repo;
      $('newRepoDesc').value = '';
      $('createRepoStatus').textContent = '';
      setTimeout(() => {
        $('connectPanel').classList.add('hidden');
        $('createRepoPanel').classList.remove('hidden');
      }, 500);
    } else if (resp.status === 401) {
      status.className = 'status err';
      status.textContent = '❌ 令牌无效或已过期，请重新生成 Personal Access Token。';
      state.connected = false;
    } else if (!resp.ok) {
      status.className = 'status err';
      status.textContent = `❌ 连接失败 (HTTP ${resp.status})。`;
      state.connected = false;
    } else {
      const data = await resp.json();
      state.branch = $('branch').value = data.default_branch || state.branch;
      state.connected = true;
      status.className = 'status ok';
      status.textContent = `✅ 连接成功！仓库「${data.name}」(${data.visibility === 'private' ? '私有' : '公开'})，正在进入…`;
      saveConfig();
      setTimeout(enterApp, 500);
    }
  } catch (e) {
    status.className = 'status err';
    status.textContent = '❌ 网络错误，请检查网络连接后重试。';
    state.connected = false;
  }
}

// 进入功能界面 / 退出
function enterApp() {
  if (!state.connected) return;
  $('connRepo').textContent = `${state.username}/${state.repo}`;
  $('connectPanel').classList.add('hidden');
  $('appPanel').classList.remove('hidden');
  $('connStatus').textContent = '';
  $('enterApp').classList.add('hidden');
  setUploadStep(1);
}
function logout() {
  state.connected = false;
  if (!state.rememberToken) {
    state.token = '';
    $('token').value = '';
  }
  localStorage.removeItem('ghu_config');
  // 若记住令牌，重新写入非令牌配置
  saveConfig();
  $('appPanel').classList.add('hidden');
  $('connectPanel').classList.remove('hidden');
  $('connStatus').className = 'status loading';
  $('connStatus').textContent = state.rememberToken
    ? '已退出，令牌已记住，下次打开自动连接。'
    : '已退出。';
}

// 一键创建仓库
async function createRepo() {
  const newName = $('newRepoName').value.trim().replace(/\s+/g, '-');
  const status = $('createRepoStatus');
  if (!newName) {
    status.className = 'status err';
    status.textContent = '⚠️ 请填写仓库名。';
    return;
  }
  state.repo = newName;
  $('repo').value = newName;
  status.className = 'status loading';
  status.textContent = '正在创建仓库…';
  try {
    const resp = await fetch(`${GITHUB_API}/user/repos`, {
      method: 'POST',
      headers: { 'Authorization': `token ${state.token}`, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newName,
        description: $('newRepoDesc').value.trim(),
        private: $('repoPrivate').checked,
        auto_init: $('repoInit').checked
      })
    });
    if (!resp.ok) {
      const t = await resp.text().catch(() => '');
      let reason = `HTTP ${resp.status}`;
      if (resp.status === 422) reason = '仓库名不合法或已存在（换个名字试试）';
      if (resp.status === 401) reason = '令牌无效';
      if (resp.status === 403) reason = '令牌权限不足（需勾选 repo 权限）';
      throw new Error(reason + (t ? ' | ' + t.slice(0, 200) : ''));
    }
    const created = await resp.json();
    // 关键：GitHub 会规范化仓库名（空格转 - 等），这里用返回的真实名字覆盖
    state.repo = created.name || newName;
    $('repo').value = state.repo;
    state.connected = true;
    state.branch = created.default_branch || 'main';
    status.className = 'status ok';
    status.textContent = `✅ 仓库「${state.repo}」创建成功，正在进入功能界面…`;
    saveConfig();
    setTimeout(() => {
      $('createRepoPanel').classList.add('hidden');
      enterApp();
    }, 900);
  } catch (e) {
    status.className = 'status err';
    status.textContent = '❌ ' + e.message;
    state.connected = false;
  }
}

// ===== 上传步骤切换 =====
function setUploadStep(n) {
  $('step1').classList.toggle('hidden', n !== 1);
  $('step2').classList.toggle('hidden', n !== 2);
  document.querySelectorAll('.steps .step').forEach((s) => {
    s.classList.toggle('active', Number(s.dataset.step) === n);
  });
}

// ===== 文件选择 =====
function addFiles(list) {
  for (const f of list) state.files.push({ name: f.name, path: f.name, absPath: f.path, size: f.size });
  renderFiles();
}
async function pickFolder() {
  const res = await window.api.selectFolder();
  if (!res) return;
  for (const f of res.files) {
    if (!state.files.some((x) => x.absPath === f.absPath)) {
      const rel = f.path.slice(res.root.length).replace(/\\/g, '/').replace(/^\//, '');
      state.files.push({ name: f.name, path: rel, absPath: f.absPath, size: f.size });
    }
  }
  renderFiles();
}
function pickFiles() {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.onchange = () => { addFiles(input.files); input.value = ''; };
  input.click();
}
function renderFiles() {
  const tbody = $('fileList');
  const empty = $('emptyHint');
  tbody.innerHTML = '';
  if (!state.files.length) {
    empty.style.display = 'block';
    $('toUpload').disabled = true;
    return;
  }
  empty.style.display = 'none';
  $('toUpload').disabled = false;
  state.files.forEach((f, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${esc(f.name)}</td><td>${fmtSize(f.size)}</td><td>${esc(f.path || f.name)}</td>
      <td><button class="del-file" data-i="${i}">删除</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.del-file').forEach((b) => {
    b.onclick = () => { state.files.splice(Number(b.dataset.i), 1); renderFiles(); };
  });
}
function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ===== 上传 =====
async function uploadFile(f) {
  const target = f.path || f.name;
  const base64 = await window.api.readFileBase64(f.absPath);
  const pathPart = state.targetDir ? `${state.targetDir.replace(/\/$/, '')}/${target}` : target;
  const body = { message: `上传 ${target} - GitHub上传助手`, content: base64, branch: state.branch };
  let sha = null;
  try {
    const exist = await fetch(`${GITHUB_API}/repos/${state.username}/${state.repo}/contents/${encodePath(pathPart)}?ref=${state.branch}`, {
      headers: { 'Authorization': `token ${state.token}`, 'Accept': 'application/vnd.github+json' }
    });
    if (exist.ok) { sha = (await exist.json()).sha; body.message = `更新 ${target} - GitHub上传助手`; }
  } catch (e) {}
  if (sha) body.sha = sha;
  const resp = await fetch(`${GITHUB_API}/repos/${state.username}/${state.repo}/contents/${encodePath(pathPart)}`, {
    method: 'PUT',
    headers: { 'Authorization': `token ${state.token}`, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    let reason = `HTTP ${resp.status}`;
    if (resp.status === 422) reason = '文件冲突或路径无效';
    if (resp.status === 403) reason = '令牌权限不足（需 repo 权限）或文件过大';
    if (resp.status === 404) reason = '仓库或分支不存在';
    throw new Error(reason + (errText ? ' | ' + errText.slice(0, 200) : ''));
  }
  return (await resp.json()).content.html_url;
}
function encodePath(p) { return p.split('/').map(encodeURIComponent).join('/'); }

async function startUpload() {
  const btn = $('startUpload');
  btn.disabled = true;
  $('uploadLog').innerHTML = '';
  $('doneBox').classList.add('hidden');
  $('doneBox').classList.remove('ok', 'partial', 'err');
  state.log = state.files.map((f) => ({ name: f.name, state: 'waiting', url: null, err: null }));
  renderLog();
  let done = 0, okCount = 0, errCount = 0;
  for (let i = 0; i < state.files.length; i++) {
    state.log[i].state = 'uploading';
    renderLog();
    try {
      const url = await uploadFile(state.files[i]);
      state.log[i].state = 'ok'; state.log[i].url = url; okCount++;
    } catch (e) {
      state.log[i].state = 'err'; state.log[i].err = e.message; errCount++;
    }
    done++;
    const pct = Math.round((done / state.files.length) * 100);
    $('progressBar').style.width = pct + '%';
    $('progressText').textContent = pct + '%';
    renderLog();
  }
  btn.disabled = false;
  const box = $('doneBox');
  box.classList.remove('hidden');
  if (errCount === 0) {
    box.classList.add('ok');
    box.innerHTML = `<b>🎉 全部上传成功！</b> ${okCount} 个文件已同步到 <b>${state.username}/${state.repo}</b> 分支 ${state.branch}。`;
  } else if (okCount > 0) {
    box.classList.add('partial');
    box.innerHTML = `<b>⚠️ 部分成功：</b>成功 ${okCount} 个，失败 ${errCount} 个。`;
  } else {
    box.classList.add('err');
    box.innerHTML = `<b>❌ 上传失败：</b>${errCount} 个文件均未成功。`;
  }
}

function renderLog() {
  const log = $('uploadLog');
  log.innerHTML = '';
  state.log.forEach((item) => {
    const div = document.createElement('div');
    div.className = 'log-item';
    const stateText = { waiting: '等待中', uploading: '上传中…', ok: '✅ 成功', err: '❌ 失败' }[item.state];
    div.innerHTML = `<span class="state ${item.state}">${stateText}</span> <span>${esc(item.name)}</span>
      ${item.url ? `<a href="${item.url}" target="_blank">在 GitHub 查看</a>` : ''}
      ${item.err ? `<span style="color:#cf222e">${esc(item.err)}</span>` : ''}`;
    log.appendChild(div);
  });
}

// ===== Release 发布 =====
let relAsset = null;
async function selectAsset() {
  const res = await window.api.selectSingleFile();
  if (!res) return;
  relAsset = res;
  $('relAsset').value = `${res.name}（${fmtSize(res.size)}）`;
}
async function createReleaseAndUpload() {
  const tag = $('relTag').value.trim();
  const status = $('relStatus');
  $('relLog').innerHTML = '';
  const done = $('relDone');
  done.classList.add('hidden');
  done.classList.remove('ok', 'err');
  if (!state.token || !state.username || !state.repo) {
    status.className = 'status err';
    status.textContent = '⚠️ 请先在连接页完成连接。';
    return;
  }
  if (!tag) {
    status.className = 'status err';
    status.textContent = '⚠️ 请填写版本号 Tag（如 v1.0.0）。';
    return;
  }
  const btn = $('createRelease');
  btn.disabled = true;
  status.className = 'status loading';
  status.textContent = '正在创建 Release…';
  try {
    const release = await window.api.createRelease({
      token: state.token, username: state.username, repo: state.repo,
      tagName: tag, name: $('relName').value.trim(), body: $('relBody').value,
      draft: $('relDraft').checked, prerelease: $('relPre').checked, branch: state.branch
    });
    $('relLog').innerHTML += `<div class="log-item"><span class="state ok">✅ 已创建</span> <span>Release「${esc(release.name || release.tag_name)}」</span> <a href="${release.html_url}" target="_blank">查看</a></div>`;
    if (relAsset) {
      status.textContent = `正在上传附件 ${relAsset.name}…`;
      const asset = await window.api.uploadAsset({
        token: state.token, username: state.username, repo: state.repo,
        releaseId: release.id, filePath: relAsset.path, assetName: relAsset.name
      });
      $('relLog').innerHTML += `<div class="log-item"><span class="state ok">✅ 附件已上传</span> <span>${esc(asset.name)}（${fmtSize(relAsset.size)}）</span> <a href="${asset.browser_download_url || release.html_url}" target="_blank">下载链接</a></div>`;
      done.classList.remove('hidden'); done.classList.add('ok');
      done.innerHTML = `<b>🎉 发布成功！</b>版本 <b>${esc(tag)}</b> 已发布。<a href="${release.html_url}" target="_blank">前往 Release 页面</a>`;
    }
    status.className = 'status ok';
    status.textContent = '✅ Release 处理完成。';
    $('relTag').value = '';
  } catch (e) {
    status.className = 'status err';
    status.textContent = '❌ ' + e.message;
  } finally {
    btn.disabled = false;
  }
}

// ===== 事件绑定 =====
document.addEventListener('DOMContentLoaded', () => {
  loadConfig();

  $('toggleToken').onclick = () => {
    const t = $('token');
    t.type = t.type === 'password' ? 'text' : 'password';
    $('toggleToken').textContent = t.type === 'password' ? '显示' : '隐藏';
  };
  $('testConn').onclick = testConnection;
  $('enterApp').onclick = enterApp;
  $('logout').onclick = logout;

  // 仓库创建
  $('doCreateRepo').onclick = createRepo;
  $('backConnect').onclick = () => {
    $('createRepoPanel').classList.add('hidden');
    $('createRepoStatus').textContent = '';
    $('connectPanel').classList.remove('hidden');
    $('connStatus').className = 'status loading';
    $('connStatus').textContent = '已返回连接页，请重新测试。';
  };

  // 上传文件流程
  $('pickFiles').onclick = pickFiles;
  $('pickFolder').onclick = pickFolder;
  $('clearFiles').onclick = () => { state.files = []; renderFiles(); };
  $('toUpload').onclick = () => {
    const total = state.files.reduce((s, f) => s + f.size, 0);
    $('uploadSummary').innerHTML = `即将上传 <b>${state.files.length}</b> 个文件（合计 <b>${fmtSize(total)}</b>）到 <b>${state.username}/${state.repo}</b> 的 <b>${state.branch}</b> 分支。`;
    setUploadStep(2);
    renderLog();
  };
  $('backToPick').onclick = () => setUploadStep(1);
  $('startUpload').onclick = startUpload;

  // 功能切换
  const switchMode = (mode) => {
    const upload = mode === 'upload';
    $('uploadMode').style.display = upload ? '' : 'none';
    $('releasePanel').classList.toggle('hidden', upload);
    $('tabUpload').classList.toggle('active', upload);
    $('tabRelease').classList.toggle('active', !upload);
  };
  $('tabUpload').onclick = () => switchMode('upload');
  $('tabRelease').onclick = () => switchMode('release');

  // Release 事件
  $('pickAsset').onclick = selectAsset;
  $('createRelease').onclick = createReleaseAndUpload;
});
