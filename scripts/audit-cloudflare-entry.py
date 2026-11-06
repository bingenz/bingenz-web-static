"""Read-only audit. Logs exclude credentials, visitor data and rule expressions."""
import collections
import datetime
import json
import os
import urllib.error
import urllib.request

BASE = "https://api.cloudflare.com/client/v4"
DOMAIN = "bingenz.com"


def api(path, body=None):
    token = os.environ.get("CLOUDFLARE_API_TOKEN")
    if not token:
        raise RuntimeError("Missing repository Actions secret CLOUDFLARE_API_TOKEN")
    request = urllib.request.Request(
        BASE + path,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        return {"success": False, "http_status": error.code}


def rules_summary(result):
    if not result.get("success"):
        return {"available": False, "http_status": result.get("http_status")}
    return [
        {"id": rule.get("id"), "action": rule.get("action"),
         "enabled": rule.get("enabled", True),
         "all_requests": rule.get("expression", "").strip() in ("true", "(true)"),
         "security_level": rule.get("action_parameters", {}).get("settings", {}).get("security_level")}
        for rule in result.get("result", {}).get("rules", [])
    ]


def audit(call=api):
    zones = call("/zones?name=" + DOMAIN)
    if not zones.get("success") or len(zones.get("result", [])) != 1:
        raise RuntimeError("Cannot read the bingenz.com zone; check token permissions and zone scope")
    zone = zones["result"][0]
    prefix = "/zones/" + zone["id"]
    report = {"domain": DOMAIN, "settings": {}, "rules": {}}
    for name in ("security_level", "browser_check", "challenge_ttl"):
        result = call(prefix + "/settings/" + name)
        report["settings"][name] = result.get("result", {}).get("value") if result.get("success") else {"available": False, "http_status": result.get("http_status")}
    bot = call(prefix + "/bot_management")
    report["bot_management"] = {key: bot.get("result", {}).get(key) for key in (
        "fight_mode", "enable_js", "sbfm_definitely_automated", "sbfm_likely_automated", "sbfm_static_resource_protection"
    )} if bot.get("success") else {"available": False, "http_status": bot.get("http_status")}
    for phase in ("http_request_firewall_custom", "http_request_firewall_managed", "http_ratelimit", "http_config_settings"):
        report["rules"][phase] = rules_summary(call(prefix + "/rulesets/phases/" + phase + "/entrypoint"))
    legacy = call(prefix + "/firewall/rules?per_page=100")
    report["legacy_rules"] = [{"id": rule.get("id"), "action": rule.get("action"), "paused": rule.get("paused", False)} for rule in legacy.get("result", [])] if legacy.get("success") else {"available": False, "http_status": legacy.get("http_status")}
    pages = call(prefix + "/pagerules?status=active&per_page=100")
    report["page_security_rules"] = [{"id": rule.get("id"), "status": rule.get("status"), "security_levels": [action.get("value") for action in rule.get("actions", []) if action.get("id") == "security_level"]} for rule in pages.get("result", []) if any(action.get("id") == "security_level" for action in rule.get("actions", []))] if pages.get("success") else {"available": False, "http_status": pages.get("http_status")}
    since = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=24)).strftime("%Y-%m-%dT%H:%M:%SZ")
    query = "query($zone: String!, $since: Time!) { viewer { zones(filter:{zoneTag:$zone}) { firewallEventsAdaptive(limit:1000, filter:{datetime_geq:$since}, orderBy:[datetime_DESC]) { action source ruleId } } } }"
    events = call("/graphql", {"query": query, "variables": {"zone": zone["id"], "since": since}})
    viewer = (events.get("data") or {}).get("viewer") or {}
    groups = viewer.get("zones") or []
    if groups:
        counts = collections.Counter((event.get("action"), event.get("source"), event.get("ruleId")) for event in groups[0].get("firewallEventsAdaptive", []))
        report["recent_events"] = [{"action": action, "source": source, "rule_id": rule, "count": count} for (action, source, rule), count in counts.items()]
    else:
        report["recent_events"] = {"available": False}
    return report


if __name__ == "__main__":
    try:
        print(json.dumps(audit(), indent=2))
    except (RuntimeError, urllib.error.URLError) as error:
        raise SystemExit(str(error))
