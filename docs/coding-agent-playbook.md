# Coding Agent Playbook

## Cost & Routing Rules

- **Grok/OpenCode (`opencode run`)**: Default for ALL code fixes. Cheap ($2-6/M tokens) vs Claude ($5-25/M). User explicitly said: "that request to claud cost me $$ and grok would have been basically free. going forward stick to the plan on where to send the requests."
- **Claude Code**: Only for complex multi-file refactors, architecture changes, or when Grok hits API availability issues (HTTP 429/503). Claude's $20+ per session costs add up.

## When to Use Each

### Grok/OpenCode first choice:
- Simple bug fixes (single-file edits)
- CSS/font changes
- Missing DOM elements
- Dead code removal
- Console.log cleanup
- .gitignore fixes
- Any task that's well-scoped to 1-3 files

### Claude Code (secondary):
- Renaming concepts across entire codebase
- Multi-file refactors
- Complex architecture changes
- When Grok hits upstream API errors after 2+ retries

## Commands
- One-shot: `opencode run 'do X' --workdir /home/spahrep/portalcolosseum`
- Background: `opencode` (pty=true, background=true) then `process submit`
- Auth: `opencode auth login`
