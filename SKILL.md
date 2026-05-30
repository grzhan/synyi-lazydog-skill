---
name: synyi-oa-worktime-month-fill
description: 在用户要求基于一个已有的工时补录流程,为补录范围内的每个工作日批量创建工时录入流程时使用。每天默认填 Y3018005 / 8 小时 / "Nexus 开发"。要求环境变量 SYNYI_OA_USERNAME 和 SYNYI_OA_PASSWORD 已设置。
---

# Synyi OA 月度工时批量填报

执行时只用 Skill 内脚本:

- `scripts/submit-month-worktime.js`

## 触发条件

用户要你:

- 基于补录流程,把当前月每天工时补一遍
- 用补录流程批量填工时录入流程
- 每天 8 小时 Nexus 开发,把整个月都建好

## 必做检查

先检查环境变量:

- `SYNYI_OA_USERNAME`
- `SYNYI_OA_PASSWORD`

缺任何一个就直接报错,并提醒用户先设置这两个环境变量。

## 工作机制

1. 登录 OA 拿 cookie
2. 从 OA 拉补录流程列表,过滤出当前用户自己创建的
3. 选定一条补录流程:
   - 用户给了 `--supplementRequestId` 就用它
   - 否则自动选当前用户最新创建的那条补录流程
4. 用补录流程自带的开始日期和结束日期作为遍历范围(不是日历月)
5. 对范围内的每一天,串行执行:
   - 创建工时录入流程,主表关联这个补录流程
   - 加一条明细行: 项目编号 / 8 小时 / 工作内容
   - 提交
6. 单天失败(非工作日 / 服务端校验拒绝 / 网络错误等)直接跳过,继续下一天
7. 末尾输出成功和失败的汇总

不做重复提交查重,如果某天已经提交过工时,由用户自己保证。

## 默认参数

| 参数 | 默认值 | 说明 |
|---|---|---|
| `--projectCode` | `Y3018005` | 项目编号 |
| `--content` | `Nexus 开发` | 工作内容 |
| `--hours` | `8` | 每天工时 |
| `--supplementRequestId` | 无 | 指定补录流程 ID,不传时自动选 |

## 执行步骤

1. 检查 `SYNYI_OA_USERNAME` 和 `SYNYI_OA_PASSWORD`
2. 如果用户明确给了项目编号、工作内容、工时,就用用户给的
3. 否则用默认值: `Y3018005` / `Nexus 开发` / 8 小时
4. 运行:

```bash
cd scripts
node submit-month-worktime.js
```

或带参数:

```bash
node submit-month-worktime.js --supplementRequestId 1058063 --projectCode Y3018005 --content "Nexus 开发" --hours 8
```

5. 读取脚本输出 JSON,向用户汇报:
   - 选的补录流程 ID 和补录区间
   - 成功创建的日期 + 各自的 requestId
   - 跳过的日期 + 原因(尤其是非工作日)

## 输出要求

成功汇报包括:

- 补录流程 requestId 和区间
- 成功的日期清单 + requestId
- 失败的日期清单 + 原因

非工作日被服务端拒绝是预期内的跳过,不要当成异常。

如果一天都没成功,把错误原因原样告诉用户,不要展开解释脚本内部实现。

## 项目映射文件

和 `synyi-oa-worktime-submit` 一样的逻辑:

- `data/project-aliases.example.json` 是模板
- 用户首次使用先复制成 `data/project-aliases.json` 并填入自己的项目信息
- 本 Skill 默认硬编码 `Y3018005`,如果用户要换项目,可以从 `project-aliases.json` 里挑一个项目编号通过 `--projectCode` 传入
