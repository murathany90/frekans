(() => {
  const POLL_MS = 60_000;
  const SUMMARY_SYNC_MS = 300_000;
  const NOMINAL_HZ = 50;
  const NORMAL_AGE_MS = 20 * 60_000;
  const DELAYED_AGE_MS = 30 * 60_000;
  const RAW_WINDOW_MS = 60 * 60_000;
  const RETENTION_MS = 24 * 60 * 60_000;
  const ZOOM_RAW_THRESHOLD_MS = 15 * 60_000;
  const SUMMARY_COLOR = "#111827";
  const MAX_COLOR = "#ef9a9a";
  const MIN_COLOR = "#9ca3af";

  const COPY = {
    tr: {
      title: "Kıta Avrupası Canlı Frekansı",
      subtitle: "Kıta Avrupası · GridRadar · yaklaşık 15 dakika gecikmeli",
      chartSubtitle: "1 saat görünümünde saniyelik seri; 6/24 saat görünümünde 60 saniyelik özet kullanılır.",
      chartAria: "Yaklaşık 15 dakika gecikmeli Kıta Avrupası frekans grafiği",
      sourceTitle: "Veri Kaynağı",
      sourceSplit: "Tarihsel/Günlük Kıta Avrupası verisi: Netztransparenz · Canlı/gecikmeli Kıta Avrupası verisi: GridRadar",
      providerMeta: "1 s çözünürlük · ~15 dk gecikme",
      providerAria: "GridRadar resmi frekans sayfası",
      officialLink: "GridRadar frekans sayfası",
      commercialLink: "Ticari veya profesyonel veri erişimi için GridRadar ile iletişime geçin.",
      termsSummary: "Veri kullanım koşulları",
      termsText: "Bu sayfada gösterilen Kıta Avrupası frekans verileri GridRadar tarafından sağlanmaktadır. Veriler yalnızca kişisel, ticari olmayan ve fonlanmamış akademik araştırma amaçlarıyla görüntülenmek üzere sunulmaktadır. Ticari veya profesyonel kullanım, şirket içi analiz, danışmanlık, ücretli ürün ve hizmetler veya fonlanan araştırma projelerinde kullanım için GridRadar’dan önceden uygun kullanım izni alınmalıdır.",
      rangeLabel: "Canlı frekans zaman aralığı",
      range1h: "Son 1 saat",
      range6h: "Son 6 saat",
      range24h: "Son 24 saat",
      rangeTitle1h: "Son 1 Saat",
      rangeTitle6h: "Son 6 Saat",
      rangeTitle24h: "Son 24 Saat",
      previousHour: "Önceki saat",
      nextHour: "Sonraki saat",
      modulePreparing: "Canlı frekans modülü hazırlanıyor.",
      apiMissing: "Worker API URL yapılandırılmadı. Cloudflare deploy sonrası bu sekme otomatik bağlanacak.",
      loading: "Canlı frekans verisi yükleniyor.",
      showingRange: "{range} gösteriliyor.",
      firstBuffer: "Seçili zaman aralığı için veri tamponu hazırlanıyor.",
      waitingLabel: "Veri bekleniyor",
      waitingBanner: "GridRadar ölçüm zamanı henüz alınamadı; veri tamponu hazırlanıyor.",
      healthyLabel: "Sağlıklı",
      healthyBanner: "Kıta Avrupası · GridRadar · yaklaşık 15 dakika gecikmeli veri gösteriliyor.",
      delayedLabel: "Gecikmeli",
      delayedBanner: "GridRadar ölçümü beklenen gecikmenin üzerinde; mevcut veri korunuyor.",
      staleLabel: "Veri akışı zayıf",
      staleBanner: "Veri akışı kesintili veya eski; son alınan GridRadar ölçümü gösteriliyor.",
      rawFallback: "Saniyelik seri alınamadı; mevcut 60 saniyelik özet görünüm korunuyor.",
      connectionErrorAuth: "GridRadar API token/yetki sorunu. Worker secret durumunu kontrol edin.",
      connectionError: "GridRadar bağlantısı veya Worker geçici olarak kullanılamıyor.",
      pollWarn: "Canlı veri yenilemesi gecikti; mevcut grafik korunuyor.",
      bufferNotice: "Seçili zaman aralığı için veri tamponu hazırlanıyor. Mevcut geçmiş: {duration}.",
      kpiMeasurementTime: "Ölçüm Zamanı",
      kpiMeasurementSub: "Yerel tarih ve saat",
      kpiMeasurementTooltip: "GridRadar tarafından sağlanan son frekans ölçümünün tarayıcı yerel saatine çevrilmiş zamanıdır.",
      kpiConnection: "Bağlantı / Veri Yaşı",
      kpiConnectionTooltip: "Durum, son ölçüm zamanı ile şu an arasındaki yaşa göre hesaplanır: 20 dakikaya kadar sağlıklı, 20-30 dakika gecikmeli, 30 dakikadan eskiyse veri akışı zayıf kabul edilir.",
      kpiStats: "Mak-Ort-Min",
      kpiStatsTooltip: "Maksimum, ortalama ve minimum değerler seçili zaman aralığından hesaplanır. 6/24 saat özet ortalaması validSamples ile ağırlıklandırılır.",
      kpiNominal: "Nominal Sapma",
      kpiNominalSub: "50.000 Hz referans",
      kpiNominalTooltip: "Son frekans ölçümünün nominal 50.000 Hz sistem frekansından mHz cinsinden farkıdır.",
      statMax: "Mak",
      statMean: "Ort",
      statMin: "Min",
      pointUnitSecond: "sn",
      pointUnitMinute: "dk",
      seriesRaw: "Saniyelik frekans",
      seriesMean: "Ortalama frekans",
      seriesMax: "Maksimum",
      seriesMin: "Minimum",
      seriesZoomRaw: "Zoom 1 s frekans",
      hourWindow: "{from} - {to}",
      unavailable: "-"
    },
    en: {
      title: "Continental Europe Live Frequency",
      subtitle: "Continental Europe · GridRadar · about 15 minutes delayed",
      chartSubtitle: "The 1 hour view uses a 1 s series; 6/24 hour views normally use a 60 s summary.",
      chartAria: "Continental Europe frequency chart delayed by about 15 minutes",
      sourceTitle: "Data Source",
      sourceSplit: "Historical/Daily Continental Europe data: Netztransparenz · Live/delayed Continental Europe data: GridRadar",
      providerMeta: "1 s resolution · ~15 min delay",
      providerAria: "GridRadar official mains frequency page",
      officialLink: "GridRadar frequency page",
      commercialLink: "Commercial or professional data access: contact GridRadar.",
      termsSummary: "Data use terms",
      termsText: "The Continental Europe frequency data shown on this page is provided by GridRadar. The data is presented only for viewing for personal, non-commercial and unfunded academic research purposes. Commercial or professional use, internal company analysis, consulting, paid products and services, or funded research projects require appropriate prior permission from GridRadar.",
      rangeLabel: "Live frequency time range",
      range1h: "Last 1 Hour",
      range6h: "Last 6 Hours",
      range24h: "Last 24 Hours",
      rangeTitle1h: "Last 1 Hour",
      rangeTitle6h: "Last 6 Hours",
      rangeTitle24h: "Last 24 Hours",
      previousHour: "Previous hour",
      nextHour: "Next hour",
      modulePreparing: "Preparing the live frequency module.",
      apiMissing: "Worker API URL is not configured. This tab will connect automatically after the Cloudflare deploy.",
      loading: "Loading live frequency data.",
      showingRange: "Showing {range}.",
      firstBuffer: "Preparing the data buffer for the selected time range.",
      waitingLabel: "Waiting for data",
      waitingBanner: "GridRadar measurement time is not available yet; the data buffer is being prepared.",
      healthyLabel: "Healthy",
      healthyBanner: "Continental Europe · GridRadar · about 15 minutes delayed data is shown.",
      delayedLabel: "Delayed",
      delayedBanner: "The GridRadar measurement is older than expected; the current data is kept.",
      staleLabel: "Data flow weak",
      staleBanner: "The data flow is interrupted or old; the last received GridRadar measurement is shown.",
      rawFallback: "The 1 s series could not be loaded; the current 60 s summary view is kept.",
      connectionErrorAuth: "GridRadar API token/permission problem. Check the Worker secret.",
      connectionError: "GridRadar connection or Worker is temporarily unavailable.",
      pollWarn: "Live data refresh was delayed; the current chart is kept.",
      bufferNotice: "Preparing the data buffer for the selected range. Available history: {duration}.",
      kpiMeasurementTime: "Measurement Time",
      kpiMeasurementSub: "Local date and time",
      kpiMeasurementTooltip: "The latest frequency measurement supplied by GridRadar, converted to your browser's local time.",
      kpiConnection: "Connection / Data Age",
      kpiConnectionTooltip: "The status is calculated from the age of the latest measurement: healthy up to 20 minutes, delayed between 20 and 30 minutes, weak if older than 30 minutes.",
      kpiStats: "Max-Avg-Min",
      kpiStatsTooltip: "Maximum, average and minimum values are calculated from the selected time range. The 6/24 hour summary average is weighted by validSamples.",
      kpiNominal: "Nominal Deviation",
      kpiNominalSub: "50.000 Hz reference",
      kpiNominalTooltip: "Difference between the latest frequency measurement and the nominal 50.000 Hz system frequency, in mHz.",
      statMax: "Max",
      statMean: "Avg",
      statMin: "Min",
      pointUnitSecond: "s",
      pointUnitMinute: "min",
      seriesRaw: "1 s frequency",
      seriesMean: "Average frequency",
      seriesMax: "Maximum",
      seriesMin: "Minimum",
      seriesZoomRaw: "Zoom 1 s frequency",
      hourWindow: "{from} - {to}",
      unavailable: "-"
    }
  };

  const state = {
    active: false,
    timer: null,
    chart: null,
    status: null,
    minuteSeries: [],
    rawHourSeries: [],
    rangeSeconds: 3600,
    hourOffset: 0,
    lastTimestampMs: 0,
    lastSeriesSyncMs: 0,
    visibilityBound: false,
    controlsBound: false,
    languageBound: false,
    languageObserver: null,
    refreshInFlight: null,
    pollInFlight: null,
    chartRequestId: 0,
    oneSecondCache: new Map(),
    zoomRaw: null,
    zoomFetchKey: "",
    lastZoom: null,
    suppressZoom: false,
    zoomHandler: null
  };

  const $ = (id) => document.getElementById(id);

  function apiBaseUrl() {
    return String(window.GRIDFREQ_CONFIG?.liveApiBaseUrl || "").replace(/\/$/, "");
  }

  function currentLang() {
    const lang = document.documentElement.getAttribute("data-current-lang") || document.documentElement.lang || "tr";
    return String(lang).toLowerCase().startsWith("en") ? "en" : "tr";
  }

  function locale() {
    return currentLang() === "en" ? "en-US" : "tr-TR";
  }

  function copy(key, vars = {}) {
    const value = COPY[currentLang()]?.[key] ?? COPY.tr[key] ?? key;
    return Object.entries(vars).reduce((text, [name, replacement]) => text.replaceAll(`{${name}}`, String(replacement)), value);
  }

  function rangeKey(seconds = state.rangeSeconds, prefix = "range") {
    if (seconds === 3600) return `${prefix}1h`;
    if (seconds === 21600) return `${prefix}6h`;
    return `${prefix}24h`;
  }

  function rangeLabel(seconds = state.rangeSeconds) {
    return copy(rangeKey(seconds));
  }

  function rangeTitle(seconds = state.rangeSeconds) {
    return copy(rangeKey(seconds, "rangeTitle"));
  }

  function setText(id, text) {
    const node = $(id);
    if (node) node.textContent = text;
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
    if (!Number.isFinite(value)) return copy("unavailable");
    return `${value.toLocaleString(locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits })} Hz`;
  }

  function formatMhz(value) {
    if (!Number.isFinite(value)) return copy("unavailable");
    const mhz = (value - NOMINAL_HZ) * 1000;
    const sign = mhz > 0 ? "+" : "";
    return `${sign}${mhz.toLocaleString(locale(), { maximumFractionDigits: 1 })} mHz`;
  }

  function formatTime(value) {
    if (!value) return copy("unavailable");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return copy("unavailable");
    return date.toLocaleString(locale(), { hour12: false });
  }

  function formatShortTime(ms) {
    const date = new Date(ms);
    if (Number.isNaN(date.getTime())) return copy("unavailable");
    return date.toLocaleString(locale(), { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
  }

  function formatAge(iso) {
    if (!iso) return copy("unavailable");
    const parsed = Date.parse(iso);
    if (!Number.isFinite(parsed)) return copy("unavailable");
    const ageSeconds = Math.max(0, Math.floor((Date.now() - parsed) / 1000));
    const minutes = Math.floor(ageSeconds / 60);
    const hours = Math.floor(minutes / 60);
    if (currentLang() === "en") {
      if (hours > 0) return `${hours} h ${minutes % 60} min`;
      return `${minutes} min`;
    }
    if (hours > 0) return `${hours} sa ${minutes % 60} dk`;
    return `${minutes} dk`;
  }

  function formatDuration(seconds) {
    const totalSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (currentLang() === "en") return `${hours} h ${minutes} min`;
    return `${hours} saat ${minutes} dakika`;
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

  function renderStaticCopy() {
    setText("liveFrequencyTitle", copy("title"));
    setText("liveFrequencySubtitle", copy("subtitle"));
    setText("liveFrequencySourceTag", "GridRadar");
    setText("liveFrequencyChartTitle", rangeTitle());
    setText("liveFrequencyChartSubtitle", copy("chartSubtitle"));
    setText("liveFrequencySourceTitle", copy("sourceTitle"));
    setText("liveFrequencySourceSplit", copy("sourceSplit"));
    setText("liveFrequencyProviderName", "GridRadar");
    setText("liveFrequencyProviderMeta", copy("providerMeta"));
    setText("liveFrequencyOfficialLink", copy("officialLink"));
    setText("liveFrequencyCommercialLink", copy("commercialLink"));
    setText("liveFrequencyTermsSummary", copy("termsSummary"));
    setText("liveFrequencyTermsText", copy("termsText"));

    const chart = $("liveFrequencyChart");
    if (chart) chart.setAttribute("aria-label", copy("chartAria"));

    const controls = $("liveFrequencyRangeControls");
    if (controls) controls.setAttribute("aria-label", copy("rangeLabel"));

    document.querySelectorAll("[data-live-range]").forEach((button) => {
      const seconds = Number(button.dataset.liveRange) || 3600;
      button.textContent = rangeLabel(seconds);
    });

    const provider = document.querySelector(".live-frequency-provider");
    if (provider) provider.setAttribute("aria-label", copy("providerAria"));

    $("liveFrequencyPrevHour")?.setAttribute("aria-label", copy("previousHour"));
    $("liveFrequencyNextHour")?.setAttribute("aria-label", copy("nextHour"));
    updateHourNav();
  }

  function bindLanguageObserver() {
    if (state.languageBound) return;
    state.languageObserver = new MutationObserver(() => {
      renderStaticCopy();
      if (!state.active) return;
      updateStatusFromFreshness();
      renderKpis();
      renderBufferNotice();
      renderChart();
    });
    state.languageObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-current-lang", "lang"] });
    state.languageBound = true;
  }

  function measurementFreshness(status = state.status) {
    const measuredAt = status?.latestMeasurementTime ? Date.parse(status.latestMeasurementTime) : NaN;
    if (!Number.isFinite(measuredAt)) {
      return {
        label: copy("waitingLabel"),
        dot: "stale",
        bannerTone: "warn",
        banner: copy("waitingBanner")
      };
    }
    const ageMs = Math.max(0, Date.now() - measuredAt);
    if (ageMs <= NORMAL_AGE_MS) {
      return {
        label: copy("healthyLabel"),
        dot: "healthy",
        bannerTone: "success",
        banner: copy("healthyBanner")
      };
    }
    if (ageMs <= DELAYED_AGE_MS) {
      return {
        label: copy("delayedLabel"),
        dot: "delayed",
        bannerTone: "warn",
        banner: copy("delayedBanner")
      };
    }
    return {
      label: copy("staleLabel"),
      dot: "stale",
      bannerTone: "muted",
      banner: copy("staleBanner")
    };
  }

  function updateStatusFromFreshness() {
    const freshness = measurementFreshness();
    if (!state.minuteSeries.length && !state.rawHourSeries.length) {
      setStatus(copy("firstBuffer"), "warn");
      return;
    }
    setStatus(freshness.banner, freshness.bannerTone);
  }

  function latestMeasurementMs() {
    const latest = state.status?.latestMeasurementTime ? Date.parse(state.status.latestMeasurementTime) : NaN;
    if (Number.isFinite(latest)) return latest;
    const lastMinute = state.minuteSeries.at(-1)?.timestamp ? Date.parse(state.minuteSeries.at(-1).timestamp) : NaN;
    if (Number.isFinite(lastMinute)) return lastMinute;
    return 0;
  }

  function selectedMinuteSeries() {
    const anchor = latestMeasurementMs() || Date.now();
    const cutoff = anchor - state.rangeSeconds * 1000;
    return state.minuteSeries.filter((point) => {
      const timestamp = Date.parse(point.timestamp);
      return Number.isFinite(timestamp) && timestamp >= cutoff && timestamp <= anchor + 60_000;
    });
  }

  function computeSummaryStats(series) {
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
      points: series.length,
      unit: copy("pointUnitMinute")
    };
  }

  function computeRawStats(series) {
    const values = series.map((point) => point.frequencyHz).filter(Number.isFinite);
    return {
      mean: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : NaN,
      min: values.length ? Math.min(...values) : NaN,
      max: values.length ? Math.max(...values) : NaN,
      points: values.length,
      unit: copy("pointUnitSecond")
    };
  }

  function selectedStats() {
    if (state.rangeSeconds === 3600 && state.rawHourSeries.length) {
      return computeRawStats(state.rawHourSeries);
    }
    return computeSummaryStats(selectedMinuteSeries());
  }

  function kpi(label, valueHtml, sub = "", tooltip = "") {
    const safeLabel = escapeHtml(label);
    const safeSub = escapeHtml(sub);
    const tooltipAttrs = tooltip
      ? ` tabindex="0" title="${escapeHtml(tooltip)}" data-tooltip="${escapeHtml(tooltip)}" aria-label="${safeLabel}: ${escapeHtml(tooltip)}"`
      : "";
    return `<article class="live-frequency-kpi"${tooltipAttrs}><div class="label">${safeLabel}</div><div class="value">${valueHtml}</div>${safeSub ? `<div class="sub">${safeSub}</div>` : ""}</article>`;
  }

  function renderKpis() {
    const root = $("liveFrequencyKpis");
    if (!root) return;
    const status = state.status || {};
    const stats = selectedStats();
    const freshness = measurementFreshness(status);
    const age = formatAge(status.latestMeasurementTime);
    const maxMeanMin = [
      `<span class="live-frequency-stat"><b>${escapeHtml(copy("statMax"))}</b> ${escapeHtml(formatHz(stats.max))}</span>`,
      `<span class="live-frequency-stat"><b>${escapeHtml(copy("statMean"))}</b> ${escapeHtml(formatHz(stats.mean))}</span>`,
      `<span class="live-frequency-stat"><b>${escapeHtml(copy("statMin"))}</b> ${escapeHtml(formatHz(stats.min))}</span>`
    ].join("");
    root.innerHTML = [
      kpi(
        copy("kpiMeasurementTime"),
        escapeHtml(formatTime(status.latestMeasurementTime)),
        copy("kpiMeasurementSub"),
        copy("kpiMeasurementTooltip")
      ),
      kpi(
        copy("kpiConnection"),
        `<span class="live-frequency-status-line"><span class="live-frequency-status-dot ${freshness.dot}" aria-hidden="true"></span>${escapeHtml(freshness.label)}</span>`,
        age,
        copy("kpiConnectionTooltip")
      ),
      kpi(
        copy("kpiStats"),
        `<span class="live-frequency-stat-stack">${maxMeanMin}</span>`,
        `${rangeTitle()} · ${stats.points.toLocaleString(locale())} ${stats.unit}`,
        copy("kpiStatsTooltip")
      ),
      kpi(
        copy("kpiNominal"),
        escapeHtml(formatMhz(status.latestFrequencyHz)),
        copy("kpiNominalSub"),
        copy("kpiNominalTooltip")
      )
    ].join("");
  }

  function derivedHistorySeconds() {
    const timestamps = state.minuteSeries.map((point) => Date.parse(point.timestamp)).filter(Number.isFinite);
    if (timestamps.length < 2) return 0;
    return Math.max(0, Math.floor((Math.max(...timestamps) - Math.min(...timestamps)) / 1000));
  }

  function renderBufferNotice() {
    const node = $("liveFrequencyBufferNotice");
    if (!node) return;
    const seconds = Number(state.status?.availableHistorySeconds || 0) || derivedHistorySeconds();
    if (!seconds || seconds >= state.rangeSeconds) {
      node.hidden = true;
      node.textContent = "";
      return;
    }
    node.hidden = false;
    node.textContent = copy("bufferNotice", { duration: formatDuration(seconds) });
  }

  function ensureChart() {
    const host = $("liveFrequencyChart");
    if (!host || !window.echarts) return null;
    if (!state.chart) state.chart = window.echarts.init(host);
    bindChartZoom(state.chart);
    return state.chart;
  }

  function bindChartZoom(chart) {
    if (!chart || state.zoomHandler) return;
    state.zoomHandler = (event) => handleDataZoom(event);
    chart.on("dataZoom", state.zoomHandler);
  }

  function latestRawHistoryMs() {
    const seconds = Number(state.status?.availableHistorySeconds || 0);
    return Math.min(seconds > 0 ? seconds * 1000 : RETENTION_MS, RETENTION_MS);
  }

  function maxHourOffset() {
    const historyMs = latestRawHistoryMs();
    return Math.max(0, Math.floor((historyMs - RAW_WINDOW_MS) / RAW_WINDOW_MS));
  }

  function currentHourWindow() {
    const latest = latestMeasurementMs() || Date.now();
    const maxOffset = maxHourOffset();
    state.hourOffset = Math.min(Math.max(0, state.hourOffset), maxOffset);
    const unclampedTo = latest - state.hourOffset * RAW_WINDOW_MS;
    const earliest = latest - latestRawHistoryMs();
    const fromMs = Math.max(earliest, unclampedTo - RAW_WINDOW_MS);
    const toMs = Math.max(fromMs + 1000, unclampedTo);
    return { fromMs, toMs };
  }

  function updateHourNav(windowRange = null) {
    const nav = $("liveFrequencyHourNav");
    if (!nav) return;
    const isHourly = state.rangeSeconds === 3600;
    nav.hidden = !isHourly;
    const prev = $("liveFrequencyPrevHour");
    const next = $("liveFrequencyNextHour");
    if (prev) prev.disabled = !isHourly || state.hourOffset >= maxHourOffset();
    if (next) next.disabled = !isHourly || state.hourOffset <= 0;
    const label = $("liveFrequencyWindowLabel");
    if (label) {
      const range = windowRange || (isHourly ? currentHourWindow() : null);
      label.textContent = range ? copy("hourWindow", { from: formatShortTime(range.fromMs), to: formatShortTime(range.toMs) }) : "";
    }
  }

  function normalizeRawWindow(fromMs, toMs) {
    let from = Math.floor(Number(fromMs) / 1000) * 1000;
    let to = Math.ceil(Number(toMs) / 1000) * 1000;
    if (!Number.isFinite(from) || !Number.isFinite(to)) {
      const now = Date.now();
      from = now - RAW_WINDOW_MS;
      to = now;
    }
    if (to <= from) to = from + 1000;
    if (to - from > RAW_WINDOW_MS) from = to - RAW_WINDOW_MS;
    return { fromMs: from, toMs: to, key: `${from}:${to}` };
  }

  function normalizeRawSeries(payload) {
    return (Array.isArray(payload) ? payload : []).map((point) => {
      const timestampMs = Number(point.timestampMs ?? Date.parse(point.timestamp || ""));
      const frequencyHz = Number(point.frequencyHz ?? point.meanHz ?? point.value);
      return { timestampMs, frequencyHz };
    }).filter((point) => Number.isFinite(point.timestampMs) && Number.isFinite(point.frequencyHz))
      .sort((a, b) => a.timestampMs - b.timestampMs);
  }

  async function fetchOneSecondSeries(fromMs, toMs) {
    const normalized = normalizeRawWindow(fromMs, toMs);
    const cached = state.oneSecondCache.get(normalized.key);
    if (cached) return cached;
    const path = `/v1/live/series?from=${encodeURIComponent(new Date(normalized.fromMs).toISOString())}&to=${encodeURIComponent(new Date(normalized.toMs).toISOString())}&resolution=1s`;
    const series = normalizeRawSeries(await fetchJson(path));
    state.oneSecondCache.set(normalized.key, series);
    return series;
  }

  function summaryDomainMs() {
    const minute = selectedMinuteSeries();
    const timestamps = minute.map((point) => Date.parse(point.timestamp)).filter(Number.isFinite);
    if (!timestamps.length) return null;
    return { min: Math.min(...timestamps), max: Math.max(...timestamps) };
  }

  function chartBaseOption(series, preserveZoom = false) {
    const zoom = preserveZoom && state.lastZoom ? state.lastZoom : { start: 0, end: 100 };
    return {
      animation: false,
      color: [SUMMARY_COLOR, MAX_COLOR, MIN_COLOR],
      tooltip: {
        trigger: "axis",
        formatter(params) {
          const first = params?.[0];
          const timeValue = Array.isArray(first?.value) ? first.value[0] : first?.axisValue;
          const date = new Date(timeValue);
          const utc = Number.isNaN(date.getTime()) ? timeValue : date.toISOString().replace("T", " ").replace(".000Z", " UTC");
          const local = Number.isNaN(date.getTime()) ? "" : date.toLocaleString(locale(), { hour12: false });
          const rows = params.map((item) => {
            const value = Array.isArray(item.value) ? item.value[1] : item.value;
            return `${item.marker}${item.seriesName}: ${formatHz(value, 4)}`;
          }).join("<br>");
          return `${utc}<br>${local}<br>${rows}`;
        }
      },
      legend: { top: 0 },
      grid: { left: 52, right: 20, top: 54, bottom: 54 },
      xAxis: { type: "time", boundaryGap: false },
      yAxis: { type: "value", scale: true, axisLabel: { formatter: (value) => Number(value).toFixed(3) } },
      dataZoom: [
        { type: "inside", filterMode: "none", start: zoom.start, end: zoom.end },
        { type: "slider", filterMode: "none", height: 24, start: zoom.start, end: zoom.end }
      ],
      series: series.filter((item) => item.data.length)
    };
  }

  function nominalMarkLine() {
    return {
      silent: true,
      symbol: "none",
      data: [
        { yAxis: NOMINAL_HZ, lineStyle: { color: "#17212b", width: 1 }, label: { formatter: "50.000 Hz" } }
      ]
    };
  }

  function renderSummaryChart(preserveZoom = false) {
    const chart = ensureChart();
    if (!chart) return;
    const minute = selectedMinuteSeries();
    const summaryOpacity = state.zoomRaw ? 0.42 : 1;
    const series = [
      {
        name: copy("seriesMean"),
        type: "line",
        data: minute.map((point) => [Date.parse(point.timestamp), point.meanHz]).filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1])),
        showSymbol: false,
        connectNulls: false,
        lineStyle: { width: 2, color: SUMMARY_COLOR, opacity: summaryOpacity },
        markLine: nominalMarkLine()
      },
      {
        name: copy("seriesMax"),
        type: "line",
        data: minute.map((point) => [Date.parse(point.timestamp), point.maxHz]).filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1])),
        showSymbol: false,
        connectNulls: false,
        lineStyle: { width: 1, color: MAX_COLOR, opacity: 0.48 }
      },
      {
        name: copy("seriesMin"),
        type: "line",
        data: minute.map((point) => [Date.parse(point.timestamp), point.minHz]).filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1])),
        showSymbol: false,
        connectNulls: false,
        lineStyle: { width: 1, color: MIN_COLOR, opacity: 0.44 }
      }
    ];
    if (state.zoomRaw?.points?.length) {
      series.push({
        name: copy("seriesZoomRaw"),
        type: "line",
        data: state.zoomRaw.points.map((point) => [point.timestampMs, point.frequencyHz]),
        showSymbol: false,
        connectNulls: false,
        lineStyle: { width: 2.2, color: SUMMARY_COLOR, opacity: 1 }
      });
    }
    state.suppressZoom = true;
    chart.setOption(chartBaseOption(series, preserveZoom), true);
    state.suppressZoom = false;
  }

  async function renderOneHourChart(requestId) {
    const chart = ensureChart();
    if (!chart) return;
    const windowRange = currentHourWindow();
    updateHourNav(windowRange);
    state.zoomRaw = null;
    state.lastZoom = null;
    try {
      const raw = await fetchOneSecondSeries(windowRange.fromMs, windowRange.toMs);
      if (requestId !== state.chartRequestId) return;
      state.rawHourSeries = raw;
      const series = [{
        name: copy("seriesRaw"),
        type: "line",
        data: raw.map((point) => [point.timestampMs, point.frequencyHz]),
        showSymbol: false,
        connectNulls: false,
        lineStyle: { width: 2, color: SUMMARY_COLOR, opacity: 1 },
        markLine: nominalMarkLine()
      }];
      state.suppressZoom = true;
      chart.setOption(chartBaseOption(series), true);
      state.suppressZoom = false;
      renderKpis();
    } catch {
      state.rawHourSeries = [];
      setStatus(copy("rawFallback"), "warn");
      renderSummaryChart();
      renderKpis();
    }
  }

  async function renderChart() {
    setText("liveFrequencyChartTitle", rangeTitle());
    setText("liveFrequencyChartSubtitle", copy("chartSubtitle"));
    const requestId = ++state.chartRequestId;
    if (state.rangeSeconds === 3600) {
      await renderOneHourChart(requestId);
    } else {
      state.rawHourSeries = [];
      updateHourNav();
      renderSummaryChart(Boolean(state.lastZoom));
      renderKpis();
    }
  }

  async function handleDataZoom(event) {
    if (state.suppressZoom || state.rangeSeconds === 3600) return;
    const detail = event?.batch?.[0] || event || {};
    const start = Number(detail.start);
    const end = Number(detail.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return;
    state.lastZoom = { start, end };
    const domain = summaryDomainMs();
    if (!domain || domain.max <= domain.min) return;
    const fromMs = domain.min + (domain.max - domain.min) * Math.min(start, end) / 100;
    const toMs = domain.min + (domain.max - domain.min) * Math.max(start, end) / 100;
    const visibleMs = toMs - fromMs;
    if (visibleMs <= ZOOM_RAW_THRESHOLD_MS) {
      const normalized = normalizeRawWindow(fromMs, toMs);
      if (state.zoomRaw?.key === normalized.key || state.zoomFetchKey === normalized.key) return;
      state.zoomFetchKey = normalized.key;
      try {
        const points = await fetchOneSecondSeries(normalized.fromMs, normalized.toMs);
        if (state.rangeSeconds === 3600) return;
        state.zoomRaw = { key: normalized.key, points };
        renderSummaryChart(true);
      } finally {
        state.zoomFetchKey = "";
      }
    } else if (state.zoomRaw) {
      state.zoomRaw = null;
      renderSummaryChart(true);
    }
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
      renderStaticCopy();
      if (!apiBaseUrl()) {
        setStatus(copy("apiMissing"), "warn");
        renderKpis();
        return;
      }
      setStatus(copy("loading"), "muted");
      try {
        const [status] = await Promise.all([
          fetchJson("/v1/live/status"),
          syncMinuteSeries()
        ]);
        state.status = status;
        updateLastTimestampFromStatus();
        await renderChart();
        updateStatusFromFreshness();
        renderKpis();
        renderBufferNotice();
      } catch (error) {
        const message = error?.message === "auth" ? copy("connectionErrorAuth") : copy("connectionError");
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
        let shouldRender = state.rangeSeconds === 3600;
        if (Date.now() - state.lastSeriesSyncMs >= SUMMARY_SYNC_MS) {
          await syncMinuteSeries();
          shouldRender = true;
        }
        if (shouldRender) await renderChart();
        updateStatusFromFreshness();
        renderKpis();
        renderBufferNotice();
      } catch {
        setStatus(copy("pollWarn"), "warn");
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
    if (state.controlsBound) return;
    state.controlsBound = true;
    document.querySelectorAll("[data-live-range]").forEach((button) => {
      button.addEventListener("click", async () => {
        state.rangeSeconds = Number(button.dataset.liveRange) || 3600;
        state.hourOffset = 0;
        state.zoomRaw = null;
        state.lastZoom = null;
        document.querySelectorAll("[data-live-range]").forEach((item) => item.classList.toggle("active", item === button));
        setStatus(copy("showingRange", { range: rangeLabel() }), "muted");
        renderStaticCopy();
        renderBufferNotice();
        await renderChart();
      });
    });
    $("liveFrequencyPrevHour")?.addEventListener("click", async () => {
      state.hourOffset = Math.min(maxHourOffset(), state.hourOffset + 1);
      await renderChart();
    });
    $("liveFrequencyNextHour")?.addEventListener("click", async () => {
      state.hourOffset = Math.max(0, state.hourOffset - 1);
      await renderChart();
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
    bindLanguageObserver();
    renderStaticCopy();
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
      state.zoomHandler = null;
    }
  }

  function currentTabIsLive() {
    return document.querySelector(".tab-button.active")?.dataset.tab === "tab-live-frequency"
      || window.location.hash.startsWith("#/live-frequency");
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (currentTabIsLive()) start();
    else {
      bindLanguageObserver();
      renderStaticCopy();
    }
  });

  window.addEventListener("gridfreq:tabchange", (event) => {
    if (event.detail?.tabId === "tab-live-frequency") start();
    else if (state.active) stop();
  });

  window.GridFreqLiveFrequency = { start, stop, refresh: refreshAll };
})();
