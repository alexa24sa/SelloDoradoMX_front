(function initializeRuntimeConfig() {
  const DEFAULT_API_BASE_URLS = [
    'http://localhost:8088/api/v1',
    'http://localhost:8080/api/v1'
  ];

  function normalizeApiBaseUrl(value) {
    const rawValue = String(value || '').trim().replace(/\/+$/, '');
    if (!rawValue) return '';

    const withProtocol = rawValue.startsWith('//')
      ? `${window.location.protocol}${rawValue}`
      : /^https?:\/\//i.test(rawValue)
        ? rawValue
        : `https://${rawValue}`;
    return /\/api\/v1$/i.test(withProtocol) ? withProtocol : `${withProtocol}/api/v1`;
  }

  async function loadJsonConfig() {
    const candidatePaths = ['./config.json'];

    for (const candidatePath of candidatePaths) {
      try {
        const response = await fetch(candidatePath, { cache: 'no-store' });
        if (!response.ok) continue;
        return await response.json();
      } catch {
        // Ignore and continue to env fallback.
      }
    }

    return {};
  }

  function parseEnvFile(content) {
    return String(content || '')
      .split(/\r?\n/)
      .reduce((accumulator, line) => {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('#')) return accumulator;

        const separatorIndex = trimmedLine.indexOf('=');
        if (separatorIndex <= 0) return accumulator;

        const key = trimmedLine.slice(0, separatorIndex).trim();
        const value = trimmedLine.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
        accumulator[key] = value;
        return accumulator;
      }, {});
  }

  async function loadPublicEnv() {
    const candidatePaths = ['./.env'];

    for (const candidatePath of candidatePaths) {
      try {
        const response = await fetch(candidatePath, { cache: 'no-store' });
        if (!response.ok) continue;
        return parseEnvFile(await response.text());
      } catch {
        // Ignore and continue to fallbacks.
      }
    }

    return {};
  }

  async function resolveApiBaseUrl() {
    const jsonConfig = await loadJsonConfig();
    const envConfig = Object.keys(jsonConfig).length ? jsonConfig : await loadPublicEnv();
    const configuredBaseUrl = normalizeApiBaseUrl(envConfig.PUBLIC_API_BASE_URL || envConfig.API_BASE_URL || '');
    if (configuredBaseUrl) {
      return configuredBaseUrl;
    }

    for (const candidateBaseUrl of DEFAULT_API_BASE_URLS) {
      try {
        const response = await fetch(`${candidateBaseUrl}/business-categories`, { signal: AbortSignal.timeout(2000) });
        if (response.status < 600) {
          return candidateBaseUrl;
        }
      } catch {
        // Ignore and continue to the next fallback.
      }
    }

    return DEFAULT_API_BASE_URLS[0];
  }

  const ready = resolveApiBaseUrl().then((apiBaseUrl) => {
    window.API_BASE_URL = apiBaseUrl;
    return apiBaseUrl;
  });

  window.AppRuntimeConfig = {
    ready,
    getApiBaseUrl() {
      return window.API_BASE_URL || DEFAULT_API_BASE_URLS[0];
    },
    normalizeApiBaseUrl
  };
})();
