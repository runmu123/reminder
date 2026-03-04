#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Android APK 构建脚本（reminder）

命令说明：
  build.py init      - 初始化 Capacitor Android 项目
  build.py sync      - 同步 Web 代码到 Android 项目
  build.py build     - 构建 APK 并复制到输出目录
  build.py clean     - 清理构建文件
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

import yaml
from xml.sax.saxutils import escape as xml_escape

ANDROID_BUILD_DIR = "android_build"
ANDROID_DIR = os.path.join(ANDROID_BUILD_DIR, "android")
GRADLE_WRAPPER = os.path.join(ANDROID_DIR, "gradlew.bat")


class Colors:
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    BLUE = "\033[94m"
    END = "\033[0m"

    @classmethod
    def green(cls, text):
        return f"{cls.GREEN}{text}{cls.END}"

    @classmethod
    def yellow(cls, text):
        return f"{cls.YELLOW}{text}{cls.END}"

    @classmethod
    def red(cls, text):
        return f"{cls.RED}{text}{cls.END}"

    @classmethod
    def blue(cls, text):
        return f"{cls.BLUE}{text}{cls.END}"


def log_info(message):
    print(f"[{Colors.blue('INFO')}] {message}")


def log_success(message):
    print(f"[{Colors.green('SUCCESS')}] {message}")


def log_warning(message):
    print(f"[{Colors.yellow('WARNING')}] {message}")


def log_error(message):
    print(f"[{Colors.red('ERROR')}] {message}")


def log_step(step):
    print(f"\n{Colors.blue('=' * 60)}")
    print(f"{Colors.blue(f'步骤: {step}')}")
    print(f"{Colors.blue('=' * 60)}")


def run_command(cmd, cwd=None, capture_output=False):
    try:
        log_info(f"执行命令: {' '.join(cmd)}")
        if capture_output:
            result = subprocess.run(
                cmd, cwd=cwd, capture_output=True, text=True, shell=False
            )
            return result.returncode, result.stdout, result.stderr
        result = subprocess.run(cmd, cwd=cwd, shell=False)
        return result.returncode, None, None
    except Exception as e:
        if isinstance(e, FileNotFoundError) and os.name == "nt" and cmd and not cmd[0].lower().endswith(".cmd"):
            fallback_cmd = cmd.copy()
            fallback_cmd[0] = f"{cmd[0]}.cmd"
            try:
                log_info(f"重试命令: {' '.join(fallback_cmd)}")
                if capture_output:
                    result = subprocess.run(
                        fallback_cmd, cwd=cwd, capture_output=True, text=True, shell=False
                    )
                    return result.returncode, result.stdout, result.stderr
                result = subprocess.run(fallback_cmd, cwd=cwd, shell=False)
                return result.returncode, None, None
            except Exception as retry_e:
                log_error(f"执行命令失败: {retry_e}")
                return -1, None, str(retry_e)
        log_error(f"执行命令失败: {e}")
        return -1, None, str(e)


def check_environment():
    log_step("检查系统环境")

    log_info("检查 Python 版本...")
    if sys.version_info < (3, 7):
        log_error("Python 版本需要 3.7 或更高")
        return False
    log_success(f"Python 版本: {sys.version.split()[0]}")

    log_info("检查 Node.js 版本...")
    code, stdout, _ = run_command(["node", "--version"], capture_output=True)
    if code != 0:
        log_error("Node.js 未安装或不可用")
        return False
    log_success(f"Node.js 版本: {stdout.strip()}")

    log_info("检查 npm 版本...")
    code, stdout, _ = run_command(["npm", "--version"], capture_output=True)
    if code != 0:
        log_error("npm 未安装或不可用")
        return False
    log_success(f"npm 版本: {stdout.strip()}")

    log_info("检查 Java 版本...")
    code, _, stderr = run_command(["java", "-version"], capture_output=True)
    if code != 0:
        log_error("Java 未安装或不可用")
        return False
    java_version_line = (stderr or "").splitlines()[0] if stderr else "已安装"
    log_success(f"Java 版本: {java_version_line}")

    if os.path.exists(GRADLE_WRAPPER):
        log_info("检查 Gradle 版本...")
        code, _, _ = run_command([os.path.abspath(GRADLE_WRAPPER), "--version"], cwd=ANDROID_DIR)
        if code == 0:
            log_success("Gradle 可用")
        else:
            log_warning("Gradle 检查失败，后续构建时再处理")

    return True


