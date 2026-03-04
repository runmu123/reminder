# 倒计时提醒应用（reminder）

一个纯前端的移动端风格倒计时页面，用于管理多个事件并实时显示「还有/已经」天数。

## 功能概览

- 实时时钟与日期显示（每秒刷新）
- 倒计时事件列表展示
- 新建事件
- 目标日期选择（公历/农历切换）
- 待办管理（本地新增、编辑、删除、完成、筛选）
- 本地存储（`localStorage`）持久化事件数据
- 底部导航与移动端页面布局

## 技术栈

- HTML5
- CSS3
- 原生 JavaScript（ES Module）
- [lunar-javascript](https://github.com/6tail/lunar-javascript)（通过 CDN 引入）

## 目录结构

```text
.
├─ index.html          # 页面结构与模块入口
├─ css/
│  └─ styles.css       # 样式定义
├─ js/
│  ├─ main.js          # 应用入口
│  ├─ app.js           # 初始化与事件绑定
│  ├─ state.js         # 全局状态与持久化
│  ├─ ui.js            # 视图渲染与日期选择器交互
│  └─ utils.js         # 工具函数
└─ spec.md             # 页面与交互规格说明
```

## 快速开始

1. 直接双击打开 `index.html`，或使用本地静态服务器启动。
2. 推荐命令（任选其一）：

```bash
# Node 环境
npx serve .

# Python 环境
python -m http.server 8000
```

3. 浏览器访问对应地址（如 `http://localhost:8000`）。

## 数据存储

- `localStorage` 键名：`countdownEvents`
- `localStorage` 键名：`todoItems`（待办）
- 单个事件结构（保存时）：

```json
{
  "id": 1700000000000,
  "name": "示例事件",
  "targetDate": "2026-03-03T00:00:00.000Z",
  "calendarType": "solar",
  "includeStartDay": false,
  "repeatType": "不重复",
  "createdAt": "2026-03-03T08:00:00.000Z"
}
```

## 核心流程

1. `main.js` 在 `DOMContentLoaded` 后调用 `init()`。
2. `app.js` 启动时钟、绑定交互事件、首次渲染列表。
3. 新建事件后写入 `state.events`，并通过 `saveEvents()` 持久化。
4. `ui.js` 根据目标日期与当前日期计算天数差并更新列表显示。

## 当前限制与说明

- `repeatType`（每周/每月/每年）目前仅保存，未参与倒计时计算。
- `includeStartDay` 目前仅保存，未影响天数计算逻辑。
- 农历模式下日期展示与选择可用，但保存后仍以转换后的公历时间进行计算。
- 删除事件、编辑事件、置顶与自定义背景等高级功能尚未实现（界面有占位）。
- 待办数据当前仅保存在本地，不参与云端同步。

## 后续建议

- 将 `repeatType` 与 `includeStartDay` 纳入实际计算逻辑。
- 增加事件编辑、删除、排序功能。
- 增加单元测试（日期计算、农历转换、边界日期）。
- 补充构建与发布脚本（如 Vite）。
