#!/usr/bin/env python3
"""Verify the application's import closure and an isolated school-day HTTP service."""
from __future__ import annotations

import argparse
import ast
import importlib
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys


BACKEND = Path('/Users/xenoxu/Documents/ChatGPT/AICampus/versions/v4')
RETIRED = set('activity_load app_agent checkpoint cognition curriculum daily_unit education_service '
              'experience_materials lesson_plans material_tutor materials pedagogy plugins profiles '
              'runtime settings student_agent tutoring'.split())
ROOTS = ('WebUI.server', 'QingheSimulation.school_day_api', 'QingheSimulation.school_day_materials',
         'QingheSimulation.lesson_planner', 'QingheSimulation.source_curriculum',
         'QingheSimulation.school_day_evaluation', 'QingheSimulation.profile_graph',
         'QingheSimulation.curriculum_graph', 'QingheSimulation.grade_schedule',
         'QingheSimulation.learner_profiles')


def module_path(root, name):
    base = root.joinpath(*name.split('.'))
    for path in (base.with_suffix('.py'), base / '__init__.py'):
        if path.is_file():
            return path
    return None


def backend_imports(root):
    pending, visited, missing = list(ROOTS), {}, set()
    while pending:
        name = pending.pop()
        if name in visited:
            continue
        path = module_path(root, name)
        if not path:
            if name.startswith('QingheSimulation.'):
                missing.add(name)
            continue
        visited[name] = str(path.relative_to(root))
        package = name if path.name == '__init__.py' else name.rpartition('.')[0]
        imports = set()
        for node in ast.walk(ast.parse(path.read_text(), filename=str(path))):
            if isinstance(node, ast.Import):
                imports.update(alias.name for alias in node.names)
            elif isinstance(node, ast.ImportFrom):
                base = importlib.util.resolve_name('.' * node.level + (node.module or ''), package) if node.level else node.module or ''
                imports.add(base)
                imports.update(base + '.' + alias.name for alias in node.names
                               if alias.name != '*' and module_path(root, base + '.' + alias.name))
            elif isinstance(node, ast.Call) and node.args and isinstance(node.args[0], ast.Constant):
                target = node.func.attr if isinstance(node.func, ast.Attribute) else node.func.id if isinstance(node.func, ast.Name) else ''
                if target in {'import_module', '__import__'} and isinstance(node.args[0].value, str):
                    value = node.args[0].value
                    imports.add(importlib.util.resolve_name(value, package) if value.startswith('.') else value)
        for target in imports:
            if module_path(root, target) or target.startswith('QingheSimulation.'):
                pending.append(target)
                parts = target.split('.')
                pending.extend('.'.join(parts[:end]) for end in range(1, len(parts)))
    forbidden = sorted(name for name in visited if name.startswith('QingheSimulation.') and name.split('.')[1] in RETIRED)
    assert not missing, 'Unresolved education modules: ' + ', '.join(sorted(missing))
    assert not forbidden, 'Runtime closure includes: ' + ', '.join(forbidden)
    return {'roots': list(ROOTS), 'module_count': len(visited), 'modules': dict(sorted(visited.items()))}


def frontend_imports(root):
    entries = [p for p in (root / 'app').rglob('*') if p.name in {'page.tsx', 'layout.tsx', 'route.ts', 'page.ts', 'layout.ts'}]
    pending, visited = entries[:], set()
    imports = re.compile(r'''(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s*)["']([^"']+)["']''')
    while pending:
        path = pending.pop().resolve()
        if path in visited:
            continue
        visited.add(path)
        source = path.read_text()
        assert '/api/teaching/' not in source, 'Application route uses a historical API: ' + str(path)
        for target in imports.findall(source):
            if target.startswith('@/'):
                base = root / target[2:]
            elif target.startswith('.'):
                base = path.parent / target
            else:
                continue
            choices = [base] + [Path(str(base) + ext) for ext in ('.ts', '.tsx', '.js', '.jsx')] + [base / ('index' + ext) for ext in ('.ts', '.tsx')]
            resolved = next((p for p in choices if p.is_file()), None)
            if resolved and resolved.suffix in {'.ts', '.tsx', '.js', '.jsx'}:
                pending.append(resolved)
    forbidden = {root / 'components' / name for name in ('teaching-lab.tsx', 'daily-learning.tsx', 'teaching-modules.tsx')}
    forbidden.add(root / 'lib/world/teaching3d.ts')
    assert not visited.intersection(forbidden), 'Application route imports a second teaching scene'
    return {'entrypoints': [str(p.relative_to(root)) for p in entries], 'module_count': len(visited),
            'modules': sorted(str(p.relative_to(root)) for p in visited)}


