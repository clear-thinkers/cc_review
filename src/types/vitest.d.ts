declare module "vitest" {
  export function describe(name: string, fn: () => void): void;
  export function it(name: string, fn: () => void): void;
  export function expect<T>(value: T): {
    toBe(expected: unknown): void;
    toBeCloseTo(expected: number, precision?: number): void;
    toBeGreaterThan(expected: number): void;
  };
}
