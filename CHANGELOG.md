# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0]

### Added

- MCP server over stdio, built on discord.js and the MCP TypeScript SDK, running on Bun
- Read-only tools: `list_guilds`, `get_guild`, `list_channels`, `list_roles`, `list_members`, `get_member`
- Default server resolution through `DISCORD_GUILD_ID`, or the only server the bot is in
- Environment validation with clear startup errors
- Docker image running as a non-root user, token passed at runtime through `--env-file`
