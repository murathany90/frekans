from __future__ import annotations

import json

from scripts.fetch_teias import write_status


def read_status(tmp_path):
    return json.loads((tmp_path / "status.json").read_text(encoding="utf-8"))


def test_write_status_records_prompt2_success_schema(tmp_path):
    write_status(
        tmp_path,
        {
            "processed": [{"date": "2026-07-10", "status": "complete", "qualityScore": 100}],
            "missing": ["2026-07-11"],
            "failed": [],
            "attemptedDate": "2026-07-11",
            "workflowRunAt": "2026-07-14T00:00:00Z",
        },
    )

    status = read_status(tmp_path)

    assert status["lastRunAt"] == "2026-07-14T00:00:00Z"
    assert status["lastSuccessfulRunAt"] == "2026-07-14T00:00:00Z"
    assert status["lastFailedRunAt"] is None
    assert status["lastSuccessfulDataDate"] == "2026-07-10"
    assert status["lastAttemptedDataDate"] == "2026-07-11"
    assert status["status"] == "success"
    assert status["missingDates"] == ["2026-07-11"]
    assert status["lastError"] is None
    assert status["lastWorkflowResult"] == "success"
    assert status["lastSuccessfulTeiasDataDate"] == "2026-07-10"


def test_write_status_records_teias_source_lag_fields(tmp_path):
    write_status(
        tmp_path,
        {
            "processed": [{"date": "2026-07-13", "status": "complete", "qualityScore": 100}],
            "missing": ["2026-07-15"],
            "failed": [],
            "attemptedDate": "2026-07-15",
            "workflowRunAt": "2026-07-17T08:30:00Z",
            "latestDiscoveredDate": "2026-07-14",
            "discoveredDates": ["2026-07-13", "2026-07-14"],
            "catchUpPublishedDates": ["2026-07-14"],
        },
    )

    status = read_status(tmp_path)

    assert status["sourceLatestTeiasDataDate"] == "2026-07-14"
    assert status["teiasPublishedButMissingDates"] == ["2026-07-14"]
    assert status["teiasNotYetPublishedDates"] == ["2026-07-15"]
    assert status["lastTeiasCatchUpDates"] == ["2026-07-14"]


def test_write_status_records_prompt2_failure_schema_and_preserves_success(tmp_path):
    (tmp_path / "status.json").write_text(
        json.dumps(
            {
                "lastSuccessfulRunAt": "2026-07-13T00:00:00Z",
                "lastSuccessfulDataDate": "2026-07-10",
                "lastSuccessfulTeiasDataDate": "2026-07-10",
            }
        ),
        encoding="utf-8",
    )

    write_status(
        tmp_path,
        {
            "processed": [],
            "missing": ["2026-07-12"],
            "failed": ["2026-07-12: HTTP 503 parser timeout"],
            "attemptedDate": "2026-07-12",
            "workflowRunAt": "2026-07-14T01:00:00Z",
            "errorStep": "Fetch last 14 TEIAS days",
            "httpStatus": 503,
            "retryCount": 3,
        },
    )

    status = read_status(tmp_path)

    assert status["lastRunAt"] == "2026-07-14T01:00:00Z"
    assert status["lastSuccessfulRunAt"] == "2026-07-13T00:00:00Z"
    assert status["lastFailedRunAt"] == "2026-07-14T01:00:00Z"
    assert status["lastSuccessfulDataDate"] == "2026-07-10"
    assert status["lastAttemptedDataDate"] == "2026-07-12"
    assert status["status"] == "failed"
    assert status["missingDates"] == ["2026-07-12"]
    assert status["lastError"] == {
        "step": "Fetch last 14 TEIAS days",
        "message": "2026-07-12: HTTP 503 parser timeout",
        "httpStatus": 503,
        "retryCount": 3,
    }
    assert status["lastWorkflowResult"] == "failed"
