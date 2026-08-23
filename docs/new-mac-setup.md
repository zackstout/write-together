# New Mac Setup Plan

## Phase 1: Core Package Management

### Install Homebrew
Homebrew is the foundation. Install it first.

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

After install, follow the printed instructions to add `brew` to your PATH (especially on Apple Silicon, the path is `/opt/homebrew/bin`).

---

## Phase 2: Shell Environment

### Install a modern shell
```bash
brew install zsh fish  # pick one
```

### Install Oh My Zsh (if using zsh)
```bash
sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
```

### Restore dotfiles
Copy these files directly from your old Mac:
- `~/.zshrc` — includes NVM setup, `gpush()`, `cheer`, and `aoc` aliases
- `~/.gitconfig` — includes `ac` alias and your name/email (zackstout@gmail.com)
- `~/.ssh/config` — GitHub SSH config with keychain and ed25519 key

**Note:** Remove `nvm use 21` from `.zshrc` — set a default via `nvm alias default 21` instead.

---

## Phase 3: Developer Tools

### Command-line essentials
```bash
brew install git gh curl wget jq tree bat eza ripgrep fzf mise
```

- `gh` — GitHub CLI
- `bat` — better `cat`
- `eza` — better `ls`
- `ripgrep` — fast grep
- `fzf` — fuzzy finder
- `mise` — runtime version manager (Node, Python, Ruby, etc.)

### Git config
```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
git config --global init.defaultBranch main
```

### SSH keys
**Option A (recommended): Copy existing key** — transfer `~/.ssh/id_ed25519` and `~/.ssh/id_ed25519.pub` from old Mac via AirDrop or encrypted drive. No GitHub changes needed.

**Option B: Generate a fresh key:**
```bash
ssh-keygen -t ed25519 -C "zackstout@gmail.com"
gh ssh-key add ~/.ssh/id_ed25519.pub --title "New Mac"
```

Skip copying `known_hosts` — it regenerates automatically.

---

## Phase 4: Language Runtimes

Use NVM to manage Node versions:
```bash
brew install nvm
```

Then add to `.zshrc`:
```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
```

Then install Node and set the default:
```bash
nvm install 21
nvm alias default 21
```

---

## Phase 5: GUI Apps via Homebrew Cask

```bash
brew install --cask \
  visual-studio-code \
  cursor \
  warp \
  arc \
  1password \
  raycast \
  imageoptim \
  rectangle
```

### What each app does

| App | Purpose | Size |
|-----|---------|------|
| VS Code | Code editor, huge extension ecosystem | ~400 MB |
| Cursor | AI-first code editor built on VS Code | ~400 MB |
| Warp | Modern terminal with AI command suggestions | ~200 MB |
| Arc | Browser with tab/space organization | ~300 MB |
| 1Password | Password manager — passwords, SSH keys, env vars | ~100 MB |
| Raycast | Replaces Spotlight — app launcher, clipboard history, window management | ~100 MB |
| ImageOptim | Drag-and-drop image compression for web assets | ~20 MB |
| Rectangle | Window snapping/tiling via keyboard shortcuts | ~5 MB |

Total install footprint: ~1.5 GB.

### Security notes

- **1Password** — end-to-end encrypted, well-audited. No concern; improves your security posture.
- **Raycast** — supports third-party extensions. Stick to official or widely-used extensions.
- **Arc** — collects telemetry by default. Turn it off in Settings after install.
- **Cursor** — sends code to AI providers (Anthropic, OpenAI) for completions. Fine for personal projects; check your NDA before using on client code.
- **Warp** — sends terminal data for AI features. Same caveat as Cursor.
- **VS Code, ImageOptim, Rectangle** — no notable concerns.

---

## Phase 6: macOS System Preferences

These are manual steps in System Settings:

- **Dock**: auto-hide, remove unused apps
- **Keyboard**: key repeat rate to fast, delay to short
- **Trackpad**: tap to click, three-finger drag
- **Accessibility > Pointer Control**: trackpad options
- **Security**: FileVault on, Firewall on
- **Sharing**: turn off what you don't need

Optionally, script these with `defaults write`:
```bash
defaults write com.apple.dock autohide -bool true
defaults write NSGlobalDomain KeyRepeat -int 2
defaults write NSGlobalDomain InitialKeyRepeat -int 15
killall Dock
```

---

## Phase 7: Claude Code

```bash
npm install -g @anthropic-ai/claude-code
```

Restore your Claude Code config:
- `~/.claude/settings.json`
- `~/.claude/settings.local.json`
- `~/.claude/CLAUDE.md`
- `~/.claude/keybindings.json`

---

## Phase 8: Project Restore

1. Clone your repos
2. Run `npm install` / `pip install` / etc. per project
3. Restore any `.env` files from your secrets manager (e.g. 1Password)

---

## Checklist Summary

- [ ] Homebrew installed and in PATH
- [ ] Shell configured with dotfiles
- [ ] Git configured with SSH key added to GitHub
- [ ] `mise` installed and language runtimes set up
- [ ] GUI apps installed
- [ ] macOS system preferences tuned
- [ ] Claude Code installed and config restored
- [ ] Repos cloned and dependencies installed
