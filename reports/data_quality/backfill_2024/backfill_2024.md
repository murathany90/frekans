# 2024 Frequency Backfill Report

Generated at UTC: 2026-07-15T21:43:35Z
Range: 2024-01-01 - 2024-12-31 (366 days)

## Coverage

| Source | Target days | Available days | Missing days | Status counts | Min Hz | Max Hz | 2024 bytes |
| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| teias | 366 | 366 | 0 | {"complete": 15, "critical": 1, "partial": 350} | 49.0 | 51.0 | 140819032 |
| netztransparenz | 366 | 366 | 0 | {"complete": 366} | 49.816 | 50.146 | 141000912 |

Common 2024 days: 366

## Sample Count Notes

- teias: 351 day(s) have valid/expected samples different from plain 86,400 or partial coverage.
  First examples: [{"date": "2024-01-01", "validSamples": 86394, "expectedSamples": 86400, "missingSamples": 6, "status": "partial"}, {"date": "2024-01-02", "validSamples": 86394, "expectedSamples": 86400, "missingSamples": 6, "status": "partial"}, {"date": "2024-01-03", "validSamples": 86394, "expectedSamples": 86400, "missingSamples": 6, "status": "partial"}, {"date": "2024-01-04", "validSamples": 86394, "expectedSamples": 86400, "missingSamples": 6, "status": "partial"}, {"date": "2024-01-05", "validSamples": 86394, "expectedSamples": 86400, "missingSamples": 6, "status": "partial"}, {"date": "2024-01-06", "validSamples": 86394, "expectedSamples": 86400, "missingSamples": 6, "status": "partial"}, {"date": "2024-01-07", "validSamples": 86394, "expectedSamples": 86400, "missingSamples": 6, "status": "partial"}, {"date": "2024-01-08", "validSamples": 86394, "expectedSamples": 86400, "missingSamples": 6, "status": "partial"}, {"date": "2024-01-09", "validSamples": 86394, "expectedSamples": 86400, "missingSamples": 6, "status": "partial"}, {"date": "2024-01-10", "validSamples": 86394, "expectedSamples": 86400, "missingSamples": 6, "status": "partial"}]
- netztransparenz: 2 day(s) have valid/expected samples different from plain 86,400 or partial coverage.
  First examples: [{"date": "2024-03-31", "validSamples": 82800, "expectedSamples": 82800, "missingSamples": 0, "status": "complete"}, {"date": "2024-10-27", "validSamples": 90000, "expectedSamples": 90000, "missingSamples": 0, "status": "complete"}]

## Netztransparenz DST Days

- 2024-03-31: expected=82800, valid=82800, startUtc=2024-03-30T23:00:00Z
- 2024-10-27: expected=90000, valid=90000, startUtc=2024-10-26T22:00:00Z

## Quality Totals

| Source | Missing samples | Duplicate samples | Invalid rows | Invalid frequency samples | Suspicious frequency days |
| --- | ---: | ---: | ---: | ---: | ---: |
| teias | 2682 | 0 | 597 | 2107 | 351 |
| netztransparenz | 0 | 0 | 0 | 0 | 0 |

## Size

Data before bytes: 431839363
Data after bytes: 715099164
Data added bytes: 283259801
Dist before bytes: 433580119
Dist after bytes: 716839920
Dist added bytes: 283259801
Pages remaining bytes: 356901904

## Raw Artifact Scan

Data raw files: 0
Dist raw files: 0
