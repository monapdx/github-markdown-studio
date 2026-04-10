import { useEffect, useMemo, useState } from 'react';
import Editor from '@monaco-editor/react';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import { parseYaml } from './lib/yaml';

const initialMarkdown = `# GitHub Markdown Studio

A desktop app for writing and previewing GitHub files.

## Features

- Live Markdown preview
- YAML editing
- GitHub-focused templates

### Checklist

- [x] Shell working
- [x] Monaco editor
- [x] YAML validation
- [x] File open/save
- [ ] Multiple tabs
- [ ] Visual issue form builder

### Table

| File Type | Supported |
|-----------|-----------|
| Markdown  | Yes       |
| YAML      | Yes       |

### Code block

\`\`\`js
function greet(name) {
  return \`Hello, \${name}!\`;
}
\`\`\`

> This preview should feel close to GitHub-flavored Markdown.
`;

const initialYaml = `name: Bug Report
description: File a bug report
title: "[Bug]: "
labels:
  - bug
assignees:
  - monapdx
body:
  - type: markdown
    attributes:
      value: |
        Thanks for taking the time to fill out this bug report.

  - type: textarea
    id: summary
    attributes:
      label: Summary
      description: What happened?
      placeholder: Tell us what broke
    validations:
      required: true

  - type: input
    id: version
    attributes:
      label: Version
      description: What version are you using?
      placeholder: v1.0.0

  - type: dropdown
    id: browser
    attributes:
      label: Browser
      description: Which browser were you using?
      options:
        - Chrome
        - Firefox
        - Edge

  - type: checkboxes
    id: terms
    attributes:
      label: Before submitting
      description: Please confirm the following
      options:
        - label: I searched existing issues
        - label: I can reproduce this issue
`;

type Mode = 'markdown' | 'yaml';

