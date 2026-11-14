export interface Protocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: Protocol[];
  watchlist: string[];
}

export const MODEL = {
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  multiple_cap: 2.0,
};

export const MODEL_VERSION = 'radar-2';
const DAY_MS = 86400000;

function medianOf(values: number[]): number {
  const ordered = values.slice().sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  if (ordered.length % 2 === 1) return ordered[middle];
  return (ordered[middle - 1] + ordered[middle]) / 2;
}

function hasMarketRecord(protocol: Protocol): boolean {
  return protocol.mcap_usd !== null && protocol.tvl_usd > 0;
}

export function parseSnapshot(sourceText: string): Snapshot {
  const candidate = JSON.parse(sourceText);
  const valid = candidate &&
    Array.isArray(candidate.protocols) &&
    Array.isArray(candidate.watchlist) &&
    typeof candidate.as_of === 'string';
  if (!valid) throw Error('invalid snapshot');
  return candidate as Snapshot;
}

export function isPreToken(protocol: Protocol): boolean {
  return protocol.mcap_usd === null &&
    protocol.gecko_id === null &&
    protocol.symbol === null;
}

export function categoryMultiple(protocol: Protocol, protocols: Protocol[]): number {
  const allRatios = protocols
    .filter(hasMarketRecord)
    .map((item) => item.mcap_usd! / item.tvl_usd);
  const categoryRatios = protocols
    .filter((item) => hasMarketRecord(item) && item.category === protocol.category)
    .map((item) => item.mcap_usd! / item.tvl_usd);
  const ratios = categoryRatios.length >= 3 ? categoryRatios : allRatios;
  return Math.min(MODEL.multiple_cap, medianOf(ratios));
}

function elapsedAge(protocol: Protocol, asOf: string): number | null {
  if (!protocol.listed_at) return null;
  const end = Date.parse(asOf + 'T00:00:00Z');
  const start = Date.parse(protocol.listed_at + 'T00:00:00Z');
  if (!Number.isFinite(end) || !Number.isFinite(start)) return null;
  return Math.max(0, Math.floor((end - start) / DAY_MS));
}

function growthFactor(protocol: Protocol): number {
  const weeklyChange = Math.max(
    MODEL.growth_floor,
    Math.min(MODEL.growth_cap, protocol.change_7d ?? 0),
  );
  return 1 + weeklyChange / 100 * MODEL.growth_weight;
}

function maturityFactor(age: number | null): number {
  const days = age ?? MODEL.unknown_age_days;
  const elapsed = Math.min(days, MODEL.maturity_days);
  return MODEL.maturity_floor + elapsed / MODEL.maturity_days * MODEL.maturity_range;
}

function chainFactor(protocol: Protocol): number {
  const additionalChains = Math.max(protocol.chains.length - 1, 0);
  return 1 + 0.02 * Math.min(additionalChains, 4);
}

export function impliedValue(protocol: Protocol, snapshot: Snapshot) {
  const age = elapsedAge(protocol, snapshot.as_of);
  const multiple = categoryMultiple(protocol, snapshot.protocols);
  const growth = growthFactor(protocol);
  const maturity = maturityFactor(age);
  const chains = chainFactor(protocol);
  const rawValue = protocol.tvl_usd * multiple * growth * maturity * chains;
  return {
    value: Math.max(1, Math.round(rawValue)),
    age,
    multiple,
    growth,
    maturity,
    chains,
  };
}

const excludedCategories = new Set([
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'CEX',
]);
const releaseSuffix = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const exchangePrefix = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)/i;

function qualifiesAsEarly(protocol: Protocol): boolean {
  const categoryAllowed = !excludedCategories.has(protocol.category || '');
  const nameHasVersion = releaseSuffix.test(protocol.name);
  const nameHasWrappedProduct = /\b(wrapped|staked|staking)\b/i.test(protocol.name);
  const nameIsExchange = exchangePrefix.test(protocol.name);
  return categoryAllowed && !nameHasVersion && !nameHasWrappedProduct && !nameIsExchange;
}

function capitalTier(protocol: Protocol): number {
  if (protocol.tvl_usd >= 5e9) return 250;
  if (protocol.tvl_usd >= 1e9) return 150;
  if (protocol.tvl_usd >= 1e8) return 100;
  return 50;
}

