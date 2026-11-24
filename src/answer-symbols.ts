export interface AnswerSymbol {
  glyph: string;
  name: string;
  aliases?: string;
  insert?: string;
}

const arithmeticSymbols: AnswerSymbol[] = [
  { glyph: '×', name: 'Multiply', aliases: 'times product' },
  { glyph: '÷', name: 'Divide', aliases: 'division' },
  { glyph: '−', name: 'Minus', aliases: 'subtract negative' },
  { glyph: '√', name: 'Square root', aliases: 'sqrt radical', insert: '√(' },
  { glyph: '²', name: 'Squared', aliases: 'square power exponent 2' },
  { glyph: '³', name: 'Cubed', aliases: 'cube power exponent 3' },
  { glyph: '⁻¹', name: 'Power of minus one', aliases: 'inverse exponent reciprocal' },
  { glyph: 'π', name: 'Pi' },
  { glyph: '×10', name: 'Scientific notation', aliases: 'sci exponent', insert: ' × 10^' },
  { glyph: '%', name: 'Percent', aliases: 'percentage' },
  { glyph: 'mod', name: 'Modulo', aliases: 'remainder', insert: ' mod ' },
];

const common: AnswerSymbol[] = [
  { glyph: '→', name: 'Right arrow', aliases: 'implies maps to' },
  { glyph: '≈', name: 'Approximately equal', aliases: 'approx' },
  { glyph: '≠', name: 'Not equal', aliases: 'neq unequal' },
  { glyph: '≤', name: 'Less than or equal', aliases: 'le leq' },
  { glyph: '≥', name: 'Greater than or equal', aliases: 'ge geq' },
  { glyph: '∈', name: 'Element of', aliases: 'in member' },
  { glyph: '∩', name: 'Intersection', aliases: 'cap intersect' },
  { glyph: '∪', name: 'Union', aliases: 'cup' },
  { glyph: '₀', name: 'Subscript zero', aliases: 'sub0' },
  { glyph: '₁', name: 'Subscript one', aliases: 'sub1' },
  { glyph: '₂', name: 'Subscript two', aliases: 'sub2' },
];

const probability: AnswerSymbol[] = [
  { glyph: 'μ', name: 'Mu', aliases: 'mean' },
  { glyph: 'σ', name: 'Sigma', aliases: 'standard deviation' },
  { glyph: 'σ²', name: 'Sigma squared', aliases: 'variance' },
  { glyph: '∑', name: 'Sum', aliases: 'summation capital sigma' },
];

const moduleSymbols: Record<string, AnswerSymbol[]> = {
  'ai-and-data-mining': [
    { glyph: 'α', name: 'Alpha', aliases: 'search bound' },
    { glyph: 'β', name: 'Beta', aliases: 'search bound' },
    { glyph: 'η', name: 'Eta', aliases: 'learning rate' },
    { glyph: 'δ', name: 'Delta', aliases: 'error term' },
    { glyph: 'θ', name: 'Theta', aliases: 'weights parameters' },
    { glyph: '∇', name: 'Nabla', aliases: 'gradient' },
    { glyph: 'λ', name: 'Lambda', aliases: 'eigenvalue regularisation' },
    ...probability,
  ],
  ie2106: [
    { glyph: '∫', name: 'Integral', aliases: 'integration' },
    { glyph: '∂', name: 'Partial derivative', aliases: 'partial' },
    { glyph: '∞', name: 'Infinity', aliases: 'inf' },
    { glyph: '′', name: 'Prime', aliases: 'first derivative' },
    { glyph: '″', name: 'Double prime', aliases: 'second derivative' },
    { glyph: 'χ²', name: 'Chi squared', aliases: 'chi square' },
    { glyph: 'Φ', name: 'Capital phi', aliases: 'normal CDF' },
    { glyph: 'α', name: 'Alpha', aliases: 'significance' },
    { glyph: 'λ', name: 'Lambda', aliases: 'rate' },
    ...probability,
  ],
  'information-security': [
    { glyph: '≡', name: 'Congruent', aliases: 'congruence mod equivalent' },
    { glyph: '⊕', name: 'Exclusive or', aliases: 'xor bitwise' },
    { glyph: 'φ', name: 'Phi', aliases: 'totient RSA' },
    { glyph: '∥', name: 'Parallel bars', aliases: 'concatenate concatenation' },
    { glyph: '∧', name: 'Logical and', aliases: 'and wedge' },
    { glyph: '∨', name: 'Logical or', aliases: 'or vee' },
    { glyph: '¬', name: 'Logical not', aliases: 'not negation' },
  ],
};

export function matchingSymbols(moduleId: string, numeric: boolean, query: string) {
  const available = numeric ? arithmeticSymbols : [
    ...(Object.hasOwn(moduleSymbols, moduleId) ? moduleSymbols[moduleId] : []),
    ...common, ...arithmeticSymbols,
  ];
  const search = query.toLowerCase().replace(/-/g, ' ');
  const matches = available.filter(symbol =>
    symbol.name.toLowerCase().includes(search) || symbol.glyph.toLowerCase().includes(search) ||
    symbol.aliases?.toLowerCase().includes(search));
  const exactMatch = matches.findIndex(symbol =>
    symbol.glyph.toLowerCase() === search || symbol.name.toLowerCase() === search);
  if (exactMatch > 0) matches.unshift(...matches.splice(exactMatch, 1));
  return matches;
}

export function symbolTrigger(value: string, start: number, end: number) {
  if (start !== end) return null;
  const match = /#([a-z0-9-]*)$/i.exec(value.slice(0, start));
  return match ? { start: match.index, end, query: match[1] } : null;
}
