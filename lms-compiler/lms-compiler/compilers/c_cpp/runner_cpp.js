'use strict';
/**
 * compilers/c_cpp/runner_cpp.js
 * Thin wrapper around the C++ compiler for LMS/Lambda use.
 *
 * exports.run({ code, stdin, limits }) → { stdout, stderr, exitCode }
 *
 * The C++ compiler resolves `import std.X` and `#include <X>` by reading
 * files from the stdlib directory on disk. We write source to a temp file
 * so the existing loadWithImports() logic works unchanged.
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const lex                 = require('./cpp/lexer');
const Parser              = require('./cpp/parser');
const { flattenNamespaces } = require('./cpp/namespaces');
const { expandTemplates } = require('./cpp/templates');
const { rewriteStdMeta }  = require('./cpp/rewrite_stdmeta');
const generateIR          = require('./cpp/irgen');
const lowerIR             = require('./ir/ir_lower');
const VM                  = require('./vm/vm');

const CPP_STD_DIR = path.join(__dirname, 'cpp', 'stdlib');

const DEFAULT_LIMITS = {
  maxSteps:     500_000,
  maxTimeMs:    5_000,
  maxStack:     20_000,
  maxFrames:    2_000,
};

// ── Import/include resolution (mirrors cpp/run.js) ──────────────────────────

function stripBOM(s) {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function resolveImport(moduleName, fromDir) {
  const parts = moduleName.split('.');
  const rel   = parts.join(path.sep) + '.cpp';

  const candidates = [];

  if (parts[0] === 'std') {
    candidates.push(path.join(CPP_STD_DIR, parts.slice(1).join(path.sep) + '.cpp'));
    candidates.push(path.join(CPP_STD_DIR, rel));
  }
  candidates.push(path.join(fromDir,    rel));
  candidates.push(path.join(CPP_STD_DIR, rel));

  return candidates.find(p => fs.existsSync(p)) || null;
}

function resolveIncludeFile(includeName, fromDir) {
  const candidates = [
    path.join(fromDir,    includeName),
    path.join(CPP_STD_DIR, includeName),
  ];
  return candidates.find(p => fs.existsSync(p)) || null;
}

function loadWithImports(entryPath, seen = new Set(), definedGuards = new Set()) {
  const abs = path.resolve(entryPath);
  if (seen.has(abs)) return '';
  seen.add(abs);

  const dir   = path.dirname(abs);
  const raw   = stripBOM(fs.readFileSync(abs, 'utf8'));
  const lines = raw.split(/\r?\n/);

  let guardName = null, skipGuardLines = false;
  if (lines.length >= 2) {
    const ifndefMatch = lines[0].match(/^\s*#ifndef\s+([A-Za-z0-9_]+)\s*$/);
    const defineMatch = lines[1].match(/^\s*#define\s+([A-Za-z0-9_]+)\s*$/);
    if (ifndefMatch && defineMatch && ifndefMatch[1] === defineMatch[1]) {
      guardName = ifndefMatch[1];
      if (definedGuards.has(guardName)) return '';
      definedGuards.add(guardName);
      skipGuardLines = true;
    }
  }

  const importRe      = /^\s*import\s+([A-Za-z0-9_.]+)\s*;\s*$/;
  const includeSysRe  = /^\s*#include\s*<([^>]+)>\s*$/;
  const includeLocalRe = /^\s*#include\s*"([^"]+)"\s*$/;

  let out = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (skipGuardLines &&
        (i === 0 || i === 1 ||
         (i === lines.length - 1 && /^\s*#endif\s*(\/\/.*)?$/.test(line)))) {
      continue;
    }

    let mod = null;

    const m = line.match(importRe);
    if (m) mod = m[1];

    const s = line.match(includeSysRe);
    if (s) {
      const name = s[1];
      mod = name === 'bits/stdc++.h' ? 'std.bits.stdcpp' : 'std.' + name.replace(/\//g, '.');
    }

    const l = line.match(includeLocalRe);
    if (l) {
      const includeName = l[1];
      let resolved = resolveIncludeFile(includeName, dir);
      if (!resolved) {
        mod = includeName.replace(/\.h$/, '').replace(/\.hpp$/, '').replace(/\//g, '.');
        resolved = resolveImport(mod, dir);
      }
      if (resolved) { out += loadWithImports(resolved, seen, definedGuards) + '\n'; }
      continue;
    }

    if (mod) {
      const resolved = resolveImport(mod, dir);
      if (!resolved) throw new Error(`Cannot resolve module '${mod}'`);
      out += loadWithImports(resolved, seen, definedGuards) + '\n';
      continue;
    }

    if (/^\s*#/.test(line)) continue;

    out += line + '\n';
  }

  return out;
}

// ── Runner ───────────────────────────────────────────────────────────────────

/**
 * Compile and run C++ source.
 * @param {object} opts
 * @param {string} opts.code    - C++ source code
 * @param {string} [opts.stdin] - stdin string (newline-separated)
 * @param {object} [opts.limits] - resource limits override
 * @returns {{ stdout: string, stderr: string, exitCode: number }}
 */
function run({ code, stdin = '', limits = {} }) {
  const effectiveLimits = { ...DEFAULT_LIMITS, ...limits };

  // Write to a temp file so loadWithImports can resolve imports via disk
  const tmpFile = path.join(os.tmpdir(), `lms_cpp_${Date.now()}_${process.pid}.cpp`);
  fs.writeFileSync(tmpFile, code, 'utf8');

  let stdout = '';
  let stderr = '';

  const origLog    = console.log;
  const origErr    = console.error;
  const origWrite  = process.stdout.write.bind(process.stdout);
  const origErrWrite = process.stderr.write.bind(process.stderr);

  console.log   = (...args) => { stdout += args.join(' ') + '\n'; };
  console.error = (...args) => { stderr += args.join(' ') + '\n'; };
  process.stdout.write = (s) => { stdout += String(s); return true; };
  process.stderr.write = (s) => { stderr += String(s); return true; };

  // Patch readline-sync to consume injected stdin
  let _inputLines = stdin ? stdin.split(/\r?\n/) : [];
  let _inputIdx   = 0;
  const readlineSync  = require('readline-sync');
  const origQuestion  = readlineSync.question.bind(readlineSync);
  readlineSync.question = (_prompt) => {
    if (_inputIdx < _inputLines.length) return _inputLines[_inputIdx++];
    return '';
  };

  try {
    // Load source with imports resolved
    let src = loadWithImports(tmpFile);

    // Inject std prelude
    const preludePath = path.join(CPP_STD_DIR, 'prelude.cpp');
    if (fs.existsSync(preludePath)) {
      src = stripBOM(fs.readFileSync(preludePath, 'utf8')) + '\n\n' + src;
    }

    const tokens = lex(src);
    const parser = new Parser(tokens);
    let ast      = parser.parse();

    ast = flattenNamespaces(ast);
    ast = expandTemplates(ast);
    ast = rewriteStdMeta(ast);

    const ir       = generateIR(ast);
    const bytecode = lowerIR(ir);

    const vm = new VM(bytecode, effectiveLimits);
    vm.run();

    return { stdout, stderr, exitCode: 0 };
  } catch (e) {
    const msg = e && e.stack ? e.stack : String(e);
    return { stdout, stderr: stderr + msg, exitCode: 1 };
  } finally {
    console.log   = origLog;
    console.error = origErr;
    process.stdout.write = origWrite;
    process.stderr.write = origErrWrite;
    readlineSync.question = origQuestion;
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}

module.exports = { run };
