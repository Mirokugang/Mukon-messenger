# Mukon Messenger - Build Guide

## Simplified Build Workflow

All commands run from the `app/` folder - no need to change directories!

### Development (Metro Server)

```bash
# Start Metro bundler
npm start

# Or with cache reset
npm start -- --reset-cache
```

### Building APKs

```bash
# Build debug APK (for testing)
npm run build

# Build with gradle clean (for native module changes)
npm run build:clean

# Build with expo prebuild --clean (nuclear option)
npm run build:prebuild

# Build release APK (for production)
npm run build:release

# Build release with gradle clean
npm run build:release:clean

# Build release with expo prebuild --clean
npm run build:release:prebuild
```

**Output:**
- Debug: `app/mukon-debug.apk`
- Release: `app/mukon-release.apk`

**When to use each:**

| Command | Use Case | Speed | When to Use |
|---------|----------|-------|-------------|
| `npm run build` | Regular builds | ⚡ Fast | JS/TS changes, 99% of development |
| `npm run build:clean` | gradle clean | 🐢 Slower | After installing native modules, weird build errors |
| `npm run build:prebuild` | Regenerate native | 🐌 Slowest | Changed app.json, native config issues, major Expo upgrades |

**Decision tree:**
1. **JS/TS changes only?** → `npm run build`
2. **Added native module?** → `npm run build:clean`
3. **Changed app.json or config?** → `npm run build:prebuild`
4. **Still broken?** → `npm run build:prebuild`

### Installing APKs

```bash
# Deploy debug build to device
npm run deploy

# Deploy release build to device
npm run deploy:release

# Or use adb directly
adb install -r mukon-debug.apk
```

### Full Workflow Example

```bash
# 1. Build
npm run build

# 2. Deploy to device
npm run deploy

# 3. Start Metro (in separate terminal)
npm start
```

## Build Script Details

The custom build script (`build-apk.sh`) does:
1. Optionally runs `gradle clean` if second argument is "clean"
2. Runs Gradle build (assembleDebug or assembleRelease)
3. Copies APK from `android/app/build/outputs/apk/...` to `app/`
4. Renames to clean name (`mukon-debug.apk` or `mukon-release.apk`)
5. Shows file size and install command

**Usage:**
```bash
./build-apk.sh debug       # Regular build
./build-apk.sh debug clean # Clean + build
```

## Old vs New

**Old workflow (annoying):**
```bash
npm run android:build
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

**New workflow (easy):**
```bash
npm run build
npm run deploy
```

## Notes

- APK files are gitignored (won't be committed)
- Script is executable (`chmod +x build-apk.sh`)
- Works from `app/` folder only
- Release builds require signing config in `android/app/build.gradle`

## Troubleshooting

**Permission denied:**
```bash
chmod +x build-apk.sh
```

**Build failed (try gradle clean first):**
```bash
npm run build:clean
```

**Native module not found (ExpoClipboard, etc.):**
```bash
# Try gradle clean first
npm run build:clean
npm run deploy

# If still broken, regenerate native folders
npm run build:prebuild
npm run deploy
```

**Changed app.json or config plugins:**
```bash
# Regenerate /android and /ios from app.json
npm run build:prebuild
npm run deploy
```

**Metro won't connect:**
```bash
# Clear cache and restart
npm start -- --reset-cache
```

**When gradle clean isn't enough:**

If you're still having issues after `npm run build:clean`, use the nuclear option:

```bash
npm run build:prebuild
```

⚠️ **Warning:** This deletes and regenerates `/android` and `/ios` folders entirely.

**Only use when:**
- You changed `app.json` (config, plugins, permissions)
- You added native config plugins
- gradle clean didn't fix the issue
- After major Expo SDK upgrades

**Why it's safe for Mukon:**
- Expo manages native code (no custom modifications)
- Minimal native customization
- All config in `app.json`

**Why it's dangerous for apps with custom native code:**
- Deletes custom Java/Kotlin/Swift code
- Deletes custom native modules
- Can break apps with extensive native modifications (like EncryptSIM)
