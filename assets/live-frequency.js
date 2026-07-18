(() => {
  const POLL_MS = 60_000;
  const NOMINAL_HZ = 50;
  const RANGE_LABELS = new Map([
    [900, "Son 15 dakika"],
    [3600, "Son 1 saat"],
    [21600, "Son 6 saat"],
    [86400, "Son 24 saat"]
  ]);

  const state = {
    active: false,
    timer: null,
    chart: null,
    status: null,
    minuteSeries: [],
    rawCache: new Map(),
    rangeSeconds: 86400,
    lastTimestampMs: 0,
    visibilityBound: false
  };

  const $ = (id) => document.getElementById(id);

  function apiBaseUrl() {
    return String(window.GRIDFREQ_CONFIG?.liveApiBaseUrl || "").replace(/\/$/, "");
  }

  function formatHz(value, digits = 4) {
    if (!Number.isFinite(value)) return "-";
    return `${value.toLocaleString("tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits })} Hz`;
  }

  function formatMhz(value) {
    if (!Number.isFinite(value)) return "-";
    const mhz = (value - NOMINAL_HZ) * 1000;
    const sign = mhz > 0 ? "+" : "";
    return `${sign}${mhz.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} mHz`;
  }

  function formatTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("tr-TR", { hour12: false });
  }

  function formatAge(iso) {
    if (!iso) return "-";
    const ageSeconds = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
    const minutes = Math.floor(ageSeconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours} sa ${minutes % 60} dk`;
    return `${minutes} dk`;
  }

  async function fetchJson(path) {
    const base = apiBaseUrl();
    if (!base) throw new Error("live-api-not-configured");
    const response = await fetch(`${base}${path}`, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      const message = response.status === 401 || response.status === 403 ? "auth" : `http-${response.status}`;
      throw new Error(message);
    }
    return response.json();
  }

  function setStatus(message, tone = "muted") {
    const node = $("liveFrequencyStatus");
    if (!node) return;
    node.className = `status-banner ${tone}`;
    node.textContent = message;
  }

  function computeSeriesStats(series) {
    const valid = series.filter((point) => Number.isFinite(point.meanHz));
    const minValues = series.map((point) => point.minHz).filter(Number.isFinite);
    const maxValues = series.map((point) => point.maxHz).filter(Number.isFinite);
    const mean = valid.length ? valid.reduce((sum, point) => sum + point.meanHz, 0) / valid.length : NaN;
    const validSamples = series.reduce((sum, point) => sum + (Number(point.validSamples) || 0), 0);
    const expectedSamples = Math.max(1, series.length * 60);
    return {
      mean,
      min: minValues.length ? Math.min(...minValues) : NaN,
      max: maxValues.length ? Math.max(...maxValues) : NaN,
      validSamples,
      missingSamples: Math.max(0, expectedSamples - validSamples),
      validRatio: validSamples / expectedSamples
    };
  }

  function kpi(label, value, sub = "") {
    return `<article class="live-frequency-kpi"><div class="label">${label}</div><div class="value">${value}</div>${sub ? `<div class="sub">${sub}</div>` : ""}</article>`;
  }

  function renderKpis() {
    const root = $("liveFrequencyKpis");
    if (!root) return;
    const status = state.status || {};
    const stats = computeSeriesStats(state.minuteSeries);
    const connection = status.status === "healthy" ? "Sağlıklı" : status.status === "warming" ? "Tampon hazırlanıyor" : status.status === "auth-error" ? "Yetki sorunu" : "Kontrol gerekli";
    root.innerHTML = [
      kpi("Son erişilebilir frekans", formatHz(status.latestFrequencyHz), "GridRadar"),
      kpi("Nominal sapma", formatMhz(status.latestFrequencyHz), "50.000 Hz referans"),
      kpi("Ölçüm zamanı", formatTime(status.latestMeasurementTime), "UTC/yerel tooltipte"),
      kpi("Veri yaşı", formatAge(status.latestMeasurementTime), "Yaklaşık 15 dakika gecikmeli"),
      kpi("24s minimum", formatHz(status.minFrequencyHz ?? stats.min)),
      kpi("24s maksimum", formatHz(status.maxFrequencyHz ?? stats.max)),
      kpi("24s ortalama", formatHz(status.meanFrequencyHz ?? stats.mean)),
      kpi("Geçerli örnek oranı", `${((status.validSampleRatio ?? stats.validRatio) * 100).toFixed(2)}%`),
      kpi("Eksik veri", `${stats.missingSamples.toLocaleString("tr-TR")} sn`, `${(100 - stats.validRatio * 100).toFixed(2)}%`),
      kpi("Bağlantı durumu", connection, apiBaseUrl() ? "Worker API" : "API URL bekleniyor")
    ].join("");
  }

  function renderBufferNotice() {
    const node = $("liveFrequencyBufferNotice");
    if (!node) return;
    const seconds = Number(state.status?.availableHistorySeconds || 0);
    if (seconds >= 24 * 3600 || !seconds) {
      node.hidden = true;
      return;
    }
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    node.hidden = false;
    node.textContent = `24 saatlik veri tamponu hazırlanıyor. Mevcut geçmiş: ${hours} saat ${minutes} dakika.`;
  }

  function ensureChart() {
    const host = $("liveFrequencyChart");
    if (!host || !window.echarts) return null;
    if (!state.chart) state.chart = window.echarts.init(host);
    return state.chart;
  }

  function filteredMinuteSeries() {
    const cutoff = Date.now() - state.rangeSeconds * 1000;
    return state.minuteSeries.filter((point) => Date.parse(point.timestamp) >= cutoff);
  }

  async function rawSeriesForCurrentRange() {
    if (state.rangeSeconds > 3600) return null;
    const to = new Date().toISOString();
    const from = new Date(Date.now() - state.rangeSeconds * 1000).toISOString();
    const key = `${from}:${to}`;
    if (!state.rawCache.has(key)) {
      state.rawCache.set(key, fetchJson(`/v1/live/series?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&resolution=1s`));
    }
    return state.rawCache.get(key);
  }

  async function renderChart() {
    const chart = ensureChart();
    if (!chart) return;
    const raw = await rawSeriesForCurrentRange().catch(() => null);
    const minute = filteredMinuteSeries();
    const useRaw = Array.isArray(raw) && raw.length > 0;
    const axisData = useRaw ? raw.map((point) => new Date(point.timestampMs).toISOString()) : minute.map((point) => point.timestamp);
    const meanData = useRaw ? raw.map((point) => point.frequencyHz) : minute.map((point) => point.meanHz);
    const minData = useRaw ? [] : minute.map((point) => point.minHz);
    const maxData = useRaw ? [] : minute.map((point) => point.maxHz);
    chart.setOption({
      animation: false,
      tooltip: {
        trigger: "axis",
        formatter(params) {
          const time = params?.[0]?.axisValue;
          const utc = new Date(time).toISOString().replace("T", " ").replace(".000Z", " UTC");
          const local = new Date(time).toLocaleString("tr-TR", { hour12: false });
          const rows = params.map((item) => `${item.marker}${item.seriesName}: ${formatHz(item.value, 4)}`).join("<br>");
          return `${utc}<br>${local}<br>${rows}`;
        }
      },
      legend: { top: 0 },
      grid: { left: 52, right: 20, top: 54, bottom: 54 },
      xAxis: { type: "category", data: axisData, boundaryGap: false },
      yAxis: { type: "value", min: 49.85, max: 50.15, axisLabel: { formatter: (value) => Number(value).toFixed(3) } },
      dataZoom: [{ type: "inside" }, { type: "slider", height: 24 }],
      series: [
        {
          name: useRaw ? "1 sn frekans" : "Dakikalık ortalama",
          type: "line",
          data: meanData,
          showSymbol: false,
          connectNulls: false,
          lineStyle: { width: 2, color: "#176b9c" },
          markLine: {
            silent: true,
            symbol: "none",
            data: [
              { yAxis: 50, lineStyle: { color: "#17212b", width: 1.5 }, label: { formatter: "50.000 Hz" } },
              { yAxis: 50.02, lineStyle: { color: "#19714d", type: "dashed" }, label: { formatter: "+20 mHz" } },
              { yAxis: 49.98, lineStyle: { color: "#19714d", type: "dashed" }, label: { formatter: "-20 mHz" } },
              { yAxis: 50.05, lineStyle: { color: "#b37400", type: "dashed" }, label: { formatter: "+50 mHz" } },
              { yAxis: 49.95, lineStyle: { color: "#b37400", type: "dashed" }, label: { formatter: "-50 mHz" } },
              { yAxis: 50.1, lineStyle: { color: "#c83c3c", type: "dotted" }, label: { formatter: "+100 mHz" } },
              { yAxis: 49.9, lineStyle: { color: "#c83c3c", type: "dotted" }, label: { formatter: "-100 mHz" } }
            ]
          }
        },
        { name: "Dakikalık minimum", type: "line", data: minData, showSymbol: false, connectNulls: false, lineStyle: { width: 1, opacity: .55 } },
        { name: "Dakikalık maksimum", type: "line", data: maxData, showSymbol: false, connectNulls: false, lineStyle: { width: 1, opacity: .55 } }
      ].filter((series) => series.data.length)
    }, true);
  }

  async function refreshAll() {
    if (!apiBaseUrl()) {
      setStatus("Worker API URL yapılandırılmadı. Cloudflare deploy sonrası bu sekme otomatik bağlanacak.", "warn");
      renderKpis();
      return;
    }
    setStatus("Canlı frekans verisi yükleniyor.", "muted");
    try {
      const [status, series] = await Promise.all([
        fetchJson("/v1/live/status"),
        fetchJson("/v1/live/series?range=24h&resolution=60s")
      ]);
      state.status = status;
      state.minuteSeries = Array.isArray(series) ? series : [];
      const latest = state.status?.latestMeasurementTime ? Date.parse(state.status.latestMeasurementTime) : 0;
      state.lastTimestampMs = Math.max(state.lastTimestampMs, latest || 0);
      setStatus(state.minuteSeries.length ? "Yaklaşık 15 dakika gecikmeli canlı veri gösteriliyor." : "İlk 24 saatlik tampon hazırlanıyor; henüz grafik verisi yok.", state.minuteSeries.length ? "good" : "warn");
      renderKpis();
      renderBufferNotice();
      await renderChart();
    } catch (error) {
      const message = error?.message === "auth"
        ? "GridRadar API token/yetki sorunu. Worker secret durumunu kontrol edin."
        : "GridRadar bağlantısı veya Worker geçici olarak kullanılamıyor.";
      setStatus(message, "warn");
      renderKpis();
    }
  }

  async function pollDelta() {
    if (!state.active || document.hidden || !apiBaseUrl()) return;
    try {
      const delta = await fetchJson(`/v1/live/delta?after=${state.lastTimestampMs || 0}`);
      if (Array.isArray(delta) && delta.length) {
        state.lastTimestampMs = Math.max(...delta.map((point) => Number(point.timestampMs) || 0), state.lastTimestampMs);
        await refreshAll();
      } else {
        state.status = await fetchJson("/v1/live/status");
        renderKpis();
        renderBufferNotice();
      }
    } catch {
      setStatus("Canlı veri yenilemesi gecikti; mevcut grafik korunuyor.", "warn");
    }
  }

  function schedulePolling() {
    clearInterval(state.timer);
    state.timer = window.setInterval(pollDelta, POLL_MS);
  }

  function bindControls() {
    document.querySelectorAll("[data-live-range]").forEach((button) => {
      if (button.dataset.boundLiveRange) return;
      button.dataset.boundLiveRange = "1";
      button.addEventListener("click", async () => {
        state.rangeSeconds = Number(button.dataset.liveRange) || 86400;
        document.querySelectorAll("[data-live-range]").forEach((item) => item.classList.toggle("active", item === button));
        setStatus(`${RANGE_LABELS.get(state.rangeSeconds) || "Seçili aralık"} gösteriliyor.`, "muted");
        await renderChart();
      });
    });
  }

  function onVisibilityChange() {
    if (!state.active) return;
    if (document.hidden) {
      clearInterval(state.timer);
    } else {
      refreshAll();
      schedulePolling();
    }
  }

  async function start() {
    if (state.active) return;
    state.active = true;
    bindControls();
    if (!state.visibilityBound) {
      document.addEventListener("visibilitychange", onVisibilityChange);
      state.visibilityBound = true;
    }
    await refreshAll();
    schedulePolling();
    window.addEventListener("resize", resize);
  }

  function resize() {
    state.chart?.resize();
  }

  function stop() {
    state.active = false;
    clearInterval(state.timer);
    state.timer = null;
    window.removeEventListener("resize", resize);
    if (state.chart) {
      state.chart.dispose();
      state.chart = null;
    }
  }

  function currentTabIsLive() {
    return document.querySelector(".tab-button.active")?.dataset.tab === "tab-live-frequency"
      || window.location.hash.startsWith("#/live-frequency");
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (currentTabIsLive()) start();
  });

  window.addEventListener("gridfreq:tabchange", (event) => {
    if (event.detail?.tabId === "tab-live-frequency") start();
    else if (state.active) stop();
  });

  window.GridFreqLiveFrequency = { start, stop, refresh: refreshAll };
})();
