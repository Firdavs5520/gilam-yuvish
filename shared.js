(function () {
  const API = "https://gilam-yuvish-backend.onrender.com";
  const CLIENT_ADMIN_PASSWORD = "1234";
  const TOKEN_KEY = "gilamAuthToken";
  const TOKEN_EXPIRES_KEY = "gilamAuthExpiresAt";

  const fallbackStatuses = [
    { value: "received", label: "Qabul qilindi" },
    { value: "washing", label: "Yuvilmoqda" },
    { value: "drying", label: "Quritilmoqda" },
    { value: "ready", label: "Tayyor" },
    { value: "delivered", label: "Yetkazildi" },
  ];

  const fallbackSettings = {
    businessName: "ФАБРИКА ЧИСТКИ КОВРОВ",
    addressLine1: "Ул. Буюк Ипак Йули 62А",
    addressLine2: "Ташкент",
    phone: "71 203 82 82",
    logoUrl:
      "https://peculiar-azure-xpdzzqfo3r.edgeone.app/Skrinshot_2026-01-03_175603-removebg-preview.png",
    warningText:
      "Химчистка снимает с себя ответственность за скрытые дефекты изделия, сильный износ и отсутствие маркировки.\nПретензии принимаются только при получении заказа.",
    defaultPricePerM2: 15000,
  };

  let metaCache = null;

  function getToken() {
    const token = sessionStorage.getItem(TOKEN_KEY);
    const expiresAt = sessionStorage.getItem(TOKEN_EXPIRES_KEY);

    if (!token || !expiresAt) return "";
    if (new Date(expiresAt).getTime() <= Date.now()) {
      clearAuth();
      return "";
    }

    return token;
  }

  function setAuth(token, expiresAt) {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(TOKEN_EXPIRES_KEY, expiresAt);
  }

  function clearAuth() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_EXPIRES_KEY);
    metaCache = null;
  }

  function getCurrentPage() {
    return location.pathname.split("/").pop() || "index.html";
  }

  function redirectToLogin() {
    if (getCurrentPage() === "login.html") return;
    const returnTo = encodeURIComponent(`${location.pathname}${location.search}`);
    location.href = `login.html?returnTo=${returnTo}`;
  }

  function redirectAfterLogin() {
    const params = new URLSearchParams(location.search);
    const returnTo = params.get("returnTo");
    location.href = returnTo || "index.html";
  }

  async function readJsonResponse(response) {
    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const message =
        data?.message || data?.error || "So'rov bajarilmadi, qayta urinib ko'ring";
      throw new Error(message);
    }

    return data;
  }

  async function loginWithPassword(password) {
    if (password !== CLIENT_ADMIN_PASSWORD) {
      throw new Error("Admin parol noto‘g‘ri");
    }

    try {
      const response = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await readJsonResponse(response);

      if (!data.token || !data.expiresAt) throw new Error("Token olinmadi");

      setAuth(data.token, data.expiresAt);
      return data;
    } catch (error) {
      const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
      setAuth(`local-${Date.now()}`, expiresAt);
      return { ok: true, local: true, expiresAt };
    }
  }

  async function ensureToken() {
    const token = getToken();
    if (token) return token;

    redirectToLogin();
    throw new Error("Login talab qilinadi");
  }

  async function apiFetch(path, options = {}) {
    const token = await ensureToken();
    const headers = new Headers(options.headers || {});

    if (options.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    headers.set("Authorization", `Bearer ${token}`);

    const response = await fetch(`${API}${path}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      clearAuth();
      redirectToLogin();
    }

    return response;
  }

  async function loadMeta(force = false) {
    if (metaCache && !force) return metaCache;

    const response = await apiFetch("/meta");
    const data = await readJsonResponse(response);
    metaCache = {
      statuses: data.statuses || fallbackStatuses,
      settings: { ...fallbackSettings, ...(data.settings || {}) },
    };
    return metaCache;
  }

  async function logout() {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
      // Local logout is enough if the network is unavailable.
    }
    clearAuth();
    location.href = "login.html";
  }

  function formatMoney(value) {
    return Number(value || 0).toLocaleString();
  }

  function formatDate(value) {
    return value ? new Date(value).toLocaleString() : "";
  }

  function statusLabel(value, statuses = fallbackStatuses) {
    return statuses.find((status) => status.value === value)?.label || value || "";
  }

  function statusClass(value) {
    return `status-badge status-${value || "received"}`;
  }

  function createStatusBadge(value, statuses = fallbackStatuses) {
    const badge = document.createElement("span");
    badge.className = statusClass(value);
    badge.textContent = statusLabel(value, statuses);
    return badge;
  }

  function createElement(tag, options = {}) {
    const element = document.createElement(tag);
    if (options.className) element.className = options.className;
    if (options.text !== undefined) element.textContent = options.text;
    if (options.type) element.type = options.type;
    if (options.value !== undefined) element.value = options.value;
    if (options.href) element.href = options.href;
    if (options.placeholder) element.placeholder = options.placeholder;
    return element;
  }

  function csvEscape(value) {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
  }

  function exportCsv(filename, headers, rows) {
    const csv = [
      headers.map(csvEscape).join(","),
      ...rows.map((row) => row.map(csvEscape).join(",")),
    ].join("\n");

    downloadText(filename, csv, "text/csv;charset=utf-8");
  }

  function downloadText(filename, text, type = "text/plain;charset=utf-8") {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function downloadBackup() {
    const response = await apiFetch("/backup/orders.json");
    if (!response.ok) await readJsonResponse(response);
    const text = await response.text();
    downloadText("gilam-orders-backup.json", text, "application/json;charset=utf-8");
  }

  window.GilamApp = {
    API,
    apiFetch,
    clearAuth,
    createElement,
    downloadBackup,
    exportCsv,
    fallbackSettings,
    fallbackStatuses,
    formatDate,
    formatMoney,
    getToken,
    loadMeta,
    loginWithPassword,
    logout,
    readJsonResponse,
    redirectAfterLogin,
    createStatusBadge,
    statusClass,
    statusLabel,
  };
})();
