import { generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server";
import { authed, ok } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { redis } from "@/lib/redis";
import { rp } from "@/lib/webauthn";
import { Passkey } from "@/models";

export const GET = authed(async ({ req, user }) => {
  const { rpID } = rp(req);
  const keys = await Passkey.find({ user: user._id }).lean();
  if (!keys.length) throw new HttpError(404, "Face ID isn't set up on this account");
  const options = await generateAuthenticationOptions({
    rpID, userVerification: "required",
    allowCredentials: keys.map((k) => ({ id: k.credentialId, transports: k.transports as never })),
  });
  await redis.set(`wa-auth:${user._id}`, options.challenge, "EX", 300);
  return ok(options);
});

export const POST = authed(async ({ req, user }) => {
  const { origin, rpID } = rp(req);
  const challenge = await redis.get(`wa-auth:${user._id}`);
  if (!challenge) throw new HttpError(400, "That took too long. Try again.");
  const response = await req.json();
  const key = await Passkey.findOne({ user: user._id, credentialId: response?.id });
  if (!key) throw new HttpError(400, "This device's Face ID isn't registered. Use your PIN.");
  const v = await verifyAuthenticationResponse({
    response, expectedChallenge: challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true,
    credential: { id: key.credentialId, publicKey: new Uint8Array(key.publicKey), counter: key.counter, transports: key.transports as never },
  });
  if (!v.verified) throw new HttpError(400, "Face ID didn't match");
  await redis.del(`wa-auth:${user._id}`);
  key.counter = v.authenticationInfo.newCounter;
  await key.save();
  return ok({ ok: true });
});
