import { expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { WINUI_COURSES } from './content.js'
import { getWinuiFiles } from './samples.js'
import { sourcePack } from './sourcePack.js'

it('compiles and runs the exact downloadable portable C++ rules and behavioral tests', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vq-winui-rules-'))
  try {
    const files = getWinuiFiles(WINUI_COURSES.find(course => course.id === 'winui-capstone'))
    for (const name of ['TaskRules.h', 'TaskRules.test.cpp']) fs.writeFileSync(path.join(directory, name), files[name])
    const executable = path.join(directory, 'rules')
    execFileSync(process.env.CXX || 'c++', ['-std=c++20', '-Wall', '-Wextra', '-Werror', '-pedantic', path.join(directory, 'TaskRules.test.cpp'), '-o', executable], { timeout: 30000 })
    expect(execFileSync(executable, { encoding: 'utf8', timeout: 5000 }).trim()).toBe('18 portable TaskRules checks passed')
  } finally { fs.rmSync(directory, { recursive: true, force: true }) }
})

it('extracts every source ZIP with a standard ZIP reader and verifies CRCs and exact UTF-8 files', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vq-winui-zips-'))
  try {
    for (const course of WINUI_COURSES) {
      const files = getWinuiFiles(course)
      fs.writeFileSync(path.join(directory, `${course.id}.zip`), new Uint8Array(await sourcePack(files).arrayBuffer()))
      fs.writeFileSync(path.join(directory, `${course.id}.json`), JSON.stringify(files))
    }
    const result = execFileSync('python3', ['-c', `
import json, pathlib, sys, zipfile
root = pathlib.Path(sys.argv[1])
for path in root.glob('*.zip'):
    expected = json.loads(path.with_suffix('.json').read_text())
    with zipfile.ZipFile(path) as archive:
        assert archive.testzip() is None
        assert set(archive.namelist()) == set(expected)
        for name, text in expected.items():
            assert archive.read(name).decode('utf-8') == text, (path, name)
print(len(list(root.glob('*.zip'))))
`, directory], { encoding: 'utf8', timeout: 10000 })
    expect(result.trim()).toBe('13')
  } finally { fs.rmSync(directory, { recursive: true, force: true }) }
})

it('runs the exact downloadable API fixture regressions and JavaScript fetch companion over real loopback HTTP', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vq-winui-api-'))
  try {
    const files = getWinuiFiles(WINUI_COURSES.find(course => course.id === 'winui-api'))
    for (const name of ['api_server.py', 'test_api_server.py', 'fetch-demo.mjs']) fs.writeFileSync(path.join(directory, name), files[name])
    const output = execFileSync('python3', ['-m', 'unittest', '-v', 'test_api_server.py'], { cwd: directory, env: { ...process.env, VQ_NODE: process.execPath }, encoding: 'utf8', timeout: 20000, stdio: 'pipe' })
    expect(output).toBe('') // unittest writes its report to stderr and fails with a nonzero exit.
  } finally { fs.rmSync(directory, { recursive: true, force: true }) }
})
