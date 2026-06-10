'use strict';
/**
 * compilers/java/runner.js
 * Thin wrapper around the Java compiler for LMS/Lambda use.
 */

const { tokenize }   = require('./java/lexer/lexer');
const Parser         = require('./java/parser/parser');
const generateIR     = require('./java/irgen/irgen');
const lowerIR        = require('./ir/ir_lower');
const VirtualMachine = require('./vm/vm');

const DEFAULT_LIMITS = {
  maxSteps:     1_000_000,
  maxTimeMs:    5_000,
  maxStack:     20_000,
  maxFrames:    2_000,
  maxHeapCells: 2_000_000,
};

/**
 * Compile and run Java source.
 */
function run({ code, stdin = '', limits = {} }) {
  const effectiveLimits = { ...DEFAULT_LIMITS, ...limits };

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

  // Patch readline-sync for injected stdin
  let _inputLines = stdin ? stdin.split(/\r?\n/) : [];
  let _inputIdx   = 0;
  const readlineSync  = require('readline-sync');
  const origQuestion  = readlineSync.question.bind(readlineSync);
  readlineSync.question = (_prompt) => {
    if (_inputIdx < _inputLines.length) return _inputLines[_inputIdx++];
    return '';
  };

  try {
    const tokens   = tokenize(code);
    const parser   = new Parser(tokens);
    const ast      = parser.parse();
    const irProg   = generateIR(ast);
    const bytecode = lowerIR(irProg);

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
