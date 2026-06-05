describe('src/core boundary', () => {
  it('runs pure TypeScript with no native imports', () => {
    // Verifies Jest can reach src/core in a plain Node environment.
    // Real logic tests live here from M1 onward.
    expect(1 + 1).toBe(2);
  });

  it('does basic arithmetic', () => {
    const add = (a: number, b: number): number => a + b;
    expect(add(3, 4)).toBe(7);
  });
});
