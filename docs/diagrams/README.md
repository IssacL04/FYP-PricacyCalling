# 图源文件说明

本目录提供两套可编辑图源：

1. `*.puml`：PlantUML 图源（推荐做版本管理）。
2. `privacy-calling.drawio`：diagrams.net 可直接打开/继续编辑的源文件。

## 文件清单

- `privacy-calling-architecture.puml`：系统组件架构图
- `privacy-calling-deployment.puml`：部署拓扑图
- `privacy-calling-api-sequence.puml`：API 回拨时序图
- `privacy-calling-client-sequence.puml`：客户端直拨时序图
- `privacy-calling-state-machine.puml`：通话状态机图
- `privacy-calling-data-model.puml`：数据模型（ER/UML）
- `privacy-calling.drawio`：三页综合图（Architecture / API Call Flow / Data Model）

## 打开方式

### 1) diagrams.net 打开 `.drawio`

1. 打开 <https://app.diagrams.net/>。
2. 选择 `File -> Open From -> Device`。
3. 选择本目录下的 `privacy-calling.drawio`。
4. 文件内包含多页，可在底部页签切换。

### 2) PlantUML 渲染（本地）

示例命令：

```bash
# 安装（Ubuntu 示例）
sudo apt-get update
sudo apt-get install -y plantuml graphviz

# 渲染当前目录全部 puml 为 png
cd docs/diagrams
for f in *.puml; do plantuml -tpng "$f"; done
```

如果你更偏好 SVG：

```bash
for f in *.puml; do plantuml -tsvg "$f"; done
```

## 维护建议

1. 优先维护 `.puml`，因为 diff 友好。
2. 答辩前将关键图导出为 PNG/SVG 放入 `docs/assets/`。
3. 图中组件名建议与源码目录保持一致，避免文档和代码脱节。
