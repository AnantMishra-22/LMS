'use strict';
/**
 * tests/smoke.test.js
 * Quick smoke tests for all 4 compilers.
 * Run: node tests/smoke.test.js
 */

const { run } = require('../index');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertOutput(result, expectedSubstring) {
  if (result.exitCode !== 0) {
    throw new Error(`Non-zero exit (${result.exitCode}). stderr: ${result.stderr.slice(0, 300)}`);
  }
  if (!result.stdout.includes(expectedSubstring)) {
    throw new Error(
      `Expected stdout to contain "${expectedSubstring}".\nGot: "${result.stdout.slice(0, 300)}"`
    );
  }
}

// ── Python ──────────────────────────────────────────────────────────────────
console.log('\n[Python]');

test('hello world', () => {
  const r = run({ language: 'python', code: 'print("Hello from Python")' });
  assertOutput(r, 'Hello from Python');
});

test('arithmetic', () => {
  const r = run({ language: 'python', code: 'print(2 + 3)' });
  assertOutput(r, '5');
});

test('for loop + range', () => {
  const r = run({ language: 'python', code: `
total = 0
for n in range(1, 6):
    total = total + n
print(total)
` });
  assertOutput(r, '15');
});

test('stdin read', () => {
  const r = run({ language: 'python', code: 'x = int(input())\nprint(x * 2)', stdin: '21\n' });
  assertOutput(r, '42');
});

test('function + recursion (fib)', () => {
  const r = run({ language: 'python', code: `
def fib(n):
    if n <= 1:
        return n
    return fib(n-1) + fib(n-2)
print(fib(10))
` });
  assertOutput(r, '55');
});

// ── Java ────────────────────────────────────────────────────────────────────
console.log('\n[Java]');

test('hello world', () => {
  const r = run({ language: 'java', code: `
public class Hello {
    public static void main(String[] args) {
        System.out.println("Hello from Java");
    }
}
` });
  assertOutput(r, 'Hello from Java');
});

test('arithmetic', () => {
  const r = run({ language: 'java', code: `
public class Arith {
    public static void main(String[] args) {
        System.out.println(2 + 3);
    }
}
` });
  assertOutput(r, '5');
});

test('for loop', () => {
  const r = run({ language: 'java', code: `
public class Loop {
    public static void main(String[] args) {
        int total = 0;
        for (int i = 1; i <= 5; i = i + 1) {
            total = total + i;
        }
        System.out.println(total);
    }
}
` });
  assertOutput(r, '15');
});

test('static method call', () => {
  const r = run({ language: 'java', code: `
class Compute {
  static int add(int a, int b) { return a + b; }
  public static void main() {
    System.out.println(add(25, 30));
  }
}
` });
  assertOutput(r, '55');
});

// ── C ───────────────────────────────────────────────────────────────────────
console.log('\n[C]');

test('hello world', () => {
  const r = run({ language: 'c', code: `
#include <stdio.h>
int main() {
    printf("Hello from C\\n");
    return 0;
}
` });
  assertOutput(r, 'Hello from C');
});

test('printf formatting', () => {
  const r = run({ language: 'c', code: `
#include <stdio.h>
int main() {
    printf("Pi ~ %.4f\\n", 3.14159265);
    printf("Hex: %x\\n", 255);
    return 0;
}
` });
  assertOutput(r, '3.1416');
  assertOutput(r, 'ff');
});

test('arithmetic + loops', () => {
  const r = run({ language: 'c', code: `
#include <stdio.h>
int main() {
    int total = 0;
    for (int i = 1; i <= 5; i++) total += i;
    printf("%d\\n", total);
    return 0;
}
` });
  assertOutput(r, '15');
});

test('recursion (fib)', () => {
  const r = run({ language: 'c', code: `
#include <stdio.h>
int fib(int n) { return n <= 1 ? n : fib(n-1) + fib(n-2); }
int main() { printf("%d\\n", fib(10)); return 0; }
` });
  assertOutput(r, '55');
});

test('stdlib abs + math', () => {
  const r = run({ language: 'c', code: `
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
int main() {
    printf("%d\\n", abs(-42));
    printf("%.1f\\n", sqrt(16.0));
    return 0;
}
` });
  assertOutput(r, '42');
  assertOutput(r, '4.0');
});

// ── C++ ─────────────────────────────────────────────────────────────────────
console.log('\n[C++]');

test('hello world', () => {
  const r = run({ language: 'cpp', code: `
#include <bits/stdc++.h>
int main() {
    cout << "Hello from C++" << "\\n";
    return 0;
}
` });
  assertOutput(r, 'Hello from C++');
});

test('arithmetic', () => {
  const r = run({ language: 'cpp', code: `
#include <bits/stdc++.h>
int main() {
    int x = 2 + 3;
    cout << x << "\\n";
    return 0;
}
` });
  assertOutput(r, '5');
});

test('vector + sort', () => {
  const r = run({ language: 'cpp', code: `
#include <bits/stdc++.h>
#include <vector>
#include <algorithm>
int main() {
    vector<int> v;
    v.push_back(3); v.push_back(1); v.push_back(2);
    sort(v.data(), v.data() + v.size());
    int i = 0;
    while (i < (int)v.size()) { cout << v[i] << " "; i = i + 1; }
    cout << "\\n";
    return 0;
}
` });
  assertOutput(r, '1 2 3');
});

test('map + set', () => {
  const r = run({ language: 'cpp', code: `
#include <bits/stdc++.h>
import std.map;
import std.set;
int main() {
    map<int,int> mp;
    mp[1] = 10; mp[2] = 20;
    cout << mp[2] << "\\n";
    set<int> s;
    s.insert(5); s.insert(3); s.insert(5);
    cout << s.size() << "\\n";
    return 0;
}
` });
  assertOutput(r, '20');
  assertOutput(r, '2');
});

test('recursion (fib)', () => {
  const r = run({ language: 'cpp', code: `
#include <bits/stdc++.h>
int fib(int n) { if (n <= 1) return n; return fib(n-1) + fib(n-2); }
int main() { cout << fib(10) << "\\n"; return 0; }
` });
  assertOutput(r, '55');
});

// ── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
if (failed > 0) {
  console.log('Some tests failed. See errors above.');
  process.exit(1);
} else {
  console.log('All tests passed!');
  process.exit(0);
}
