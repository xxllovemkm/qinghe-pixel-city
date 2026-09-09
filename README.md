# 青河市 · 3D 体素沙盒世界

真正的三维像素城市。使用 Three.js / WebGL 2 渲染有体积的方块模型，透视镜头可 360° 旋转、俯仰、平移和缩放。保留 React、Vinext 与 Shadcn / Base UI 界面，图标使用 Lucide。

## 运行

```sh
npm install
npm run dev
```

生产构建：`npm run build`。类型检查：`npx tsc --noEmit`。
城市规则检查：`node scripts/check-world.mjs`。
三维模型与选取检查：`node scripts/check-3d.mjs`。
校园布局、模型与建造检查：`node scripts/check-schools.mjs`。

## Cloudflare 部署

使用 **Cloudflare Workers + Static Assets**。Workers 执行现有 Vinext 的服务端渲染与路由，Static Assets 提供浏览器使用的 JavaScript、CSS 和图片；Three.js 场景在浏览器中运行。该方案直接使用项目已有的 Cloudflare Vite 插件。

城市与校园建造状态目前保存在页面会话中。后续若需要账户和存档，可使用 D1；若需要多人共享同一城市并实时同步，可使用 Durable Objects；上传模型、纹理或存档文件可使用 R2。

`wrangler.jsonc` 管理 Worker 名称、账户、兼容日期、ASSETS 绑定、日志与环境。兼容日期 `2026-05-15` 对应锁定依赖中的 workerd 运行时，升级依赖时应一起验证。Vite 构建会生成 `dist/server/wrangler.json`，其中入口为打包后的 `index.js`，静态目录为 `dist/client`；预览与部署使用该生成配置。

| 环境 | Worker 名称 | 构建命令 | 部署命令 |
| --- | --- | --- | --- |
| 预发布 | `qinghe-pixel-city-staging` | `npm run build:staging` | `npm run deploy:staging` |
| 正式 | `qinghe-pixel-city` | `npm run build:production` | `npm run deploy` |