def http_probe(backend):
    from http.server import ThreadingHTTPServer
    import tempfile
    import threading
    from unittest.mock import patch
    from urllib.error import HTTPError
    from urllib.request import Request, urlopen
    sys.path.insert(0, str(backend))
    for name in ROOTS:
        importlib.import_module(name)
    from QingheSimulation.school_day import SchoolDayService
    from QingheSimulation.school_day_api import SchoolDayAPI
    from WebUI.server import Handler
    with tempfile.TemporaryDirectory(prefix='qinghe-architecture-') as directory:
        root = Path(directory)
        history = root / 'history'
        history.mkdir()
        evidence = history / 'ab12.json'
        evidence.write_text(json.dumps({'schema': 'architecture-history-fixture/1', 'snapshot': {'run_id': 'ab12', 'status': 'complete'}}))
        original = evidence.read_bytes()
        school = SchoolDayService(root / 'school-day', config_path=root / 'model.toml')
        api = SchoolDayAPI(school, history_root=history)
        server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        worker = threading.Thread(target=server.serve_forever, daemon=True)
        worker.start()
        statuses, responses = {}, {}
        try:
            with patch('QingheSimulation.school_day_api.get_school_day_api', return_value=api), patch.object(Handler, 'log_message'), patch('Shared.deepseek.LLMClient.call', side_effect=AssertionError('architecture probe cannot call a model')) as model:
                for route, payload, expected in [
                    ('/api/school-day/catalog', None, 200),
                    ('/api/school-day/grades?term=%E4%B8%8A%E5%86%8C', None, 200),
                    ('/api/school-day/timetable?grade_level=3&days=1', None, 200),
                    ('/api/school-day/curriculum-graph?action=browse', None, 200),
                    ('/api/school-day/state', None, 200),
                    ('/api/school-day/model-config', None, 200),
                    ('/api/school-day/knowledge?action=browse&subject=mathematics', None, 200),
                    ('/api/school-day/history/ab12', None, 200),
                    ('/api/teaching/state?run_id=ab12', None, 200),
                    ('/api/teaching/control', {'action': 'start', 'request_id': 'architecture'}, 410),
                ]:
                    request = Request(f'http://127.0.0.1:{server.server_port}' + route,
                                      data=json.dumps(payload).encode() if payload is not None else None,
                                      headers={'Content-Type': 'application/json'})
                    try:
                        response = urlopen(request, timeout=20)
                    except HTTPError as error:
                        response = error
                    with response:
                        status, body = response.status, json.load(response)
                    assert status == expected, (route, status, body)
                    statuses[route] = status
                    responses[route] = body
                assert responses['/api/school-day/state']['status'] == 'ready'
                assert responses['/api/school-day/state']['students'] == []
                timetable = responses['/api/school-day/timetable?grade_level=3&days=1']
                assert len(timetable['schedule']) == 6 and len(timetable['weekly_schedule']) == 30
                assert len(responses['/api/school-day/grades?term=%E4%B8%8A%E5%86%8C']['grades']) == 12
                assert responses['/api/school-day/knowledge?action=browse&subject=mathematics']['graph']['nodes'][0]['id'] == 'subject:mathematics'
                assert responses['/api/teaching/state?run_id=ab12']['read_only'] is True
                assert responses['/api/school-day/history/ab12']['archive']['snapshot']['run_id'] == 'ab12'
                assert evidence.read_bytes() == original
                assert school.runs() == {'runs': []}
                assert not list(school.root.iterdir())
                assert not school.config_path.exists()
                assert model.call_count == 0
        finally:
            server.shutdown()
            server.server_close()
            worker.join(timeout=3)
            school.close()
        loaded = sorted(name for name in sys.modules if name.startswith('QingheSimulation.'))
        assert not [name for name in loaded if name.split('.')[1] in RETIRED]
        return {'endpoint_statuses': statuses, 'loaded_education_modules': loaded,
                'history_bytes_preserved': True, 'new_runs': 0, 'model_requests': 0}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--backend', type=Path, default=BACKEND)
    parser.add_argument('--out', type=Path)
    parser.add_argument('--probe', action='store_true', help=argparse.SUPPRESS)
    args = parser.parse_args()
    if args.probe:
        print(json.dumps(http_probe(args.backend), ensure_ascii=False))
        return
    root = Path(__file__).resolve().parents[1]
    report = {'schema': 'qinghe-education-architecture/1', 'backend': backend_imports(args.backend),
              'frontend': frontend_imports(root)}
    process = subprocess.run([sys.executable, str(Path(__file__).resolve()), '--backend', str(args.backend), '--probe'],
                             check=True, capture_output=True, text=True, timeout=90)
    report.update(status='passed', http=json.loads(process.stdout),
                  validation_boundary='Import closure and isolated HTTP execution; live model and browser quality are verified separately.')
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
