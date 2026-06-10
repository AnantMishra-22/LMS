'use strict';
/**
 * compilers/c_cpp/runner_c.js
 * Thin wrapper around the C compiler for LMS/Lambda use.
 *
 * exports.run({ code, stdin, limits }) → { stdout, stderr, exitCode }
 *
 * Internal require() paths are relative to compilers/c_cpp/ which
 * mirrors the original "Cpp and C/" layout exactly — no path changes needed.
 */

const path = require('path');

const { preprocess } = require('./c/preprocessor');
const { Lexer }      = require('./c/lexer');
const { Parser }     = require('./c/parser');
const sema           = require('./c/sema');
const generateIR     = require('./c/irgen');
const lowerIR        = require('./ir/ir_lower');
const VirtualMachine = require('./vm/vm');

// Stdlib headers live at compilers/c_cpp/c/stdlib/
const C_STDLIB_DIR = path.join(__dirname, 'c', 'stdlib');

const DEFAULT_LIMITS = {
  maxSteps:     500_000,
  maxTimeMs:    5_000,
  maxStack:     20_000,
  maxFrames:    2_000,
};

/**
 * Compile and run C source.
 * @param {object} opts
 * @param {string} opts.code    - C source code
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

  // Patch readline-sync to consume injected stdin
  let _inputLines = stdin ? stdin.split(/\r?\n/) : [];
  let _inputIdx = 0;
  const readlineSync = require('readline-sync');
  const origQuestion = readlineSync.question.bind(readlineSync);
  readlineSync.question = (_prompt) => {
    if (_inputIdx < _inputLines.length) return _inputLines[_inputIdx++];
    return '';
  };

  try {
    // Preprocess: resolve #include against the C stdlib dir
    const preprocessed = preprocess(code, C_STDLIB_DIR);

    const lexer  = new Lexer(preprocessed);
    const tokens = lexer.tokenize();

    const parser = new Parser(tokens);
    const ast    = parser.parseProgram();

    const semaResult = sema.analyze(ast);
    const ir         = generateIR(semaResult);
    const bytecode   = lowerIR(ir);

    const vm = new VirtualMachine(bytecode, effectiveLimits);
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
  }
}

module.exports = { run };
