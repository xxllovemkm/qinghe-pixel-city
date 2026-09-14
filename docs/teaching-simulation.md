# 青河市教学实验

教学实验按学生年级进入对应校区、教学楼和教室，依青河市固定周课表推进。教师依据原教学设计组织课堂、随堂练习和完整作业；学生放学回到本人住所，交由个人学习 APP 批改、讲解和辅导。人物设定、两种知识画像、材料、Memory 与独立评测均使用同一次学校日的身份。

## 课程与教学计划

`source_curriculum.py` 读取 `/Users/xenoxu/Tencent/obsidian/教学设计`，可用 `TEACHING_DESIGN_SOURCE_ROOT` 指定同结构目录。当前导入 204 本教材、6,617 份教学设计，6,282 份目标与重难点完整，335 份有原始字段缺失。原始版本、学段、学科、教材、单元、资源 ID、文件路径与 SHA-256 均保留。

原教学设计的每段学习目标具有稳定的 `td-objective:` 身份，`curriculum_graph.py` 提供学科到目标的来源层级、检索与课程顺序。`lesson_planner.py` 使用 LiteLLM 编制课时，将生成目标显式关联到实际来源目标，并保存原文依据。

编译器检查来源引文、40 分钟活动总和、例题和随堂任务、12–20 题家庭作业、题型与子问、完整题干、答案量规、作业负荷和私有评分字段的角色投影。结构校验、原始来源的教学顺序核对和独立课程质量审核各自记录状态。

## 年级课表、空间与时间

`grade_schedule.py` 与 `data/qinghe_grade_schedules.json` 定义一至十二年级的校区、教学楼、班级教室及固定周课表：每天 6 节、每周 5 天共 30 节，每节 40 模拟分钟。配置明确记录各年级、学期和学科的教材绑定；高中模块安排具有学校课程政策来源。

课表预览接受 `grade_level`、`term`、`days`、`start_day`，按该学科已经占用的课次选择后续来源。字段缺失、教材版本变化、学制和年级不符、资源位置待核对、来源耗尽都会显示具体问题。预览可执行范围取决于所选时间段的实际来源状态。

1. 学生从本人住所出发，沿城市道路进入校区和对应教室。
2. 教师按当天六节课组织讲授、示范、练习与反馈，每生保留独立原答。
3. 课堂之间按模拟时间休息，放学后携带各科完整作业返回住所。
4. 学生独立作答并冻结整份提交，APP 按本人原答逐题批改。
5. 学生和 APP 根据上一轮实际回应继续讨论，Memory 记录本人证据和教学判断。
6. 后续学习读取保存的人物状态、本人经历及各自可见的 Memory。

学习投入、移动、休息与间隔使用模拟分钟。模型排队和网络等待进入现实耗时账本。同一学生顺序提交，不同学生可以并行；配置上限和实际请求峰值分别报告。

## 人物与双视角知识画像

`learner_profiles.py` 是由学校日事件调用的纯状态服务。人物参数包括性别、年级、外观、学习速度、保持倾向、学习投入、起始准备、求助主动性、兴趣、学习方式和任务目标。固定种子使默认人物可以复现；初始已学节点需要合法来源身份和 0–1 的声明掌握度。

| 视角 | 状态依据 | 当前数值定义 |
| --- | --- | --- |
| 真实画像 | 人物初始条件、课堂、练习、辅导、休息和模拟时间 | 固定学习增量、疲劳恢复与指数遗忘形成的模拟隐状态 |
| APP 预测画像 | 本人分享的原答、APP 评分、Memory 实际关联与原事件依据 | 独立 Beta(1,1) 先验，加权评分证据形成的掌握预测 |

真实状态进入学生行为生成。APP 只获得本人可见的学习资料和自己的预测；研究观察页面可以查看两种状态。首次接触形成数值先验，独立作答、求助后作答、部分分和同一作答的重评具有明确更新规则。对话自述与评分证据分别保存。