首次部署前，在 [Cloudflare Workers & Pages 控制台](https://dash.cloudflare.com/64adb6135d8f2b3fd3e4588919713bf5/workers-and-pages) 初始化账户的 `workers.dev` 子域，然后登录本地 CLI：

```sh
npx wrangler login
npx wrangler whoami
```

Wrangler 登录账户应有配置中 `account_id` 的 Workers 部署权限。CI 使用 `CLOUDFLARE_API_TOKEN`；账户 ID 已写入配置。Cloudflare MCP 与本地 Wrangler 分别认证。

```sh
# 生成与配置一致的绑定类型
npm run cf:typegen

# 构建正式环境并执行部署预检
npm run deploy:check

# 使用本地 Workers 运行时预览生产构建
npm start

# 发布预发布环境
npm run deploy:staging

# 发布正式环境
npm run deploy
```

Vite 在构建时通过 `CLOUDFLARE_ENV` 选择环境，上表脚本已设置此变量。每次部署脚本先构建对应环境，再上传生成的 Worker 和静态资源。生成配置已包含目标环境，Wrangler 的 `--env ''` 参数使其直接使用生成的名称与绑定。远程地址以 Wrangler 部署输出为准。

部署后可检查版本和实时日志：

```sh
npx wrangler deployments list --config wrangler.jsonc --env production
npx wrangler tail --config wrangler.jsonc --env production
```

本地凭据放在 `.dev.vars` 或 `.env*`，正式环境应用密钥通过 `npx wrangler secret put SECRET_NAME --config wrangler.jsonc --env production` 设置。

Cloudflare MCP 可通过账户下的 `/workers/scripts`、`/workers/subdomain` 和 `/pages/projects` 查询部署资源。2026-09-08 检查结果：Workers 0 个、Pages 项目 0 个，账户待初始化 `workers.dev` 子域；本地 Wrangler 4.92.0 待登录。

参考：[Cloudflare Vite 插件](https://developers.cloudflare.com/workers/vite-plugin/)、[环境选择](https://developers.cloudflare.com/workers/vite-plugin/reference/cloudflare-environments/)、[Wrangler 配置](https://developers.cloudflare.com/workers/wrangler/configuration/)。

## 城市

- 47 栋立体建筑：住宅社区、商业街、市政厅、图书馆、河畔钟楼。
- 青禾小学、明德初中、青河一中、青河大学与理工学院；校园包含运动场、庭院和喷泉。
- 有厚度的地块、下沉河道、4 座有桥墩与栏杆的立体桥梁。
- 144 名方块居民、36 辆立体车辆沿连接两岸的路网移动。
- 阶梯屋顶、窗户、烟囱、立体树木、街灯、真实投影与昼夜灯光变化。
- 可点击的缩略地图，显示当前镜头范围与方向；名称标签跟随建筑的三维位置。
- 支持种树、建住宅、移除自建物件，使用射线选取建筑和地面。

## 校园

在青河市点击青禾小学、明德初中或青河一中的建筑，在详情中选择「进入校园」。也可以从学校目录定位。每所学校都有独立的三维场景、15 项设施、设施目录与可点击的缩略地图，通过「返回青河市」回到城市原来的镜头位置。

- 青禾小学：两栋分年级教学楼、科学与创客中心、儿童活动场和自然观察园。
- 明德初中：两栋教学楼、理化生实验楼、生态实践园与学生宿舍。
- 青河一中：高一至高三三栋教学楼、科技实验中心、报告厅与艺术楼、学生宿舍。
- 三校均设有图书馆、室内体育馆、田径与足球场、篮球场、综合活动或排球场、食堂、行政与健康中心、升旗广场和校门。
- 每所校园有 38 名活动中的学生角色，支持昼夜切换、暂停、倍速、旋转、平移与缩放。
- 支持种树、放置长椅和移除自建物件。三校的建造内容、时间与活动进度分别保留，往返校园时也保留城市的建造内容。

## 操作

## AI 校园数据

青河市页面可以读取 AI Campus 的公开模拟接口，在进入三所校园后显示对应学段的学生互动统计。默认请求 `http://127.0.0.1:8768`；部署到其他地址时设置：

```sh
NEXT_PUBLIC_AI_CAMPUS_API=https://your-ai-campus-api.example npm run dev
```

API 服务通过 `QINGHE_ORIGIN` 开放跨域只读请求。城市和校园场景仍可在 API 离线时独立运行，数据恢复后页面会自动在下一次加载时更新。

- 鼠标左键拖动：旋转与俯仰；右键拖动：平移；滚轮：缩放。
- 触屏单指旋转，双指缩放与平移。
- WASD / 方向键平移，Q / E 左右旋转，R / F 调整俯仰，0 恢复全景。
- 空格暂停；1–4 切换探索、种树、住宅（校园中为长椅）与移除。
- 点击建筑查看详情，点击学校列表定位并拉近镜头。

世界内容与建造改动仅在当前页面会话保留，刷新恢复种子 2417。学校规划容量不重复计入常住人口。居民为沿道路移动的场景角色，尚无上学、职业或经济决策模型。

## 实现

- `lib/world/geometry3d.ts`：体素模型、桥梁、河床、动态角色与全景镜头范围计算。静态模型与角色使用 InstancedMesh 合并绘制。
- `lib/world/scene3d.ts`：WebGL 渲染、OrbitControls、射线拾取、光照、投影、时间推进与缩略地图。
- `lib/world/model.ts`：城市数据、路网与建造规则。
- `lib/world/render.ts`：地表纹理与缩略地图绘制；主视图由三维模型渲染。
- `lib/world/school-model.ts`：三校设施、布局、校园建造规则与会话状态。
- `lib/world/school-geometry.ts`：校园立体设施、学生路径与镜头范围计算。
- `lib/world/school3d.ts`：校园渲染、交互、设施选取、昼夜光照与缩略地图。
- `app/page.tsx`：城市与校园切换、设施目录、建筑详情和建造工具。

## 验证

三维检查涵盖 47 栋建筑的体积和射线选取、四座桥在水面之上、移动角色矩阵更新、坐标换算、透视旋转以及宽屏/窄屏镜头完整覆盖城市。城市规则检查涵盖固定种子、路网连通、道路河流占地保护与合法/非法建造。校园检查涵盖三校设施边界与间距、建筑和步道避让、射线选取、学生活动路径、建造规则与镜头范围。另执行 TypeScript 和生产构建检查。

浏览器检查使用 Playwright、Sharp 与已安装的 Google Chrome：先运行校园检查生成模型模块，并启动开发服务器，再执行 `node scripts/check-school-browser.mjs`。若浏览器依赖位于外部目录，可通过 `CAMPUS_BROWSER_DEPS` 指定包含 `playwright` 和 `sharp` 的 `node_modules` 目录，通过 `CAMPUS_BASE_URL` 指定服务器地址。

浏览器检查覆盖 1440×1000 桌面和 390×844 触屏视口，验证三校进入与返回、城市模型点击入口、设施详情、缩略地图定位、镜头旋转与缩放、学生动画与暂停、昼夜切换、校园建造保留及城市状态保留；同时检查 WebGL 画布像素和运行时错误。截图与报告输出至 `outputs/campus-browser`。

可选 WebMCP 工具 `inspect_city`、`edit_city` 复用当前城市状态和可见建造操作。真实 WebMCP 上下文验证仍未执行，普通浏览器操作不依赖此 API。