def read_args_yaml():
    default_config = {
        "name": "日程提醒",
        "pkg": "com.reminder",
        "version": "v1.0",
        "icon": "./icon.png",
        "enable_zoom": True,
        "out_dir": ".",
    }
    args_yaml_path = "args.yaml"
    if not os.path.exists(args_yaml_path):
        with open(args_yaml_path, "w", encoding="utf-8") as f:
            yaml.dump(default_config, f, allow_unicode=True, sort_keys=False)
        log_warning(f"未找到 args.yaml，已创建默认配置: {args_yaml_path}")
        return default_config

    try:
        with open(args_yaml_path, "r", encoding="utf-8") as f:
            raw_config = yaml.safe_load(f)
        if not isinstance(raw_config, dict):
            log_warning("args.yaml 内容为空或格式不正确，使用默认配置")
            return default_config
        config = default_config.copy()
        config.update(raw_config)
        config["name"] = str(config.get("name") or default_config["name"]).strip() or default_config["name"]
        config["pkg"] = str(config.get("pkg") or default_config["pkg"]).strip() or default_config["pkg"]
        config["version"] = str(config.get("version") or default_config["version"]).strip() or default_config["version"]
        config["icon"] = str(config.get("icon") or default_config["icon"]).strip() or default_config["icon"]
        config["out_dir"] = str(config.get("out_dir") or default_config["out_dir"]).strip() or default_config["out_dir"]
        config["enable_zoom"] = bool(config.get("enable_zoom", default_config["enable_zoom"]))
        return config
    except Exception as e:
        log_error(f"读取 args.yaml 失败: {e}")
        return default_config


