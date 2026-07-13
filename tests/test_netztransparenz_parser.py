from scripts.import_netztransparenz import parse_netztransparenz_csv


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
