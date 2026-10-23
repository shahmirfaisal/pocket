import { generateRegistrationOptions, verifyRegistrationResponse } from "@simplewebauthn/server";
import { authed, ok } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { redis } from "@/lib/redis";
import { rp } from "@/lib/webauthn";
import { Passkey, User } from "@/models";

/** Step 1: options for creating a Face ID passkey on this device. */
export const GET = authed(async ({ req, user }) => {
  const { rpID, rpName } = rp(req);
  const existing = await Passkey.find({ user: user._id }).lean();
  const options = await generateRegistrationOptions({
    rpName, rpID, userName: user.email, userDisplayName: user.name,
    userID: new TextEncoder().encode(String(user._id)),
    attestationType: "none",
    excludeCredentials: existing.map((p) => ({ id: p.credentialId, transports: p.transports })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "required", authenticatorAttachment: "platform" },
  });
  await redis.set(`wa-reg:${user._id}`, options.challenge, "EX", 300);
  return ok(options);
});

/** Step 2: verify and save the passkey. */
export const POST = authed(async ({ req, user }) => {
  const { origin, rpID } = rp(req);
  const challenge = await redis.get(`wa-reg:${user._id}`);
  if (!challenge) throw new HttpError(400, "That took too long. Try again.");
  const response = await req.json();
  const v = await verifyRegistrationResponse({ response, expectedChallenge: challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true });
  if (!v.verified) throw new HttpError(400, "Face ID couldn't be set up");
  await redis.del(`wa-reg:${user._id}`);
  const c = v.registrationInfo.credential;
  await Passkey.create({ user: user._id, credentialId: c.id, publicKey: Buffer.from(c.publicKey), counter: c.counter, transports: c.transports ?? [], deviceName: req.headers.get("user-agent")?.slice(0, 120) });
  await User.updateOne({ _id: user._id }, { $set: { "lock.faceId": true } });
  return ok({ ok: true });
});
