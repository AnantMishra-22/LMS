# lms-compiler

Multi-language compiler engine for LMS platforms. Supports **Python**, **Java**, **C**, and **C++** — all running inside a single Node.js process, with no native dependencies, making it ideal for **AWS Lambda** deployment.

---

## Architecture

```
lms-compiler/
├── index.js                        # AWS Lambda handler + programmatic API
├── package.json
├── compilers/
│   ├── python/                     # Python compiler
│   │   ├── python/                 # Lexer, parser, IR generator
│   │   ├── ir/                     # IR lowerer (bytecode)
│   │   ├── vm/                     # Virtual machine
│   │   ├── runtime/                # Error classes
│   │   └── runner.js               # ← Lambda-ready entry point
│   ├── java/                       # Java compiler
│   │   ├── java/                   # Lexer, parser, IR generator, AST
│   │   ├── ir/
│   │   ├── vm/
│   │   ├── runtime/
│   │   └── runner.js               # ← Lambda-ready entry point
│   └── c_cpp/                      # C and C++ compilers (shared VM/IR)
│       ├── c/                      # C frontend (preprocessor, lexer, parser, sema, irgen)
│       ├── cpp/                    # C++ frontend (lexer, parser, namespaces, templates, irgen)
│       ├── ir/
│       ├── vm/
│       ├── runtime/
│       ├── runner_c.js             # ← C Lambda-ready entry point
│       └── runner_cpp.js           # ← C++ Lambda-ready entry point
├── node_modules/
└── tests/
    ├── smoke.test.js               # 19 smoke tests across all 4 languages
    └── fixtures/                   # Sample source files
```

Each compiler's internal `require()` paths are completely unchanged from the original. Only the runner wrappers (`runner.js`, `runner_c.js`, `runner_cpp.js`) are new additions.

---

## AWS Lambda Integration

### Handler signature

```javascript
// index.js exports handler and run

// Lambda event payload:
{
  "language": "python" | "java" | "c" | "cpp",
  "code":     "<source code string>",
  "stdin":    "<optional stdin, newline-separated>",
  "limits": {                           // all optional, shown with defaults
    "maxSteps":     500000,
    "maxTimeMs":    5000,
    "maxStack":     20000,
    "maxFrames":    2000,
    "maxHeapCells": 2000000             // python/java only
  }
}

// Lambda response body (JSON):
{
  "stdout":   "<program output>",
  "stderr":   "<error if any, empty on success>",
  "exitCode": 0 | 1
}
```

### Deploying to Lambda

1. **Zip the entire repo** (excluding `.git`):
   ```bash
   zip -r lms-compiler.zip . --exclude "*.git*"
   ```
2. **Upload** to Lambda as a Node.js 18+ runtime
3. **Set handler** to `index.handler`
4. **Recommended memory**: 512 MB+
5. **Timeout**: 15–30 seconds (compilation + execution)

### Example Lambda invocation

```javascript
const AWS = require('aws-sdk');
const lambda = new AWS.Lambda();

const result = await lambda.invoke({
  FunctionName: 'lms-compiler',
  Payload: JSON.stringify({
    language: 'python',
    code: 'x = int(input())\nprint(x * x)',
    stdin: '7',
  })
}).promise();

const { stdout, stderr, exitCode } = JSON.parse(result.Payload).body
  ? JSON.parse(JSON.parse(result.Payload).body)
  : JSON.parse(result.Payload);
```

---

## Programmatic API (Node.js)

```javascript
const { run } = require('./index');

// Python
const r = run({ language: 'python', code: 'print("hi")', stdin: '' });
// → { stdout: 'hi\n', stderr: '', exitCode: 0 }

// Java
const r = run({
  language: 'java',
  code: `class Hello {
    public static void main() {
      System.out.println("Hello from Java");
    }
  }`
});

// C
const r = run({
  language: 'c',
  code: `#include <stdio.h>\nint main() { printf("hello\\n"); return 0; }`
});

// C++
const r = run({
  language: 'cpp',
  code: `#include <bits/stdc++.h>\nint main() { cout << "hello" << "\\n"; return 0; }`
});
```

---

## CLI Usage

```bash
node index.js python  <file.py>   [stdin_file]
node index.js java    <file.java> [stdin_file]
node index.js c       <file.c>    [stdin_file]
node index.js cpp     <file.cpp>  [stdin_file]
```

---

## Running Tests

```bash
node tests/smoke.test.js
```

---

## Language-Specific Notes

### Python
- Supports: functions, classes, lists, dicts, sets, `range()`, `for/while` loops, `print/input`, `try/except`, comprehensions
- `for x in iterable` — works with `range()` and list/dict iteration via `for x in range()`
- Standard inline `if x: return y` one-liners **not** supported; use full block form

### Java
- Supported syntax: `class Name { ... }` (with or without `public`)
- `main()` accepts both `main()` and `main(String[] args)` signatures
- Static methods: fully supported for simple calls
- For loops: supported with `for (int i = 0; i < n; i = i + 1)` — `i++` may cause issues in static methods; prefer `i = i + 1`
- Supported collections: `ArrayList`, `HashMap`, `StringBuilder`
- No support for: generics at runtime, lambdas, streams, inheritance chains

### C
- Full `printf/scanf/stdio.h` support with format specifiers (`%d`, `%f`, `%s`, `%x`, etc.)
- `stdlib.h`: `malloc`, `free`, `abs`, `rand`, `qsort`
- `math.h`: `sqrt`, `pow`, `sin`, `cos`, `floor`, `ceil`, etc.
- `string.h`: `strlen`, `strcmp`, `strcpy`, `strcat`, etc.
- Structs with pointer members, linked lists
- Limitation: `malloc`-allocated arrays cannot be indexed with `[]` (use struct-based approaches)
- Ternary `?:` operator works in expressions but not in variable declarations

### C++
- Supported: `vector`, `map`, `set`, `stack`, `queue`, `string`, `sort`, `algorithm`
- Import style: use `import std.X;` or `#include <X>` — both resolved from stdlib
- `cout` / `cin` for I/O
- Templates: basic template functions supported
- Limitations: no `--` decrement operator; no `+=`/`-=` compound assignment; no range-for `for (auto x : v)`; no multi-variable declarations `int a, b`

---

## Dependencies

- `readline-sync` ^1.4.10 — for interactive stdin (patched to use injected stdin in Lambda mode)
- Node.js 16+
