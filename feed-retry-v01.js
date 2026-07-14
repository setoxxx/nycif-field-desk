(() => {
  const nativeFetch = window.fetch.bind(window);
  const sleep = ms => new Promise(resolve => window.setTimeout(resolve, ms));

  window.fetch = async function nycifFetchWithRetry(input, init) {
    const requestUrl = typeof input === 'string' ? input : input?.url || '';
    const method = String(init?.method || input?.method || 'GET').toUpperCase();
    const retryable = method === 'GET' && requestUrl.includes('raw.githubusercontent.com');

    if (!retryable) {
      return nativeFetch(input, init);
    }

    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await nativeFetch(input, init);
        if (response.ok || (response.status < 500 && response.status !== 429)) {
          return response;
        }
        lastError = new Error(`Feed request failed with HTTP ${response.status}`);
      } catch (error) {
        lastError = error;
      }

      if (attempt < 2) {
        await sleep(350 * (attempt + 1));
      }
    }

    throw lastError || new Error('Feed request failed after retries');
  };
})();
