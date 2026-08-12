@echo off
REM ============================================
REM 工厂排产跟进 - 自动同步定时任务
REM
REM 功能：获取飞书数据 → 保存本地JSON → 同步到网站
REM 用法：通过Windows任务计划程序定时调用此脚本
REM ============================================

REM === 配置区（根据实际路径修改）===
set PROJECT_DIR=F:\TRAE SOLO CN\6a717be5ded033ac5a159e55\工厂排产跟进
set PYTHON_EXE=C:\Program Files\Python312\python.exe

REM === 切换到项目目录 ===
cd /d "%PROJECT_DIR%"

REM === 步骤1: 获取飞书数据并自动同步到网站 ===
echo [%date% %time%] 开始获取飞书数据...
"%PYTHON_EXE%" scripts\fetch_data.py
if %errorlevel% neq 0 (
    echo [%date% %time%] 飞书数据获取失败！
    exit /b 1
)

REM === 步骤2: 独立同步（作为备用，确保数据已推送到网站）===
echo [%date% %time%] 备用同步检查...
"%PYTHON_EXE%" scripts\sync_to_website.py
if %errorlevel% neq 0 (
    echo [%date% %time%] 备用同步失败，但步骤1可能已同步成功
)

echo [%date% %time%] 全部完成！
exit /b 0
