#!/bin/bash
# Self-healing check for the MedicentrIQ dev stack, run by launchd every 60s.
# Covers failure modes launchd's KeepAlive can't see — e.g. `node --watch`
# whose supervisor is alive while the actual server child has died.
#
# Probes:
#  - APIs (fast servers): HTTP — any response counts as alive.
#  - Next dev servers: TCP only. A dev server that accepts connections but is
#    slow to respond is COMPILING, not dead — kicking it mid-compile corrupts
#    .next and makes things worse.
# A failing probe is re-checked 15s later before acting, and each service is
# kickstarted at most once per 10 minutes (cooldown) to prevent thrash loops.
set -u

UID_NUM=$(id -u)
PREFIX="com.medicentriq"
LOG="$HOME/Library/Logs/medicentriq/watchdog.log"
COOLDOWN_DIR="$HOME/Library/Application Support/medicentriq/watchdog-cooldown"
mkdir -p "$COOLDOWN_DIR"

probe_http() {
  [ "$(curl -s -o /dev/null -w '%{http_code}' -m 8 "$1" 2>/dev/null || echo 000)" != "000" ]
}

probe_tcp() {
  nc -z -G 3 127.0.0.1 "$1" >/dev/null 2>&1
}

heal() {
  local name="$1"
  local marker="$COOLDOWN_DIR/$name"
  # Cooldown: at most one kickstart per service per 10 minutes.
  if [ -f "$marker" ] && [ -n "$(find "$marker" -mmin -10 2>/dev/null)" ]; then
    echo "$(date '+%F %T') $name unresponsive but in cooldown — skipping" >> "$LOG"
    return
  fi
  touch "$marker"
  echo "$(date '+%F %T') $name unresponsive — kickstarting" >> "$LOG"
  launchctl kickstart -k "gui/$UID_NUM/$PREFIX.$name" 2>> "$LOG"
}

check_http() {
  local name="$1" url="$2"
  probe_http "$url" && return 0
  sleep 15
  probe_http "$url" && return 0
  heal "$name"
}

check_tcp() {
  local name="$1" port="$2"
  probe_tcp "$port" && return 0
  sleep 15
  probe_tcp "$port" && return 0
  heal "$name"
}

check_http core-api "http://127.0.0.1:4100/health"
check_http gateway  "http://127.0.0.1:4105/health"
check_http ngrok    "http://127.0.0.1:4040/api/tunnels"
check_tcp  staff-web     3200
check_tcp  patient-web   3201
check_tcp  clinician-pwa 3203
