# Troubleshooting

[← Back to README](../README.md) · [Screens](SCREENS.md) · [API](API.md)

Find your symptom in the table, then open the matching section below for the exact commands.
All commands are for **Windows PowerShell**; the project is assumed to be at `C:\co`.

> 💡 **Never paste the ```` ``` ```` fence lines** (or the word `powershell` after them) from this guide into PowerShell — copy only the commands inside the grey box. Pasting ```` ``` ```` gives errors like *"The term '```' is not recognized"* or leaves PowerShell waiting at `>>` (press **Ctrl+C** to escape).

## Quick health check (run this first)

```powershell
adb devices                                  # phone listed as "device"?
netstat -ano | findstr :8000                 # backend listening?
netstat -ano | findstr :8081                 # Metro listening?
adb reverse --list                           # tcp:8000 and tcp:8081 forwarded?
curl.exe http://localhost:8000/              # {"app":"Compliance One API","status":"online",...}
echo $env:EXPO_PUBLIC_API_URL                # must end with /api/v1
```

## Symptom → cause → fix

| # | Symptom | Cause | Fix |
|---|---|---|---|
| 1 | Build fails with many `undefined symbol: std::__ndk1::…` / `ld.lld: error` / libc++ link errors | Android SDK/NDK in a path **with spaces** (e.g. `C:\Users\First Last\AppData\Local\Android\Sdk`) | [Move SDK to `C:\Android\Sdk`](#1-ndk-link-errors-spaces-in-sdk-path) |
| 2 | `Filename longer than 260 characters`, CMake/Ninja "file not found" in `.cxx` | Project in a long path | Clone to `C:\co` ([details](#2-long-paths)) |
| 3 | `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | Installed app signed with a different key (other PC / other build type) | [Uninstall then install](#3-install_failed_update_incompatible) (data on the phone is lost) |
| 4 | `DELETE_FAILED_INTERNAL_ERROR` when uninstalling | Package manager glitch / app still running / multiple users | [Force stop, uninstall for user 0, reboot](#4-delete_failed_internal_error) |
| 5 | App installed but no icon / Play Protect blocks it | Launcher not refreshed; Play Protect warning for non-Play APKs | [`monkey` launch, *Install anyway*](#5-app-not-showing--play-protect) |
| 6 | "Server not connected" / "Could not reach the server" / Login spins | Backend down, `adb reverse` missing, URL missing `/api/v1`, backend on 127.0.0.1 only | [Server connection checklist](#6-server-not-connected) |
| 7 | Register / Login returns **404** | `EXPO_PUBLIC_API_URL` missing `/api/v1` | Set `http://localhost:8000/api/v1`, restart Metro with `--clear` |
| 8 | Sync log: pull **404 "Business not found"** | Server never stored this phone's business (first push rejected / DB reset) | **Fixed** — the app re-sends the business and retries. Just keep the server reachable ([details](#8-sync-pull-404-business-not-found)) |
| 9 | `Failed to connect to localhost:8000` / `localhost:8081` | Cable re-plugged (reverse lost) or backend/Metro stopped | `adb reverse tcp:8000 tcp:8000; adb reverse tcp:8081 tcp:8081`, restart backend/Metro |
| 10 | Warning: `i18next: Your environment seems not to be Intl API compatible` | Hermes lacks `Intl.PluralRules` | Already fixed by `import 'intl-pluralrules'` in `mobile/index.ts` — run `npm install`, restart with `--clear` |
| 11 | Voice: "Speech model not available", "No speech detected", nothing happens | No Google speech service / offline Tamil pack, no internet, mic permission | [Voice checklist](#11-voice-not-working) |
| 12 | Voice adds the same word/item several times | Old build joined speech alternatives and repeated finals | Fixed (one final per phrase, de-duplicated). `git pull`, reload Metro (`r`) |
| 13 | `An Application Control policy has blocked this file` (uvicorn.exe, alembic.exe, pytest.exe) | Windows Application Control blocks `.venv\Scripts\*.exe` | Use `python -m uvicorn …`, `python -m alembic …`, `python -m pytest` |
| 14 | "Docker is not running" / should I install Docker? | — | Docker is **not needed**. Run the backend with Python |
| 15 | PowerShell shows `>>` or "'```' is not recognized" | Pasted the markdown fence lines | Ctrl+C; copy only the commands |
| 16 | Weird Gradle errors after updates, `Could not delete …\build`, daemon hangs | Stale Gradle daemon / CMake cache | [Gradle cleanup](#16-gradle-daemon--cache-cleanup) |
| 17 | Old screens/strings still show, "Unable to resolve module", red box after `git pull` | Metro cache | `npx expo start --dev-client --clear` (and `npm install`) |
| 18 | `No space left on device` / build fails at 99 % / PC very slow | Low disk space (old SDK copy, Gradle caches) | [Free disk space](#18-low-disk-space) |
| 19 | `JAVA_HOME is not set and no 'java' command could be found` / wrong Java version | JDK 17 missing or not on `JAVA_HOME` | [Set JAVA_HOME](#19-java_home-not-set) |
| 20 | `Address already in use` / `[Errno 10048]` on 8000, Metro asks to use another port for 8081 | Old backend/Metro still running | [Free the port](#20-port-8000-or-8081-in-use) |
| 21 | Want a completely clean phone database | — | [Data reset](#21-reset-the-phones-data) (**deletes all phone data**) |
| 22 | Keyboard covers the input box | Older build / a screen without keyboard handling | `git pull` + reload; scroll the screen up; on the Bill tab type then tap **+** |
| 23 | GST rate looks wrong for an HSN | Offline HSN list shows **typical** post-Sept-2025 rates | Edit the GST % on the item; confirm with your auditor/CA ([details](#23-hsn--gst-rate-disclaimer)) |
| 24 | `SDK location not found. Define a valid SDK location with an ANDROID_HOME environment variable or by setting the sdk.dir path in local.properties` | `local.properties` missing | `Set-Content C:\co\mobile\android\local.properties "sdk.dir=C:\\Android\\Sdk"` |
| 25 | `adb devices` shows `unauthorized` or nothing | USB debugging prompt not accepted / charge-only cable / driver | Accept the prompt, choose *File transfer*, try another cable/port, `adb kill-server; adb start-server` |
| 26 | `Activate.ps1 cannot be loaded because running scripts is disabled` | PowerShell execution policy | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` or use `.\.venv\Scripts\python.exe -m …` |
| 27 | Backend: `RuntimeError: SECRET_KEY must be set when ENV is not development` | `ENV=production` without a key | Set `SECRET_KEY` in `backend\.env`, or `ENV=development` locally |
| 28 | Backend: `no such table: users` | Migrations not run for this DB file | `cd C:\co\backend; python -m alembic upgrade head` |
| 29 | All requests 401 after restarting the server with a new `SECRET_KEY` | Old tokens signed with the old key | Log out and log in again on the phone |
| 30 | Release APK can't sync | APK built without the right `EXPO_PUBLIC_API_URL`, or phone can't reach the PC | Rebuild with the URL set; for USB use `adb reverse tcp:8000 tcp:8000` (see README §6C/§6E) |

---

## Details

### 1. NDK link errors (spaces in SDK path)

Why: the NDK's CMake/Ninja linker command lines break at spaces, so libc++ symbols are not found.

```powershell
# 1) Create the new folder and move/copy the SDK (or reinstall it there from Android Studio SDK Manager)
New-Item -ItemType Directory -Force C:\Android | Out-Null
robocopy "$env:LOCALAPPDATA\Android\Sdk" "C:\Android\Sdk" /E /MT:16
# 2) Point everything at it
[Environment]::SetEnvironmentVariable("ANDROID_HOME", "C:\Android\Sdk", "User")
[Environment]::SetEnvironmentVariable("ANDROID_SDK_ROOT", "C:\Android\Sdk", "User")
Set-Content C:\co\mobile\android\local.properties "sdk.dir=C:\\Android\\Sdk"
# 3) Reopen PowerShell, then clean and rebuild
cd C:\co\mobile\android; .\gradlew --stop
Remove-Item -Recurse -Force .\app\.cxx, .\app\build, .\build -ErrorAction SilentlyContinue
cd C:\co\mobile; npx expo run:android
```

Also update Android Studio: *Settings → Languages & Frameworks → Android SDK → Android SDK Location* = `C:\Android\Sdk`.
After a successful build you can delete the old copy (see [18](#18-low-disk-space)).

### 2. Long paths

```powershell
cd C:\
git clone https://github.com/Compliance-One/Compilance_One-Application.git co
cd C:\co; git checkout feat/backend-sqlite
```
Optional (admin PowerShell): enable long paths in Windows and git:
```powershell
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name LongPathsEnabled -Value 1 -PropertyType DWORD -Force
git config --global core.longpaths true
```

### 3. INSTALL_FAILED_UPDATE_INCOMPATIBLE

The phone has `com.complianceone.app` signed with a different key. Android will not replace it.

> ⚠️ Uninstalling deletes the app's data on the phone (bills, items). If the server is running and the phone was syncing, open the old app once with the server reachable and wait ~30 s so everything is pushed first.

```powershell
adb uninstall com.complianceone.app
adb install C:\co\mobile\android\app\build\outputs\apk\release\app-release.apk
# or for the dev build:
cd C:\co\mobile; npx expo run:android
```

### 4. DELETE_FAILED_INTERNAL_ERROR

```powershell
adb shell am force-stop com.complianceone.app
adb shell pm uninstall --user 0 com.complianceone.app
adb uninstall com.complianceone.app
```
If it still fails: uninstall from the phone (*Settings → Apps → Compliance One → Uninstall*; also check *Second space/Dual apps*), or reboot the phone (`adb reboot`) and try again.

### 5. App not showing / Play Protect

```powershell
adb shell pm list packages | findstr complianceone       # is it installed?
adb shell monkey -p com.complianceone.app -c android.intent.category.LAUNCHER 1
```
Play Protect "Blocked by Play Protect / unsafe app" → *More details → Install anyway*. For WhatsApp/Drive installs, allow *Install unknown apps* for that app. On Xiaomi/Redmi also turn on *Developer options → Install via USB*.

### 6. "Server not connected"

Work through this checklist:

- [ ] Backend running **with `--host 0.0.0.0`**: `python -m uvicorn app.main:app --host 0.0.0.0 --port 8000`
- [ ] `curl.exe http://localhost:8000/` on the PC shows `"status":"online"`
- [ ] Cable mode: `adb reverse tcp:8000 tcp:8000` (again after every re-plug), and `adb reverse --list` shows it
- [ ] `EXPO_PUBLIC_API_URL` = `http://localhost:8000/api/v1` (cable) or `http://<PC-IP>:8000/api/v1` (Wi‑Fi) — **with `/api/v1`**
- [ ] Metro restarted with `--clear` after changing the URL (`EXPO_PUBLIC_*` values are read when the bundle is built)
- [ ] Wi‑Fi mode: phone browser can open `http://<PC-IP>:8000/` — if not, firewall or office Wi‑Fi isolation → allow Python in Windows Firewall (Private), or use the cable/hotspot
- [ ] Release APK: the URL was set **before** `gradlew assembleRelease`

Remember: billing works without the server. Only login and sync need it.

### 8. Sync pull 404 "Business not found"

Seen in the Metro log as `[sync] cycle failed … 404`. It meant the server had no row for the phone's business (e.g. the server DB was deleted or the first push failed). Current code handles it: the phone logs `[sync] business missing on server; re-sending it`, re-queues the business and the failed items, pushes, and pulls again. Make sure you are logged in with the same account and the server is reachable; within one or two 30‑second cycles it settles.

### 11. Voice not working

- [ ] Microphone permission allowed (*Settings → Apps → Compliance One → Permissions → Microphone*)
- [ ] **Google** app installed and updated (it provides the speech service: `com.google.android.googlequicksearchbox`)
- [ ] Internet ON for the best Tamil recognition
- [ ] For offline: Google app → *Settings → Voice → Offline speech recognition* (or *Languages*) → download **Tamil (India)** and **English (India)**
- [ ] Speak after the 🎤 turns into ⏹, one phrase at a time, close to the phone; "No speech detected" means it heard nothing in time — tap again
- [ ] Choose the matching chip (தமிழ் / English)
- [ ] You can always type the same phrase in the box and tap **+**

### 16. Gradle daemon / cache cleanup

```powershell
cd C:\co\mobile\android
.\gradlew --stop
Remove-Item -Recurse -Force .\app\.cxx, .\app\build, .\build, .\.gradle -ErrorAction SilentlyContinue
cd C:\co\mobile
npx expo run:android
```
Deep clean (re-downloads dependencies, slow):
```powershell
Remove-Item -Recurse -Force "$env:USERPROFILE\.gradle\caches" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force C:\co\mobile\node_modules; cd C:\co\mobile; npm install
```

### 18. Low disk space

```powershell
Get-PSDrive C                                                   # free space
# Old SDK copy after moving to C:\Android\Sdk (check C:\Android\Sdk works first!)
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\Android\Sdk"
# Gradle caches and build outputs
Remove-Item -Recurse -Force "$env:USERPROFILE\.gradle\caches" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force C:\co\mobile\android\app\build, C:\co\mobile\android\app\.cxx -ErrorAction SilentlyContinue
# Unused NDK versions / system images: Android Studio → SDK Manager → untick and Apply
```
A build needs roughly 10 GB free.

### 19. JAVA_HOME not set

```powershell
Get-ChildItem "C:\Program Files\Microsoft" -Directory | Where-Object Name -like "jdk-17*"
[Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Microsoft\<jdk-17-folder-from-above>", "User")
```
Close and reopen PowerShell; `java -version` must say 17. If another Java comes first, remove older Java entries from *System Properties → Environment Variables → Path*.

### 20. Port 8000 or 8081 in use

```powershell
netstat -ano | findstr :8000
netstat -ano | findstr :8081
taskkill /PID 12345 /F          # use the number in the last column
```

### 21. Reset the phone's data

> ⚠️ This **erases everything** the app stored on the phone (bills, items, customers, login). Unsynced changes are lost.

```powershell
adb shell pm clear com.complianceone.app
```
To reset the server instead: stop uvicorn, delete `C:\co\backend\data\compliance_one.db`, run `python -m alembic upgrade head`, start again (phones will re-send their data after login).

### 23. HSN / GST rate disclaimer

The offline HSN list (`mobile/src/data/hsn.json`) and the hardware catalogue use **typical** GST rates mapped to the slabs in force after **September 2025** (5 % / 18 % / 40 %, with some items at 0 %). Rates depend on exact product description; the app always lets you change the GST % per item and per bill line. Confirm with your auditor/CA before filing.

---

## Useful logs

```powershell
# App JavaScript logs (sync messages start with [sync])
adb logcat *:S ReactNative:V ReactNativeJS:V
# Native crash logs
adb logcat *:E
# Backend: read the uvicorn window — every request and Python traceback is printed there
```

Still stuck? Note the exact error text, which mode you are in (cable / Wi‑Fi / release APK), and the output of the [quick health check](#quick-health-check-run-this-first).
