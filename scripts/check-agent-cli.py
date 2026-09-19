#!/usr/bin/env python3
"""Exercise the exact downloadable Python companion without network or credentials."""
import importlib.util
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
source = Path(__file__).resolve().parents[1] / 'frontend/src/features/agents/companions/agent.py'
spec = importlib.util.spec_from_file_location('voltquest_agent_companion', source)
agent = importlib.util.module_from_spec(spec)
spec.loader.exec_module(agent)
assert agent.self_test().startswith('PASS')
env = {'workspace': agent.create_workspace(), 'approve': lambda op: True,
       'ask': lambda q: 'Title', 'github': False}
requests = []
def provider_transport(url, options):
    requests.append((url, options))
    if len(requests) == 1:
        return {'status': 'completed', 'usage': {'input_tokens': 200}, 'output': [
            {'type': 'function_call', 'call_id': 'call_1', 'name': 'read_file', 'arguments': '{"path":"report.txt"}'}]}
    return {'status': 'completed', 'usage': {'input_tokens': 260}, 'output': [
        {'type': 'message', 'content': [{'type': 'output_text', 'text': 'Evidence read.'}]}]}
logs = []
result = agent.run_agent('Read report', agent.live_provider('test-private-key', 'test-model', provider_transport), env, logs.append)
assert result['answer'] == 'Evidence read.'
assert result['usage'][0]['input_tokens'] == 200
payload = json.loads(requests[1][1]['body'])
assert payload['input'][-1]['call_id'] == 'call_1'
assert 'before email verification' in payload['input'][-1]['output']
assert payload['store'] is False and payload['max_output_tokens'] == 800
assert 'test-private-key' not in json.dumps(logs)
assert all(url == 'https://api.openai.com/v1/responses' for url, _ in requests)
def github_transport(url, options):
    assert url == 'https://api.github.com/repos/example/demo/issues?state=open&per_page=5'
    return [{'number': i, 'title': 'x' * 900, 'body': 'omit body', 'html_url': 'https://github.com/example/demo/issues/1'} for i in range(8)]
env.update({'github': True, 'repository': 'example/demo', 'request': github_transport})
issues = agent.execute_tool('github_issues', {}, env)
assert len(issues) == 5 and len(issues[0]['title']) == 500
assert 'omit body' not in json.dumps(issues)
def expect_error(work, fragment):
    try:
        work()
    except ValueError as error:
        assert fragment in str(error), str(error)
    else:
        raise AssertionError('Expected failure: ' + fragment)
expect_error(lambda: agent.run_agent('Task', agent.demo_provider(), env, max_turns=1), 'Turn limit')
expect_error(lambda: agent.run_agent('Task', agent.live_provider('test', 'test', lambda *args: {'status': 'incomplete', 'output': []}), env), 'incomplete')
env['repository'] = 'example/demo/../secret'
expect_error(lambda: agent.execute_tool('github_issues', {}, env), 'requires --github')
env['approve'] = lambda op: False
env['workspace'] = agent.create_workspace()
result = agent.run_agent('Draft', agent.demo_provider(), env)
assert 'draft.md' not in result['files']
print('Python companion checks passed: offline execution, live-loop mock, call ids, usage, GitHub opt-in, bounded results, denial and termination.')
