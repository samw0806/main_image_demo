# AGENTS.md

本文件用于给 Codex 提供本仓库的项目级协作说明。

## 用途

这个仓库主要提供一组项目私有 skills，供 Codex 在当前项目内按需发现和调用。

## Skills 入口

- 本项目的 Codex skills 暴露在 `./.agents/skills/`
- 实际 skill 源文件保留在 `./skills/`
- `./.agents/skills/` 下的目录可以是软链接，用于指向 `./skills/` 中的真实内容，避免重复维护

## 使用约定

- 当用户明确提到某个 skill 名称，或请求明显匹配某个 skill 的适用条件时，优先从 `./.agents/skills/` 加载对应的 `SKILL.md`
- 修改 skill 内容时，优先编辑 `./skills/` 中的源文件
- 新增 skill 时，同步在 `./.agents/skills/` 下补充对应目录或软链接，确保 Codex 可发现
