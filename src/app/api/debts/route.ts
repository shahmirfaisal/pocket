import { z } from "zod";
import { authed, body, ok } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { minor, objectId } from "@/lib/schemas";
import { PERSON_COLORS } from "@/lib/defaults";
import { Debt, Person } from "@/models";

/** Record a split without a transaction: "I owe Ayesha 1,200" or "Bilal owes me 500". */
export const POST = authed(async ({ req, user }) => {
  const input = await body(req, z.object({
    person: objectId.optional(), name: z.string().trim().min(1).max(40).optional(),
    amount: minor, direction: z.enum(["they-owe", "i-owe"]), note: z.string().max(120).default(""), date: z.coerce.date().optional(),
  }));
  let person = input.person ? await Person.findOne({ _id: input.person, user: user._id }) : null;
  if (!person && input.name) {
    person = await Person.findOne({ user: user._id, name: input.name }) ?? await Person.create({ user: user._id, name: input.name, color: PERSON_COLORS[(await Person.countDocuments({ user: user._id })) % PERSON_COLORS.length] });
  }
  if (!person) throw new HttpError(400, "Pick someone");
  await Debt.create({ user: user._id, person: person._id, amount: input.direction === "they-owe" ? input.amount : -input.amount, note: input.note, date: input.date ?? new Date() });
  return ok({ ok: true }, { status: 201 });
});