def write_file(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


def update_file_by_regex(path, replacements):
    if not os.path.exists(path):
        return False
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    new_content = content
    for pattern, repl in replacements:
        new_content = re.sub(pattern, repl, new_content, flags=re.MULTILINE)
    changed = new_content != content
    if changed:
        write_file(path, new_content)
    return changed


def normalize_hex_color(color, fallback="#ffffff"):
    if not color:
        return fallback
    c = color.strip()
    if not c.startswith("#"):
        return fallback
    hex_part = c[1:]
    if len(hex_part) == 3 and re.fullmatch(r"[0-9a-fA-F]{3}", hex_part):
        return "#" + "".join(ch * 2 for ch in hex_part).lower()
    if len(hex_part) == 6 and re.fullmatch(r"[0-9a-fA-F]{6}", hex_part):
        return "#" + hex_part.lower()
    if len(hex_part) == 8 and re.fullmatch(r"[0-9a-fA-F]{8}", hex_part):
        return "#" + hex_part.lower()
    return fallback


def detect_status_bar_color():
    default_color = "#ffffff"
    index_html_path = os.path.join(ANDROID_BUILD_DIR, "www", "index.html")
    if not os.path.exists(index_html_path):
        return default_color
    try:
        with open(index_html_path, "r", encoding="utf-8") as f:
            content = f.read()
        var_match = re.search(r"--nav-bg\s*:\s*([^;]+);", content, flags=re.MULTILINE)
        if var_match:
            return normalize_hex_color(var_match.group(1), default_color)
        body_match = re.search(r"body\s*\{[\s\S]*?background-color\s*:\s*([^;]+);", content, flags=re.MULTILINE)
        if body_match:
            return normalize_hex_color(body_match.group(1), default_color)
    except Exception:
        return default_color
    return default_color


def apply_android_app_metadata(config):
    app_name = config["name"]
    app_id = config["pkg"]
    version_name = config["version"].lstrip("v")
    icon_path = config.get("icon", "./icon.png")
    status_bar_color = detect_status_bar_color()
    status_bar_color_argb = status_bar_color
    if re.fullmatch(r"#[0-9a-fA-F]{6}", status_bar_color):
        status_bar_color_argb = "#ff" + status_bar_color[1:]

    capacitor_config_path = os.path.join(ANDROID_BUILD_DIR, "capacitor.config.ts")
    capacitor_config = f"""import {{ CapacitorConfig }} from '@capacitor/cli';

const config: CapacitorConfig = {{
  appId: '{app_id}',
  appName: '{app_name}',
  webDir: 'www',
  server: {{
    androidScheme: 'https'
  }},
  plugins: {{
    StatusBar: {{
      overlaysWebView: false,
      backgroundColor: '{status_bar_color_argb}'
    }}
  }}
}};

export default config;
"""
    write_file(capacitor_config_path, capacitor_config)
    log_success("已写入 capacitor.config.ts")

    strings_xml_path = os.path.join(ANDROID_DIR, "app", "src", "main", "res", "values", "strings.xml")
    if update_file_by_regex(
        strings_xml_path,
        [
            (r"(<string name=\"app_name\">).*?(</string>)", rf"\1{xml_escape(app_name)}\2"),
            (r"(<string name=\"title_activity_main\">).*?(</string>)", rf"\1{xml_escape(app_name)}\2"),
            (r"(<string name=\"package_name\">).*?(</string>)", rf"\1{xml_escape(app_id)}\2"),
            (r"(<string name=\"custom_url_scheme\">).*?(</string>)", rf"\1{xml_escape(app_id)}\2"),
        ],
    ):
        log_success("已同步 strings.xml 应用名/包名")

    app_build_gradle_path = os.path.join(ANDROID_DIR, "app", "build.gradle")
    if update_file_by_regex(
        app_build_gradle_path,
        [
            (r'namespace\s+"[^"]+"', f'namespace "{app_id}"'),
            (r'applicationId\s+"[^"]+"', f'applicationId "{app_id}"'),
            (r'versionName\s+"[^"]+"', f'versionName "{version_name}"'),
        ],
    ):
        log_success("已同步 app/build.gradle 包名/版本")

    main_activity_paths = list(Path(ANDROID_DIR).glob("app/src/main/java/**/MainActivity.java"))
    for activity_path in main_activity_paths:
        if update_file_by_regex(
            str(activity_path),
            [(r"^\s*package\s+[a-zA-Z0-9_.]+\s*;", f"package {app_id};")],
        ):
            log_success(f"已同步 MainActivity 包名: {activity_path}")

    styles_xml_path = os.path.join(ANDROID_DIR, "app", "src", "main", "res", "values", "styles.xml")
    if os.path.exists(styles_xml_path):
        styles_xml = f"""<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="Theme.AppCompat.Light.DarkActionBar">
        <item name="colorPrimary">@color/colorPrimary</item>
        <item name="colorPrimaryDark">@color/colorPrimaryDark</item>
        <item name="colorAccent">@color/colorAccent</item>
        <item name="android:statusBarColor">{status_bar_color}</item>
        <item name="android:navigationBarColor">{status_bar_color}</item>
        <item name="android:windowLightStatusBar">true</item>
    </style>

    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:background">@null</item>
        <item name="android:statusBarColor">{status_bar_color}</item>
        <item name="android:navigationBarColor">{status_bar_color}</item>
        <item name="android:windowLightStatusBar">true</item>
    </style>

    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="android:background">@drawable/splash</item>
        <item name="android:statusBarColor">{status_bar_color}</item>
        <item name="android:navigationBarColor">{status_bar_color}</item>
        <item name="android:windowLightStatusBar">true</item>
    </style>
</resources>
"""
        write_file(styles_xml_path, styles_xml)
        log_success(f"已同步状态栏颜色: {status_bar_color}")

    source_icon = Path(icon_path)
    if not source_icon.is_absolute():
        source_icon = Path(os.getcwd()) / source_icon
    if source_icon.exists() and source_icon.is_file():
        mipmap_dirs = list(Path(ANDROID_DIR).glob("app/src/main/res/mipmap-*"))
        for mipmap_dir in mipmap_dirs:
            for target_name in ("ic_launcher.png", "ic_launcher_round.png"):
                target_icon = mipmap_dir / target_name
                if target_icon.exists():
                    shutil.copy2(str(source_icon), str(target_icon))
        anydpi_v26 = Path(ANDROID_DIR) / "app" / "src" / "main" / "res" / "mipmap-anydpi-v26"
        for xml_name in ("ic_launcher.xml", "ic_launcher_round.xml"):
            xml_path = anydpi_v26 / xml_name
            if xml_path.exists():
                xml_path.unlink()
        log_success(f"已同步应用图标: {source_icon}")
    else:
        log_warning(f"图标文件不存在，跳过同步: {source_icon}")


def cleanup_legacy_root_assets():
    legacy_dirs = ["js", "css", "sql"]
    legacy_files = ["index.html", "icon.png", "args.yaml"]
    for name in legacy_dirs:
        path = os.path.join(ANDROID_BUILD_DIR, name)
        if os.path.isdir(path):
            shutil.rmtree(path)
            log_info(f"已清理历史目录: {path}")
    for name in legacy_files:
        path = os.path.join(ANDROID_BUILD_DIR, name)
        if os.path.isfile(path):
            os.remove(path)
            log_info(f"已清理历史文件: {path}")


def cleanup_post_build_artifacts():
    targets = [
        os.path.join(ANDROID_BUILD_DIR, "www"),
        os.path.join(ANDROID_DIR, "app", "build"),
        os.path.join(ANDROID_DIR, "build"),
        os.path.join(ANDROID_DIR, ".gradle"),
        os.path.join(ANDROID_DIR, "app", "src", "main", "assets", "public"),
    ]
    cleaned = 0
    for target in targets:
        try:
            if os.path.isdir(target):
                shutil.rmtree(target)
                cleaned += 1
            elif os.path.isfile(target):
                os.remove(target)
                cleaned += 1
        except Exception as e:
            log_warning(f"清理失败（可忽略）: {target} ({e})")
    log_success(f"构建产物清理完成，共清理 {cleaned} 项")


def configure_local_gradle():
    local_gradle_path = r"C:\Users\Mi\Downloads\gradle-8.14.3-all.zip"
    if not os.path.exists(local_gradle_path):
        log_warning("未找到本地 Gradle 分发包，将按 Gradle 默认行为处理")
        return

    gradle_wrapper_dir = r"C:\Users\Mi\.gradle\wrapper\dists\gradle-8.14.3-all"
    os.makedirs(gradle_wrapper_dir, exist_ok=True)
    random_dir = "bhlb1v25mvn5uk2d4746t5w8lf"
    target_dir = os.path.join(gradle_wrapper_dir, random_dir)
    os.makedirs(target_dir, exist_ok=True)
    target_path = os.path.join(target_dir, "gradle-8.14.3-all.zip")
    if not os.path.exists(target_path):
        shutil.copy2(local_gradle_path, target_path)
        log_success("已复制本地 Gradle 分发包")

    gradle_wrapper_properties = os.path.join(ANDROID_DIR, "gradle", "wrapper", "gradle-wrapper.properties")
    if os.path.exists(gradle_wrapper_properties):
        with open(gradle_wrapper_properties, "r", encoding="utf-8") as f:
            content = f.read()
        content = content.replace("gradle-8.0.2-all.zip", "gradle-8.14.3-all.zip")
        local_gradle_url = "file:///" + local_gradle_path.replace("\\", "/")
        content = re.sub(
            r"distributionUrl=.*",
            f"distributionUrl={local_gradle_url}",
            content,
            flags=re.MULTILINE,
        )
        with open(gradle_wrapper_properties, "w", encoding="utf-8") as f:
            f.write(content)
        log_success("Gradle 已配置为本地 8.14.3 分发包")


def configure_sdk_version():
    if not os.path.exists(ANDROID_DIR):
        return
    sdk_path = r"D:\SDK\platforms"
    if not os.path.exists(os.path.join(sdk_path, "android-34")):
        log_warning("未检测到 android-34，保留默认 SDK 配置")
        return

    build_gradle_path = os.path.join(ANDROID_DIR, "app", "build.gradle")
    if not os.path.exists(build_gradle_path):
        return

    with open(build_gradle_path, "r", encoding="utf-8") as f:
        content = f.read()
    content = content.replace("compileSdk 33", "compileSdk 34")
    content = content.replace("targetSdk 33", "targetSdk 34")
    with open(build_gradle_path, "w", encoding="utf-8") as f:
        f.write(content)
    log_success("SDK 版本已配置为 34")


def init():
    if not check_environment():
        return False
    log_step("初始化 Capacitor Android 项目")
    os.makedirs(ANDROID_BUILD_DIR, exist_ok=True)
    config = read_args_yaml()

    package_json = {
        "name": "reminder-android",
        "version": config["version"].lstrip("v"),
        "description": "Reminder Android 应用",
        "main": "index.html",
        "scripts": {
            "build": "echo 'Build completed'",
            "sync": "npx cap sync",
        },
        "dependencies": {
            "@capacitor/core": "^5.0.0",
            "@capacitor/android": "^5.0.0",
        },
        "devDependencies": {
            "typescript": "^5.0.0",
            "@capacitor/cli": "^5.0.0",
        },
    }
    package_json_path = os.path.join(ANDROID_BUILD_DIR, "package.json")
    with open(package_json_path, "w", encoding="utf-8") as f:
        json.dump(package_json, f, indent=2, ensure_ascii=False)
    log_success("已创建 package.json")

    code, _, _ = run_command(["npm", "install"], cwd=ANDROID_BUILD_DIR)
    if code != 0:
        log_error("安装依赖失败")
        return False
    log_success("依赖安装成功")

    cap_cmd = os.path.abspath(os.path.join(ANDROID_BUILD_DIR, "node_modules", ".bin", "cap.cmd"))
    if not os.path.exists(cap_cmd):
        log_error(f"未找到 cap 命令: {cap_cmd}")
        return False

    if not os.path.exists(os.path.join(ANDROID_BUILD_DIR, "capacitor.config.ts")):
        code, _, _ = run_command([cap_cmd, "init", config["name"], config["pkg"]], cwd=ANDROID_BUILD_DIR)
        if code != 0:
            log_error("Capacitor 初始化失败")
            return False
        log_success("Capacitor 初始化成功")

    if not os.path.exists(ANDROID_DIR):
        code, _, _ = run_command([cap_cmd, "add", "android"], cwd=ANDROID_BUILD_DIR)
        if code != 0:
            log_error("添加 Android 平台失败")
            return False
        log_success("Android 平台添加成功")

    apply_android_app_metadata(config)
    configure_local_gradle()
    configure_sdk_version()

    log_success("项目初始化完成")
    return True


def sync():
    log_step("同步 Web 代码到 Android 项目")
    if not os.path.exists(ANDROID_BUILD_DIR):
        log_error("未找到 android_build，请先执行 init")
        return False

    www_dir = os.path.join(ANDROID_BUILD_DIR, "www")
    os.makedirs(www_dir, exist_ok=True)
    cleanup_legacy_root_assets()

    required_files = ["index.html"]
    for file_name in required_files:
        if not os.path.exists(file_name):
            log_error(f"缺少必要文件: {file_name}")
            return False
        shutil.copy2(file_name, os.path.join(www_dir, file_name))
        log_success(f"复制文件成功: {file_name}")

    required_dirs = ["js", "css"]
    for dir_name in required_dirs:
        if not os.path.exists(dir_name):
            log_error(f"缺少必要目录: {dir_name}")
            return False
        target_dir = os.path.join(www_dir, dir_name)
        if os.path.exists(target_dir):
            shutil.rmtree(target_dir)
        shutil.copytree(dir_name, target_dir)
        log_success(f"复制目录成功: {dir_name}")

    optional_dirs = ["sql"]
    for dir_name in optional_dirs:
        source_dir = Path(dir_name)
        target_dir = Path(www_dir) / dir_name
        if source_dir.exists() and source_dir.is_dir():
            if target_dir.exists():
                shutil.rmtree(target_dir)
            shutil.copytree(source_dir, target_dir)
            log_success(f"复制可选目录成功: {dir_name}")
        else:
            target_dir.mkdir(parents=True, exist_ok=True)
            log_info(f"可选目录不存在，已创建空目录: {target_dir}")

    config = read_args_yaml()
    icon_path = config.get("icon", "./icon.png")
    if os.path.exists(icon_path):
        shutil.copy2(icon_path, os.path.join(www_dir, "icon.png"))
        log_success(f"复制图标成功: {icon_path}")
    else:
        log_warning(f"图标文件不存在: {icon_path}")

    shutil.copy2("args.yaml", os.path.join(www_dir, "args.yaml"))
    log_success("复制 args.yaml 成功")

    apply_android_app_metadata(config)
    code, _, _ = run_command(["npx.cmd", "cap", "sync"], cwd=ANDROID_BUILD_DIR)
    if code != 0:
        log_error("Capacitor 同步失败")
        return False
    apply_android_app_metadata(config)
    configure_android_permissions()

    log_success("代码同步完成")
    return True


def configure_android_permissions():
    manifest_path = os.path.join(ANDROID_DIR, "app", "src", "main", "AndroidManifest.xml")
    if not os.path.exists(manifest_path):
        log_warning("未找到 AndroidManifest.xml，跳过权限配置")
        return
    with open(manifest_path, "r", encoding="utf-8") as f:
        content = f.read()
    permissions = [
        '<uses-permission android:name="android.permission.INTERNET" />',
        '<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />',
        '<uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />',
    ]
    for permission in permissions:
        if permission not in content:
            content = content.replace("</manifest>", f"    {permission}\n</manifest>")
    with open(manifest_path, "w", encoding="utf-8") as f:
        f.write(content)
    log_success("Android 权限配置完成")


def build():
    config = read_args_yaml()
    if not sync():
        return False
    log_step("构建 APK")
    if not os.path.exists(GRADLE_WRAPPER):
        log_error("未找到 Gradle Wrapper，请先执行 init")
        return False

    gradlew_cmd = os.path.abspath(GRADLE_WRAPPER)
    code, _, _ = run_command([gradlew_cmd, "assembleDebug"], cwd=ANDROID_DIR)
    if code != 0:
        log_error("Gradle 构建失败")
        return False

    apk_files = list(Path(ANDROID_DIR).glob("app/build/outputs/apk/debug/*.apk"))
    if not apk_files:
        log_error("未找到生成的 APK 文件")
        return False
    apk_path = str(apk_files[0])
    out_dir = config.get("out_dir", ".")
    os.makedirs(out_dir, exist_ok=True)
    version_label = str(config.get("version", "v0.0")).strip() or "v0.0"
    safe_version_label = re.sub(r'[\\/:*?"<>|]', "_", version_label)
    dest_apk = os.path.join(out_dir, f"reminder_{safe_version_label}.apk")
    shutil.copy2(apk_path, dest_apk)
    log_success(f"APK 已复制到: {dest_apk}")

    cleanup_post_build_artifacts()
    log_success("构建完成")
    return True


def clean():
    log_step("清理构建文件")
    config = read_args_yaml()
    out_dir = config.get("out_dir", ".")
    apk_candidates = list(Path(".").glob("reminder_*.apk"))
    apk_candidates.extend(Path(out_dir).glob("reminder_*.apk"))
    removed = set()
    for apk_file in apk_candidates:
        apk_file_str = str(apk_file)
        if apk_file_str in removed:
            continue
        if os.path.exists(apk_file_str):
            os.remove(apk_file_str)
            removed.add(apk_file_str)
            log_success(f"已删除 APK: {apk_file_str}")

    if os.path.exists(ANDROID_DIR):
        build_dir = os.path.join(ANDROID_DIR, "app", "build")
        if os.path.exists(build_dir):
            shutil.rmtree(build_dir)
            log_success("已清理 Android app/build")

    node_modules = os.path.join(ANDROID_BUILD_DIR, "node_modules")
    if os.path.exists(node_modules):
        shutil.rmtree(node_modules)
        log_success("已清理 node_modules")

    log_success("清理完成")
    return True


def main():
    parser = argparse.ArgumentParser(description="Reminder Android APK 构建脚本")
    parser.add_argument("command", choices=["init", "sync", "build", "clean"], help="执行命令")
    args = parser.parse_args()

    try:
        if args.command == "init":
            ok = init()
        elif args.command == "sync":
            ok = sync()
        elif args.command == "build":
            ok = build()
        else:
            ok = clean()
        if not ok:
            sys.exit(1)
    except KeyboardInterrupt:
        log_error("用户中断操作")
        sys.exit(1)
    except Exception as e:
        log_error(f"发生错误: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
