#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="$ROOT_DIR/.commentx-dev.pid"
LOG_FILE="$ROOT_DIR/.commentx-dev.log"
HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-4173}"
RUNNING_PID=""

load_running_pid() {
  if [[ ! -f "$PID_FILE" ]]; then
    RUNNING_PID=""
    return
  fi
  local current_pid
  current_pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -z "$current_pid" ]]; then
    rm -f "$PID_FILE"
    RUNNING_PID=""
    return
  fi
  if kill -0 "$current_pid" 2>/dev/null; then
    RUNNING_PID="$current_pid"
  else
    rm -f "$PID_FILE"
    RUNNING_PID=""
  fi
}

start_service() {
  load_running_pid
  if [[ -n "$RUNNING_PID" ]]; then
    echo "服务已在运行，PID: $RUNNING_PID"
    exit 0
  fi

  cd "$ROOT_DIR"
  nohup npm run dev -- --host "$HOST" --port "$PORT" >"$LOG_FILE" 2>&1 &
  local new_pid="$!"
  echo "$new_pid" > "$PID_FILE"
  sleep 1

  if kill -0 "$new_pid" 2>/dev/null; then
    echo "服务启动成功"
    echo "PID: $new_pid"
    echo "URL: http://localhost:$PORT/"
    echo "日志: $LOG_FILE"
  else
    rm -f "$PID_FILE"
    echo "服务启动失败"
    tail -n 40 "$LOG_FILE" || true
    exit 1
  fi
}

stop_service() {
  load_running_pid
  if [[ -z "$RUNNING_PID" ]]; then
    echo "服务未运行"
    exit 0
  fi

  kill "$RUNNING_PID" 2>/dev/null || true
  for _ in {1..20}; do
    if ! kill -0 "$RUNNING_PID" 2>/dev/null; then
      rm -f "$PID_FILE"
      echo "服务已停止"
      exit 0
    fi
    sleep 0.2
  done

  kill -9 "$RUNNING_PID" 2>/dev/null || true
  rm -f "$PID_FILE"
  echo "服务已强制停止"
}

show_status() {
  load_running_pid
  if [[ -n "$RUNNING_PID" ]]; then
    echo "运行中，PID: $RUNNING_PID"
    echo "URL: http://localhost:$PORT/"
    exit 0
  fi
  echo "未运行"
}

show_logs() {
  if [[ -f "$LOG_FILE" ]]; then
    tail -n 80 "$LOG_FILE"
  else
    echo "暂无日志"
  fi
}

case "${1:-status}" in
  start)
    start_service
    ;;
  stop)
    stop_service
    ;;
  restart)
    stop_service
    start_service
    ;;
  status)
    show_status
    ;;
  logs)
    show_logs
    ;;
  *)
    echo "用法: bash scripts/agent.sh {start|stop|restart|status|logs}"
    exit 1
    ;;
esac
