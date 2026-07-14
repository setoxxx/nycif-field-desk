(() => {
  const nativeFetch = window.fetch.bind(window);
  const sleep = ms => new Promise(resolve => window.setTimeout(resolve, ms));

  window.fetch = async function nycifFetchWithRetry(input, init) {
    const requestUrl = typeof input === 'string' ? input : input?.url || '';
    const method = String(init?.method || input?.method || 'GET').toUpperCase();
    const retryable = method === 'GET' && requestUrl.includes('raw.githubusercontent.com');

    if (!retryable) {
      return nativeFetch(input, init);