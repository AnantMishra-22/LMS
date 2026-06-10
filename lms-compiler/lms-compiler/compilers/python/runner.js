'use strict';
/**
 * compilers/python/runner.js
 * Thin wrapper around the Python compiler for LMS/Lambda use.
 *
 * exports.run({ code, stdin, limits }) → { stdout, stderr, exitCode }
 */

const lexer   = require('./python/lexer');
const Parser  = require('./python/parser');
const irgen   = require('./python/irgen');
const lowerIR = require('./ir/ir_lower');
const VM      = require('./vm/vm');

const DEFAULT_LIMITS = {
  maxSteps:     500_000,
  maxTimeMs:    5_000,
  maxStack:     20_000,
  maxFrames:    2_000,
  maxHeapCells: 2_000_000,
};

/**
 * Compile and run Python source.
 * @param {object} opts
 * @param {string} opts.code   - Python source code
 * @param {string} [opts.stdin] - stdin string (newline-separated)
 * @param {object} [opts.limits] - resource limits override
 * @returns {{ stdout: string, stderr: string, exitCode: number }}
 */
function run({ code, stdin = '', limits = {} }) {
  const effectiveLimits = { ...DEFAULT_LIMITS, ...limits };

  let stdout = '';
  let stderr = '';

  const origLog   = console.log;
  const origErr   = console.error;
  const origWrite = process.stdout.write.bind(process.stdout);
  const origErrWrite = process.stderr.write.bind(process.stderr);

  console.log   = (...args) => { stdout += args.join(' ') + '\n'; };
  console.error = (...args) => { stderr += args.join(' ') + '\n'; };
  process.stdout.write = (s) => { stdout += String(s); return true; };
  process.stderr.write = (s) => { stderr += String(s); return true; };

  try {
    const tokens   = lexer(code);
    const parser   = new Parser(tokens);
    const ast      = parser.parse();
    const ir       = irgen(ast);
    const bytecode = lowerIR(ir);

    const vm = new VM(bytecode, { ...effectiveLimits, stdin });
    vm.run();

    return { stdout, stderr, exitCode: 0 };
  } catch (e) {
    const msg = e && e.stack ? e.stack : String(e);
    return { stdout, stderr: stderr + msg, exitCode: 1 };
  } finally {
    console.log        = origLog;
    console.error      = origErr;
    process.stdout.write = origWrite;
    process.stderr.write = origErrWrite;
  }
}

module.exports = { run };
