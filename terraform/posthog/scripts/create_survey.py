#!/usr/bin/env python3
"""
PostHog Survey を冪等に作成するスクリプト。
既に同名のサーベイが存在する場合はスキップする。
環境変数: POSTHOG_API_KEY, POSTHOG_PROJECT_ID, POSTHOG_HOST
"""
import json
import os
import sys
import urllib.error
import urllib.request

SURVEY_NAME = "無料枠到達時_先行案内登録"

api_key    = os.environ["POSTHOG_API_KEY"]
project_id = os.environ["POSTHOG_PROJECT_ID"]
host       = os.environ.get("POSTHOG_HOST", "https://us.i.posthog.com").rstrip("/")

headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json",
}


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


# ── 既存サーベイを確認 ──────────────────────────────────────────
resp = ph_request("GET", "/surveys/")
existing = [s for s in resp.get("results", []) if s["name"] == SURVEY_NAME]
if existing:
    print(f"SKIP: Survey already exists (id={existing[0]['id']})")
    sys.exit(0)

# ── 新規作成 ────────────────────────────────────────────────────
payload = {
    "name": SURVEY_NAME,
    "description": "無料診断枠到達時に Proプラン先行アクセス希望メールを収集する",
    "type": "popover",
    "questions": [
        {
            "type": "open",
            "question": "本日の無料診断枠の上限に達しました。"
                        "Proプラン（無制限）の先行アクセスを希望しますか？",
            "description": "メールアドレスを入力してください",
            "buttonText": "先行アクセスを申し込む",
            "originalQuestionIndex": 0,
        }
    ],
    "conditions": {
        "events": {
            "values": [{"name": "limit_reached"}]
        }
    },
    "appearance": {
        "backgroundColor": "#faf5ff",
        "submitButtonColor": "#9333ea",
        "submitButtonTextColor": "#ffffff",
        "position": "center",
    },
}

result = ph_request("POST", "/surveys/", payload)
print(f"CREATED: Survey '{result['name']}' (id={result['id']})")
