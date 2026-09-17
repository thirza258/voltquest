import { describe, expect, it } from 'vitest'
import { runMatlab } from './model.js'

const variable = (source, name = 'answer') => runMatlab(source).workspace.find(value => value.name === name)
const values = source => variable(source).values

describe('MATLAB-style numeric semantics', () => {
  it('handles precedence, negative array entries, fractional literals and element operators', () => {
    expect(values('answer=[-2^2 (-2)^2 2.^3 .5*4 1 -2 3 - 1];')).toEqual([-4, 4, 8, 2, 1, -2, 2])
    expect(values('answer=2^3^2;')).toEqual([64])
  })
  it('separates comments, escaped text, continuation lines and semicolon suppression', () => {
    const result = runMatlab('x=1+... ignore this\n2; % comment\ndisp("100% complete");\ndisp(\'it\'\'s text\');\nx')
    expect(result.output).toEqual(['100% complete', "it's text", 'ans =\n3'])
  })
  it('preserves column-major reshape, transpose and one-based indexing', () => {
    expect(values('A=reshape(1:6,2,3); answer=[A(3) A(2,3) A(end) A(1,min(end,2))];')).toEqual([3, 6, 6, 3])
    expect(variable('A=[1 2;3 4]; answer=A\';')).toMatchObject({ rows: 2, cols: 2, values: [1, 2, 3, 4] })
    expect(variable('A=[1 2;3 4]; answer=A(:);')).toMatchObject({ rows: 4, cols: 1, values: [1, 3, 2, 4] })
  })
  it('preserves vector orientations and logical masks', () => {
    expect(variable('x=[1 2 3]; answer=x([3;1]);')).toMatchObject({ rows: 1, cols: 2, values: [3, 1] })
    expect(variable('x=[1;2;3]; answer=x([3 1]);')).toMatchObject({ rows: 2, cols: 1, values: [3, 1] })
    expect(values('x=[1 4 2 8]; x(x>3)=0; answer=x;')).toEqual([1, 0, 2, 0])
    expect(variable('a=[true false]; a(2)=5; answer=a;')).toMatchObject({ type: 'logical', values: [1, 1] })
  })
  it('uses value semantics for assignment and anonymous captures', () => {
    expect(values('A=[1 2]; B=A; A(1)=8; answer=B;')).toEqual([1, 2])
    expect(values('a=2; f=@(x) a*x; a=3; answer=f(4);')).toEqual([8])
    expect(values('A=[1 2]; f=@(k) A(k); A(1)=9; answer=f(1);')).toEqual([1])
  })
  it('evaluates nested blocks, elseif, continue, break and column iteration', () => {
    const source = 'total=0;\nfor k=1:8\nif k==2\ncontinue;\nelseif k==5\nbreak;\nelse\ntotal=total+k;\nend\nend\ni=0;\nwhile i<3\ni=i+1;\nend\nanswer=[total i];'
    expect(values(source)).toEqual([8, 3])
    expect(values('n=0;\nfor column=[1 2;3 4]\nn=n+1;\nend\nanswer=n;')).toEqual([2])
  })
  it('implements short-circuit guards without evaluating unsafe right sides', () => {
    expect(values('answer=true | false & false;')).toEqual([1])
    expect(values('answer=[false && missing(1) true || sqrt(-1)];')).toEqual([0, 1])
    expect(() => runMatlab('answer=false & sqrt(-1);')).toThrow(/finite real/)
  })
  it('distinguishes matrix multiplication and power from element-wise operations', () => {
    expect(values('A=[1 2;3 4]; answer=A*A;')).toEqual([7, 15, 10, 22])
    expect(values('A=[1 2;3 4]; answer=A.*A;')).toEqual([1, 9, 4, 16])
    expect(values('A=[1 2;3 4]; answer=A^0;')).toEqual([1, 0, 0, 1])
    expect(values('answer=2\\[4 6];')).toEqual([2, 3])
  })
  it('solves pivoting and tall least-squares problems and detects singular inputs', () => {
    expect(values('answer=[0 2;1 1]\\[4;3];')[0]).toBeCloseTo(1, 12)
    expect(values('answer=[0 2;1 1]\\[4;3];')[1]).toBeCloseTo(2, 12)
    const solution = values('answer=[0 1;1 1;2 1;3 1]\\[1;3;5;7];')
    expect(solution[0]).toBeCloseTo(2, 12); expect(solution[1]).toBeCloseTo(1, 12)
    expect(() => runMatlab('x=[1 2;2 4]\\[1;2];')).toThrow(/singular/)
  })
  it('uses MATLAB reduction dimensions and sample/population variance', () => {
    expect(values('answer=sum([1 2;3 4]);')).toEqual([4, 6])
    expect(values('answer=sum([1 2;3 4],2);')).toEqual([3, 7])
    expect(values('answer=[var([1 2 3]) var([1 2 3],1) std([1 2 3])];')).toEqual([1, 2 / 3, 1])
    expect(values('answer=[sum([]) prod([]) all([]) any([])];')).toEqual([0, 1, 1, 0])
  })
  it('handles interpolation, fitted coefficients and integration with independent expected values', () => {
    expect(values('answer=interp1([0 1 3],[2 4 8],[0 0.5 2 3]);')).toEqual([2, 3, 6, 8])
    const fit = values('answer=polyfit([0 1 2 3],[1 3 7 13],2);')
    expect(fit[0]).toBeCloseTo(1, 10); expect(fit[1]).toBeCloseTo(1, 10); expect(fit[2]).toBeCloseTo(1, 10)
    expect(values('answer=trapz([0 1 3],[0 2 2]);')).toEqual([5])
    expect(values('answer=gradient([0 1 4],1);')).toEqual([1, 2, 3])
  })
  it('implements real convolution with row and column output shapes', () => {
    expect(variable('answer=conv([1 2 3],[1 2]);')).toMatchObject({ rows: 1, cols: 4, values: [1, 4, 7, 6] })
    expect(variable('answer=conv([1;2;3],[1;2]);')).toMatchObject({ rows: 4, cols: 1, values: [1, 4, 7, 6] })
    expect(variable('answer=conv([1 2 3],[1;2]);')).toMatchObject({ rows: 1, cols: 4, values: [1, 4, 7, 6] })
  })
  it('finds bracketed roots and rejects invalid bracketing', () => {
    expect(values('answer=fzero(@(x) x.^3-8,[0 3]);')[0]).toBeCloseTo(2, 8)
    expect(() => runMatlab('fzero(@(x) x.^2+1,[-1 1]);')).toThrow(/opposite signs/)
  })
  it('resets each workspace and random stream and supports repeatable explicit seeds', () => {
    const source = 'rng(12); answer=rand(1,4);'
    expect(values(source)).toEqual(values(source))
    expect(values(source)).not.toEqual(values('rng(13); answer=rand(1,4);'))
    expect(values('answer=rand(1,3);')).toEqual(values('answer=rand(1,3);'))
    expect(() => runMatlab('disp(answer)')).toThrow(/Unknown variable/)
  })
  it('records actual plot data, hold behavior, labels and source', () => {
    const source = 'plot([1 2]); hold("on"); plot([0 2],[3 4]); xlabel("s"); ylabel("V"); title("Comparison");'
    expect(runMatlab(source)).toMatchObject({ source, plots: [{ x: [1, 2], y: [1, 2] }, { x: [0, 2], y: [3, 4] }], labels: { xlabel: 's', ylabel: 'V', title: 'Comparison' } })
    expect(runMatlab('plot([1 2]); plot([3 4]);').plots).toHaveLength(1)
  })
})

