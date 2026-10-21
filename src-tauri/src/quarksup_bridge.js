(() => {
  if (location.origin !== "https://entreprise.quarksup.net" || window.__eztt) return;

  const API = "https://api.quarksup.net";
  const nativeFetch = window.fetch.bind(window);
  const nativeOpen = XMLHttpRequest.prototype.open;
  const nativeSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  const xhrUrls = new WeakMap();
  const responses = new Map();
  let token = null;
  let employeeId = null;
  let nextRequestId = 1;

  function capture(url, authorization) {
    if (!String(url).startsWith(API) || !authorization?.startsWith("Bearer ")) return;
    token = authorization.slice("Bearer ".length);
    const observedEmployeeId = new URL(url, location.href).searchParams.get("employeeId");
    if (observedEmployeeId) employeeId = Number(observedEmployeeId);
  }

  function tokenClaims() {
    try {
      const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(atob(payload));
    } catch {
      return {};
    }
  }

  window.fetch = (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    capture(url, headers.get("authorization"));
    return nativeFetch(input, init);
  };

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    xhrUrls.set(this, String(url));
    return nativeOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    if (name.toLowerCase() === "authorization") capture(xhrUrls.get(this) ?? "", value);
    return nativeSetRequestHeader.call(this, name, value);
  };

  // Les appels partent de la page : quarksUp répond 403 (anti-bot) aux requêtes externes.
  async function perform({ path, method, body }) {
    try {
      const response = await nativeFetch(API + path, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/json, text/plain, */*",
          "absence-beta": "true",
          ...(body ? { "content-type": "application/json" } : {}),
        },
        body: body ?? undefined,
      });
      return { status: response.status, body: await response.text() };
    } catch (error) {
      return { status: 0, body: String(error) };
    }
  }

  Object.defineProperty(window, "__eztt", {
    value: Object.freeze({
      session() {
        if (!token) return null;
        const claims = tokenClaims();
        return { employeeId, expiresAt: claims.exp ?? null, claimNames: Object.keys(claims) };
      },
      send(request) {
        if (!token) return null;
        const id = nextRequestId++;
        perform(request).then((response) => responses.set(id, response));
        return id;
      },
      take(id) {
        const response = responses.get(id) ?? null;
        responses.delete(id);
        return response;
      },
    }),
  });
})();
