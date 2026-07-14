from __future__ import annotations

import argparse
import json
import os
import re
import time
from dataclasses import dataclass
from typing import Any, Callable

import requests

DEFAULT_TOKEN_URL = "https://identity.netztransparenz.de/users/connect/token"
RETRY_DELAYS = (1, 2, 4, 8)
REDACTED = "[redacted]"


class NetztransparenzApiError(RuntimeError):
    def __init__(
        self,
        message: str,
        *,
        category: str = "download_failed",
        http_status: int | None = None,
        step: str = "netztransparenz_api",
    ) -> None:
        super().__init__(message)
        self.category = category
        self.http_status = http_status
        self.step = step


@dataclass
class TokenContext:
    token: str


def _redact_mapping(value: Any) -> Any:
    if isinstance(value, dict):
        safe: dict[str, Any] = {}
        for key, item in value.items():
            lowered = str(key).lower()
            if lowered in {"authorization", "client_secret", "client_id", "access_token", "refresh_token"}:
                safe[key] = REDACTED
            else:
                safe[key] = _redact_mapping(item)
        return safe
    if isinstance(value, list):
        return [_redact_mapping(item) for item in value]
    return value


def _redact_text(text: str) -> str:
    redacted = re.sub(r"Bearer\s+[A-Za-z0-9._~+/=-]+", REDACTED, text, flags=re.IGNORECASE)
    redacted = re.sub(r'("?(?:access_token|client_secret|client_id)"?\s*[:=]\s*)"[^"]+"', rf"\1\"{REDACTED}\"", redacted, flags=re.IGNORECASE)
    redacted = re.sub(r"((?:access_token|client_secret|client_id)=)[^&\s]+", rf"\1{REDACTED}", redacted, flags=re.IGNORECASE)
    return redacted


def safe_response_error(
    response: Any,
    *,
    headers: dict[str, Any] | None = None,
    data: dict[str, Any] | None = None,
    body_limit: int = 1000,
) -> str:
    status = getattr(response, "status_code", None)
    text = getattr(response, "text", "") or ""
    safe_headers = _redact_mapping(headers or {})
    safe_data = _redact_mapping(data or {})
    safe_body = _redact_text(text[:body_limit])
    return f"status={status}; headers={json.dumps(safe_headers, ensure_ascii=False)}; data={json.dumps(safe_data, ensure_ascii=False)}; body={safe_body}"


def get_access_token(
    *,
    token_url: str = DEFAULT_TOKEN_URL,
    client_id: str | None = None,
    client_secret: str | None = None,
    session: Any | None = None,
    timeout: int = 30,
) -> str:
    resolved_client_id = client_id if client_id is not None else os.environ.get("NETZTRANSPARENZ_CLIENT_ID", "")
    resolved_client_secret = client_secret if client_secret is not None else os.environ.get("NETZTRANSPARENZ_CLIENT_SECRET", "")
    if not resolved_client_id:
        raise NetztransparenzApiError(
            "Missing NETZTRANSPARENZ_CLIENT_ID",
            category="authentication_failed",
            step="oauth_token",
        )
    if not resolved_client_secret:
        raise NetztransparenzApiError(
            "Missing NETZTRANSPARENZ_CLIENT_SECRET",
            category="authentication_failed",
            step="oauth_token",
        )

    http = session or requests.Session()
    data = {
        "grant_type": "client_credentials",
        "client_id": resolved_client_id,
        "client_secret": resolved_client_secret,
    }
    try:
        response = http.post(token_url, data=data, timeout=timeout)
    except requests.RequestException as error:
        raise NetztransparenzApiError(
            f"OAuth token request failed: {error.__class__.__name__}",
            category="authentication_failed",
            step="oauth_token",
        ) from error

    if response.status_code != 200:
        raise NetztransparenzApiError(
            f"OAuth token request failed: {safe_response_error(response, data=data)}",
            category="authentication_failed",
            http_status=response.status_code,
            step="oauth_token",
        )
    try:
        payload = response.json()
    except Exception as error:  # noqa: BLE001 - redacted API error for callers
        raise NetztransparenzApiError(
            "OAuth token response was not valid JSON",
            category="authentication_failed",
            http_status=response.status_code,
            step="oauth_token",
        ) from error

    token = payload.get("access_token") if isinstance(payload, dict) else None
    token_type = str(payload.get("token_type", "")) if isinstance(payload, dict) else ""
    expires_in = payload.get("expires_in") if isinstance(payload, dict) else None
    if not token:
        raise NetztransparenzApiError(
            "OAuth token response did not contain access_token",
            category="authentication_failed",
            http_status=response.status_code,
            step="oauth_token",
        )
    if token_type and token_type.lower() != "bearer":
        raise NetztransparenzApiError(
            "OAuth token response did not contain a Bearer token_type",
            category="authentication_failed",
            http_status=response.status_code,
            step="oauth_token",
        )
    if expires_in is None:
        raise NetztransparenzApiError(
            "OAuth token response did not contain expires_in",
            category="authentication_failed",
            http_status=response.status_code,
            step="oauth_token",
        )
    return str(token)


