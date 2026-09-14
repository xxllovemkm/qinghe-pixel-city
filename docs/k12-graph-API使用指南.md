# k12-graph 知识图谱 API 使用指南

- **服务地址**：`http://21.130.252.81:4187`
- **协议**：全部端点均为 `GET`（只读服务，不支持写操作）
- **鉴权**：已实测确认该部署**要求鉴权**（`curl` 不带 token 返回 `401 missing_token`），因此**每一个请求**都必须带请求头：

```
Authorization: Bearer <你的 K12_API_TOKEN>
```

> token 是部署时通过环境变量 `K12_API_TOKEN` 设置的那个值，请向部署者获取，不要把它写进前端代码或公开仓库。

---

## 一、通用约定

### 1. 响应结构
- 成功：`200`，JSON（除 QTI 导出为 XML）。
- 错误：非 200 时统一为 `{ "error": "<code>", "message": "<说明>" }`。
- 常见错误码：

| HTTP 状态 | error code | 含义 |
| --- | --- | --- |
| 400 | `missing_param` / `invalid_param` / `invalid_key` / `param_out_of_range` / `too_many_keys` / `q_too_long` / `cross_shard` | 参数问题，**服务器不会静默修正或截断**，一律直接拒绝 |
| 401 | `missing_token` / `invalid_token` | 未带 token 或 token 错误 |
| 404 | `key_not_found` / `shard_not_found` / `exercise_not_found` / `standard_item_not_found` / `not_found` | 资源不存在 |
| 405 | `method_not_allowed` | 用了非 GET/HEAD 方法 |
| 410 | `key_tombstoned` | key 已废弃（响应会带 `successors` 告知新 key，**不是 404**，要注意区分处理） |
| 501 | `not_implemented` / `content_unsupported` | 功能未在此数据包/provider 中启用 |
| 500 | `internal_error` | 服务端内部错误 |

### 2. 分页三件套
支持分页的端点统一给三个字段：
- `total`：**切片前**真实总数（不随 `limit`/`offset` 变化）
- `returned`：本页实际条数
- `truncated`：是否还有更多（`total > offset + returned`）

`limit` 默认 20，最大 200；`offset` 默认 0，最大 100000。**越界直接 400，不会静默截断**。

### 3. key 与别名
- 知识点 key 形如：`mathematics.junior.geometry.shape-properties.triangles-and-polygons.pythagorean-theorem`（`<subject>.<stage>.<路径...>`）。
- 题目 key 形如：`k12ex.<subject>.<12位十六进制>`。
- 传入的 key 若是历史别名，响应会带 `resolved_from` 字段告知正式 key；若 key 已废弃，返回 **410**（不是 404），并在响应里给出 `successors`（新 key）。

---

## 二、端点详解

### 元信息

| 端点 | 说明 |
| --- | --- |
| `GET /api/health` | 健康检查，不返回任何数据内容，仅服务状态 |
| `GET /api/manifest` | 数据包版本、分区、各项覆盖率统计 |

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://21.130.252.81:4187/api/health
curl -s -H "Authorization: Bearer $TOKEN" http://21.130.252.81:4187/api/manifest
```

### 1. 检索：`GET /api/search`

用一段文字（甚至一整道题目）检索知识点。

| 参数 | 说明 |
| --- | --- |
| `q` | 必填，检索文本，最长 2000 字符 |
| `subject` / `stage` | 可选，限定学科/学段（不给则跨全部分片查，此时分数**不可比**，见 `score_comparable_across_shards`） |
| `limit` / `offset` | 分页 |

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://21.130.252.81:4187/api/search?q=勾股定理&subject=mathematics&stage=junior&limit=5"
```

响应含 `items[].score`、`match_kinds`（命中方式：`alias_exact` 别名精确 / `bigram_bm25` 分词打分 / `path_hit` 所属主题弱命中）。**纯字面检索，不理解语义。**

### 2. 知识点详情：`GET /api/kp`

| 参数 | 说明 |
| --- | --- |
| `key` | 必填 |
| `textbook` | 可选，传教材册 id 后额外返回 `textbook_position`（该知识点在这册书第几节讲，`taught:false` 表示没讲） |

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://21.130.252.81:4187/api/kp?key=mathematics.junior.geometry.shape-properties.triangles-and-polygons.pythagorean-theorem"
```

返回内容包括：名称、学段、`level_path`、认知层级（`cognitive_level` + `cognitive_level_scheme` 要配对读，不同学科量表不通用）、`keypoints`（讲解要点列表）、`exercises.count`（题目数）、`parent_key`、`children`（下一层子节点）。

### 3. 树浏览：`GET /api/kp/children`

不传 `key` 时列出该学科/学段的顶层节点。

```bash
# 顶层
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://21.130.252.81:4187/api/kp/children?subject=mathematics&stage=junior"

