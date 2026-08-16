#!/bin/bash
# MedicentrIQ dev services under launchd — install once, they start at login
# and auto-restart on crash. Usage:
#   scripts/dev-services.sh install    # (re)generate + load all agents
#   scripts/dev-services.sh status     # health of every service
#   scripts/dev-services.sh restart <name|all>
#   scripts/dev-services.sh logs <name>
#   scripts/dev-services.sh uninstall  # remove all agents
#
# Services: core-api(4100) gateway(4105) ngrok staff-web(3200)
#           patient-web(3201) clinician-pwa(3203)
set -euo pipefail

REPO="/Users/maverick/Documents/HealthOs/MedicentrIQ"
NODE_BIN="/Users/maverick/.nvm/versions/node/v22.14.0/bin"
AGENTS_DIR="$HOME/Library/LaunchAgents"
LOG_DIR="$HOME/Library/Logs/medicentriq"
PREFIX="com.medicentriq"
UID_NUM=$(id -u)
SERVICES=(core-api gateway ngrok staff-web patient-web clinician-pwa)

mkdir -p "$AGENTS_DIR" "$LOG_DIR"

plist_path() { echo "$AGENTS_DIR/$PREFIX.$1.plist"; }

# ---- plist generation --------------------------------------------------------
write_plist() {
  local name="$1" wd="$2" logname="$1"
  shift 2
  local args=""
  for a in "$@"; do args+="    <string>$a</string>
"; done
  cat > "$(plist_path "$name")" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$PREFIX.$name</string>
  <key>ProgramArguments</key>
  <array>
$args  </array>
  <key>WorkingDirectory</key><string>$wd</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>$LOG_DIR/$logname.log</string>
  <key>StandardErrorPath</key><string>$LOG_DIR/$logname.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>$NODE_BIN:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
$(env_block "$name")  </dict>
</dict>
</plist>
PLIST
}

env_block() {
  case "$1" in
    gateway)
      cat <<'EOF'
    <key>CORE_API_URL</key><string>http://127.0.0.1:4100</string>
    <key>SERVICE_API_KEY</key><string>core_demo_service_key</string>
    <key>PORT</key><string>4105</string>
EOF
      ;;
    *) : ;;
  esac
}

write_watchdog_plist() {
  # ~/Documents is TCC-protected: /bin/bash under launchd gets "Operation not
  # permitted" reading it. Install the watchdog into ~/Library instead.
  local wd_script="$HOME/Library/Application Support/medicentriq/dev-watchdog.sh"
  mkdir -p "$(dirname "$wd_script")"
  cp "$REPO/scripts/dev-watchdog.sh" "$wd_script"
  chmod +x "$wd_script"
  cat > "$AGENTS_DIR/$PREFIX.watchdog.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$PREFIX.watchdog</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$wd_script</string>
  </array>
  <key>StartInterval</key><integer>60</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$LOG_DIR/watchdog.log</string>
  <key>StandardErrorPath</key><string>$LOG_DIR/watchdog.log</string>
</dict>
</plist>
PLIST
}

generate_all() {
  write_watchdog_plist
  write_plist core-api "$REPO/core-api" \
    "$NODE_BIN/node" --env-file=.env --watch --import tsx src/main.ts
  write_plist gateway "$REPO/integration-gateway" \
    "$NODE_BIN/node" --import tsx src/main.ts
  write_plist ngrok "$REPO" \
    "$NODE_BIN/ngrok" http 4105 --url=https://feeble-unlisted-earthly.ngrok-free.dev --log stdout
  write_plist staff-web "$REPO/staff-web" "$NODE_BIN/npm" run dev
  write_plist patient-web "$REPO/patient-web" "$NODE_BIN/npm" run dev
  write_plist clinician-pwa "$REPO/clinician-pwa" "$NODE_BIN/npm" run dev
}

load_one()   { launchctl bootstrap "gui/$UID_NUM" "$(plist_path "$1")" 2>/dev/null || launchctl load "$(plist_path "$1")"; }
unload_one() { launchctl bootout "gui/$UID_NUM/$PREFIX.$1" 2>/dev/null || launchctl unload "$(plist_path "$1")" 2>/dev/null || true; }

case "${1:-status}" in
  install)
    generate_all
    for s in "${SERVICES[@]}"; do
      unload_one "$s"
      load_one "$s"
      echo "loaded  $PREFIX.$s"
    done
    ;;
  uninstall)
    for s in "${SERVICES[@]}"; do
      unload_one "$s"
      rm -f "$(plist_path "$s")"
      echo "removed $PREFIX.$s"
    done
    ;;
  restart)
    target="${2:-all}"
    for s in "${SERVICES[@]}"; do
      if [ "$target" = "all" ] || [ "$target" = "$s" ]; then
        launchctl kickstart -k "gui/$UID_NUM/$PREFIX.$s" && echo "restarted $s"
      fi
    done
    ;;
  logs)
    tail -n 60 -f "$LOG_DIR/${2:?usage: dev-services.sh logs <name>}.log"
    ;;
  status)
    health_url() {
      case "$1" in
        core-api) echo "http://127.0.0.1:4100/health" ;;
        gateway) echo "http://127.0.0.1:4105/health" ;;
        ngrok) echo "http://127.0.0.1:4040/api/tunnels" ;;
        staff-web) echo "http://127.0.0.1:3200" ;;
        patient-web) echo "http://127.0.0.1:3201" ;;
        clinician-pwa) echo "http://127.0.0.1:3203" ;;
      esac
    }
    printf '%-15s %-8s %s\n' SERVICE PID HEALTH
    for s in "${SERVICES[@]}"; do
      pid=$(launchctl print "gui/$UID_NUM/$PREFIX.$s" 2>/dev/null | awk '/pid = /{print $3}' || true)
      code=$(curl -s -o /dev/null -w '%{http_code}' -m 4 "$(health_url "$s")" 2>/dev/null || echo "000")
      printf '%-15s %-8s %s\n' "$s" "${pid:--}" "HTTP $code"
    done
    ;;
  *)
    echo "usage: $0 install|uninstall|status|restart <name|all>|logs <name>"
    exit 1
    ;;
esac
