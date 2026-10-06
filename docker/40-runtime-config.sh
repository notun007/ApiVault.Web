#!/bin/sh
set -eu

: "${APIVAULT_ENVIRONMENT:=Production}"
: "${APIVAULT_API_BASE_URL:?APIVAULT_API_BASE_URL is required}"
: "${APIVAULT_APPLICATION_NAME:=ApiVault}"
: "${APIVAULT_ORGANIZATION_NAME:=Banking Organization}"
: "${APIVAULT_SESSION_STORAGE_KEY:=apivault.session}"

case "${APIVAULT_API_BASE_URL}" in
  https://*) ;;
  http://*)
    if [ "${APIVAULT_ENVIRONMENT}" != "Development" ]; then
      echo "APIVAULT_API_BASE_URL must use HTTPS outside Development." >&2
      exit 1
    fi
    ;;
  *)
    echo "APIVAULT_API_BASE_URL must be an absolute HTTP(S) URL." >&2
    exit 1
    ;;
esac

export APIVAULT_API_BASE_URL
export APIVAULT_APPLICATION_NAME
export APIVAULT_ORGANIZATION_NAME
export APIVAULT_SESSION_STORAGE_KEY

envsubst \
  '${APIVAULT_API_BASE_URL} ${APIVAULT_APPLICATION_NAME} ${APIVAULT_ORGANIZATION_NAME} ${APIVAULT_SESSION_STORAGE_KEY}' \
  < /etc/apivault/runtime-config.template.json \
  > /usr/share/nginx/html/config/runtime-config.json
