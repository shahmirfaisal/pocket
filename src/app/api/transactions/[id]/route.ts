import { authed, body, ok } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { txInput } from "@/lib/schemas";
import { accessibleAccountIds } from "@/lib/finance";
import { deleteTransaction, updateTransaction } from "@/lib/transactions";
import { serializeTx, TX_POPULATE } from "@/lib/serialize";
import { Debt, Transaction } from "@/models";

export const GET = authed<{ id: string }>(async ({ user, params }) => {
  const ids = (await accessibleAccountIds(user._id)).map(String);
  const t = await Transaction.findById(params.id).populate(TX_POPULATE).lean();
  if (!t) throw new HttpError(404, "Transaction not found");
  const accId = String((t.account as unknown as { _id: unknown })?._id ?? t.account);
  if (!ids.includes(accId)) throw new HttpError(404, "Transaction not found");
  const splits = await Debt.find({ transaction: t._id, user: user._id }).populate<{ person: { _id: unknown; name: string } }>("person", "name").lean();
  return ok({
    transaction: serializeTx(t, String(user._id)),
    splits: splits.map((d) => ({ id: String(d._id), person: { id: String(d.person?._id), name: d.person?.name ?? "" }, amount: d.amount, settled: d.settled })),
  });
});

export const PATCH = authed<{ id: string }>(async ({ req, user, params }) => {
  const input = await body(req, txInput);
  const t = await updateTransaction(user, params.id, input);
  const full = await Transaction.findById(t._id).populate(TX_POPULATE).lean();
  return ok({ transaction: serializeTx(full!, String(user._id)) });
});

export const DELETE = authed<{ id: string }>(async ({ user, params }) => {
  await deleteTransaction(user, params.id);
  return ok({ ok: true });
});
