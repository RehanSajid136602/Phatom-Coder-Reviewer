// tests/lib/detectLanguage.test.ts
import { describe, it, expect } from '@jest/globals';
import { detectLanguage, getLanguageLabel, Language } from '@/lib/detectLanguage';

describe('detectLanguage', () => {
  describe('Python detection', () => {
    it('should detect Python from def keyword', () => {
      const code = `def hello():
    print("Hello")`;
      expect(detectLanguage(code)).toBe('python');
    });

    it('should detect Python from import statement', () => {
      const code = `import os
import sys`;
      expect(detectLanguage(code)).toBe('python');
    });

    it('should detect Python from class definition', () => {
      const code = `class MyClass:
    def __init__(self):
        pass`;
      expect(detectLanguage(code)).toBe('python');
    });

    it('should detect Python from if __name__ == "__main__"', () => {
      const code = `if __name__ == "__main__":
    main()`;
      expect(detectLanguage(code)).toBe('python');
    });
  });

  describe('JavaScript detection', () => {
    it('should detect JavaScript from function keyword', () => {
      const code = `function hello() {
    console.log("Hello");
}`;
      expect(detectLanguage(code)).toBe('javascript');
    });

    it('should detect JavaScript from const declaration', () => {
      const code = `const x = 10;
let y = 20;`;
      expect(detectLanguage(code)).toBe('javascript');
    });

    it('should detect JavaScript from arrow function', () => {
      const code = `const add = (a, b) => {
    return a + b;
};`;
      expect(detectLanguage(code)).toBe('javascript');
    });

    it('should detect JavaScript from require', () => {
      const code = `const express = require('express');`;
      expect(detectLanguage(code)).toBe('javascript');
    });
  });

  describe('TypeScript detection', () => {
    it('should detect TypeScript from type annotation', () => {
      const code = `function add(a: number, b: number): number {
    return a + b;
}`;
      expect(detectLanguage(code)).toBe('typescript');
    });

    it('should detect TypeScript from interface', () => {
      const code = `interface User {
    id: number;
    name: string;
}`;
      expect(detectLanguage(code)).toBe('typescript');
    });

    it('should detect TypeScript from type alias', () => {
      const code = `type Result = Success | Failure;`;
      expect(detectLanguage(code)).toBe('typescript');
    });

    it('should detect TypeScript from generic', () => {
      const code = `function identity<T>(arg: T): T {
    return arg;
}`;
      expect(detectLanguage(code)).toBe('typescript');
    });

    it('should prioritize TypeScript over JavaScript when type annotations present', () => {
      const code = `const users: User[] = [];
function getUser(id: number): User {
    return users.find(u => u.id === id);
}`;
      expect(detectLanguage(code)).toBe('typescript');
    });
  });

  describe('Rust detection', () => {
    it('should detect Rust from fn keyword', () => {
      const code = `fn main() {
    println!("Hello");
}`;
      expect(detectLanguage(code)).toBe('rust');
    });

    it('should detect Rust from let mut', () => {
      const code = `let mut x = 5;`;
      expect(detectLanguage(code)).toBe('rust');
    });

    it('should detect Rust from impl block', () => {
      const code = `impl MyClass {
    fn new() -> Self {
        MyClass {}
    }
}`;
      expect(detectLanguage(code)).toBe('rust');
    });

    it('should detect Rust from match expression', () => {
      const code = `match value {
    Some(x) => println!("{}", x),
    None => println!("None"),
}`;
      expect(detectLanguage(code)).toBe('rust');
    });
  });

  describe('Go detection', () => {
    it('should detect Go from func keyword', () => {
      const code = `func main() {
    fmt.Println("Hello")
}`;
      expect(detectLanguage(code)).toBe('go');
    });

    it('should detect Go from package declaration', () => {
      const code = `package main`;
      expect(detectLanguage(code)).toBe('go');
    });

    it('should detect Go from short variable declaration', () => {
      const code = `x := 10`;
      expect(detectLanguage(code)).toBe('go');
    });

    it('should detect Go from goroutine', () => {
      const code = `go func() {
    doSomething()
}()`;
      expect(detectLanguage(code)).toBe('go');
    });
  });

  describe('C++ detection', () => {
    it('should detect C++ from include directive', () => {
      const code = `#include <iostream>`;
      expect(detectLanguage(code)).toBe('cpp');
    });

    it('should detect C++ from std namespace', () => {
      const code = `std::cout << "Hello";`;
      expect(detectLanguage(code)).toBe('cpp');
    });

    it('should detect C++ from main function', () => {
      const code = `int main(int argc, char** argv) {
    return 0;
}`;
      expect(detectLanguage(code)).toBe('cpp');
    });

    it('should detect C++ from template', () => {
      const code = `template<typename T>
class Container {
    T value;
};`;
      expect(detectLanguage(code)).toBe('cpp');
    });
  });

  describe('SQL detection', () => {
    it('should detect SQL from SELECT statement', () => {
      const code = `SELECT * FROM users WHERE id = 1;`;
      expect(detectLanguage(code)).toBe('sql');
    });

    it('should detect SQL from INSERT statement', () => {
      const code = `INSERT INTO users (name, email) VALUES ('John', 'john@example.com');`;
      expect(detectLanguage(code)).toBe('sql');
    });

    it('should detect SQL from CREATE TABLE', () => {
      const code = `CREATE TABLE users (
    id INT PRIMARY KEY,
    name VARCHAR(100)
);`;
      expect(detectLanguage(code)).toBe('sql');
    });

    it('should detect SQL from JOIN', () => {
      const code = `SELECT u.name, o.total
FROM users u
JOIN orders o ON u.id = o.user_id;`;
      expect(detectLanguage(code)).toBe('sql');
    });
  });

  describe('Bash detection', () => {
    it('should detect Bash from shebang', () => {
      const code = `#!/bin/bash`;
      expect(detectLanguage(code)).toBe('bash');
    });

    it('should detect Bash from echo command', () => {
      const code = `echo "Hello World"`;
      expect(detectLanguage(code)).toBe('bash');
    });

    it('should detect Bash from if statement', () => {
      const code = `if [ -f "$file" ]; then
    echo "File exists"
fi`;
      expect(detectLanguage(code)).toBe('bash');
    });

    it('should detect Bash from pipe to grep', () => {
      const code = `cat file.txt | grep "pattern"`;
      expect(detectLanguage(code)).toBe('bash');
    });
  });

  describe('Edge cases', () => {
    it('should return "other" for empty string', () => {
      expect(detectLanguage('')).toBe('other');
    });

    it('should return "other" for plain text', () => {
      expect(detectLanguage('This is just plain text')).toBe('other');
    });

    it('should return "other" for random characters', () => {
      expect(detectLanguage('asdfghjkl123456789')).toBe('other');
    });

    it('should handle mixed language code (Python + SQL)', () => {
      const code = `def get_user():
    query = "SELECT * FROM users"
    return execute(query)`;
      // Python should win due to def keyword
      expect(detectLanguage(code)).toBe('python');
    });

    it('should handle whitespace-only input', () => {
      expect(detectLanguage('   \n\n   ')).toBe('other');
    });

    it('should handle very short code snippets', () => {
      expect(detectLanguage('def x(): pass')).toBe('python');
    });
  });

  describe('getLanguageLabel', () => {
    it('should return correct label for each language', () => {
      expect(getLanguageLabel('python')).toBe('Python');
      expect(getLanguageLabel('javascript')).toBe('JavaScript');
      expect(getLanguageLabel('typescript')).toBe('TypeScript');
      expect(getLanguageLabel('rust')).toBe('Rust');
      expect(getLanguageLabel('go')).toBe('Go');
      expect(getLanguageLabel('cpp')).toBe('C++');
      expect(getLanguageLabel('sql')).toBe('SQL');
      expect(getLanguageLabel('bash')).toBe('Bash');
      expect(getLanguageLabel('other')).toBe('Other');
    });
  });
});
