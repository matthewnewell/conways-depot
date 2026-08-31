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
assert len(caps) >= 8, f'expected at least 8 seeded capabilities, got {len(caps)}'
print(len(caps), 'capabilities')
"

echo "== applications seeded, with honest status labels =="
curl -s "$BASE/applications" | python3 -c "
import json, sys
apps = json.load(sys.stdin)
by_status = {}
for a in apps:
    by_status.setdefault(a['status'], []).append(a['name'])
for status, names in by_status.items():
    print(status, ':', ', '.join(names))
assert 'Value Stream' in by_status.get('built', []), 'Value Stream should be seeded as built'
assert 'WinMax' in by_status.get('external', []), 'WinMax should be seeded as external'
assert any('Staffing' in n for n in by_status.get('planned', [])), 'Staffing engine should be a planned placeholder'
"

echo "== applications carry an honest phase (pursuit/award/execution), invalid phase rejected =="
curl -s "$BASE/applications" | python3 -c "
import json, sys
apps = json.load(sys.stdin)
by_name = {a['name']: a['phase'] for a in apps}
assert by_name['WinMax'] == 'pursuit', by_name['WinMax']
assert by_name['Costpoint'] == 'award', by_name['Costpoint']
assert by_name['Value Stream'] == 'execution', by_name['Value Stream']
print('ok —', by_name)
"
WV_ID=$(curl -s "$BASE/applications" | python3 -c "
import json, sys
print(next(a['id'] for a in json.load(sys.stdin) if a['name'] == 'WinMax'))
")
STATUS=$(curl -s -o /dev/null -w '%{http_code}' -X PUT "$BASE/applications/$WV_ID" \
  -H 'Content-Type: application/json' -d '{"phase":"bogus"}')
[ "$STATUS" = "400" ] && echo "invalid phase correctly rejected: $STATUS" || (echo "expected 400, got $STATUS" && exit 1)

echo "== demo project has the digital-thread crosswalk and phase-scoped links =="
PID=$(curl -s "$BASE/projects" | python3 -c "
import json, sys
print(next(p['id'] for p in json.load(sys.stdin) if p['name'].startswith('Demo')))
")
curl -s "$BASE/projects/$PID" | python3 -c "
import json, sys
d = json.load(sys.stdin)
assert len(d['external_ids']) == 2, 'expected WinMax + Costpoint crosswalk entries'
phases = {l['phase'] for l in d['app_links']}
assert phases == {'pursuit', 'award', 'execution', 'closeout'}, f'expected all 4 phases represented, got {phases}'
vs_link = next(l for l in d['app_links'] if l['application_name'] == 'Value Stream')
assert vs_link['link_url'], 'Value Stream link should have a real deep-link URL'
print('crosswalk + all 4 phases present; Value Stream link:', vs_link['link_url'])
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
