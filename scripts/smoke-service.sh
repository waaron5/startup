#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-4010}"
HOST="${HOST:-127.0.0.1}"
BASE_URL="http://${HOST}:${PORT}"
COOKIE_JAR="$(mktemp)"
UNIQUE_SUFFIX="$(date +%s)-$RANDOM"
EMAIL="phase5-${UNIQUE_SUFFIX}@example.com"
PASSWORD="password123"
DISPLAY_NAME="Phase Five User"

SERVER_PID=""

cleanup() {
  if [[ -n "${SERVER_PID}" ]]; then
    if kill -0 "${SERVER_PID}" >/dev/null 2>&1; then
      kill "${SERVER_PID}" >/dev/null 2>&1 || true
      wait "${SERVER_PID}" 2>/dev/null || true
    fi
  fi
  rm -f "${COOKIE_JAR}"
}

trap cleanup EXIT

if [[ ! -f "dist/index.html" ]]; then
  echo "dist/index.html not found. Run 'npm run build' before smoke tests."
  exit 1
fi

PORT="${PORT}" node service/index.js >/tmp/the-quisling-smoke.log 2>&1 &
SERVER_PID=$!

for _ in {1..30}; do
  if curl -s -f "${BASE_URL}/api/health" >/dev/null; then
    break
  fi
  sleep 0.2
done

assert_status() {
  local actual="$1"
  local expected="$2"
  local label="$3"

  if [[ "${actual}" != "${expected}" ]]; then
    echo "FAIL: ${label} expected ${expected}, got ${actual}"
    echo "Service logs:"
    cat /tmp/the-quisling-smoke.log || true
    exit 1
  fi

  echo "PASS: ${label} (${actual})"
}

check_spa_route() {
  local route="$1"
  local body_file
  body_file="$(mktemp)"
  local code
  code="$(curl -s -o "${body_file}" -w "%{http_code}" "${BASE_URL}${route}")"
  assert_status "${code}" "200" "GET ${route}"

  if ! grep -iq "<!doctype html>" "${body_file}"; then
    echo "FAIL: ${route} did not return HTML shell."
    exit 1
  fi
}

code="$(curl -s -o /tmp/smoke-me-before.json -w "%{http_code}" "${BASE_URL}/api/auth/me")"
assert_status "${code}" "401" "GET /api/auth/me before login"

code="$(curl -s -o /tmp/smoke-register.json -w "%{http_code}" \
  -c "${COOKIE_JAR}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\",\"displayName\":\"${DISPLAY_NAME}\"}" \
  "${BASE_URL}/api/auth/register")"
assert_status "${code}" "201" "POST /api/auth/register"

code="$(curl -s -o /tmp/smoke-me-after-register.json -w "%{http_code}" \
  -b "${COOKIE_JAR}" \
  "${BASE_URL}/api/auth/me")"
assert_status "${code}" "200" "GET /api/auth/me after register"

code="$(curl -s -o /tmp/smoke-logout.json -w "%{http_code}" \
  -b "${COOKIE_JAR}" \
  -c "${COOKIE_JAR}" \
  -X POST \
  "${BASE_URL}/api/auth/logout")"
assert_status "${code}" "200" "POST /api/auth/logout"

code="$(curl -s -o /tmp/smoke-protected-after-logout.json -w "%{http_code}" \
  -b "${COOKIE_JAR}" \
  "${BASE_URL}/api/protected")"
assert_status "${code}" "401" "GET /api/protected after logout"

code="$(curl -s -o /tmp/smoke-login.json -w "%{http_code}" \
  -c "${COOKIE_JAR}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}" \
  "${BASE_URL}/api/auth/login")"
assert_status "${code}" "200" "POST /api/auth/login"

code="$(curl -s -o /tmp/smoke-protected-after-login.json -w "%{http_code}" \
  -b "${COOKIE_JAR}" \
  "${BASE_URL}/api/protected")"
assert_status "${code}" "200" "GET /api/protected after login"

check_spa_route "/"
check_spa_route "/profile"
check_spa_route "/game"
check_spa_route "/results"

echo "Smoke tests passed."
