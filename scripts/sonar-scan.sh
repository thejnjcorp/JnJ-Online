#!/usr/bin/env bash
# Runs a local SonarQube analysis via the sonar-scanner-cli Docker image,
# authenticating with a token stored in the gitignored .sonar.env file.
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=".sonar.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE." >&2
  echo "Create it (see .sonar.env.example) with a token generated at:" >&2
  echo "  http://localhost:9000/account/security" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [ -z "${SONAR_TOKEN:-}" ]; then
  echo "SONAR_TOKEN is not set in $ENV_FILE" >&2
  exit 1
fi

echo "Generating coverage (npm run test:tst:coverage)..."
npm run test:tst:coverage

docker run --rm \
  --network sonarnet \
  -e SONAR_HOST_URL="http://sonarqube:9000" \
  -e SONAR_TOKEN="$SONAR_TOKEN" \
  -v "$PWD:/usr/src" \
  sonarsource/sonar-scanner-cli \
  -Dsonar.qualitygate.wait=true \
  -Dsonar.qualitygate.timeout=300
