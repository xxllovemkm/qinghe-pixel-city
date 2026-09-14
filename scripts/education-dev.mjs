import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const root = path.resolve(import.meta.dirname, '..');
const backend = process.env.AICAMPUS_BACKEND ?? path.join(os.homedir(), 'Documents/ChatGPT/AICampus/versions/v4');
const candidates = [process.env.EDUCATION_PYTHON, path.join(root, '.venv-education/bin/python'), 'python3.12', 'python3.11', 'python3'].filter(Boolean);
const python = candidates.find(candidate => spawnSync(candidate, ['-c', 'import sys; assert sys.version_info >= (3,11); import pymupdf, PIL'], { stdio: 'ignore' }).status === 0);
const requiredModules = ['school_day.py', 'school_day_api.py', 'source_curriculum.py'];
const missingModules = requiredModules.filter(name => !fs.existsSync(path.join(backend, 'QingheSimulation', name)));
if (missingModules.length) throw new Error(`Set AICAMPUS_BACKEND to the AICampus versions/v4 directory. Missing modules: ${missingModules.join(', ')}`);
if (!python) throw new Error('Set EDUCATION_PYTHON to Python 3.11+ with QingheSimulation/requirements-materials.txt installed.');
const children = [];
function stop() { for (const child of children) if (!child.killed) child.kill('SIGTERM'); }
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, stop);
for (const [command, args, cwd] of [
  [python, ['-m', 'WebUI.server', '--host', '127.0.0.1', '--port', '8768', '--qinghe-url', 'http://localhost:3000/'], backend],
  ['npm', ['run', 'dev'], root],
]) {
  const child = spawn(command, args, { cwd, stdio: 'inherit', env: process.env });
  children.push(child);
  child.on('error', error => { console.error(error.message); process.exitCode = 1; stop(); });
  child.on('exit', (code, signal) => { if (code && !signal) process.exitCode = code; stop(); });
}
console.log('Teaching lab: http://localhost:3000/?teaching=1');
