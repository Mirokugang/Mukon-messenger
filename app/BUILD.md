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

# Build release APK (for production)
npm run build:release
```

**Output:**
- Debug: `app/mukon-debug.apk`
- Release: `app/mukon-release.apk`

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
1. Runs Gradle build (assembleDebug or assembleRelease)
2. Copies APK from `android/app/build/outputs/apk/...` to `app/`
3. Renames to clean name (`mukon-debug.apk` or `mukon-release.apk`)
4. Shows file size and install command

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

**Build failed:**
```bash
cd android
./gradlew clean
cd ..
npm run build
```

**Metro won't connect:**
```bash
# Clear cache and restart
npm start -- --reset-cache
```
