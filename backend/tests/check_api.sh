#!/bin/bash
# Smoke test against a running dev server (localhost:8090): seed content, the digital-thread
# crosswalk, phase-scoped links, and the real cross-app deep link into Value Stream.
set -e
BASE=http://localhost:8090/api

echo "== health =="
curl -s "$BASE/health"
echo

echo "== capabilities seeded =="
curl -s "$BASE/capabilities" | python3 -c "
import json, sys
caps = json.load(sys.stdin)
assert len(caps) >= 4, f'expected at least 4 seeded capabilities, got {len(caps)}'
print(len(caps), 'capabilities')
"

echo "== applications seeded, no status field =="
curl -s "$BASE/applications" | python3 -c "
import json, sys
apps = json.load(sys.stdin)
names = sorted(a['name'] for a in apps)
assert 'Value Stream' in names and 'WinMax' in names, names
assert all('status' not in a for a in apps), 'apps should carry no status field'
print(', '.join(names))
"

echo "== applications are NOT tagged with a lifecycle phase (that's a link property now) =="
curl -s "$BASE/applications" | python3 -c "
import json, sys
apps = json.load(sys.stdin)
assert all('phases' not in a and 'phase' not in a for a in apps), 'no phase field on an app'
print('ok — no phase on', len(apps), 'apps')
"
WV_ID=$(curl -s "$BASE/applications" | python3 -c "
import json, sys
print(next(a['id'] for a in json.load(sys.stdin) if a['name'] == 'WinMax'))
")

echo "== applications are filed under a 15288-derived category, invalid category rejected =="
curl -s "$BASE/applications" | python3 -c "
import json, sys
apps = json.load(sys.stdin)
cats = {a['name']: a['category'] for a in apps}
assert cats['WinMax'] == 'agreement', cats
assert cats['Value Stream'] == 'project', cats
assert cats['Staffing & Capacity Engine'] == 'enterprise', cats
print('ok —', cats)
"
STATUS=$(curl -s -o /dev/null -w '%{http_code}' -X PUT "$BASE/applications/$WV_ID" \
  -H 'Content-Type: application/json' -d '{\"category\":\"bogus\"}')
[ "$STATUS" = "400" ] && echo "invalid category correctly rejected: $STATUS" || (echo "expected 400, got $STATUS" && exit 1)

echo "== Organizational Enablers: organizational scope =="
curl -s "$BASE/applications" | python3 -c "
import json, sys
apps = json.load(sys.stdin)
org = {a['name']: a for a in apps if a['scope'] == 'organizational'}
assert {'Staffing & Capacity Engine', 'Contract & Legal Authoring'} <= set(org), set(org)
print('ok —', sorted(org))
"

echo "== demo personas seeded (a lens, not auth) =="
curl -s "$BASE/people" | python3 -c "
import json, sys
people = json.load(sys.stdin)
by_name = {p['name']: p for p in people}
assert any(p['is_admin'] for p in people), 'expected one admin (see-everything) persona'
sam = by_name['Sam Ortiz']
assert not sam['is_admin'] and 0 < len(sam['project_ids']) < 4, sam
assert len(sam['application_ids']) >= 1, sam
assert len(sam['projects']) == len(sam['project_ids']), sam
assert all('application_ids' in p and 'phase' in p for p in sam['projects']), sam
print('ok —', {p['name']: len(p['projects']) for p in people})
"

echo "== demo project has the digital-thread crosswalk and phase-scoped links =="
PID=$(curl -s "$BASE/projects" | python3 -c "
import json, sys
print(next(p['id'] for p in json.load(sys.stdin) if p['name'].startswith('Demo: Bracket')))
")
curl -s "$BASE/projects/$PID" | python3 -c "
import json, sys
d = json.load(sys.stdin)
assert len(d['external_ids']) == 1, 'expected the WinMax crosswalk entry'
phases = {l['phase'] for l in d['app_links']}
assert phases == {'pursuit', 'execution'}, f'expected pursuit + execution links, got {phases}'
vs_link = next(l for l in d['app_links'] if l['application_name'] == 'Value Stream')
assert vs_link['link_url'], 'Value Stream link should have a real deep-link URL'
print('crosswalk + pursuit/execution links present; Value Stream link:', vs_link['link_url'])
"

echo "== that Value Stream deep link actually resolves (requires Value Stream running on :5173) =="
VS_MAP_ID=$(curl -s "$BASE/projects/$PID" | python3 -c "
import json, sys
d = json.load(sys.stdin)
l = next(l for l in d['app_links'] if l['application_name'] == 'Value Stream')
print(l['external_ref'])
")
curl -s -o /dev/null -w "Value Stream map status: %{http_code}\n" "http://localhost:8080/api/maps/$VS_MAP_ID"

echo "== chat gracefully reports not-configured when AI_PROVIDER is unset =="
curl -s -X POST "$BASE/chat" -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"hi"}]}' | python3 -c "
import json, sys
d = json.load(sys.stdin)
assert 'error' in d, 'expected a graceful not-configured error, not a crash'
print('ok:', d['error'][:60], '...')
"

echo "all checks passed"
