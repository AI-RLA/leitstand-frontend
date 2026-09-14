#!/bin/sh
# Render the upstream Authorization header from the mounted secret; empty or absent renders none.
set -eu

out=/etc/nginx/conf.d/auth.inc
secret=/run/secrets/leitstand_auth_bearer_token
# The master process reads the config as root; nothing else needs the token.
umask 077

token=""
if [ -f "$secret" ]; then
    token=$(tr -d '\r\n' < "$secret")
fi
if [ -n "$token" ]; then
    # The same alphabet the backend enforces; a wrong header fails every request while both
    # containers look healthy.
    if ! printf '%s' "$token" | grep -Eq '^[A-Za-z0-9._~+-]+$'; then
        echo "[auth-include] refusing token: only A-Za-z0-9._~+- are allowed" >&2
        exit 1
    fi
    printf 'proxy_set_header Authorization "Bearer %s";\n' "$token" > "$out"
    echo "[auth-include] upstream bearer attached from $secret"
else
    : > "$out"
    echo "[auth-include] no token secret; upstream requests carry no Authorization"
fi