function suggestedHold(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

function categoryAction(protocol: Protocol, amount: number, chain: string): string {
  const group = (protocol.category || '').toLowerCase();
  const label = protocol.name;
  if (group.includes('lend') || group.includes('cdp')) {
    return `Supply $${amount} of USDC to ${label} on ${chain} and keep the position open.`;
  }
  if (group.includes('dex') || group.includes('yield') || group.includes('leveraged')) {
    return `Provide $${amount} of liquidity to ${label}'s main pool on ${chain} and keep the position open.`;
  }
  if (group.includes('bridge')) {
    return `Bridge $${amount} of USDC through ${label} to ${chain}, then use the funds in its app.`;
  }
  if (group.includes('staking') || group.includes('restak')) {
    return `Stake $${amount} of ${chain}'s staking asset through ${label} and keep the receipt.`;
  }
  if (group.includes('perpetual') || group.includes('derivative')) {
    return `Deposit $${amount} USDC margin on ${label} on ${chain} and open one small hedge.`;
  }
  if (group.includes('prediction')) {
    return `Fund $${amount} on ${label} on ${chain} and place one small market position.`;
  }
  if (group.includes('curator') || group.includes('allocator')) {
    return `Deposit $${amount} into a ${label} vault on ${chain} and keep the shares.`;
  }
  if (group.includes('stable')) {
    return `Mint or deposit $${amount} of its stable asset through ${label} on ${chain}.`;
  }
  if (group.includes('rwa')) {
    return `Mint $${amount} of ${label}'s yield asset on ${chain} and hold it.`;
  }
  if (group.includes('insurance')) {
    return `Buy $${amount} of cover from ${label} on ${chain} and keep the policy.`;
  }
  return `Deposit $${amount} of USDC into ${label} on ${chain} and keep the position open.`;
}

export function farmSteps(protocol: Protocol, age: number | null): string[] {
  const chain = protocol.chains[0] || 'its main chain';
  const amount = capitalTier(protocol);
  const days = suggestedHold(age);
  const weeklyAction = categoryAction(protocol, amount, chain);
  return [
    `Set up a fresh wallet for ${protocol.name}; write its seed phrase offline and keep it separate. Cost: under $3 gas. Time: 5 minutes.`,
    `${weeklyAction} Cost: $${amount} capital plus about $${amount >= 150 ? 8 : 4} gas. Time: 15 minutes.`,
    `Make one qualifying action on ${protocol.name} each week, such as a deposit, swap, vote or borrow. Cost: about $2 gas weekly. Time: 10 minutes a week.`,
    `Keep the position on ${chain} for ${days} days so activity spans multiple snapshots. Cost: $${amount} remains committed. Time: ${days} days.`,
    `Check ${protocol.name}'s own points or rewards page; claim only through links it publishes and never pay to claim. Cost: no fee to check. Time: 10 minutes.`,
    `Record wallet, dates, actions and transaction references in a farm log before you unwind. Cost: no cash cost. Time: 5 minutes.`,
  ];
}

export interface BoardRow extends Protocol {
  rank: number;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    category_multiple: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    chain_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

function collectBoardProtocols(snapshot: Snapshot): Protocol[] {
  const bySlug = new Map(snapshot.protocols.map((protocol) => [protocol.slug, protocol]));
  const selected = new Map<string, Protocol>();
  for (const slug of snapshot.watchlist) {
    const protocol = bySlug.get(slug);
    if (protocol) selected.set(slug, protocol);
  }
  for (const protocol of snapshot.protocols) {
    const isNewPick = !selected.has(protocol.slug);
    const isEarlyCandidate = isPreToken(protocol) &&
      protocol.tvl_usd < snapshot.floor_usd &&
      qualifiesAsEarly(protocol);
    if (isNewPick && isEarlyCandidate) selected.set(protocol.slug, protocol);
  }
  return [...selected.values()];
}

export function buildBoard(snapshot: Snapshot): BoardRow[] {
  const ranked = collectBoardProtocols(snapshot)
    .map((protocol) => ({ protocol, score: impliedValue(protocol, snapshot) }))
    .sort((left, right) =>
      right.score.value - left.score.value ||
      left.protocol.slug.localeCompare(right.protocol.slug),
    );
  return ranked.map(({ protocol, score }, index) => ({
    rank: index + 1,
    ...protocol,
    token_status: 'pre-token',
    age_days: score.age,
    implied_value_usd: score.value,
    model: {
      category_multiple: score.multiple,
      growth_multiplier: score.growth,
      maturity_multiplier: score.maturity,
      chain_multiplier: score.chains,
      age_days: score.age,
    },
    farm_steps: farmSteps(protocol, score.age),
  }));
}

export function liveRows(snapshot: Snapshot): Protocol[] {
  return snapshot.protocols
    .filter((protocol) => !isPreToken(protocol) && protocol.category !== 'CEX')
    .sort((left, right) =>
      (right.mcap_usd ?? 0) - (left.mcap_usd ?? 0) ||
      right.tvl_usd - left.tvl_usd ||
      left.slug.localeCompare(right.slug),
    )
    .slice(0, 24);
}

export function boardIssue(rows: BoardRow[], snapshot: Snapshot): string | null {
  if (rows.length < 100 || rows.length > 4000) return `row count ${rows.length}`;
  const included = new Set(rows.map((row) => row.slug));
  const absentWatchlist = snapshot.watchlist.filter((slug) => !included.has(slug));
  if (absentWatchlist.length) return `missing watchlist: ${absentWatchlist.slice(0, 4).join(', ')}`;
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    if (row.rank !== index + 1) return `rank mismatch at ${index}`;
    if (index && rows[index - 1].implied_value_usd < row.implied_value_usd) return 'values rise with rank';
    if (!Number.isSafeInteger(row.implied_value_usd) || row.implied_value_usd < 1) return `bad value ${row.slug}`;
    if (!snapshot.protocols.some((protocol) => protocol.slug === row.slug)) return `unknown slug ${row.slug}`;
    const invalidSteps = row.farm_steps.length !== 6 ||
      row.farm_steps.some((step) => step.trim().length < 20 || step.trim().length > 600);
    if (invalidSteps) return `bad farm steps ${row.slug}`;
  }
  const allEqual = rows.length > 1 && rows.every((row) => row.implied_value_usd === rows[0].implied_value_usd);
  if (allEqual) return 'all values equal';
  return null;
}

export function buildRadar(snapshot: Snapshot) {
  const board = buildBoard(snapshot);
  const watchlist = new Set(snapshot.watchlist);
  const rows = board.map((row) => ({
    ...row,
    on_watchlist: watchlist.has(row.slug),
    model: { ...row.model },
  }));
  return {
    board,
    radar: {
      as_of: snapshot.as_of,
      source: snapshot.source,
      floor_usd: snapshot.floor_usd,
      model: MODEL,
      model_version: MODEL_VERSION,
      watchlist_size: snapshot.watchlist.length,
      board_size: board.length,
      early_size: board.filter((row) => !watchlist.has(row.slug)).length,
      live: liveRows(snapshot),
      rows,
    },
  };
}

export function dataScript(data: unknown): string {
  return `window.RADAR=${JSON.stringify(data)};\n`;
}