# 下钻某个 key
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://21.130.252.81:4187/api/kp/children?key=mathematics.junior.geometry"
```

每条附带 `is_node`（能否 `/api/kp` 查详情）、`node_kind`（`topic` 主题层 / `knowledge_point` 可教可考知识点）、`descendants`（辖下知识点数）、`has_children`（能否继续下钻）。

可选 `textbook=<册id>` 按该册教材顺序重排（不过滤，未讲的排最后并标 `taught:false`）。

### 4. 先修/后继依赖：`GET /api/kp/neighbors`

| 参数 | 说明 |
| --- | --- |
| `key` | 必填 |
| `k` | 跳数（不是节点数！），默认 2，最大 6 |
| `limit` | 每层最多返回条数 |

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://21.130.252.81:4187/api/kp/neighbors?key=mathematics.junior.geometry.shape-properties.triangles-and-polygons.pythagorean-theorem&k=2"
```

返回 `prerequisites`（前置，学这个之前要先学什么）与 `successors`（后续，学完它可以接着学什么），`confidence` 沿链相乘衰减。若 `key` 是主题层（非具体知识点），会自动聚合其辖下知识点的依赖并标 `aggregated:true`。

### 5. 该知识点的题目：`GET /api/kp/exercises`

| 参数 | 说明 |
| --- | --- |
| `key` | 必填 |
| `limit` / `offset` | 分页 |
| `difficulty` | `easy` / `medium` / `hard` |
| `question_kind` | `single_choice` / `multi_choice` / `fill_blank` / `judge` / `short_answer` / `calculation` / `proof` / `essay` |

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://21.130.252.81:4187/api/kp/exercises?key=mathematics.junior.geometry.shape-properties.triangles-and-polygons.pythagorean-theorem&limit=10&difficulty=medium"
```

响应带 `provider` 能力声明（`supportsContent` 是否能拿正文）。能拿正文时再调：

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://21.130.252.81:4187/api/exercises/content?key=<题目key，形如 k12ex.mathematics.xxxxxxxxxxxx>"
```

反查题目属于哪些知识点：`GET /api/exercises/reverse?key=<题目key>`。

### 6. 学习路径规划：`GET /api/path`

给目标知识点 + 已掌握的知识点，规划学习顺序（拓扑序，已掌握的会连同其前置一起剪枝）。

| 参数 | 说明 |
| --- | --- |
| `target` | 必填，逗号分隔的 key 列表，最多 30 个，**必须同属一个 subject/stage** |
| `known` | 可选，已掌握的 key 列表 |
| `limit` | 序列长度上限，默认 200，最大 500 |

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://21.130.252.81:4187/api/path?target=<目标key1>,<目标key2>&known=<已掌握key1>"
```

`target` 跨学科/学段会直接 400（先修边按分片存储，跨分片规划会缺边，服务宁可拒绝也不给不完整答案）。

### 7. 错题 → 前置缺口诊断：`GET /api/diagnose`

给一批错题对应的知识点，找出它们共同依赖的前置薄弱点。

| 参数 | 说明 |
| --- | --- |
| `wrong` | 必填，错题对应的知识点 key 列表，逗号分隔，同 subject/stage |
| `k` | 回溯跳数，默认 3 |
| `limit` | 候选项上限 |

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://21.130.252.81:4187/api/diagnose?wrong=<key1>,<key2>,<key3>"
```

每个候选带 `support`（被多少个错题共同依赖，`support=1` 是弱信号，不宜直接当结论呈现）与 `min_depth`。

### 8. 课标对齐：`GET /api/standards/align`

双向查询：`key=<知识点>` → 对应课标条目；`item=<课标条目id>` → 对应知识点。

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://21.130.252.81:4187/api/standards/align?key=<知识点key>"
```

`method=standard-ref`（score 1.0，权威）与 `method=literal-name`（score<1，字面命中补漏信号）需分开看待。

### 9. 教材版本重排：`GET /api/textbooks` / `GET /api/textbook`

```bash
# 列出可选教材版本（用于版本选择器）
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://21.130.252.81:4187/api/textbooks?subject=mathematics&stage=junior"

