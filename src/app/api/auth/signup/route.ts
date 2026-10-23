import { open, body, ok, clientIp } from "@/lib/api";
import { HttpError, createSession, hashSecret } from "@/lib/auth";
import { rateLimit } from "@/lib/redis";
import { signupSchema } from "@/lib/schemas";
import { Account, Category, User } from "@/models";
import { DEFAULT_CATEGORIES } from "@/lib/defaults";

export const POST = open(async ({ req }) => {
  if (!(await rateLimit(`signup:${clientIp(req)}`, 10, 3600))) throw new HttpError(429, "Too many sign-ups from this network. Try again later.");
  const input = await body(req, signupSchema);
  if (await User.exists({ email: input.email })) throw new HttpError(409, "An account with this email already exists");
  const user = await User.create({ name: input.name, email: input.email, passwordHash: await hashSecret(input.password), setupStep: 1 });
  await Category.insertMany(DEFAULT_CATEGORIES.map((c, i) => ({ ...c, user: user._id, order: i })));
  // Claim any shared-wallet invites that were sent to this email before sign-up.
  await Account.updateMany(
    { "members.email": input.email },
    { $set: { "members.$[m].user": user._id, "members.$[m].name": input.name } },
    { arrayFilters: [{ "m.email": input.email }] }
  );
  await createSession(String(user._id));
  return ok({ ok: true, next: "/setup" });
});