export default function App() {
  const [mode, setMode] = useState<Mode>('markdown');
  const [content, setContent] = useState(initialMarkdown);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [status, setStatus] = useState('Ready');

  useEffect(() => {
    if (!window.api) {
      setStatus('Electron bridge missing');
    }
  }, []);

  const md = useMemo(() => {
    return new MarkdownIt({
      html: false,
      linkify: true,
      typographer: true,
      highlight(str, lang) {
        if (lang && hljs.getLanguage(lang)) {
          try {
            return `<pre class="hljs"><code>${hljs.highlight(str, {
              language: lang,
              ignoreIllegals: true,
            }).value}</code></pre>`;
          } catch {
            return `<pre class="hljs"><code>${mdEscape(str)}</code></pre>`;
          }
        }

        return `<pre class="hljs"><code>${mdEscape(str)}</code></pre>`;
      },
    });
  }, []);

  const yamlResult = useMemo(() => {
    if (mode !== 'yaml') return null;
    return parseYaml(content);
  }, [content, mode]);

  const previewHtml = useMemo(() => {
    if (mode === 'markdown') {
      return md.render(content);
    }

    if (!yamlResult) return '';

    if (!yamlResult.valid) {
      return `
        <div class="yaml-error">
          <strong>Invalid YAML</strong>
          <p>${mdEscape(yamlResult.error)}</p>
          ${
            yamlResult.line !== undefined && yamlResult.column !== undefined
              ? `<p>Line: ${yamlResult.line + 1}, Column: ${yamlResult.column + 1}</p>`
              : ''
          }
        </div>
      `;
    }

    return renderYamlPreview(yamlResult.data);
  }, [content, md, mode, yamlResult]);

  function getInitialContent(nextMode: Mode) {
    return nextMode === 'markdown' ? initialMarkdown : initialYaml;
  }

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setFilePath(null);
    setContent(getInitialContent(nextMode));
    setStatus(`Switched to ${nextMode}`);
  }

  function loadTemplate(template: 'readme' | 'contributing' | 'issue' | 'workflow') {
    if (template === 'readme') {
      setMode('markdown');
      setFilePath(null);
      setContent(`# Project Name

A short description of what this repo does.

## Features

- Feature one
- Feature two
- Feature three

## Installation

\`\`\`bash
npm install
\`\`\`

## Usage

Describe how to use the project.

## License

MIT
`);
      setStatus('Loaded README template');
      return;
    }

    if (template === 'contributing') {
      setMode('markdown');
      setFilePath(null);
      setContent(`# Contributing

Thanks for your interest in contributing.

## How to contribute

1. Fork the repo
2. Create a branch
3. Make your changes
4. Open a pull request

## Guidelines

- Keep changes focused
- Write clear commit messages
- Be respectful
`);
      setStatus('Loaded CONTRIBUTING template');
      return;
    }

    if (template === 'issue') {
      setMode('yaml');
      setFilePath(null);
      setContent(initialYaml);
      setStatus('Loaded issue form template');
      return;
    }

    setMode('yaml');
    setFilePath(null);
    setContent(`name: CI

on:
  push:
    branches:
      - main
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install dependencies
        run: npm install
      - name: Build
        run: npm run build
`);
    setStatus('Loaded workflow template');
  }

  async function handleNew() {
    setFilePath(null);
    setContent(getInitialContent(mode));
    setStatus(`Started new ${mode === 'markdown' ? 'Markdown' : 'YAML'} file`);
  }

  async function handleOpen() {
    try {
      setStatus('Opening...');

      if (!window.api?.openFile) {
        setStatus('window.api.openFile missing');
        return;
      }

      const result = await window.api.openFile();

      if (!result) {
        setStatus('Open canceled');
        return;
      }

      const nextMode: Mode = result.filePath.toLowerCase().endsWith('.md')
        ? 'markdown'
        : 'yaml';

      setMode(nextMode);
      setFilePath(result.filePath);
      setContent(result.content);
      setStatus(`Opened ${result.filePath.split(/[/\\\\]/).pop()}`);
    } catch (error) {
      console.error('Open failed:', error);
      setStatus('Open failed');
    }
  }

  async function handleSave() {
    try {
      if (!window.api?.saveFile || !window.api?.saveFileAs) {
        setStatus('window.api save methods missing');
        return;
      }

      if (!filePath) {
        const result = await window.api.saveFileAs(content);

        if (!result) {
          setStatus('Save canceled');
          return;
        }

        setFilePath(result.filePath);
        setStatus(`Saved ${result.filePath.split(/[/\\\\]/).pop()}`);
      } else {
        const result = await window.api.saveFile(content);

        if (!result) {
          setStatus('Save failed');
          return;
        }

        setFilePath(result.filePath);
        setStatus(`Saved ${result.filePath.split(/[/\\\\]/).pop()}`);
      }
    } catch (error) {
      console.error('Save failed:', error);
      setStatus('Save failed');
    }
  }

  const displayName = filePath
    ? filePath.split(/[/\\\\]/).pop()
    : 'Untitled';

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-wrap">
          <div className="brand-title">GitHub Markdown Studio</div>
          <div className="brand-file">{displayName}</div>
        </div>

        <div className="topbar-actions">
          <button onClick={() => switchMode('markdown')}>Markdown</button>
          <button onClick={() => switchMode('yaml')}>YAML</button>
          <button onClick={handleNew}>New</button>
          <button onClick={handleOpen}>Open</button>
          <button onClick={handleSave}>Save</button>
        </div>
      </header>

      <div className="statusbar">{status}</div>

      <div className="main-layout">
        <aside className="sidebar">
          <h2>Templates</h2>
          <ul className="template-list">
            <li>
              <button
                className="sidebar-button"
                onClick={() => loadTemplate('readme')}
              >
                README.md
              </button>
            </li>
            <li>
              <button
                className="sidebar-button"
                onClick={() => loadTemplate('contributing')}
              >
                CONTRIBUTING.md
              </button>
            </li>
            <li>
              <button
                className="sidebar-button"
                onClick={() => loadTemplate('issue')}
              >
                Issue Form
              </button>
            </li>
            <li>
              <button
                className="sidebar-button"
                onClick={() => loadTemplate('workflow')}
              >
                Workflow
              </button>
            </li>
          </ul>
        </aside>

        <main className="editor-area">
          <div className="panel editor-panel">
            <div className="panel-header">
              <h2>Editor</h2>
              <span className="mode-badge">
                {mode === 'markdown' ? 'Markdown' : 'YAML'}
              </span>
            </div>

            <div className="editor-wrap">
              <Editor
                height="100%"
                defaultLanguage="markdown"
                language={mode === 'markdown' ? 'markdown' : 'yaml'}
                value={content}
                onChange={(value) => setContent(value ?? '')}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  wordWrap: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                }}
              />
            </div>
          </div>
        </main>

        <section className="preview-area">
          <div className="panel preview-panel">
            <div className="panel-header">
              <h2>Preview</h2>
              <span className="mode-badge">
                {mode === 'markdown' ? 'Rendered' : 'Structured preview'}
              </span>
            </div>

            <div
              className="markdown-preview"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function renderYamlPreview(data: any) {
  if (!data || typeof data !== 'object') {
    return `<pre>${mdEscape(JSON.stringify(data, null, 2))}</pre>`;
  }

  if (Array.isArray(data.body)) {
    return renderIssueForm(data);
  }

  return `<pre>${mdEscape(JSON.stringify(data, null, 2))}</pre>`;
}

