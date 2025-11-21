/**
 * Minimal global declarations so TypeScript can typecheck Jest-style tests
 * without pulling in the full Jest type surface yet.
 */

declare function test(name: string, fn: () => void): void;

declare function expect(actual: unknown): {
  toThrow(): void;
  toMatch(expected: RegExp | string): void;
  toHaveLength(expectedLength: number): void;
  toBe(expected: unknown): void;
  toContain(expected: unknown): void;
};
