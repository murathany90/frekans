from datetime import datetime
from zoneinfo import ZoneInfo

from scripts.normalize_frequency import local_to_utc_iso


def test_turkey_1500_matches_berlin_1400_in_june_2026():
    tr = local_to_utc_iso("2026-06-15", "15:00:00", "Europe/Istanbul")
    de = local_to_utc_iso("2026-06-15", "14:00:00", "Europe/Berlin")

    assert tr == de == "2026-06-15T12:00:00Z"


def test_turkey_1500_matches_berlin_1300_in_winter_2026():
    tr = local_to_utc_iso("2026-02-02", "15:00:00", "Europe/Istanbul")
    de = local_to_utc_iso("2026-02-02", "13:00:00", "Europe/Berlin")

    assert tr == de == "2026-02-02T12:00:00Z"


def test_berlin_dst_transition_days_have_non_86400_utc_duration():
    spring_start = datetime(2026, 3, 29, tzinfo=ZoneInfo("Europe/Berlin"))
    spring_end = datetime(2026, 3, 30, tzinfo=ZoneInfo("Europe/Berlin"))
    fall_start = datetime(2026, 10, 25, tzinfo=ZoneInfo("Europe/Berlin"))
    fall_end = datetime(2026, 10, 26, tzinfo=ZoneInfo("Europe/Berlin"))

    assert int((spring_end.astimezone(ZoneInfo("UTC")) - spring_start.astimezone(ZoneInfo("UTC"))).total_seconds()) == 82800
    assert int((fall_end.astimezone(ZoneInfo("UTC")) - fall_start.astimezone(ZoneInfo("UTC"))).total_seconds()) == 90000
