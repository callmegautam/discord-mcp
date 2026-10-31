# Records docs/demo/demo.gif: Claude Code auditing a server and setting up a layout from a template.
# Run it from the repo root against a throwaway server only, ALLOWED_GUILD_IDS in mcp.json locks the
# MCP server to it:
#   DEMO_GUILD_ID=your-test-server-id DISCORD_MCP_ENV=/absolute/path/to/.env vhs docs/demo/demo.tape

Output docs/demo/demo.gif

Require claude
Require docker

Set Shell "bash"
Set FontSize 15
Set Width 1280
Set Height 760
Set Padding 16
Set Theme "Catppuccin Mocha"
Set TypingSpeed 35ms
Set WindowBar Colorful

Hide
# An empty directory, so no project instructions reach the session, and a clean environment, so it
# doesn't pick up settings from a Claude Code session it runs inside.
# Every read-only tool is allowed, the only write is apply_template.
Type@1ms 'DEMO="$PWD/docs/demo" && cd "$(mktemp -d -t my-server.XXXX)" && '
Type@1ms 'env -i HOME="$HOME" PATH="$PATH" TERM=xterm-256color COLORTERM=truecolor LANG=en_US.UTF-8 '
Type@1ms 'DEMO_GUILD_ID="$DEMO_GUILD_ID" DISCORD_MCP_ENV="$DISCORD_MCP_ENV" '
Type@1ms 'claude --permission-mode default --strict-mcp-config --mcp-config "$DEMO/mcp.json" --settings "$DEMO/settings.json"'
Enter
Wait+Screen@60s /trust this folder/
Sleep 1500ms
Down
Sleep 500ms
Enter
Wait+Screen@60s /for shortcuts/
Sleep 1s
Ctrl+L
Sleep 500ms
Show

Type "Audit the permissions on my Discord server. Keep it to five short bullets."
Sleep 500ms
Enter
Wait+Screen@30s /esc to interrupt/
Wait+Screen@180s /for shortcuts/
Sleep 8s

Type "Now set it up for a study group with a server template: a Tutor role, a Study category with #homework and #resources, and a #tutors channel only tutors can see. Dry run it first."
Sleep 500ms
Enter
Wait+Screen@30s /esc to interrupt/
Wait+Screen@240s /for shortcuts/
Sleep 8s

Type "Looks good, apply the template."
Sleep 500ms
Enter
Wait+Screen@30s /esc to interrupt/
Wait+Screen@240s /for shortcuts/
Sleep 10s

Hide
Ctrl+C
Ctrl+C