两个个人 3D 图各显示本视角的已学目标，每个节点都有有限的掌握度。节点标签、列表和详情显示百分比；60%、80%、95% 对应一星、二星、三星起点。详情展示原教学目标与可点击的学习依据，量规面板说明模型公式和证据权重。公共结构的层级与课程顺序来自 `CurriculumGraph.profile_graph`。

量规版本为 `qinghe-learner-dynamics/1`，属于明确声明的模拟假设。掌握预测准确率、误判漏判及长期学习收益需要独立标注与配对实验。历史运行按原始保存范围解释；缺少连续真实状态的档案显示其实际记录边界。

## 个人材料与证据

“学情与证据”按当前运行和学生显示人物设定、真实画像、APP 预测画像、学习记录、个人材料和运行评测。题目、原答、反馈、对话和知识判断均可追溯到原事件。

照片、PDF、Word 与文本材料归属于上传学生。原件、页图、题目和子问解析后，所选题目转为本人作业；APP 批改和讨论沿同一学校日入口执行。材料任务保存归属、预算、请求与恢复状态。来源关联和 APP 掌握预测分别接受验收。

## 模块与接口

| 模块 | 职责 |
| --- | --- |
| `school_day.py` | 学校日、学生因果顺序、城市移动、作业与 APP、画像事件、请求账本 |
| `school_day_api.py` | 当前运行与学生观察、材料、评测、配置和历史档案读取 |
| `source_curriculum.py`、`curriculum_graph.py` | 原教学设计、稳定目标身份、来源结构与检索 |
| `grade_schedule.py` | 年级固定课表、教材绑定、空间归属与来源可执行性 |
| `lesson_planner.py` | 原目标驱动的课时生成与结构验证 |
| `learner_profiles.py` | 人物初始条件、真实学习状态、APP 独立预测及角色投影 |
| `school_day_materials.py`、`material_ingestion.py`、`semantic_mapping.py` | 材料归属、原件理解、子问区域与模型知识关联 |
| `configuration.py`、`shared_model_gate.py` | LiteLLM 配置和请求并发闸门 |
| `school_day_evaluation.py` | 课程、逐题批改和教学对话独立审核 |

后端位于 `/Users/xenoxu/Documents/ChatGPT/AICampus/versions/v4/QingheSimulation`。

| HTTP 接口 | 用途 |
| --- | --- |
| `GET /api/school-day/catalog`、`books/{book_id}` | 来源教材与教学设计 |
| `GET /api/school-day/grades`、`timetable` | 年级、固定周课表、来源状态及所选课段 |
| `GET /api/school-day/curriculum-graph` | 教学设计来源结构、检索和目标详情 |
| `POST /api/school-day/start`、`control` | 按年级开始、暂停、继续 |
| `GET /api/school-day/runs`、`state`、`export` | 已保存运行、状态与证据导出 |
| `POST /api/school-day/message` | 本人作业中的连续交流 |
| `GET /api/school-day/students/{student_id}/profile` | 人物、两种知识画像与学习证据 |
| `GET/POST /api/school-day/materials` | 个人材料、解析与分享任务 |
| `GET /api/school-day/evaluations`、`POST /api/school-day/evaluation` | 冻结证据、执行和查看独立评测 |

运行和观察使用明确的 `run_id`，个人数据还核对 `student_id`；修改请求以稳定 `request_id` 去重。画像事件保存原参数、节点身份和原学习依据，可按初始条件重放。

## 启动与验证

```sh
npm run education:dev
```

打开[年级与课表](http://localhost:3000/?teaching=1&setup=1)，核对年级、学期与固定课表，在“模型设置”中配置 LiteLLM。开始真实运行前，固定天数、学生数、题量、轮次、并发、请求预算和现实期限。

在后端 `versions/v4` 目录验证人物与画像状态：

```sh
/Users/xenoxu/Tencent/SharedWorld/.venv-education/bin/python -m unittest tests.test_qinghe_learner_profiles
```

课程、批改和对话审核通过 `python -m QingheSimulation.school_day_evaluation prepare|run` 或“运行评测”执行。原 Smartedu 目录和 K12 图谱相关实测按各自版本保存在历史档案中，真实模型调用数及独立审核结论见[教育 Memory 实施与验收](education-memory-implementation.md)。
