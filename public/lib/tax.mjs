export const TAX_YEAR = 2025;
export const MAX_AMOUNT = 1_000_000_000_000;
export const VAT_RATE = 10;
export const TAX_SCOPES = Object.freeze({
  income:{name:'종합소득세',year:TAX_YEAR,period:'2025년 귀속'},
  corporate:{name:'법인세',year:2026,period:'2026년 개시 · 1년 사업연도'},
  vat:{name:'부가가치세',year:2026,period:'2026년 · 일반과세자'}
});
// 국세청: 2023~2025년 귀속. 모든 계산은 정수 원, 세율은 정수 %.
export const BRACKETS = Object.freeze([
  { limit:14_000_000, rate:6, deduction:0 },
  { limit:50_000_000, rate:15, deduction:1_260_000 },
  { limit:88_000_000, rate:24, deduction:5_760_000 },
  { limit:150_000_000, rate:35, deduction:15_440_000 },
  { limit:300_000_000, rate:38, deduction:19_940_000 },
  { limit:500_000_000, rate:40, deduction:25_940_000 },
  { limit:1_000_000_000, rate:42, deduction:35_940_000 },
  { limit:Infinity, rate:45, deduction:65_940_000 }
]);
export function parseAmount(value, label='금액') {
  if (typeof value !== 'number' && typeof value !== 'string') throw new Error(`${label}을 원 단위 정수로 입력해 주세요.`);
  const raw = String(value).trim();
  if (!/^\d+$/.test(raw)) throw new Error(`${label}을 0 이상의 원 단위 정수로 입력해 주세요. 쉼표는 빼 주세요.`);
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n > MAX_AMOUNT) throw new Error(`${label}은 1조원 이하로 입력해 주세요.`);
  return n;
}
export const CORPORATE_BRACKETS = Object.freeze([
  { limit:200_000_000, rate:10, deduction:0 },
  { limit:20_000_000_000, rate:20, deduction:20_000_000 },
  { limit:300_000_000_000, rate:22, deduction:420_000_000 },
  { limit:Infinity, rate:25, deduction:9_420_000_000 }
]);
function progressiveTax(base, brackets) {
  const bracket = brackets.find(b => base <= b.limit);
  return {base, rate:base === 0 ? 0 : bracket.rate, deduction:bracket.deduction,
    tax:Math.max(0, Math.floor(base * bracket.rate / 100) - bracket.deduction)};
}
export function taxFromBase(value) {
  return progressiveTax(parseAmount(value, '과세표준'), BRACKETS);
}
export function calculateScenario(input) {
  if (input.year !== TAX_YEAR) throw new Error('2025년 귀속만 지원해요. 다른 연도에는 적용하지 마세요.');
  const revenue = parseAmount(input.revenue, '총수입');
  const expenses = parseAmount(input.expenses, '필요경비');
  const deductions = parseAmount(input.deductions, '소득공제');
  if (expenses > revenue) throw new Error('필요경비가 수입보다 커요. 이 버전은 결손금 계산을 지원하지 않아요.');
  const income = revenue - expenses;
  return {year:TAX_YEAR,revenue,expenses,deductions,income,...taxFromBase(Math.max(0,income-deductions))};
}
export function compareScenarios(a,b) {
  const baseline=calculateScenario(a), alternative=calculateScenario(b);
  return {baseline,alternative,difference:alternative.tax-baseline.tax};
}
export function calculateCorporate({year,base}) {
  if (year !== TAX_SCOPES.corporate.year) throw new Error('2026년 개시 사업연도만 계산할 수 있어요.');
  return {year,...progressiveTax(parseAmount(base, '과세표준'), CORPORATE_BRACKETS)};
}
export function calculateVat({year,sales,inputTax}) {
  if (year !== TAX_SCOPES.vat.year) throw new Error('2026년 과세기간만 계산할 수 있어요.');
  const supply = parseAmount(sales, '매출 공급가액');
  const credit = parseAmount(inputTax, '공제 가능 매입세액');
  const outputTax = Math.floor(supply * VAT_RATE / 100);
  return {year,sales:supply,inputTax:credit,rate:VAT_RATE,outputTax,tax:outputTax-credit};
}
export function compareTax(tax,a,b) {
  if (tax === 'income') return compareScenarios(a,b);
  if (tax !== 'corporate' && tax !== 'vat') throw new Error('세목을 선택해 주세요.');
  const calculate = tax === 'corporate' ? calculateCorporate : calculateVat;
  const baseline=calculate(a), alternative=calculate(b);
  return {baseline,alternative,difference:alternative.tax-baseline.tax};
}