def refresh_token_and_retry(token_provider: Callable[[], str]) -> str:
    return token_provider()


def _sleep_for_retry(response: Any, retry_delays: tuple[int | float, ...], retry_index: int) -> None:
    retry_after = getattr(response, "headers", {}).get("Retry-After") if getattr(response, "headers", None) else None
    if retry_after is not None:
        try:
            time.sleep(float(retry_after))
            return
        except ValueError:
            pass
    delay = retry_delays[min(retry_index, len(retry_delays) - 1)]
    time.sleep(float(delay))


def authorized_request(
    method: str,
    url: str,
    *,
    session: Any | None = None,
    token_provider: Callable[[], str] | None = None,
    headers: dict[str, str] | None = None,
    timeout: int = 30,
    min_request_interval: float = 1.0,
    retry_delays: tuple[int | float, ...] = RETRY_DELAYS,
    **kwargs: Any,
) -> Any:
    http = session or requests.Session()
    provider = token_provider or get_access_token
    token_context = TokenContext(token=provider())
    refreshed_after_401 = False
    retry_index = 0
    attempt = 0
    max_attempts = len(retry_delays) + 1

    while attempt < max_attempts:
        if attempt > 0 and min_request_interval > 0:
            time.sleep(min_request_interval)
        safe_headers = dict(headers or {})
        safe_headers["Authorization"] = f"Bearer {token_context.token}"
        try:
            response = http.request(method, url, headers=safe_headers, timeout=timeout, **kwargs)
        except (requests.Timeout, requests.ConnectionError) as error:
            if retry_index >= len(retry_delays):
                raise NetztransparenzApiError(
                    f"API request failed after retries: {error.__class__.__name__}",
                    category="download_failed",
                    step="authorized_request",
                ) from error
            time.sleep(float(retry_delays[retry_index]))
            retry_index += 1
            attempt += 1
            continue

        if 200 <= response.status_code < 300:
            return response
        if response.status_code == 401 and not refreshed_after_401:
            token_context.token = refresh_token_and_retry(provider)
            refreshed_after_401 = True
            attempt += 1
            continue
        if response.status_code == 403:
            raise NetztransparenzApiError(
                f"Authorization failed: {safe_response_error(response, headers=safe_headers)}",
                category="authorization_failed",
                http_status=403,
                step="authorized_request",
            )
        if response.status_code == 404:
            raise NetztransparenzApiError(
                f"Endpoint or data not found: {safe_response_error(response, headers=safe_headers)}",
                category="endpoint_not_found",
                http_status=404,
                step="authorized_request",
            )
        if response.status_code == 429 or response.status_code in {500, 502, 503, 504}:
            if retry_index >= len(retry_delays):
                raise NetztransparenzApiError(
                    f"API request failed after retries: {safe_response_error(response, headers=safe_headers)}",
                    category="download_failed",
                    http_status=response.status_code,
                    step="authorized_request",
                )
            _sleep_for_retry(response, retry_delays, retry_index)
            retry_index += 1
            attempt += 1
            continue
        if 400 <= response.status_code < 500:
            raise NetztransparenzApiError(
                f"Non-retryable API error: {safe_response_error(response, headers=safe_headers)}",
                category="download_failed",
                http_status=response.status_code,
                step="authorized_request",
            )
        attempt += 1

    raise NetztransparenzApiError("API request retry budget exhausted", category="download_failed", step="authorized_request")


def main() -> int:
    parser = argparse.ArgumentParser(description="Netztransparenz OAuth client helper.")
    parser.add_argument("--check", action="store_true", help="Verify a token can be generated without printing it.")
    parser.add_argument("--token-url", default=DEFAULT_TOKEN_URL)
    args = parser.parse_args()
    if args.check:
        get_access_token(token_url=args.token_url)
        print("Netztransparenz OAuth token check ok.")
        return 0
    parser.error("No action requested.")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
