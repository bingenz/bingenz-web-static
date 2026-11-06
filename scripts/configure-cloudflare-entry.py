"""Narrow, reversible exception in the identified public-entry challenge rule."""
import hashlib
import json
import runpy
import sys
from pathlib import Path

api = runpy.run_path(str(Path(__file__).with_name("audit-cloudflare-entry.py")))["api"]
DOMAIN = "bingenz.com"
RULE_ID = "0b7a2b2b37584f4a8df8283f9a4de4ba"
PHASE = "http_request_firewall_custom"
PUBLIC_PATHS = (
    "/", "/index", "/index.html", "/styles.css", "/app.js", "/gemini.css",
    "/gemini.mjs", "/commerce.css", "/commerce.mjs", "/robots.txt", "/favicon.ico",
    "/api/catalog", "/api/ai/plans", "/api/gemini/plans",
)
PUBLIC_PREFIXES = ("/icons/", "/img/", "/product-thumbnails/", "/api/thumbnails/")
public_paths = "http.request.uri.path in {" + " ".join(json.dumps(path) for path in PUBLIC_PATHS) + "}"
public_prefixes = " or ".join("starts_with(http.request.uri.path, " + json.dumps(path) + ")" for path in PUBLIC_PREFIXES)
EXCEPTION = '(http.host in {"bingenz.com" "www.bingenz.com"} and http.request.method in {"GET" "HEAD"} and (' + public_paths + " or " + public_prefixes + "))"
SUFFIX = " and not " + EXCEPTION


def require_result(response):
    if not response.get("success"):
        raise RuntimeError("Cloudflare API refused the operation; HTTP status " + str(response.get("http_status", "unknown")))
    return response["result"]


def business_rules(rules):
    return [{key: value for key, value in rule.items() if key not in ("version", "last_updated")} for rule in rules]


def configure(operation, call=api):
    if operation not in ("apply", "rollback"):
        raise RuntimeError("Operation must be apply or rollback")
    zones = require_result(call("/zones?name=" + DOMAIN))
    if len(zones) != 1 or zones[0]["name"] != DOMAIN:
        raise RuntimeError("Expected exactly the bingenz.com zone")
    prefix = "/zones/" + zones[0]["id"]
    entrypoint = prefix + "/rulesets/phases/" + PHASE + "/entrypoint"
    before = require_result(call(entrypoint))
    targets = [rule for rule in before["rules"] if rule["id"] == RULE_ID]
    if len(targets) != 1 or targets[0]["action"] != "managed_challenge" or targets[0].get("enabled", True) is not True:
        raise RuntimeError("Expected the identified enabled Managed Challenge rule; refusing other changes")
    target = targets[0]
    original = target["expression"]
    applied = original.startswith("(") and original.endswith(")" + SUFFIX)
    if operation == "apply" and applied:
        return {"operation": operation, "changed": False, "reason": "public-entry exception already present"}
    if operation == "rollback" and not applied:
        raise RuntimeError("This rule has no recognized public-entry exception to roll back")
    updated = "(" + original + ")" + SUFFIX if operation == "apply" else original[:-len(SUFFIX)][1:-1]
    if not updated or len(updated) > 4096:
        raise RuntimeError("Resulting rule expression is empty or too long")
    # Check for an intervening dashboard edit, then patch only this rule.
    current = require_result(call(entrypoint))
    if current != before:
        raise RuntimeError("Rules changed during inspection; rerun after reviewing the change")
    require_result(call(prefix + "/rulesets/" + before["id"] + "/rules/" + RULE_ID,
                        {"action": target["action"], "expression": updated}, method="PATCH"))
    after = require_result(call(entrypoint))
    expected = [dict(rule, expression=updated) if rule["id"] == RULE_ID else rule for rule in before["rules"]]
    if business_rules(after["rules"]) != business_rules(expected):
        raise RuntimeError("Post-change verification differs from the intended single-rule edit; inspect before further changes")
    return {"operation": operation, "changed": True, "domain": DOMAIN, "rule_id": RULE_ID,
            "before_sha256": hashlib.sha256(original.encode()).hexdigest(),
            "after_sha256": hashlib.sha256(updated.encode()).hexdigest(),
            "public_paths": list(PUBLIC_PATHS), "public_prefixes": list(PUBLIC_PREFIXES),
            "methods": ["GET", "HEAD"], "other_rules_preserved": True}


if __name__ == "__main__":
    try:
        print(json.dumps(configure(sys.argv[1] if len(sys.argv) == 2 else ""), indent=2))
    except RuntimeError as error:
        raise SystemExit(str(error))
