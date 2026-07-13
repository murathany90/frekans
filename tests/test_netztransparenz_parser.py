from scripts.import_netztransparenz import parse_netztransparenz_csv
from scripts.normalize_frequency import decode_frequency_array


def test_netztransparenz_parser_accepts_header_decimal_comma_and_semicolon():
    text = "\n".join(
        [
            "DATE;TIME;FREQUENCY_[HZ]",
            "01.06.2026;00:00:00;50,015",
            "01.06.2026;00:00:01;50,022",
            "01.06.2026;00:00:02;50.018",
        ]
    )

    days = parse_netztransparenz_csv(text.encode("utf-8"), source_url="local")

    assert sorted(days) == ["2026-06-01"]
    package = days["2026-06-01"]
    assert package.valid_samples == 3
    assert package.minimum_hz == 50.015
    assert package.maximum_hz == 50.022


def test_netztransparenz_parser_detects_alternate_delimiter_and_columns():
    text = "\n".join(
        [
            "Zeit,Datum,Frequenz",
            "00:00:00,02.06.2026,50.001",
            "00:00:01,02.06.2026,50.002",
        ]
    )

    days = parse_netztransparenz_csv(text.encode("utf-8"), source_url="local")

    assert days["2026-06-02"].valid_samples == 2


def test_netztransparenz_parser_maps_spring_dst_gap_to_utc_day_index():
    text = "\n".join(
        [
            "DATE;TIME;FREQUENCY_[HZ]",
            "29.03.2026;00:00:00;50,001",
            "29.03.2026;01:59:59;50,002",
            "29.03.2026;02:30:00;50,999",
            "29.03.2026;03:00:00;50,003",
            "29.03.2026;23:59:59;50,004",
        ]
    )

    days = parse_netztransparenz_csv(text.encode("utf-8"), source_url="local")

    package = days["2026-03-29"]
    decoded = decode_frequency_array(package.encoded)
    assert package.expected_samples == 82800
    assert package.valid_samples == 4
    assert package.invalid_rows == 1
    assert decoded[0] == 50.001
    assert decoded[7199] == 50.002
    assert decoded[7200] == 50.003
    assert decoded[82799] == 50.004


def test_netztransparenz_parser_maps_fall_dst_repeated_hour_to_distinct_indexes():
    text = "\n".join(
        [
            "DATE;TIME;FREQUENCY_[HZ]",
            "25.10.2026;02:00:00;50,011",
            "25.10.2026;02:00:00;50,022",
        ]
    )

    days = parse_netztransparenz_csv(text.encode("utf-8"), source_url="local")

    package = days["2026-10-25"]
    decoded = decode_frequency_array(package.encoded)
    assert package.expected_samples == 90000
    assert package.valid_samples == 2
    assert package.duplicate_samples == 0
    assert decoded[7200] == 50.011
    assert decoded[10800] == 50.022
