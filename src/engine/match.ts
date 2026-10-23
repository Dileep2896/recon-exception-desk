import type {
  ReconInput,
  BankLine,
  LedgerEntry,
  Match,
  Packet,
  Basis,
  Candidate,
  Reason,
} from "./types.js";
import { isTransposition } from "./money.js";
import { evidence, makePacket, total } from "./packets.js";
const days = (a: string, b: string) =>
  (Date.parse(a) - Date.parse(b)) / 86400000;
const shared = (b: BankLine, l: LedgerEntry) =>
  Boolean(b.reference && b.reference === l.reference);
const related = (b: BankLine, l: LedgerEntry) =>
  shared(b, l) || Boolean(b.counterparty && b.counterparty === l.counterparty);
const basisWords: Record<Basis, string> = {
  exact_ref: "Exact amount and shared reference within the period.",
  exact_date: "Exact amount and date; unique on both sides.",
  timing: "Exact amount within the clearing window; unique on both sides.",
  payout_batch:
    "Payout receipts less processor fee equal the statement deposit.",
  split:
    "Two or three statement debits sum to one ledger payment with a shared reference.",
};
export function match(input: ReconInput): {
  matches: Match[];
  packets: Packet[];
} {
  let banks = [...input.bankLines],
    ledgers = [...input.ledgerEntries];
  const matches: Match[] = [],
    packets: Packet[] = [];
  const consume = (bs: BankLine[], ls: LedgerEntry[]) => {
    banks = banks.filter((x) => !bs.includes(x));
    ledgers = ledgers.filter((x) => !ls.includes(x));
  };
  const packet = (
    reason: Reason,
    bs: BankLine[],
    ls: LedgerEntry[],
    cs: Candidate[] = [],
    text?: string,
  ) => {
    packets.push(makePacket(input, reason, bs, ls, cs, text));
    consume(bs, ls);
  };
  const clear = (basis: Basis, bs: BankLine[], ls: LedgerEntry[]) => {
    const text = basisWords[basis];
    if (
      ls.some(
        (x) =>
          Math.abs(x.amountCents) >= input.rules.supportThresholdCents &&
          !x.documentIds.some((id) => input.documents.some((d) => d.id === id)),
      )
    )
      packet(
        "MISSING_SUPPORT",
        bs,
        ls,
        [
          {
            bankIds: bs.map((x) => x.id),
            ledgerIds: ls.map((x) => x.id),
            basis,
            basisText: text,
            score: 1,
          },
        ],
        text,
      );
    else {
      matches.push({
        id: `match-${bs[0].id}`,
        basis,
        basisText: text,
        bankLines: bs,
        ledgerEntries: ls,
        evidenceRefs: evidence(bs, ls),
      });
      consume(bs, ls);
    }
  };
  // Reserve duplicate evidence before any pass can consume one of the postings.
  for (const b of [...banks]) {
    const ls = ledgers.filter(
      (l) => !l.payoutId && b.amountCents === l.amountCents && related(b, l),
    );
    if (
      ls.length === 2 &&
      ls[0].counterparty === ls[1].counterparty &&
      Math.abs(days(ls[0].date, ls[1].date)) <= 3 &&
      ((ls[0].reference && ls[0].reference === ls[1].reference) ||
        ls[0].date === ls[1].date) &&
      banks.filter((x) => x.amountCents === b.amountCents && related(x, ls[0]))
        .length === 1
    )
      packet("DUPLICATE_LEDGER", [b], ls);
  }
  function pass(
    basis: Basis,
    predicate: (b: BankLine, l: LedgerEntry) => boolean,
  ) {
    const edges = banks.flatMap((b) =>
      ledgers
        .filter((l) => !b.payoutId && !l.payoutId && predicate(b, l))
        .map((l) => ({ b, l })),
    );
    const seen = new Set<string>();
    for (const edge of edges) {
      if (seen.has(edge.b.id)) continue;
      const bs = new Set<BankLine>([edge.b]),
        ls = new Set<LedgerEntry>();
      let changed = true;
      while (changed) {
        changed = false;
        for (const e of edges)
          if (bs.has(e.b) || ls.has(e.l)) {
            if (!bs.has(e.b) || !ls.has(e.l)) changed = true;
            bs.add(e.b);
            ls.add(e.l);
          }
      }
      bs.forEach((b) => seen.add(b.id));
      if (bs.size === 1 && ls.size === 1) clear(basis, [...bs], [...ls]);
      else {
        const ambiguousText =
          basis === "exact_ref"
            ? "Exact amount and reference, but multiple candidate allocations."
            : basis === "exact_date"
              ? "Exact amount and date, but multiple candidate allocations."
              : "Exact amount within the clearing window, but multiple candidate allocations.";
        packet(
          "AMBIGUOUS_MATCH",
          [...bs],
          [...ls],
          edges
            .filter((e) => bs.has(e.b))
            .map((e) => ({
              bankIds: [e.b.id],
              ledgerIds: [e.l.id],
              basis,
              basisText: ambiguousText,
              score: 1,
            })),
          ambiguousText,
        );
      }
    }
  }
  pass("exact_ref", (b, l) => b.amountCents === l.amountCents && shared(b, l));
  pass(
    "exact_date",
    (b, l) => b.amountCents === l.amountCents && b.date === l.date,
  );
  pass(
    "timing",
    (b, l) =>
      b.amountCents === l.amountCents &&
      days(b.date, l.date) >= 0 &&
      days(b.date, l.date) <= input.rules.timingWindowDays,
  );
  for (const b of [...banks])
    if (b.payoutId && b.amountCents > 0) {
      if (banks.filter((x) => x.payoutId === b.payoutId).length !== 1) continue;
      const ls = ledgers.filter((l) => l.payoutId === b.payoutId),
        receipts = ls.filter((l) => l.kind === "receipt"),
        fees = ls.filter((l) => l.kind === "fee");
      const fee = b.processorFeeCents;
      if (
        receipts.length >= 2 &&
        fee !== undefined &&
        total(receipts) - fee === b.amountCents
      ) {
        if (total(fees) === -fee && ls.length === receipts.length + fees.length)
          clear("payout_batch", [b], ls);
        else if (fees.length === 0)
          packet(
            "FEE_NOT_BOOKED",
            [b],
            receipts,
            [
              {
                bankIds: [b.id],
                ledgerIds: receipts.map((x) => x.id),
                basis: "payout_batch",
                basisText: basisWords.payout_batch,
                score: 1,
              },
            ],
            basisWords.payout_batch,
          );
      }
    }
  for (const l of [...ledgers])
    if (l.reference && l.amountCents < 0) {
      const bs = banks.filter((b) => b.amountCents < 0 && shared(b, l));
      if (
        bs.length >= 2 &&
        bs.length <= 3 &&
        total(bs) === l.amountCents &&
        ledgers.filter((x) => x.reference === l.reference).length === 1
      )
        clear("split", bs, [l]);
    }
  const nearEdges = banks.flatMap((b) =>
    ledgers
      .filter(
        (l) =>
          related(b, l) &&
          b.amountCents !== l.amountCents &&
          Math.sign(b.amountCents) === Math.sign(l.amountCents) &&
          (isTransposition(b.amountCents, l.amountCents) ||
            Math.abs(b.amountCents - l.amountCents) * 100 <=
              Math.abs(l.amountCents) * input.rules.amountTolerancePct),
      )
      .map((l) => ({ b, l })),
  );
  const visited = new Set<string>();
  for (const edge of nearEdges) {
    if (visited.has(edge.b.id)) continue;
    const bs = new Set<BankLine>([edge.b]),
      ls = new Set<LedgerEntry>();
    let changed = true;
    while (changed) {
      changed = false;
      for (const e of nearEdges)
        if (bs.has(e.b) || ls.has(e.l)) {
          if (!bs.has(e.b) || !ls.has(e.l)) changed = true;
          bs.add(e.b);
          ls.add(e.l);
        }
    }
    bs.forEach((b) => visited.add(b.id));
    const candidates = nearEdges
      .filter((e) => bs.has(e.b))
      .map((e) => ({
        bankIds: [e.b.id],
        ledgerIds: [e.l.id],
        basis: "related_amount",
        basisText: "Shared counterparty or reference; amounts differ.",
        score: 0.85,
      }));
    if (bs.size === 1 && ls.size === 1)
      packet(
        isTransposition(edge.b.amountCents, edge.l.amountCents)
          ? "TRANSPOSITION"
          : "AMOUNT_DIFFERENCE",
        [...bs],
        [...ls],
        candidates,
      );
    else
      packet(
        "AMBIGUOUS_MATCH",
        [...bs],
        [...ls],
        candidates,
        "Multiple related amounts require a reviewer to select the relationship.",
      );
  }
  for (const b of [...banks])
    packet(
      /SERVICE FEE|WIRE FEE|INTEREST|RETURNED ITEM/i.test(b.description)
        ? "UNRECORDED_BANK_ITEM"
        : "UNRECOGNIZED_BANK_ITEM",
      [b],
      [],
    );
  for (const l of [...ledgers])
    packet(
      days(input.periodEnd, l.date) >= 0 &&
        days(input.periodEnd, l.date) < input.rules.inTransitDays
        ? l.amountCents < 0
          ? "OUTSTANDING_CHECK"
          : "DEPOSIT_IN_TRANSIT"
        : "UNMATCHED_LEDGER",
      [],
      [l],
    );
  return { matches, packets };
}
