(() => {
  const POLL_MS = 60_000;
  const SUMMARY_SYNC_MS = 300_000;
  const NOMINAL_HZ = 50;
  const NORMAL_AGE_MS = 20 * 60_000;
  const DELAYED_AGE_MS = 30 * 60_000;
  const RANGE_LABELS = new Map([
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
    rangeSeconds: 3600,
    lastTimestampMs: 0,
    lastSeriesSyncMs: 0,
    visibilityBound: false,
    refreshInFlight: null,
    pollInFlight: null
  };

  const $ = (id) => document.getElementById(id);

  function apiBaseUrl() {
    return String(window.GRIDFREQ_CONFIG?.liveApiBaseUrl || "").replace(/\/$/, "");
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
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
    const parsed = Date.parse(iso);
    if (!Number.isFinite(parsed)) return "-";
    const ageSeconds = Math.max(0, Math.floor((Date.now() - parsed) / 1000));
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

  function measurementFreshness(status = state.status) {
    const measuredAt = status?.latestMeasurementTime ? Date.parse(status.latestMeasurementTime) : NaN;
    if (!Number.isFinite(measuredAt)) {
      return {
        label: "Veri bekleniyor",
        dot: "stale",
        bannerTone: "warn",
        banner: "GridRadar ölçüm zamanı henüz alınamadı; veri tamponu hazırlanıyor."
      };
    }
    const ageMs = Math.max(0, Date.now() - measuredAt);
    if (ageMs <= NORMAL_AGE_MS) {
      return {
        label: "Sağlıklı",
        dot: "healthy",
        bannerTone: "success",
        banner: "Kıta Avrupası · GridRadar · yaklaşık 15 dakika gecikmeli veri gösteriliyor."
      };
    }
    if (ageMs <= DELAYED_AGE_MS) {
      return {
        label: "Gecikmeli",
        dot: "delayed",
        bannerTone: "warn",
        banner: "GridRadar ölçümü beklenen gecikmenin üzerinde; mevcut 60 saniyelik özet seri korunuyor."
      };
    }
    return {
      label: "Veri akışı kesintili",
      dot: "stale",
      bannerTone: "muted",
      banner: "Veri akışı kesintili veya eski; son alınan GridRadar ölçümü gösteriliyor."
    };
  }

  function updateStatusFromFreshness() {
    const freshness = measurementFreshness();
    if (!state.minuteSeries.length) {
      setStatus("İlk 24 saatlik tampon hazırlanıyor; henüz grafik verisi yok.", "warn");
      return;
    }
    setStatus(freshness.banner, freshness.bannerTone);
  }

  function selectedMinuteSeries() {
    const cutoff = Date.now() - state.rangeSeconds * 1000;
    return state.minuteSeries.filter((point) => Date.parse(point.timestamp) >= cutoff);
  }

  function computeSeriesStats(series) {
    const valid = series.filter((point) => Number.isFinite(point.meanHz));
    const minValues = series.map((point) => point.minHz).filter(Number.isFinite);
    const maxValues = series.map((point) => point.maxHz).filter(Number.isFinite);
    let weightedSum = 0;
    let weightTotal = 0;
    valid.forEach((point) => {
      const weight = Math.max(0, Number(point.validSamples) || 0);
      if (weight > 0) {
        weightedSum += point.meanHz * weight;
        weightTotal += weight;
      }
    });
    const mean = weightTotal
      ? weightedSum / weightTotal
      : valid.length
        ? valid.reduce((sum, point) => sum + point.meanHz, 0) / valid.length
        : NaN;
    return {
      mean,
      min: minValues.length ? Math.min(...minValues) : NaN,
      max: maxValues.length ? Math.max(...maxValues) : NaN,
      points: series.length
    };
  }

  function kpi(label, valueHtml, sub = "", tooltip = "") {
    const safeLabel = escapeHtml(label);
    const safeSub = escapeHtml(sub);
    const tooltipAttrs = tooltip
      ? ` tabindex="0" data-tooltip="${escapeHtml(tooltip)}" aria-label="${safeLabel}: ${escapeHtml(tooltip)}"`
      : "";
    return `<article class="live-frequency-kpi"${tooltipAttrs}><div class="label">${safeLabel}</div><div class="value">${valueHtml}</div>${safeSub ? `<div class="sub">${safeSub}</div>` : ""}</article>`;
  }

  function renderKpis() {
    const root = $("liveFrequencyKpis");
    if (!root) return;
    const status = state.status || {};
    const series = selectedMinuteSeries();
    const stats = computeSeriesStats(series);
    const freshness = measurementFreshness(status);
    const age = formatAge(status.latestMeasurementTime);
    const rangeLabel = RANGE_LABELS.get(state.rangeSeconds) || "Seçili aralık";
    const maxMeanMin = [
      `<span class="live-frequency-stat"><b>Mak</b> ${escapeHtml(formatHz(stats.max))}</span>`,
      `<span class="live-frequency-stat"><b>Ort</b> ${escapeHtml(formatHz(stats.mean))}</span>`,
      `<span class="live-frequency-stat"><b>Min</b> ${escapeHtml(formatHz(stats.min))}</span>`
    ].join("");
    root.innerHTML = [
      kpi(
        "Ölçüm Zamanı",
        escapeHtml(formatTime(status.latestMeasurementTime)),
        "Yerel tarih ve saat",
        "GridRadar tarafından sağlanan son frekans ölçümünün tarayıcı yerel saatine çevrilmiş zamanıdır."
      ),
      kpi(
        "Bağlantı / Veri Yaşı",
        `<span class="live-frequency-status-line"><span class="live-frequency-status-dot ${freshness.dot}" aria-hidden="true"></span>${escapeHtml(freshness.label)}</span>`,
        age,
        "Durum, son ölçüm zamanı ile şu an arasındaki yaşa göre hesaplanır: 20 dakikaya kadar sağlıklı, 20-30 dakika gecikmeli, 30 dakikadan eskiyse veri akışı zayıf kabul edilir."
      ),
      kpi(
        "Mak-Ort-Min",
        `<span class="live-frequency-stat-stack">${maxMeanMin}</span>`,
        `${rangeLabel} · ${stats.points.toLocaleString("tr-TR")} dk`,
        "Maksimum, ortalama ve minimum değerler seçili zaman aralığındaki 60 saniyelik özet GridRadar serisinden hesaplanır."
      ),
      kpi(
        "Nominal Sapma",
        escapeHtml(formatMhz(status.latestFrequencyHz)),
        "50.000 Hz referans",
        "Son frekans ölçümünün nominal 50.000 Hz sistem frekansından mHz cinsinden farkıdır."
      )
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

  async function renderChart() {
    const chart = ensureChart();
    if (!chart) return;
    const minute = selectedMinuteSeries();
    const axisData = minute.map((point) => point.timestamp);
    chart.setOption({
      animation: false,
      color: ["#111827", "#c83c3c", "#6b7280"],
      tooltip: {
        trigger: "axis",
        formatter(params) {
          const time = params?.[0]?.axisValue;
          const date = new Date(time);
          const utc = Number.isNaN(date.getTime()) ? time : date.toISOString().replace("T", " ").replace(".000Z", " UTC");
          const local = Number.isNaN(date.getTime()) ? "" : date.toLocaleString("tr-TR", { hour12: false });
          const rows = params.map((item) => `${item.marker}${item.seriesName}: ${formatHz(item.value, 4)}`).join("<br>");
          return `${utc}<br>${local}<br>${rows}`;
        }
      },
      legend: { top: 0 },
      grid: { left: 52, right: 20, top: 54, bottom: 54 },
      xAxis: { type: "category", data: axisData, boundaryGap: false },
      yAxis: { type: "value", scale: true, axisLabel: { formatter: (value) => Number(value).toFixed(3) } },
      dataZoom: [{ type: "inside" }, { type: "slider", height: 24 }],
      series: [
        {
          name: "Canlı frekans",
          type: "line",
          data: minute.map((point) => point.meanHz),
          showSymbol: false,
          connectNulls: false,
          lineStyle: { width: 2, color: "#111827" },
          markLine: {
            silent: true,
            symbol: "none",
            data: [
              { yAxis: 50, lineStyle: { color: "#17212b", width: 1.2 }, label: { formatter: "50.000 Hz" } }
            ]
          }
        },
        {
          name: "Maksimum",
          type: "line",
          data: minute.map((point) => point.maxHz),
          showSymbol: false,
          connectNulls: false,
          lineStyle: { width: 1.2, color: "#c83c3c", opacity: 0.82 }
        },
        {
          name: "Minimum",
          type: "line",
          data: minute.map((point) => point.minHz),
          showSymbol: false,
          connectNulls: false,
          lineStyle: { width: 1.2, color: "#6b7280", opacity: 0.78 }
        }
      ].filter((series) => series.data.length)
    }, true);
  }

  function updateLastTimestampFromStatus() {
    const latest = state.status?.latestMeasurementTime ? Date.parse(state.status.latestMeasurementTime) : 0;
    if (Number.isFinite(latest)) state.lastTimestampMs = Math.max(state.lastTimestampMs, latest || 0);
  }

  async function syncMinuteSeries() {
    const series = await fetchJson("/v1/live/series?range=24h&resolution=60s");
    state.minuteSeries = Array.isArray(series) ? series : [];
    state.lastSeriesSyncMs = Date.now();
  }

  async function refreshAll() {
    if (state.refreshInFlight) return state.refreshInFlight;
    state.refreshInFlight = (async () => {
      if (!apiBaseUrl()) {
        setStatus("Worker API URL yapılandırılmadı. Cloudflare deploy sonrası bu sekme otomatik bağlanacak.", "warn");
        renderKpis();
        return;
      }
      setStatus("Canlı frekans verisi yükleniyor.", "muted");
      try {
        const [status] = await Promise.all([
          fetchJson("/v1/live/status"),
          syncMinuteSeries()
        ]);
        state.status = status;
        updateLastTimestampFromStatus();
        updateStatusFromFreshness();
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
    })();
    try {
      return await state.refreshInFlight;
    } finally {
      state.refreshInFlight = null;
    }
  }

  async function pollLiveData() {
    if (!state.active || document.hidden || !apiBaseUrl() || state.pollInFlight) return;
    state.pollInFlight = (async () => {
      try {
        const [status, delta] = await Promise.all([
          fetchJson("/v1/live/status"),
          fetchJson(`/v1/live/delta?after=${state.lastTimestampMs || 0}`)
        ]);
        state.status = status;
        updateLastTimestampFromStatus();
        if (Array.isArray(delta) && delta.length) {
          state.lastTimestampMs = Math.max(...delta.map((point) => Number(point.timestampMs) || 0), state.lastTimestampMs);
        }
        if (Date.now() - state.lastSeriesSyncMs >= SUMMARY_SYNC_MS) {
          await syncMinuteSeries();
          await renderChart();
        }
        updateStatusFromFreshness();
        renderKpis();
        renderBufferNotice();
      } catch {
        setStatus("Canlı veri yenilemesi gecikti; mevcut grafik korunuyor.", "warn");
      }
    })();
    try {
      return await state.pollInFlight;
    } finally {
      state.pollInFlight = null;
    }
  }

  function clearPolling() {
    if (state.timer !== null) clearInterval(state.timer);
    state.timer = null;
  }

  function schedulePolling() {
    clearPolling();
    if (!state.active || document.hidden) return;
    state.timer = window.setInterval(pollLiveData, POLL_MS);
  }

  function bindControls() {
    document.querySelectorAll("[data-live-range]").forEach((button) => {
      if (button.dataset.boundLiveRange) return;
      button.dataset.boundLiveRange = "1";
      button.addEventListener("click", async () => {
        state.rangeSeconds = Number(button.dataset.liveRange) || 3600;
        document.querySelectorAll("[data-live-range]").forEach((item) => item.classList.toggle("active", item === button));
        setStatus(`${RANGE_LABELS.get(state.rangeSeconds) || "Seçili aralık"} gösteriliyor.`, "muted");
        renderKpis();
        await renderChart();
      });
    });
  }

  function onVisibilityChange() {
    if (!state.active) return;
    if (document.hidden) {
      clearPolling();
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
    clearPolling();
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
