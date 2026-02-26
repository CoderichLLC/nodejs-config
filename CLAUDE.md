# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm test                          # Run all tests
npm test -- --testPathPattern=Config.test  # Run a single test file
npm run lint                      # Run ESLint
npm run dev                       # Run coderich-dev tooling (e.g. npm run dev npmPublish)
```

## Architecture

This is a single-class library (`src/Config.js`) that provides a general-purpose configuration manager with variable substitution and lazy resolution.

### Core Concepts

**Two internal stores**: The `Config` instance maintains `#config` (the raw/original definition with unresolved template strings) and `#data` (the fully resolved values). `#config` is cloned at write time to prevent external mutation from affecting re-resolution; `#data` is a live reference so callers can mutate arrays/objects by reference.

**Variable substitution syntax**:
- `${namespace:key, fallback}` — looks up `key` in the named namespace from the dictionary; `self` is always reserved and refers to `#config` itself
- `@{functionName:arg1, arg2}` — calls a registered function passed to the constructor
- Substitutions resolve from the inside out (recursive), honoring non-string types when the entire value is a single substitution token
- Depth is capped at 10 to prevent infinite recursion

**Dictionary / `resolve()`**: External namespaces (e.g. `sm`, `env`, `context`) are registered via `config.resolve({ sm: secrets, env: process.env })`. The dictionary is deep-merged and persists across calls. `self` is reserved and cannot be overridden.

**Key notation**: Both dot-notation (`app.name`) and colon-notation (`app:name`) are accepted interchangeably.

**Static utilities**: `Config.parseFile(filepath)` supports `.js`, `.json`, `.yml`/`.yaml`. `Config.parseDir(dir)` recursively builds an object from a directory (files first, then subdirs, alphabetical). `Config.dirPaths(dir)` returns raw file contents as `[{ paths, data }]` for manual YAML stitching. `Config.parseEnv()` and `Config.parseArgs()` flatten env vars / CLI args using `__` as the nesting delimiter.

### Publishing

CI publishes to npm automatically on push to any `release/**` branch via the GitHub Actions workflow (`.github/workflows/publish.yml`), which calls `npm run dev npmPublish`.
