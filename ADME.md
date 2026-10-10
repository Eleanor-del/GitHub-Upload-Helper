# GitHub 上传助手（GitHub Uploader）

一个 Windows 桌面小工具，图形化一键把本地文件上传到 GitHub 仓库、发布 Release 并上传安装包，**全程不用命令行、不用 Git**。

## 功能
- 连接 GitHub：填 Personal Access Token（勾选 `repo` 权限），测试连接
- 记住令牌：下次打开自动登录，无需重新输入
- 仓库自动检测：测试连接时若仓库不存在，可在软件内一键新建仓库
- 上传文件：选文件夹/多文件，自动同步到仓库，支持覆盖更新
- 发布 Release：创建版本标签、填写说明、上传安装包附件（如 Setup.exe）

## 技术栈
- Electron 31（桌面框架）
- GitHub REST API（仓库创建、文件上传、Release 创建、附件上传）
- NSIS（Windows 安装包制作）

## 工程结构
```
github-uploader-desktop/
├── package.json      # 项目配置与打包脚本
├── main.js           # Electron 主进程（窗口、文件对话框、GitHub API 调用）
├── preload.js        # 渲染层桥接
├── index.html        # 界面结构
├── style.css         # 样式
├── renderer.js       # 界面逻辑与交互
├── setup.nsi         # NSIS 安装脚本
└── build/
    ├── icon.png      # 应用图标
    └── icon.ico
```

## 如何在 Windows 上重新打包成 Setup.exe
1. 安装 Node.js（18+）
2. 在本目录执行 `npm install`
3. 打包：`npx electron-builder --win dir --x64`（生成 win-unpacked）
4. 用 NSIS 编译 setup.nsi 得到安装包，或执行 `npm run dist:win`

## 使用
打开软件 → 连接 GitHub → 进入功能界面 → 上传文件 / 发布 Release。
