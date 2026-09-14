# 青河市 · 3D 体素沙盒世界

青河市有学校、居民区和连接它们的道路。学生按年级进入对应校区、教学楼和教室，依固定周课表上课；教师依据原教学设计组织课堂和完整作业，学生放学回到本人住所，由手机里的学习 APP 批改、讲解和辅导。人物设定、真实学习状态与 APP 预测都能在当前学生的页面查看。

本仓库提供城市、校园、教室、住宅和移动端学习界面。课程导入、教师备课、学生模拟、批改、Memory 与评测位于 `/Users/xenoxu/Documents/ChatGPT/AICampus/versions/v4/QingheSimulation`。

## 从哪里开始

```sh
npm ci
npm run education:dev
```

打开[青河市](http://localhost:3000/)，点击“开始学校日”，或直接打开[年级与课表](http://localhost:3000/?teaching=1&setup=1)。选择年级、学期、学习天数和学生人数，核对固定课表和来源状态；“运行设置”可调整作业题数、辅导轮数与请求并发。课表为每天 6 节、每周 5 天共 30 节，每节 40 模拟分钟。API 的 `start_day` 可指定学期第几个上课日。

运行需要 Node.js 22.13 以上、Python 3.11 以上和支持 WebGL 2 的浏览器。当前工作区已准备 `.venv-education/bin/python`；其他机器可设置 `EDUCATION_PYTHON` 与 `AICAMPUS_BACKEND`，并安装后端的 `requirements.txt` 和 `QingheSimulation/requirements-materials.txt`。`npm run dev` 可单独启动城市前端。

| 配置 | 用途 |
| --- | --- |
| `NEXT_PUBLIC_AI_CAMPUS_API` | 浏览器访问后端的地址，默认 `http://127.0.0.1:8768` |
| `QINGHE_ORIGIN` | 后端允许的前端来源，默认 `http://localhost:3000` |
| `QINGHE_SCHOOL_DAY_ROOT` | 学校日运行、人物、计划、作业和请求账本目录 |
| `TEACHING_DESIGN_SOURCE_ROOT` | 教学设计目录，默认 `/Users/xenoxu/Tencent/obsidian/教学设计` |
| `AICAMPUS_BACKEND` | AICampus 后端 `versions/v4` 的位置 |
| `EDUCATION_PYTHON` | 后端 Python 解释器 |

## 教材、知识结构与课表

当前来源包含 **204 本教材、6,617 份教学设计**，其中 **6,282 份目标与重难点完整，335 份存在原始字段缺失**。导入保留版本、学段、学科、年级、教材、单元、资源、文件路径和内容哈希。教材资源的排列依据与待核对状态随来源保存；目录覆盖量、顺序核验量和已实际执行课时分别统计。

`CurriculumGraph` 从原教学目标构建 `td-objective:` 节点，节点保存原文及哈希。公共结构沿学科、学段、版本、教材、单元、课时和目标展开；包含关系与课程顺序各有语义。真实画像与 APP 预测沿用这些目标身份，依据各自经历显示个人学习范围。

`GradeScheduleService` 为一至十二年级提供固定周课表，保存学期教材绑定、模块安排和来源快照。课表预览检查原始字段、年级、学制、资源位置与来源余量；有问题的安排显示具体原因。每个课时由 LiteLLM 据原始目标和重难点编制 40 分钟活动、至少 2 道例题、至少 4 道随堂题及 12–20 道家庭作业。生成结构、课程科学性与实际教学效果分别验收。

## 人物、真实画像与 APP 预测

“人物设定”展示可以旋转的立体学生，以及性别、年级、学习方式、兴趣、学习属性与任务目标。人物参数使用固定种子生成，并允许在创建运行时声明具体初始条件和已学目标。

“真实画像”根据课堂、练习、辅导、休息与间隔时间更新模拟掌握状态、疲劳和遗忘。“APP 预测画像”依据学生实际分享的题目、原答、APP 评分及模型关联到的目标独立形成预测；两种视角的节点集合、数值和更新时间可以不同。

两张个人 3D 知识图各自显示已学目标，每个显示节点都有 0–100% 掌握度、0–3 星及来源依据。当前量规将 60%、80%、95% 设为一星、二星、三星起点，页面可展开学习公式、证据权重与遗忘规则。这些是明确声明的模拟与预测模型，教育测量准确率和学习收益仍需独立校准。历史运行按其原档案解释，可见状态从实际记录的时刻开始。

## 学校日与居家 APP

教师组织讲授、示范、随堂练习和反馈，并布置完整作业。每位学生依据自己的经历与状态生成实际作答。学生从住所出发，进入对应年级教室，放学后沿城市道路返回本人住所。

到家后，学生独立完成作业并冻结整份提交。APP 读取本人题目与原答，逐题批改、解释问题步骤并进行连续交流。手机可以切换作业、查看原答和反馈、选择题目继续提问。

学习记录、人物画像、材料和独立评测共享当前 `run_id + student_id`。上传材料保留原件、页内位置与本人原答；选题分享后进入该学生的作业列表，由同一 APP 批改和讨论。`/?run={run_id}` 恢复课程，校园往返保留运行与学生选择。

## LiteLLM 与验证

模拟与评测使用 LiteLLM。页面“模型设置”读取后端 `config/qinghe.local.toml`，独立 Judge 使用 `config/qinghe.judge.local.toml`。每次运行支持 1–200 名学生、1–200 个并发请求；同一学生按因果顺序提交。请求账本保留模型、输入哈希、排队／发出／返回时间、原始响应、token 与错误，暂停和恢复延续同一运行。

历史有界实测已完成两天数学、6 名学生、180 道原答与批改，以及七年级历史、2 名学生、24 道原答与批改。原 Smartedu 课程、固定 K12 图谱、真实模型请求和独立审核保存在各自结果档案中。它们的样本与量规见[教育 Memory 实施与验收](docs/education-memory-implementation.md)，当前年级课表与人物画像的验证另行列示。

后端专项回归可在 `versions/v4` 执行：

```sh
/Users/xenoxu/Tencent/SharedWorld/.venv-education/bin/python -m unittest tests.test_qinghe_learner_profiles
```

运行真实模拟前先固定课表、学生数、题量、轮数、模型、请求预算和现实耗时边界。结构回归、实际 API 执行、独立语义审核、浏览器操作与学习收益分别保存证据。

## 部署与进一步阅读

前端使用 Vite／vinext；`npm run build` 构建，Cloudflare 部署命令见 `package.json`。Python 教学后端独立运行。当前启动入口面向本地实验。

- [教育 Memory 与校园模拟任务待办](docs/education-memory-todo.md)
- [教育 Memory 实施与验收](docs/education-memory-implementation.md)
- [教学模拟说明](docs/teaching-simulation.md)
- [K12 图谱与教育 Agent Memory](docs/k12-memory-design.md)
