// Server-side proxy to the public Wargaming Developer API so the page
// never needs a CORS-enabled client-side call, and the application_id
// stays out of client JS (it's not secret, but no reason to expose it).
const APP_ID = "e360a30a29eaf0b2027e440f3b605c07";

// session.realm comes through as the game's eRealm enum stringified
// (e.g. "eRealm.Europe" or "Europe" - exact casing unconfirmed live, so
// match loosely). Russia/Lesta is a different company/API entirely as of
// the WG/Lesta split - included for completeness, almost certainly won't
// authenticate with a Wargaming application_id.
const REALM_HOSTS = [
  ["europe", "api.wotblitz.eu"],
  ["eu", "api.wotblitz.eu"],
  ["northamerica", "api.wotblitz.com"],
  ["na", "api.wotblitz.com"],
  ["asia", "api.wotblitz.asia"],
  ["russia", "api.wotblitz.ru"],
  ["ru", "api.wotblitz.ru"],
];

function resolveHost(realmRaw) {
  const key = (realmRaw || "").toLowerCase().replace(/^erealm\./, "");
  for (const [needle, host] of REALM_HOSTS) {
    if (key.includes(needle)) return host;
  }
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/stats") {
      // account_id arrives formatted by the game's str1000Separated() (the
      // only function that could render session.dbid at all) - strip
      // thousand-separator spaces/encoding artifacts before validating.
      const accountId = (url.searchParams.get("account_id") || "").replace(/\D/g, "");
      const realmRaw = url.searchParams.get("realm") || "";
      const host = resolveHost(realmRaw);

      if (!accountId || !/^\d+$/.test(accountId)) {
        return Response.json({ ok: false, error: "missing_or_invalid_account_id", realm_raw: realmRaw }, { status: 400 });
      }
      if (!host) {
        return Response.json({ ok: false, error: "unknown_realm", realm_raw: realmRaw }, { status: 400 });
      }

      const apiUrl = `https://${host}/wotb/account/info/?application_id=${APP_ID}&account_id=${accountId}&fields=nickname%2Cstatistics.all`;
      try {
        const resp = await fetch(apiUrl);
        const data = await resp.json();
        return Response.json({ ok: true, realm_raw: realmRaw, host, wg: data }, {
          headers: { "Cache-Control": "no-store" },
        });
      } catch (err) {
        return Response.json({ ok: false, error: "upstream_fetch_failed", detail: String(err) }, { status: 502 });
      }
    }

    return env.ASSETS.fetch(request);
  },
};