function renderIssueForm(form: any) {
  const fields = form.body ?? [];

  return `
    <div class="issue-form">
      <h2>${mdEscape(form.name ?? 'Issue Form')}</h2>
      <p class="form-description">${mdEscape(form.description ?? '')}</p>

      <div class="form-meta">
        ${
          Array.isArray(form.labels) && form.labels.length
            ? `<div><strong>Labels:</strong> ${form.labels.map((label: string) => mdEscape(label)).join(', ')}</div>`
            : ''
        }
        ${
          Array.isArray(form.assignees) && form.assignees.length
            ? `<div><strong>Assignees:</strong> ${form.assignees.map((name: string) => mdEscape(name)).join(', ')}</div>`
            : ''
        }
      </div>

      <div class="form-fields">
        ${fields.map(renderField).join('')}
      </div>
    </div>
  `;
}

function renderField(field: any) {
  if (field.type === 'markdown') {
    return `<div class="form-markdown">${mdEscape(field.attributes?.value ?? field.value ?? '')}</div>`;
  }

  const label = field.attributes?.label ?? 'Field';
  const description = field.attributes?.description ?? '';
  const placeholder = field.attributes?.placeholder ?? '';
  const required = field.validations?.required ? ' <span class="required">*</span>' : '';

  switch (field.type) {
    case 'input':
      return `
        <div class="form-group">
          <label>${mdEscape(label)}${required}</label>
          <input placeholder="${mdEscape(placeholder)}" disabled />
          <small>${mdEscape(description)}</small>
        </div>
      `;

    case 'textarea':
      return `
        <div class="form-group">
          <label>${mdEscape(label)}${required}</label>
          <textarea placeholder="${mdEscape(placeholder)}" disabled></textarea>
          <small>${mdEscape(description)}</small>
        </div>
      `;

    case 'dropdown':
      return `
        <div class="form-group">
          <label>${mdEscape(label)}${required}</label>
          <select disabled>
            ${(field.attributes?.options ?? [])
              .map(
                (opt: any) =>
                  `<option>${mdEscape(
                    typeof opt === 'string' ? opt : (opt.label ?? '')
                  )}</option>`
              )
              .join('')}
          </select>
          <small>${mdEscape(description)}</small>
        </div>
      `;

    case 'checkboxes':
      return `
        <div class="form-group">
          <label>${mdEscape(label)}${required}</label>
          <div class="checkbox-group">
            ${(field.attributes?.options ?? [])
              .map(
                (opt: any) => `
                  <label class="checkbox-item">
                    <input type="checkbox" disabled />
                    ${mdEscape(typeof opt === 'string' ? opt : (opt.label ?? ''))}
                  </label>
                `
              )
              .join('')}
          </div>
          <small>${mdEscape(description)}</small>
        </div>
      `;

    default:
      return `<div class="form-unknown">Unsupported field type: ${mdEscape(
        field.type ?? 'unknown'
      )}</div>`;
  }
}

function mdEscape(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}