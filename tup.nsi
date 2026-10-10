Unicode true
!addincludedir "/home/user/Doubao/chats/38441967495277826/.tmp-tool-results/nsis-eb/Include"
!addincludedir "/home/user/Doubao/chats/38441967495277826/.tmp-tool-results/nsis-eb/Contrib/Modern UI 2"

!define APPNAME "GitHub上传助手"
!define EXENAME "GitHub上传助手.exe"
!define VERSION "1.3.1"
!define REGAPP "GitHubUploader"

Name "${APPNAME}"
OutFile "/home/user/Doubao/chats/38445717740043266/github-uploader-desktop/dist/GitHub上传助手 Setup 1.3.1.exe"
InstallDir "$PROGRAMFILES\${APPNAME}"
InstallDirRegKey HKLM "Software\${REGAPP}" "InstallDir"
RequestExecutionLevel admin
SetCompressor /SOLID lzma

!include "MUI2.nsh"

!define MUI_ABORTWARNING
!define MUI_ICON "/home/user/Doubao/chats/38445717740043266/github-uploader-desktop/build/icon.ico"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "SimpChinese"

Section "安装主程序" SecMain
  SetOutPath "$INSTDIR"
  File /r "/home/user/Doubao/chats/38445717740043266/github-uploader-desktop/dist/win-unpacked/*"

  ; 卸载器
  WriteUninstaller "$INSTDIR\uninstall.exe"

  ; 注册表卸载信息
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${REGAPP}" "DisplayName" "${APPNAME}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${REGAPP}" "UninstallString" "$INSTDIR\uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${REGAPP}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${REGAPP}" "InstallLocation" "$INSTDIR"
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${REGAPP}" "NoModify" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${REGAPP}" "NoRepair" 1

  ; 快捷方式
  CreateDirectory "$SMPROGRAMS\${APPNAME}"
  CreateShortCut "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk" "$INSTDIR\${EXENAME}"
  CreateShortCut "$DESKTOP\${APPNAME}.lnk" "$INSTDIR\${EXENAME}"
SectionEnd

Section "Uninstall"
  Delete "$INSTDIR\uninstall.exe"
  RMDir /r "$INSTDIR"

  Delete "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk"
  RMDir "$SMPROGRAMS\${APPNAME}"
  Delete "$DESKTOP\${APPNAME}.lnk"

  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${REGAPP}"
  DeleteRegKey HKLM "Software\${REGAPP}"
SectionEnd
