const fs = require('fs');
const path = require('path');
const os = require('os');

function projectsDir() {
  const base = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  return path.join(base, 'projects');
}

function samePath(a, b) {
  const n = (p) => path.resolve(String(p || '')).replace(/[\\/]+$/, '');
  return process.platform === 'win32' ? n(a).toLowerCase() === n(b).toLowerCase() : n(a) === n(b);
}

function readJsonl(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (e) {
    return [];
  }
  const out = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line));
    } catch (e) {}
  }
  return out;
}

function sessionFiles(workspace, since) {
  const root = projectsDir();
  let dirs;
  try {
    dirs = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => path.join(root, d.name));
  } catch (e) {
    return [];
  }
  const found = [];
  for (const dir of dirs) {
    let files;
    try {
      files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')).map((f) => path.join(dir, f));
    } catch (e) {
      continue;
    }
    for (const file of files) {
      let st;
      try {
        st = fs.statSync(file);
      } catch (e) {
        continue;
      }
      if (st.mtimeMs < since) continue;
      const entries = readJsonl(file);
      if (!entries.some((e) => e && e.cwd && samePath(e.cwd, workspace))) continue;
      found.push({ file, entries });
    }
  }
  return found;
}

function textOf(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('\n');
}

function messages(entries) {
  const out = [];
  for (const e of entries) {
    if (!e || e.isSidechain || e.isMeta || !e.message) continue;
    const content = e.message.content;
    if (e.type === 'user') {
      if (Array.isArray(content) && content.some((b) => b && b.type === 'tool_result')) continue;
      const text = textOf(content).trim();
      if (!text || /^<[a-z-]+>/i.test(text) || /^\[Request interrupted/.test(text)) continue;
      out.push({ role: 'user', time: e.timestamp, text });
    } else if (e.type === 'assistant') {
      if (e.message.model === '<synthetic>') continue;
      const text = textOf(content).trim();
      if (!text) continue;
      const id = e.message.id;
      const last = out[out.length - 1];
      if (last && last.role === 'assistant' && id && last.id === id) last.text += '\n' + text;
      else out.push({ role: 'assistant', time: e.timestamp, text, id });
    }
  }
  return out;
}

function clock(t) {
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function buildChat(sessions, transcript, terminal, startedAt) {
  const out = [];
  out.push('Suflyor - чат сессии');
  out.push('Начало: ' + new Date(startedAt).toLocaleString('ru-RU'));
  out.push('');
  const all = sessions
    .flatMap((s) => messages(s.entries))
    .sort((a, b) => new Date(a.time) - new Date(b.time));
  for (const m of all) {
    let who = 'Claude: ';
    if (m.role === 'user') who = /^Собеседник/i.test(m.text) ? '' : 'Ты: ';
    out.push('[' + clock(m.time) + '] ' + who + m.text);
    out.push('');
  }
  const heard = Array.isArray(transcript) ? transcript : [];
  if (!all.length) {
    if (heard.length) {
      out.push('Расшифровка речи собеседника:');
      for (const t of heard) out.push('[' + t.time + '] ' + t.text + (t.sent ? '  (отправлено в Claude)' : ''));
      out.push('');
    }
    const term = String(terminal || '').trim();
    if (term) {
      out.push('Терминал:');
      out.push(term);
      out.push('');
    }
  } else {
    const unsent = heard.filter((t) => !t.sent);
    if (unsent.length) {
      out.push('Распознано, но не отправлено в Claude:');
      for (const t of unsent) out.push('[' + t.time + '] ' + t.text);
      out.push('');
    }
  }
  return { text: out.join('\r\n'), count: all.length };
}

function fileStamp(d) {
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '_' + p(d.getHours()) + '-' + p(d.getMinutes());
}

module.exports = { sessionFiles, messages, buildChat, fileStamp };