describe('bounded parser and runtime', () => {
  it.each([
    ['x=zeros(999999999);', /16,384/], ['x=1:1e20;', /16,384/], ['x=1:0:5;', /nonzero/],
    ['while true\nend', /Execution limit/], ['x=ones(128);\nfor k=1:200\nx=x+1;\nend', /limit/i],
    ['x=1/0;', /finite real/], ['x=sqrt(-1);', /finite real/], ['x=[1 2]; x(0)=2;', /indices/],
    ['x=zeros(2); x(:,1)=[1 2];', /dimensions/], ['a=[1 2]; answer=a([true]);', /logical index/],
    ['a=[1 2]; answer=a+transpose(a);', /equal array sizes/], ['a=[1 2;3 4]; answer=a/a;', /desktop-only/],
    ['disp(1,2)', /Supported syntax/], ['answer=linspace(0,1,-2);', /16,384/],
    ['answer=interp1([1 0],[2 3],0.5);', /strictly increasing/], ['answer=interp1([0 1],[2 3],2);', /inside/],
    ['answer=norm(ones(2));', /vector/], ['answer=rand(-1);', /16,384/],
    ['x=(', /Line/], ['if true\nx=1;', /expected end/], ['end', /unexpected end/], ['break', /enclosing loop/],
    ['eval("globalThis")', /not supported/], ['system("id")', /not supported/], ['fetch("https://example.com")', /not supported/],
    ['x=globalThis.location', /unsupported character/], ['x=constructor(1)', /not supported/], ['x=__proto__', /unsupported character/],
    ['ode45(@(x) x,[0 1],0)', /not supported/], ['gpuArray([1 2])', /not supported/],
  ])('rejects %s explicitly', (source, expected) => { expect(() => runMatlab(source)).toThrow(expected) })
  it('bounds source bytes, parser nesting, output and result previews', () => {
    expect(() => runMatlab('%' + '😀'.repeat(9000))).toThrow(/32 KiB/)
    expect(() => runMatlab('x=' + '('.repeat(70) + '1' + ')'.repeat(70))).toThrow(/nesting/)
    expect(() => runMatlab('if true\n'.repeat(35) + 'end\n'.repeat(35))).toThrow(/nesting/)
    const result = runMatlab('a=1:300;\nfor k=1:300\ndisp(k);\nend')
    expect(result.output).toHaveLength(200); expect(result.outputTruncated).toBe(true)
    expect(result.workspace.find(v => v.name === 'a')).toMatchObject({ cols: 300, truncated: true })
    expect(result.workspace.find(v => v.name === 'a').values).toHaveLength(256)
  })
})
