// node quote-to-wave.tests.mjs
// Runs the CORE block extracted from the shipped index.html. Expected figures were worked out by hand first.
// Ends with one of: PASSED, FAILED, DID NOT COMPLETE. A crash is never counted as a pass.
import { readFileSync } from "node:fs";
process.on("uncaughtException", e => { console.log("\nDID NOT COMPLETE: the tests crashed. " + (e && e.stack || e)); process.exit(2); });
const file = process.env.QTW_HTML || new URL("./index.html", import.meta.url);
const core = readFileSync(file, "utf8").split("/* CORE-START")[1].split("/* CORE-END */")[0].replace(/^[^\n]*\n/, "");
const Q = new Function(core + "\nreturn QTW;")();
let pass = 0, fail = 0;
const check = (name, cond, detail) => { if (cond) pass++; else { fail++; console.log("FAIL " + name + (detail !== undefined ? "  :: " + JSON.stringify(detail).slice(0, 400) : "")); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const TODAY = "2026-11-12", NOW = "2026-11-12T15:00:00.000Z"; // a Thursday
const L = (desc, qty, price) => ({ desc, unit: "each", qty: String(qty), price: String(price) });
const fig = q => { const c = Q.compute(q); return [c.subtotal, c.discount, c.hst, c.total, c.deposit, c.balance]; };
// A draft with made-up details, added to a state.
function draft(state, patch, clientPatch) {
  const r = Q.newQuote(state, TODAY), q = r.state.quotes.find(x => x.id === r.id);
  Object.assign(q, { title: "Booking page for the studio", lines: [L("Website build", 1, "1850.00")] }, patch || {});
  Object.assign(q.client, { name: "Dana Okafor", business: "Okafor Studio", email: "dana@example.org", street: "10 Sample St", city: "Waterloo", postal: "N2L 0A1" }, clientPatch || {});
  return r;
}
const finished = (state, patch, clientPatch) => { const d = draft(state, patch, clientPatch); const f = Q.finishQuote(d.state, d.id, TODAY); return { state: f.state, id: d.id, number: f.number, res: f }; };
const get = (state, id) => state.quotes.find(q => q.id === id);
const S1 = [L("Website build", 1, "1850.00"), L("Extra page", 3, "145.50"), L("Support", "1.75", "85.25")];
const S2 = [L("Automation build", 1, "2400.00"), L("Hosting setup", 1, "240.00"), L("Training", "1.5", "95.00")];
const S3 = [L("Feature add", 1, "1000.00"), L("Design revisions", 3, "133.33"), L("Data migration", "2.25", "90.00")];

// --- the three hand-worked samples
check("sample 1, HST off: lines $1,850.00, $436.50, $149.19; total $2,435.69, no HST", same(Q.compute({ lines: S1 }).lines.map(l => l.total), [185000, 43650, 14919]) && same(fig({ lines: S1, hstOn: false }), [243569, 0, 0, 243569, 0, 243569]), fig({ lines: S1 }));
check("sample 2, HST on: subtotal $2,782.50, HST $361.73, total $3,144.23", same(fig({ lines: S2, hstOn: true }), [278250, 0, 36173, 314423, 0, 314423]), fig({ lines: S2, hstOn: true }));
check("sample 3, HST on, 5% off, 30% deposit: $1,602.49, discount $80.12, HST $197.91, total $1,720.28, deposit $516.08, balance $1,204.20", same(fig({ lines: S3, hstOn: true, discountPct: "5", depositPct: "30" }), [160249, 8012, 19791, 172028, 51608, 120420]), fig({ lines: S3, hstOn: true, discountPct: "5", depositPct: "30" }));
check("sample 3 with HST off: total $1,522.37, deposit $456.71, balance $1,065.66", same(fig({ lines: S3, hstOn: false, discountPct: "5", depositPct: "30" }), [160249, 8012, 0, 152237, 45671, 106566]));
// --- arithmetic rules
check("a half cent rounds up: 13% of $2,782.50 is $361.73", Q.mulDiv(278250, 13, 100) === 36173);
const heater = [L("a", 1, "1289.00"), L("b", 1, "86.75"), L("c", 3, "4.35"), L("d", 4, "95"), L("e", 4, "55"), L("f", 1, "60"), L("g", 1, "45")];
const perLine = Q.compute({ lines: heater }).lines.reduce((t, l) => t + Q.mulDiv(l.total, 13, 100), 0);
check("HST is worked out once on the subtotal: $272.19, not the $272.20 line-by-line rounding gives", perLine === 27220 && Q.compute({ lines: heater, hstOn: true }).hst === 27219, perLine);
check("HST off charges nothing, whatever the lines", Q.compute({ lines: heater, hstOn: false }).hst === 0 && Q.compute({ lines: heater }).total === 209380);
check("money and quantities as people type them", Q.toCents("1,289.00") === 128900 && Q.toCents("$45") === 4500 && Q.toCents("12.3") === 1230 && Q.toCents("abc") === null && Q.toCents("-5") === null && Q.toCents("1.234") === null
  && Q.toMilli("1.5") === 1500 && Q.toMilli("1,5") === 1500 && Q.toMilli("0.25") === 250 && Q.toMilli("-1") === null && Q.toPct("7.5") === 750 && Q.toPct("") === 0 && Q.toPct("x") === null);
check("money is written with a dollar sign, commas and two decimals", Q.money(172028) === "$1,720.28" && Q.money(5) === "$0.05" && Q.plain(-8012) === "-80.12");
// --- dates
check("valid until is the quote date plus the days", Q.compute({ lines: S1, date: TODAY, validDays: "30" }).validUntil === "2026-12-12");
check("10 business days after Thursday December 10 is Thursday December 24", Q.addBusinessDays("2026-12-10", 10) === "2026-12-24");
check("10 business days after Friday November 13 is Friday November 27", Q.addBusinessDays("2026-11-13", 10) === "2026-11-27");
check("1 business day after a Saturday is the Monday", Q.addBusinessDays("2026-11-14", 1) === "2026-11-16" && Q.addBusinessDays("2026-11-12", 0) === "2026-11-12");
check("made-up dates are refused", Q.isDate("2026-02-28") && !Q.isDate("2026-02-30") && !Q.isDate("2026-13-01") && !Q.isDate("12/11/2026") && !Q.isDate(""));

// --- quote numbers
let st = Q.blankState();
const a = finished(st); st = a.state;
check("the first finished quote is Q-2026-001 and becomes sent", a.number === "Q-2026-001" && get(st, a.id).status === "sent");
const dr = draft(st); st = dr.state;
check("a draft has no number", get(st, dr.id).number === "" && get(st, dr.id).status === "draft");
st = Q.deleteDraft(st, dr.id).state;
const b = finished(st); st = b.state;
check("deleting a draft uses no number: the next finished quote is Q-2026-002", b.number === "Q-2026-002");
st = JSON.parse(JSON.stringify(st)); // what a reload does: saved as text, read back
const c3 = finished(st); st = c3.state;
check("numbering carries on after the saved data is reloaded: Q-2026-003", c3.number === "Q-2026-003");
check("a finished quote can't be finished again or change its number", Q.finishQuote(st, a.id, TODAY).ok === false && get(st, a.id).number === "Q-2026-001");
check("a numbered quote can't be deleted", Q.deleteDraft(st, a.id).ok === false && Q.deleteDraft(st, a.id).error.includes("declined"));
const bad = draft(st, { title: "" }); const badRes = Q.finishQuote(bad.state, bad.id, TODAY);
check("a draft with a problem is not finished and uses no number", badRes.ok === false && "title" in badRes.errors && finished(bad.state).number === "Q-2026-004");
const ny = finished(st, { date: "2027-01-04" });
check("the count starts again each year: a quote dated 2027 is Q-2027-001, and 2026 carries on at 004", ny.number === "Q-2027-001" && finished(ny.state).number === "Q-2026-004");
let many = Q.blankState(); const seen = [];
for (let i = 0; i < 150; i++) { const f = finished(many); many = f.state; seen.push(f.number); if (i % 7 === 0) { const d = draft(many); many = Q.deleteDraft(d.state, d.id).state; } }
check("150 quotes in a row, with drafts deleted along the way: Q-2026-001 to Q-2026-150 in order, no repeats, no gaps", same(seen, Array.from({ length: 150 }, (_, i) => "Q-2026-" + String(i + 1).padStart(3, "0"))) && many.counters["2026"] === 150, seen.slice(-3));
let late = Q.blankState(); late.counters["2026"] = 998; const l1 = finished(late), l2 = finished(l1.state), l3 = finished(l2.state);
check("past 999 the number simply grows: Q-2026-999, Q-2026-1000, Q-2026-1001", same([l1.number, l2.number, l3.number], ["Q-2026-999", "Q-2026-1000", "Q-2026-1001"]));

// --- statuses
check("a sent quote reads as expired the day after its valid-until date, not on the day", Q.shownStatus(get(st, a.id), "2026-12-12") === "sent" && Q.shownStatus(get(st, a.id), "2026-12-13") === "expired");
const acc = Q.setStatus(st, a.id, "accepted", { today: TODAY, now: NOW, finishDate: "2026-12-10" });
check("accepting records the day, the finish date and a due date 10 business days after delivery", acc.ok && get(acc.state, a.id).status === "accepted" && get(acc.state, a.id).acceptedOn === TODAY && get(acc.state, a.id).dueDate === "2026-12-24" && acc.state.lastAcceptedAt === NOW);
check("accepting needs a finish date", "finishDate" in Q.setStatus(st, a.id, "accepted", { today: TODAY, now: NOW, finishDate: "" }).errors);
check("the finish date can't be in the past", "finishDate" in Q.setStatus(st, a.id, "accepted", { today: TODAY, now: NOW, finishDate: "2026-11-11" }).errors);
check("an expired quote can still be accepted", Q.setStatus(st, a.id, "accepted", { today: "2026-12-20", now: NOW, finishDate: "2027-01-15" }).ok);
check("a quote can be declined, and a decline or an acceptance can be undone", Q.setStatus(st, a.id, "declined", {}).ok && Q.setStatus(Q.setStatus(st, a.id, "declined", {}).state, a.id, "sent", {}).ok
  && (() => { const u = Q.setStatus(acc.state, a.id, "sent", {}); const q = get(u.state, a.id); return u.ok && q.acceptedOn === "" && q.dueDate === "" && q.number === "Q-2026-001"; })());
check("changes that make no sense are refused", !Q.setStatus(st, a.id, "draft", {}).ok && !Q.setStatus(acc.state, a.id, "declined", {}).ok && !Q.setStatus(st, 999, "accepted", { today: TODAY, finishDate: TODAY }).ok && !Q.setStatus(dr.state, dr.id, "accepted", { today: TODAY, finishDate: TODAY }).ok);
check("the due date can be changed, but not to before the acceptance", Q.setDueDate(acc.state, a.id, "2027-01-08").ok && get(Q.setDueDate(acc.state, a.id, "2027-01-08").state, a.id).dueDate === "2027-01-08" && !Q.setDueDate(acc.state, a.id, "2026-11-01").ok && !Q.setDueDate(st, a.id, "2027-01-08").ok);
const termsSt = JSON.parse(JSON.stringify(st)); termsSt.settings.termsDays = "5"; const t5 = finished(termsSt);
check("a new quote takes the payment terms setting: 5 business days after December 10 is December 17", get(Q.setStatus(t5.state, t5.id, "accepted", { today: TODAY, now: NOW, finishDate: "2026-12-10" }).state, t5.id).dueDate === "2026-12-17" && /within 5 business days/.test(Q.termsText(get(t5.state, t5.id), Q.compute(get(t5.state, t5.id)))));
check("changing the terms setting later never changes a finished quote's terms", get(Q.setStatus(t5.state, a.id, "accepted", { today: TODAY, now: NOW, finishDate: "2026-12-10" }).state, a.id).dueDate === "2026-12-24" && /within 10 business days/.test(Q.termsText(get(t5.state, a.id), Q.compute(get(t5.state, a.id)))));
const cp = Q.copyToDraft(acc.state, a.id, "2026-11-20"); const cq = get(cp.state, cp.id);
check("copying a finished quote makes a new draft with the same client and lines, no number, today's date, and leaves the original alone", cp.ok && cq.status === "draft" && cq.number === "" && cq.date === "2026-11-20" && cq.acceptedOn === "" && same(cq.lines, get(acc.state, a.id).lines) && same(cq.client, get(acc.state, a.id).client) && get(cp.state, a.id).status === "accepted" && Q.finishQuote(cp.state, cp.id, "2026-11-20").number === "Q-2026-004");

// --- validation, one rule at a time
const v = (patch, clientPatch, linePatch) => { const d = draft(Q.blankState(), patch, clientPatch); const q = get(d.state, d.id); if (linePatch) Object.assign(q.lines[0], linePatch); return Q.validate(q, TODAY); };
check("a complete draft has no problems", Object.keys(v()).length === 0, v());
check("no client name and no business", "name" in v({}, { name: " ", business: "" }));
check("a business with no person's name is fine, and so is the reverse", !("name" in v({}, { name: "" })) && !("name" in v({}, { business: "" })));
check("an email that isn't one", "email" in v({}, { email: "dana at example" }) && !("email" in v({}, { email: "" })));
check("no title", "title" in v({ title: "  " }));
check("no line items", "lines" in v({ lines: [] }));
check("a line with no description", "desc-0" in v({}, {}, { desc: "" }));
check("zero quantity", /more than 0/.test(v({}, {}, { qty: "0" })["qty-0"] || ""));
check("negative or non-number quantity", "qty-0" in v({}, {}, { qty: "-2" }) && "qty-0" in v({}, {}, { qty: "two" }));
check("a quantity too large", "qty-0" in v({}, {}, { qty: "10001" }));
check("a price that isn't a number, or is negative, or is too large", "price-0" in v({}, {}, { price: "lots" }) && "price-0" in v({}, {}, { price: "-5" }) && "price-0" in v({}, {}, { price: "1000000.01" }));
check("discount over 100% or not a number", "discount" in v({ discountPct: "101" }) && "discount" in v({ discountPct: "half" }) && !("discount" in v({ discountPct: "100" })));
check("deposit over 100% or not a number", "deposit" in v({ depositPct: "150" }) && "deposit" in v({ depositPct: "x" }));
check("a quote date that isn't a real date", "date" in v({ date: "2026-02-30" }));
check("valid days out of range", "validDays" in v({ validDays: "0" }) && "validDays" in v({ validDays: "400" }) && "validDays" in v({ validDays: "1.5" }));
check("a quote that would already have expired", /already have expired/.test(v({ date: "2026-01-01", validDays: "30" }).validDays || ""));
check("HST on with no registration number, or a malformed one", "hst" in v({ hstOn: true, hstNumber: "" }) && "hst" in v({ hstOn: true, hstNumber: "12345 RT0001" }) && !("hst" in v({ hstOn: true, hstNumber: "123456789 RT0001" })) && !("hst" in v({ hstOn: false, hstNumber: "" })));
const vs = patch => Q.validateSettings(Object.assign(Q.blankState().settings, patch));
check("default settings have no problems: HST off, 10 business days, quotes valid 30 days", Object.keys(vs({})).length === 0 && Q.blankState().settings.hstRegistered === false && Q.blankState().settings.termsDays === "10" && Q.blankState().settings.validDays === "30");
check("settings: payment terms, valid days, deposit and HST number are each checked", "termsDays" in vs({ termsDays: "-1" }) && "termsDays" in vs({ termsDays: "61" }) && "validDays" in vs({ validDays: "0" }) && "depositPct" in vs({ depositPct: "200" }) && "hstNumber" in vs({ hstRegistered: true, hstNumber: "" }) && !("hstNumber" in vs({ hstRegistered: true, hstNumber: "123456789RT0001" })) && "businessName" in vs({ business: { name: "" } }));
check("price list: a service needs a name and a price", "desc" in Q.validatePriceItem({ desc: "", price: "10" }) && "price" in Q.validatePriceItem({ desc: "x", price: "ten" }) && Object.keys(Q.validatePriceItem({ desc: "x", price: "1,000.00" })).length === 0);
check("no prices are written into the code", Q.blankState().settings.priceList.length === 0);

// --- HST switch
let hs = Q.blankState(); const before = finished(hs, { lines: S2 }); hs = before.state;
hs.settings.hstRegistered = true; hs.settings.hstNumber = "123456789 RT0001";
const after = finished(hs, { lines: S2 });
check("a new quote after registering charges 13% and carries the number", Q.compute(get(after.state, after.id)).hst === 36173 && get(after.state, after.id).hstNumber === "123456789 RT0001");
check("a quote finished before registering stays without HST", Q.compute(get(after.state, before.id)).hst === 0 && Q.compute(get(after.state, before.id)).total === 278250);
check("turning the switch on later never changes a finished quote, even if the page re-syncs it", (() => { const q = JSON.parse(JSON.stringify(get(after.state, before.id))); Q.syncDraft(q, after.state.settings); return q.hstOn === false && q.hstNumber === "" && Q.compute(q).hst === 0; })());
const dq = draft(hs); const nohst = JSON.parse(JSON.stringify(dq.state)); nohst.settings.hstRegistered = false;
check("a draft follows the switch until it is finished", Q.syncDraft(get(nohst, dq.id), nohst.settings).hstOn === false && get(nohst, dq.id).hstNumber === "");
const noNum = Q.blankState(); noNum.settings.hstRegistered = true;
check("HST on with no registration number blocks finishing", (() => { const d = draft(noNum); const f = Q.finishQuote(d.state, d.id, TODAY); return !f.ok && "hst" in f.errors; })());

// --- message
let ms = Q.blankState(); ms.settings.hstRegistered = true; ms.settings.hstNumber = "123456789 RT0001";
const m3 = finished(ms, { lines: S3, discountPct: "5", depositPct: "30" }); const q3 = get(m3.state, m3.id);
const msg = Q.message(q3, Q.compute(q3), m3.state.settings);
check("message with HST: first name, number, total, deposit, balance, terms, expiry, sign-off", msg.startsWith("Hi Dana, here's quote Q-2026-001 for Booking page for the studio.") && msg.includes("The total is $1,720.28, including 13% HST.") && msg.includes("A deposit of $516.08 (30%) is due when you accept, and the balance of $1,204.20 is due within 10 business days of delivery.") && msg.includes("valid until December 12, 2026") && msg.endsWith("Casim Bahadar, Phoenix Applications & Automations"), msg);
const m1 = finished(Q.blankState(), { lines: S1 }, { name: "" }); const q1 = get(m1.state, m1.id); const msg1 = Q.message(q1, Q.compute(q1), m1.state.settings);
check("message without HST never mentions HST, and copes with no first name or deposit", msg1.startsWith("Hi there, here's quote") && msg1.includes("The total is $2,435.69. Payment is due within 10 business days of delivery.") && !/HST/.test(msg1), msg1);
check("no em or en dashes in anything the tool writes", !/[\u2013\u2014]/.test(msg + msg1 + JSON.stringify(v({ title: "", lines: [] }, { name: "", business: "" })) + JSON.stringify(vs({ termsDays: "x", validDays: "x" }))));

// --- Ready for Wave
const w3s = Q.setStatus(m3.state, m3.id, "accepted", { today: TODAY, now: NOW, finishDate: "2026-12-10" }).state; const w = Q.waveSheet(get(w3s, m3.id)); const c3q = Q.compute(get(w3s, m3.id));
check("Wave: nothing is offered until the quote is accepted", Q.waveSheet(q3) === null && Q.waveCustomerCSV(q3) === null);
check("Wave: every line item with description, quantity and price, plus the discount as its own line", same(w.lines.map(l => [l.desc, l.qty, l.price]), [["Feature add", "1", "1000.00"], ["Design revisions", "3", "133.33"], ["Data migration", "2.25", "90.00"], ["Discount (5%)", "1", "-80.12"]]), w.lines);
check("Wave: the lines add up to the quote's subtotal after discount, and with HST to its total", w.lines.reduce((t, l) => t + l.amount, 0) === c3q.taxable && w.subtotal === 152237 && w.subtotal + w.hst === c3q.total && w.total === 172028 && w.hst === 19791);
check("Wave: deposit and balance match the quote and add up to the total", w.deposit === 51608 && w.balance === 120420 && w.deposit + w.balance === w.total);
check("Wave: invoice date is the day accepted, due date 10 business days after delivery, quote number carried", w.invoiceDate === TODAY && w.dueDate === "2026-12-24" && w.number === "Q-2026-001" && w.hstNumber === "123456789 RT0001");
check("Wave: the notes line states the deposit, the balance and the due date", w.notes === "Quote Q-2026-001. Deposit of $516.08 due on acceptance. Balance of $1,204.20 due December 24, 2026.", w.notes);
check("Wave: client split into company, first and last name, with address parts", same([w.customer.company, w.customer.firstName, w.customer.lastName, w.customer.email, w.customer.address1, w.customer.city, w.customer.postal, w.customer.country, w.customer.currency], ["Okafor Studio", "Dana", "Okafor", "dana@example.org", "10 Sample St", "Waterloo", "N2L 0A1", "Canada", "CAD"]), w.customer);
const csv = Q.waveCustomerCSV(get(w3s, m3.id)).split("\r\n");
check("Wave customer file: exactly the header of Wave's own sample file", csv[0] === "Company Name,First Name,Last Name,Email,Phone,Address 1,Address 2,City,Postal Code,Country,Currency", csv[0]);
check("Wave customer file: one row, 11 columns, in Wave's order", csv[1] === "Okafor Studio,Dana,Okafor,dana@example.org,,10 Sample St,,Waterloo,N2L 0A1,Canada,CAD" && csv.length === 3 && csv[2] === "", csv[1]);
const w1s = Q.setStatus(m1.state, m1.id, "accepted", { today: TODAY, now: NOW, finishDate: TODAY }).state; const w1 = Q.waveSheet(get(w1s, m1.id));
check("Wave without HST, discount or deposit: no HST, no discount line, total $2,435.69, payment due line", w1.hst === 0 && w1.hstOn === false && w1.lines.length === 3 && w1.total === 243569 && w1.balance === 243569 && w1.notes === "Quote Q-2026-001. Payment due November 26, 2026.", w1.notes);
const evil = JSON.parse(JSON.stringify(get(w3s, m3.id))); Object.assign(evil.client, { business: '=HYPERLINK("x")', name: "+cmd Smith", email: "@x@example.org", street: "-1 Main, Unit 2", city: "\tWaterloo", postal: "\rN2L" });
const ecsv = Q.waveCustomerCSV(evil);
check("Wave customer file: cells starting with = + - @ become text, commas and quotes are escaped, and stray tabs and returns are trimmed off", ecsv.includes(`"'=HYPERLINK(""x"")"`) && ecsv.includes(",'+cmd,") && ecsv.includes(",'@x@example.org,") && ecsv.includes(`"'-1 Main, Unit 2"`) && ecsv.includes(",Waterloo,N2L,"), ecsv);
check("any spreadsheet cell starting with a tab or a carriage return also becomes text, including one hiding a formula", Q.toCSV(["a"], [["\t=1+1"], ["\r@x"], ["ok"]]) === `a\r\n'\t=1+1\r\n"'\r@x"\r\nok\r\n`, Q.toCSV(["a"], [["\t=1+1"], ["\r@x"]]));
evil.client.city = "\t=1+1";
check("a formula hidden behind a tab in a client field is still made text after trimming", Q.waveCustomerCSV(evil).includes(",'=1+1,"));

// --- backup and restore
let bk = w3s; const f2 = finished(bk, { lines: S1 }, { name: "Lee Park", business: "", email: "lee@example.net" }); bk = f2.state;
bk.settings.priceList.push({ desc: "Made-up service", unit: "each", price: "123.45" }); const d2 = draft(bk); bk = d2.state;
const ex = Q.exportBackup(bk, "2026-11-12T16:00:00.000Z");
const re = Q.importBackup(ex.text, Q.blankState());
check("backup then restore on an empty device gives back exactly the same data", re.ok && same(re.state, ex.state) && re.quotes === 3, [re.state, ex.state]);
check("the backup file is named for the tool and the day, and backing up records when", ex.name === "quote-to-wave-backup-2026-11-12.json" && ex.state.lastBackupAt === "2026-11-12T16:00:00.000Z");
check("numbering carries on after a restore: the next quote is Q-2026-003", finished(re.state).number === "Q-2026-003");
check("a reminder to back up shows after an accepted quote and clears after a backup", Q.needsBackup(bk) === true && Q.needsBackup(ex.state) === false && Q.needsBackup(Q.blankState()) === false
  && Q.needsBackup(Q.setStatus(finished(ex.state).state, finished(ex.state).id, "accepted", { today: TODAY, now: "2026-11-12T17:00:00.000Z", finishDate: TODAY }).state) === true);
let newer = ex.state; for (let i = 0; i < 4; i++) newer = finished(newer).state;
const old = Q.importBackup(ex.text, newer);
check("restoring an older backup never reuses a number already given out on this device", old.ok && old.state.counters["2026"] === 6 && finished(old.state).number === "Q-2026-007", old.state.counters);
const noCount = JSON.parse(ex.text); delete noCount.state.counters;
check("a backup with its counters missing is rebuilt from the quote numbers in it", finished(Q.importBackup(JSON.stringify(noCount), Q.blankState()).state).number === "Q-2026-003");
check("files that aren't backups are refused with a plain message", !Q.importBackup("not json", bk).ok && !Q.importBackup("{}", bk).ok && !Q.importBackup('{"app":"other","version":1,"state":{}}', bk).ok && !Q.importBackup('{"app":"quote-to-wave","version":2,"state":{"quotes":[],"settings":{}}}', bk).ok && !Q.importBackup('{"app":"quote-to-wave","version":1,"state":{"quotes":"x","settings":{}}}', bk).ok && !Q.importBackup("null", bk).ok && /isn't a backup/.test(Q.importBackup("[]", bk).error));
const hostile = JSON.parse(ex.text); hostile.state.quotes[0].extra = "<script>"; hostile.state.quotes[0].client.name = { toString: "x" }; hostile.state.quotes[0].status = "paid"; hostile.state.quotes[0].number = "Q-2026-001<b>"; hostile.state.quotes[0].lines[0].desc = "x".repeat(5000); hostile.state.settings.rogue = 1; hostile.state.counters = { "__proto__x": 9, "2026": "99", "20x6": 5 }; hostile.state.quotes.push("junk", null);
const hr = Q.importBackup(JSON.stringify(hostile), Q.blankState());
check("a tampered backup is rebuilt field by field: unknown fields dropped, odd values blanked, long text cut, junk rows skipped", hr.ok && !("extra" in hr.state.quotes[0]) && hr.state.quotes[0].client.name === "" && hr.state.quotes[0].status === "draft" && hr.state.quotes[0].number === "" && hr.state.quotes[0].lines[0].desc.length === 300 && !("rogue" in hr.state.settings) && same(Object.keys(hr.state.counters), ["2026"]) && hr.state.counters["2026"] === 2 && hr.state.quotes.length === 3, hr.state.counters);

const odd = JSON.parse(ex.text); odd.state.quotes[0].status = "paid"; odd.state.quotes[1].status = "draft";
const or = Q.importBackup(JSON.stringify(odd), Q.blankState());
check("a restored quote with a number and an unknown or draft status comes back as sent, never as a deletable draft", or.ok && or.state.quotes[0].number === "Q-2026-001" && or.state.quotes[0].status === "sent" && or.state.quotes[1].status === "sent" && !Q.deleteDraft(or.state, or.state.quotes[0].id).ok, or.state.quotes.map(q => q.status));

const holed = Q.deleteDraft(ex.state, d2.id).state; // a deleted draft leaves the internal id counter ahead of the quotes
check("saved data with a deleted draft in its past still comes back exactly", same(Q.loadState(JSON.stringify(holed)).state, holed) && same(Q.importBackup(Q.exportBackup(holed, "2026-11-12T16:00:00.000Z").text, Q.blankState()).state, holed));
const ld = Q.loadState(JSON.stringify(ex.state));
check("saved data read at start comes back exactly, and keeps the last backup time", !ld.damaged && same(ld.state, ex.state));
check("first run starts empty, and unreadable saved data is reported as damaged, never silently treated as fine", same(Q.loadState(null), { state: Q.blankState(), damaged: false }) && Q.loadState("{broken").damaged && Q.loadState('{"app":"other"}').damaged && Q.loadState("null").damaged);
check("the client list has each client once with their quote count, newest details first", same(Q.clients(bk).map(c => [c.client.name, c.quotes]), [["Dana Okafor", 2], ["Lee Park", 1]]), Q.clients(bk));

// --- delete this client's data
let del = bk; const dana2 = finished(del, { lines: S2 }); del = dana2.state; // Dana: accepted quote 001, draft, sent quote 003. Lee: quote 002.
const key = Q.clientKey(get(del, m3.id));
const gone = Q.deleteClient(del, key);
const g = get(gone.state, m3.id);
check("deleting a client blanks their details on every numbered quote and removes their drafts", gone.quotes === 3 && same(g.client, { name: "", business: "", email: "", phone: "", street: "", city: "", province: "", postal: "", country: "" }) && g.title === "Client details deleted" && g.clientDeleted === true && !get(gone.state, d2.id) && !JSON.stringify(gone.state).includes("Dana") && !JSON.stringify(gone.state).includes("dana@example.org") && !JSON.stringify(gone.state).includes("Okafor") && same(Q.clients(gone.state).map(c => c.client.name), ["Lee Park"]) && !Q.copyToDraft(gone.state, m3.id, TODAY).ok);
check("the numbers, statuses and figures of those quotes stay, so the sequence has no holes", g.number === "Q-2026-001" && g.status === "accepted" && Q.compute(g).total === 172028 && get(gone.state, dana2.id).number === "Q-2026-003" && finished(gone.state).number === "Q-2026-004");
check("other clients are untouched", get(gone.state, f2.id).client.name === "Lee Park" && get(gone.state, f2.id).client.email === "lee@example.net");
check("clients match by email whatever the capitals, or by name and business when there is no email", Q.clientKey({ client: { email: " Dana@Example.org ", name: "x" } }) === key && Q.clientKey({ client: { email: "", name: "Lee Park", business: "" } }) === "n:lee park|" && Q.clientKey({ client: { email: "", name: "Lee Park", business: "Other" } }) !== "n:lee park|");

// --- storage and speed
check("the storage key carries the tool's name", Q.KEY === "quote-to-wave:v1:state" && Q.KEY.startsWith(Q.APP + ":"));
const big = { lines: Array.from({ length: 5000 }, (_, i) => L("Item " + i, 1 + (i % 7) * 0.5, "12.34")), hstOn: true, date: TODAY, validDays: "30", title: "x", client: { name: "x" }, hstNumber: "123456789 RT0001" };
const t0 = performance.now(); const bc = Q.compute(big); const ve = Q.validate(big, TODAY); const ms2 = performance.now() - t0;
check(`5,000 line items worked out and checked in ${ms2.toFixed(1)} ms (under 200)`, ms2 < 200 && bc.lines.length === 5000 && Object.keys(ve).length === 0);
check("totals add up exactly at 5,000 lines", bc.subtotal === bc.lines.reduce((s, l) => s + l.total, 0) && bc.total === bc.taxable + bc.hst);

// --- the shipped page itself
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
const html = readFileSync(file, "utf8");
const sha = t => "'sha256-" + createHash("sha256").update(t, "utf8").digest("base64") + "'";
const script = html.split("<script>")[1].split("</script>")[0], style = html.split("<style>")[1].split("</style>")[0];
const policy = (/http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html) || [])[1] || "";
check("the page's policy starts from allow nothing and blocks every network request", policy.includes("default-src 'none'") && policy.includes("connect-src 'none'") && policy.includes("form-action 'none'") && policy.includes("base-uri 'none'") && !/unsafe-inline|unsafe-eval|https?:|\*/.test(policy), policy);
check("the policy's script and style fingerprints match the script and style in the file", policy.includes("script-src " + sha(script) + ";") && policy.includes("style-src " + sha(style) + ";"));
check("there is exactly one script and one stylesheet, both inside the file, and nothing loads from another site", html.split("<script").length === 2 && html.split("<style").length === 2 && !/<link[^>]+stylesheet/.test(html) && !/(src|href)\s*=\s*["']https?:/.test(html.replace(script, "")) && !/url\(\s*["']?https?:/.test(style) && !/@import/.test(style));
check("the script compiles", (() => { try { new Function(script); return true; } catch (e) { return false; } })());
check("the page never writes text as HTML or runs text as code", !/innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\s*\(|new\s+Function|srcdoc/.test(script));
check("the page makes no network calls of its own", !/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts|serviceWorker/.test(script));
check("storage is only ever touched through the tool's own key", (script.match(/localStorage\.(getItem|setItem|removeItem)\(([^,)]+)/g) || []).every(m => /\(Q\.KEY/.test(m)) && !/sessionStorage|indexedDB|document\.cookie/.test(script), script.match(/localStorage\.\w+\([^,)]+/g));
check("no em or en dashes anywhere in the file", !/[\u2013\u2014]/.test(html));
const hf = new URL("./_headers", import.meta.url);
if (!process.env.QTW_HTML && existsSync(hf)) check("the _headers file sends the same policy as the page, plus a ban on framing", readFileSync(hf, "utf8").includes("Content-Security-Policy: " + policy + "; frame-ancestors 'none'"));

console.log(`\n${pass}/${pass + fail} tests passed`);
console.log(fail ? "FAILED" : "PASSED");
process.exit(fail ? 1 : 0);
