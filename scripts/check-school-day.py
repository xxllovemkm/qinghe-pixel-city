#!/usr/bin/env python3
"""Run a bounded source-curriculum school day against the live LiteLLM service."""
import argparse
from collections import Counter
import json
import math
from pathlib import Path
import time
from urllib.request import Request, urlopen

DEFAULT_BOOK = 'f4184328-83db-4a43-8dab-bb9df75597a6'
DEFAULT_LESSONS = ['10faaa3a-a938-76fc-bd5e-33cdd59a58d4', '453fc773-5282-73b4-9941-e31588fc9e00']


def request(api, route, payload=None):
    body = None if payload is None else json.dumps(payload).encode()
    req = Request(api + '/api/school-day/' + route, data=body,
                  headers={'Content-Type': 'application/json'} if body else {})
    with urlopen(req, timeout=60) as response:
        return json.load(response)


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2))


def audit(state):
    assert state['status'] == 'complete', state.get('error')
    plans = state.get('plans') or [state['plan']]
    rows = []
    for plan in plans:
        assert sum(activity['minutes'] for activity in plan['activities']) == 40
        assert len(plan['classwork']) >= 4
        items = plan['homework']['items']
        assert 12 <= len(items) <= 20
        assert len({item['id'] for item in items}) == len(items)
        contents = [json.dumps({'type': item['type'],
            'prompt': ''.join(item['prompt'].split()),
            'context': ''.join(item.get('context', '').split()),
            'options': sorted(''.join(option['text'].split()) for option in item.get('options', []))},
            sort_keys=True, ensure_ascii=False) for item in items]
        assert len(set(contents)) == len(items)
        assert plan['source'].get('sha256')
        assert len({item['type'] for item in items}) >= 3
        if plan['lesson_id'] in DEFAULT_LESSONS:
            assert {item['type'] for item in items} >= {'choice', 'fill_blank', 'true_false', 'short_answer', 'calculation'}
    for student in state['students']:
        works = student.get('assignments') or [student['homework']]
        assert len(works) == len(plans), (student['id'], len(works), len(plans))
        assert student['location']['scene'] == 'home'
        for work in works:
            item_ids = {item['id'] for item in work['items']}
            answers = work['answers']
            assert len(answers) == len(item_ids)
            assert {answer['item_id'] for answer in answers} == item_ids
            assert work['submission']
            grades = work['review']['items']
            assert len(grades) == len(item_ids)
            assert {grade['item_id'] for grade in grades} == item_ids
            rows.append({'student_id': student['id'], 'student_name': student['name'],
                'assignment_id': work['assignment_id'], 'assigned': len(item_ids),
                'response_records': len(answers), 'completed_answers': sum(a.get('response_kind') == 'answer' and bool(str(a.get('answer','')).strip()) for a in answers),
                'submitted_items': len(item_ids), 'graded_items': len(grades),
                'correct_items': sum(g.get('correct') is True for g in grades),
                'type_distribution': dict(Counter(item['type'] for item in work['items']))})
        transcript = student.get('app_session', {}).get('transcript', [])
        if state.get('settings', {}).get('tutoring_turns', 2):
            assert any(row['role'] == 'student' for row in transcript)
            assert any(row['role'] == 'assistant' for row in transcript)
        assert student.get('app_memory')
        if state.get('grade_setup'):
            movements = [event for event in state['events'] if event.get('student_id') == student['id']
                         and event['kind'] == 'student_moved']
            assert movements[0]['location']['scene'] == 'home'
            assert {event['journey']['direction'] for event in movements} == {'school', 'home'}
            arrivals = [event['kind'] for event in state['events'] if event.get('student_id') == student['id']
                        and event['kind'] in {'school_arrived', 'home_arrived'}]
            assert arrivals == ['school_arrived', 'home_arrived'] * state['settings']['days']
            assert student['classroom_id'] == state['grade_setup']['classroom_id']
            profile = student['learner_profile']
            for role in ('truth', 'app'):
                nodes = profile[role]['nodes'].values()
                assert nodes, (student['id'], role, 'no learned nodes')
                assert all(node['learned'] and math.isfinite(node['mastery']) and 0 <= node['mastery'] <= 1 for node in nodes)
    timeline = []
    for request_row in state.get('requests', []):
        if request_row.get('request_started_at') is not None:
            timeline.append((request_row['request_started_at'], 1))
            if request_row.get('completed_at') is not None:
                timeline.append((request_row['completed_at'], -1))
    in_flight = peak = 0
    for _, delta in sorted(timeline):
        in_flight += delta
        peak = max(peak, in_flight)
    return {'status': 'passed', 'run_id': state['run_id'], 'plans': [
        {'book_id': plan['book_id'], 'lesson_id': plan['lesson_id'], 'title': plan['title'],
         'source_sha256': plan['source']['sha256'], 'class_minutes': sum(a['minutes'] for a in plan['activities']),
         'examples': len(plan['examples']), 'classwork': len(plan['classwork']), 'homework': len(plan['homework']['items']),
         'homework_minutes': sum(item['estimated_minutes'] for item in plan['homework']['items'])}
        for plan in plans], 'student_work': rows, 'summary': state.get('summary'),
        'peak_network_concurrency': peak,
        'checks': ['source_identity', '40_minute_lessons', 'full_diverse_homework', 'all_student_answers',
                   'whole_submission', 'complete_app_review', 'home_location', 'actual_app_dialogue', 'app_memory']
                  + (['daily_round_trip', 'grade_classroom_identity', 'learned_nodes_with_mastery'] if state.get('grade_setup') else []),
        'validation_boundary': 'structural_and_live_api_execution; semantic_quality_in_separate_judge_report'}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--api', default='http://127.0.0.1:8768')
    parser.add_argument('--out', type=Path, default=Path('outputs/school-day/two-day-api'))
    parser.add_argument('--run-id')
    parser.add_argument('--resume', action='store_true')
    parser.add_argument('--book-id', default=DEFAULT_BOOK)
    parser.add_argument('--grade-level', type=int, choices=range(1, 13))
    parser.add_argument('--term', choices=['上册', '下册'], default='上册')
    parser.add_argument('--days', type=int, default=1)
    parser.add_argument('--start-day', type=int, default=1)
    parser.add_argument('--lesson-id', action='append')
    parser.add_argument('--students', type=int, default=6)
    parser.add_argument('--concurrency', type=int, default=32)
    parser.add_argument('--homework', type=int, default=15)
    parser.add_argument('--tutoring-turns', type=int, default=2)
    parser.add_argument('--world', type=Path)
    parser.add_argument('--seconds', type=int, default=1800)
    args = parser.parse_args()
    payload = {'book_id': args.book_id, 'lesson_ids': args.lesson_id or DEFAULT_LESSONS,
               'student_count': args.students, 'homework_count': args.homework, 'concurrency': args.concurrency,
               'tutoring_turns': args.tutoring_turns, 'seed': 2417}
    if args.grade_level is not None:
        payload.pop('book_id')
        payload.pop('lesson_ids')
        payload.update(grade_level=args.grade_level, term=args.term, days=args.days,
                       start_day=args.start_day, max_wall_seconds=args.seconds)
    if args.world:
        payload['world'] = json.loads(args.world.read_text())
    if args.run_id:
        state = request(args.api, 'state?run_id=' + args.run_id)
        if args.resume and state['status'] in {'paused', 'error'}:
            state = request(args.api, 'control', {'run_id': args.run_id, 'action': 'resume'})
    else:
        state = request(args.api, 'start', payload)
        write(args.out / 'start.json', {'payload': payload, 'run_id': state['run_id'], 'wall_limit_seconds': args.seconds})
    started, last_log = time.monotonic(), ''
    while True:
        compact = {key: state.get(key) for key in ('run_id', 'status', 'phase', 'day', 'summary', 'error')}
        token = json.dumps(compact, ensure_ascii=False, sort_keys=True)
        if token != last_log:
            print(token, flush=True)
            last_log = token
            write(args.out / 'progress.json', compact)
        if state['status'] in {'complete', 'error', 'interrupted', 'paused'}:
            break
        if time.monotonic() - started > args.seconds:
            state = request(args.api, 'control', {'run_id': state['run_id'], 'action': 'pause'})
            write(args.out / 'timeout.json', {'run_id': state['run_id'], 'reason': 'wall_time_limit'})
            break
        time.sleep(3)
        state = request(args.api, 'state?run_id=' + state['run_id'])
    write(args.out / 'snapshot.json', state)
    write(args.out / 'export.json', request(args.api, 'export?run_id=' + state['run_id']))
    report = audit(state)
    report['observation_wall_seconds'] = round(time.monotonic() - started, 2)
    report['active_wall_seconds'] = round(state.get('active_wall_seconds', 0), 2)
    report['run_elapsed_seconds'] = round(state.get('updated_at', 0) - state.get('created_at', 0), 2)
    write(args.out / 'report.json', report)
    print(json.dumps(report, ensure_ascii=False, indent=2), flush=True)


if __name__ == '__main__':
    main()
