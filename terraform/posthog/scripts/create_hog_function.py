#!/usr/bin/env python3
"""
PostHog HogFunction（Webhook Destination）を冪等に作成するスクリプト。
既に同名のファンクションが存在する場合はスキップ。
環境変数: POSTHOG_API_KEY, POSTHOG_PROJECT_ID, POSTHOG_HOST,
         BACKEND_API_URL, POSTHOG_WEBHOOK_SECRET
"""
import json
import os
import sys
import urllib.error
import urllib.request

FUNCTION_NAME = "Survey Response → Waitlist Webhook"

api_key        = os.environ["POSTHOG_API_KEY"]
project_id     = os.environ["POSTHOG_PROJECT_ID"]
host           = os.environ.get("POSTHOG_HOST", "https://us.i.posthog.com").rstrip("/")
backend_url    = os.environ["BACKEND_API_URL"].rstrip("/")
webhook_secret = os.environ["POSTHOG_WEBHOOK_SECRET"]

headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json",
}

webhook_endpoint = f"{backend_url}/api/posthog/survey-webhook"

HOG_SCRIPT = f"""
let email := event.properties['$survey_response_1']
if (empty(email)) {{
    return
}}
let res := fetch('{webhook_endpoint}', {{
    'method': 'POST',
    'headers': {{
        'Content-Type': 'application/json',
        'X-Webhook-Secret': '{webhook_secret}'
    }},
    'body': {{
        'email': email,
        'survey_id': event.properties['$survey_id'],
        'survey_name': event.properties['$survey_name'],
        'distinct_id': event.distinct_id
    }}
}})
if (res.status >= 400) {{
    throw Error(concat('Webhook error: ', toString(res.status)))
}}
""".strip()


def ph_request(method: str, path: str, body=None):
    url = f"{host}/api/projects/{project_id}{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.read().decode()}", file=sys.stderr)
        sys.exit(1)


# ── 既存ファンクションを確認 ────────────────────────────────────
resp = ph_request("GET", "/hog_functions/?type=destination")
existing = [f for f in resp.get("results", []) if f["name"] == FUNCTION_NAME]
if existing:
    print(f"SKIP: HogFunction already exists (id={existing[0]['id']})")
    sys.exit(0)

# ── 新規作成 ─────────────────────────────────────────────────────
payload = {
    "name": FUNCTION_NAME,
    "description": "limit_reached Survey 送信時にメールをバックエンド waitlist API へ転送",
    "type": "destination",
    "enabled": True,
    "hog": HOG_SCRIPT,
    "filters": {
        "events": [
            {"id": "survey sent", "type": "events", "name": "survey sent"}
        ]
    },
}

result = ph_request("POST", "/hog_functions/", payload)
print(f"CREATED: HogFunction '{result['name']}' (id={result['id']})")