# 取某一册的章节树（章节标题在开源包中为合规原因不含，title/number 为 null，titles 段会说明原因）
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://21.130.252.81:4187/api/textbook?id=<textbook_id>"
```

### 10. 增量同步：`GET /api/changes?since=<版本号>`

外部系统同步数据变更用，避免整包重拉。`since` 为空则全量。返回的 `items` **必须按顺序应用**（同一个 key 可能先 update 再 deprecate）。

### 11. key 状态查询：`GET /api/keys/resolve?key=`

查一个 key 当前是 `active`（正式可用）/ `tombstoned`（已废弃，410）/ 不存在（404）。

### 12. 标准格式导出

| 端点 | 说明 |
| --- | --- |
| `GET /api/export/case?subject=&stage=` 或 `?key=` | 导出 CASE 1.0 JSON（能力框架标准格式），`include_keypoints=1` 可选带要点 |
| `GET /api/export/qti?exercise=`/`?key=`/`?subject=&stage=&format=item\|bundle\|test\|manifest` | 导出 QTI 3.0 XML 题目包。若当前 provider 不支持导出正文会返回 `501 content_unsupported` |

---

## 三、典型使用链路示例

以数学初中「勾股定理」（`mathematics.junior.geometry.shape-properties.triangles-and-polygons.pythagorean-theorem`）为例：

```bash
export TOKEN="你的token"
BASE="http://21.130.252.81:4187"

# ① 用一道题的关键词检索出知识点
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/search?q=勾股定理&subject=mathematics&stage=junior&limit=1"

# ② 知识点详情
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/kp?key=mathematics.junior.geometry.shape-properties.triangles-and-polygons.pythagorean-theorem"

# ③ 先修依赖，判断学生是否具备前置知识
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/kp/neighbors?key=mathematics.junior.geometry.shape-properties.triangles-and-polygons.pythagorean-theorem&k=2"

# ④ 拿几道配套题目
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/kp/exercises?key=mathematics.junior.geometry.shape-properties.triangles-and-polygons.pythagorean-theorem&limit=5"

# ⑤ 学生一批错题 → 诊断共同薄弱点
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/diagnose?wrong=<错题key1>,<错题key2>"

# ⑥ 规划从当前水平到目标知识点的学习路径
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/path?target=mathematics.junior.geometry.shape-properties.triangles-and-polygons.pythagorean-theorem&known=<已掌握key>"
```

---

## 四、Python 封装示例

```python
import os
import requests

BASE_URL = "http://21.130.252.81:4187"
TOKEN = os.environ["K12_API_TOKEN"]  # 建议只从环境变量读取，不要硬编码在代码里
HEADERS = {"Authorization": f"Bearer {TOKEN}"}


def call(path, **params):
    resp = requests.get(f"{BASE_URL}{path}", headers=HEADERS, params=params, timeout=10)
    resp.raise_for_status()
    return resp.json()


# 1. 拍照识题后，用抽取的关键词检索知识点
hit = call("/api/search", q="勾股定理", subject="mathematics", stage="junior", limit=1)
key = hit["items"][0]["key"]

# 2. 详情 + 先修依赖 + 推荐题目
detail = call("/api/kp", key=key)
neighbors = call("/api/kp/neighbors", key=key, k=2)
exercises = call("/api/kp/exercises", key=key, limit=5)

# 3. 学生若答错了这道题及另外两道题，诊断共同薄弱点
diagnosis = call("/api/diagnose", wrong=f"{key},其他错题对应的key")

print(detail["name"], "->", [p["key"] for p in neighbors["prerequisites"]])
```

---

## 五、可视化浏览器（可选）

浏览器直接访问 `http://21.130.252.81:4187/` 会打开随包附带的只读知识图谱浏览页面（静态资源本身不校验 token，但页面内调用 API 时需要你在页面里手动填入 token）。

## 六、注意事项

1. **跨分片限制**：`/api/path`、`/api/diagnose` 的 key 列表必须同属一个 `subject/stage`，否则 400（`cross_shard`）。
2. **跨分片检索分数不可比**：`/api/search` 不带 `subject`/`stage` 时看响应里的 `score_comparable_across_shards: false`。
3. **410 ≠ 404**：key 已废弃返回 410 并带 `successors`（新 key），请据此更新调用方的存量数据，不要当成"不存在"处理。
4. **每次请求都必须带 Authorization 头**（含从本机 `127.0.0.1` 访问也要带，因为该服务只要配置了 `K12_API_TOKEN` 就对所有来源统一校验）。
5. 一次请求 key 列表上限 30 个，`q` 最长 2000 字符，超出直接 400，不会静默截断。
