# Tempo — Claude Instructions

## Version bumping

**Always bump the version in `package.json` (and `package-lock.json`) before pushing to `main`.**

The CI workflow tags and publishes whatever version is already in `package.json`. It does not bump automatically. If you push without bumping, the tag already exists and the publish will be skipped.

Bump rules (Conventional Commits):
- `feat:` → minor bump (`npm version minor --no-git-tag-version`)
- `fix:`, `chore:`, `docs:`, `refactor:`, `perf:`, `style:`, `test:` → patch bump (`npm version patch --no-git-tag-version`)
- `BREAKING CHANGE` or `feat!:` / `fix!:` → major bump (`npm version major --no-git-tag-version`)

Include `package.json` and `package-lock.json` in the same commit as the changes (not a separate chore commit).
