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
- Copy or clone your dotfiles repo
- Symlink `.zshrc`, `.gitconfig`, `.ssh/`, etc.
- Or use a tool like `mackup` or `chezmoi` to manage this

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
Generate a new key or restore from backup:
```bash
ssh-keygen -t ed25519 -C "you@example.com"
gh ssh-key add ~/.ssh/id_ed25519.pub --title "New Mac"
```

---

## Phase 4: Language Runtimes

Use `mise` to manage versions cleanly:
```bash
mise install node@lts
mise install python@latest
```

Or install directly via brew if you prefer system-level:
```bash
brew install node python
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

Adjust this list to your actual app preferences.

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
