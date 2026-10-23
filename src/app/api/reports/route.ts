import { authed, ok } from "@/lib/api";
import { monthRange, partsIn, MONTHS_LONG } from "@/lib/dates";
import { redis } from "@/lib/redis";
import { Transaction } from "@/models";
import { accessibleAccountIds } from "@/lib/finance";

/** Info for the Export & backup screen. */
export const GET = authed(async ({ user }) => {
  const tz = user.timezone || "Asia/Karachi";
  const ids = await accessibleAccountIds(user._id);
  const count = await Transaction.countDocuments({ account: { $in: ids } });
  const last = monthRange(new Date(), tz, user.monthStartDay ?? 1, -1);
  const lp = partsIn(last.start, tz);
  return ok({
    count,
    lastBackup: await redis.get(`lastbackup:${user._id}`),
    lastMonth: { label: `${MONTHS_LONG[lp.m - 1]} ${lp.y}`, from: last.start, to: last.end },
  });
});
