from __future__ import annotations

from pathlib import Path

import pytest

from scripts import build_site as build_site_module


def write_minimal_site(tmp_path: Path) -> None:
    (tmp_path / "frekans_rapor_v1.html").write_text("<!doctype html><title>Grid</title>", encoding="utf-8")
    (tmp_path / "data").mkdir()


def test_build_site_requires_custom_domain_files(monkeypatch, tmp_path):
    write_minimal_site(tmp_path)
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(build_site_module, "build_manifest", lambda _data_root: None)
    monkeypatch.setattr(build_site_module, "validate_data_root", lambda _data_root: {"issues": []})
    monkeypatch.setattr(build_site_module, "write_storage_report", lambda _validation: None)

    with pytest.raises(FileNotFoundError, match="CNAME"):
        build_site_module.build_site(tmp_path / "data", tmp_path / "dist")


def test_build_site_copies_domain_seo_files(monkeypatch, tmp_path):
    write_minimal_site(tmp_path)
    (tmp_path / "CNAME").write_text("gridfreq.com\n", encoding="utf-8")
    (tmp_path / "robots.txt").write_text("User-agent: *\nAllow: /\nSitemap: https://gridfreq.com/sitemap.xml\n", encoding="utf-8")
    (tmp_path / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://gridfreq.com/</loc></url></urlset>\n',
        encoding="utf-8",
    )
    (tmp_path / "site.webmanifest").write_text('{"name":"GridFreq"}\n', encoding="utf-8")
    (tmp_path / "404.html").write_text("<!doctype html><title>404</title>", encoding="utf-8")
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(build_site_module, "build_manifest", lambda _data_root: None)
    monkeypatch.setattr(build_site_module, "validate_data_root", lambda _data_root: {"issues": []})
    monkeypatch.setattr(build_site_module, "write_storage_report", lambda _validation: None)

    build_site_module.build_site(tmp_path / "data", tmp_path / "dist")

    assert (tmp_path / "dist" / "CNAME").read_text(encoding="utf-8").strip() == "gridfreq.com"
    assert (tmp_path / "dist" / "robots.txt").exists()
    assert (tmp_path / "dist" / "sitemap.xml").exists()
    assert (tmp_path / "dist" / "site.webmanifest").exists()
    assert (tmp_path / "dist" / "404.html").exists()
