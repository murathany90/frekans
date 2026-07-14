import json
import os

import pytest

from scripts.netztransparenz_client import (
    NetztransparenzApiError,
    authorized_request,
    get_access_token,
    safe_response_error,
)


class FakeResponse:
    def __init__(self, status_code=200, payload=None, text="", headers=None):
        self.status_code = status_code
        self._payload = payload
        self.text = text
        self.content = text.encode("utf-8")
        self.headers = headers or {}

    def json(self):
        if isinstance(self._payload, Exception):
            raise self._payload
        return self._payload


class FakeSession:
    def __init__(self, responses):
        self.responses = list(responses)
        self.posts = []
        self.requests = []

    def post(self, url, data=None, timeout=None):
        self.posts.append({"url": url, "data": dict(data or {}), "timeout": timeout})
        return self.responses.pop(0)

    def request(self, method, url, headers=None, timeout=None, **kwargs):
        self.requests.append(
            {
                "method": method,
                "url": url,
                "headers": dict(headers or {}),
                "timeout": timeout,
                "kwargs": kwargs,
            }
        )
        return self.responses.pop(0)


def test_get_access_token_success_does_not_log_secret(capsys):
    session = FakeSession(
        [
            FakeResponse(
                200,
                {"access_token": "runtime-token", "token_type": "Bearer", "expires_in": 3600},
            )
        ]
    )

    token = get_access_token(
        token_url="https://identity.netztransparenz.de/users/connect/token",
        client_id="client-id",
        client_secret="client-secret",
        session=session,
    )

    assert token == "runtime-token"
    assert session.posts[0]["data"]["grant_type"] == "client_credentials"
    assert session.posts[0]["data"]["client_id"] == "client-id"
    assert session.posts[0]["data"]["client_secret"] == "client-secret"
    captured = capsys.readouterr()
    assert "runtime-token" not in captured.out
    assert "client-secret" not in captured.out
    assert captured.err == ""


def test_get_access_token_requires_client_id_and_secret(monkeypatch):
    monkeypatch.delenv("NETZTRANSPARENZ_CLIENT_ID", raising=False)
    monkeypatch.delenv("NETZTRANSPARENZ_CLIENT_SECRET", raising=False)

    with pytest.raises(NetztransparenzApiError, match="NETZTRANSPARENZ_CLIENT_ID"):
        get_access_token(client_id="", client_secret="present", session=FakeSession([]))

    with pytest.raises(NetztransparenzApiError, match="NETZTRANSPARENZ_CLIENT_SECRET"):
        get_access_token(client_id="present", client_secret="", session=FakeSession([]))


def test_get_access_token_rejects_invalid_json_and_missing_token():
    invalid_json = FakeResponse(200, ValueError("not json"), "not json")
    with pytest.raises(NetztransparenzApiError, match="JSON"):
        get_access_token(client_id="id", client_secret="secret", session=FakeSession([invalid_json]))

    no_token = FakeResponse(200, {"token_type": "Bearer", "expires_in": 3600})
    with pytest.raises(NetztransparenzApiError, match="access_token"):
        get_access_token(client_id="id", client_secret="secret", session=FakeSession([no_token]))


def test_authorized_request_refreshes_token_once_on_401():
    tokens = iter(["first-token", "second-token"])
    session = FakeSession([FakeResponse(401, text="unauthorized"), FakeResponse(200, {"ok": True}, "ok")])

    response = authorized_request(
        "GET",
        "https://ds.netztransparenz.de/api/v1/data/frequency/product/2026-07-01/2026-07-02",
        session=session,
        token_provider=lambda: next(tokens),
        min_request_interval=0,
        retry_delays=(0,),
    )

    assert response.status_code == 200
    assert len(session.requests) == 2
    assert session.requests[0]["headers"]["Authorization"] == "Bearer first-token"
    assert session.requests[1]["headers"]["Authorization"] == "Bearer second-token"


def test_authorized_request_does_not_retry_403():
    session = FakeSession([FakeResponse(403, text="forbidden")])

    with pytest.raises(NetztransparenzApiError, match="403"):
        authorized_request(
            "GET",
            "https://ds.netztransparenz.de/api/v1/data/frequency/product/2026-07-01/2026-07-02",
            session=session,
            token_provider=lambda: "runtime-token",
            min_request_interval=0,
            retry_delays=(0,),
        )

    assert len(session.requests) == 1


def test_authorized_request_honors_429_retry_after(monkeypatch):
    sleeps = []
    monkeypatch.setattr("scripts.netztransparenz_client.time.sleep", sleeps.append)
    session = FakeSession([FakeResponse(429, text="rate", headers={"Retry-After": "0"}), FakeResponse(200, text="ok")])

    response = authorized_request(
        "GET",
        "https://ds.netztransparenz.de/api/v1/data/frequency/product/2026-07-01/2026-07-02",
        session=session,
        token_provider=lambda: "runtime-token",
        min_request_interval=0,
        retry_delays=(0,),
    )

    assert response.status_code == 200
    assert sleeps == [0.0]


def test_authorized_request_retries_transient_5xx(monkeypatch):
    monkeypatch.setattr("scripts.netztransparenz_client.time.sleep", lambda _: None)
    session = FakeSession([FakeResponse(503, text="busy"), FakeResponse(200, text="ok")])

    response = authorized_request(
        "GET",
        "https://ds.netztransparenz.de/api/v1/data/frequency/product/2026-07-01/2026-07-02",
        session=session,
        token_provider=lambda: "runtime-token",
        min_request_interval=0,
        retry_delays=(0,),
    )

    assert response.status_code == 200
    assert len(session.requests) == 2


def test_safe_response_error_redacts_credentials():
    response = FakeResponse(
        500,
        text=json.dumps(
            {
                "access_token": "runtime-token",
                "client_secret": "client-secret",
                "message": "bad",
            }
        ),
    )

    message = safe_response_error(
        response,
        headers={"Authorization": "Bearer runtime-token"},
        data={"client_id": "client-id", "client_secret": "client-secret"},
    )

    assert "runtime-token" not in message
    assert "client-secret" not in message
    assert "Bearer" not in message
    assert "status=500" in message
