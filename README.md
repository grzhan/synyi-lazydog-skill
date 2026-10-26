# Synyi Lazy Dog Skill

<div align="center">
  <img src="lazy-dog.png" alt="Lazy Dog Logo" width="400" />
</div>


## 功能

- **录入特定日期工时**：指定某一天，快速录入当天的工时。
- **支持研发项目和客户项目**：研发项目使用 `--projectCode`，客户项目可使用 `--customerProjectCode`，或直接传入 `A` 开头的项目编号。
- **自动匹配补录流程录入当月工时**：自动识别补录流程，一键完成当月工时的录入。

## 指令样例

录入特定日期工时：

```
帮我录入 2026-05-26 的工时，项目编号 Y3018005，工作内容 Nexus 联调
```

录入客户项目工时：

```bash
node scripts/submit-one-day.js --date 2026-05-26 --noSupplement --customerProjectCode A3018377 --content "客户项目开发" --hours 8
```

自动匹配补录流程录入当月工时：

```
基于补录流程把这个月的工时都补一下，项目用 Y3018005，工作内容写「Nexus 开发」
```

结合龙虾使用效果更佳。
