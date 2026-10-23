import webpush from "web-push";
import { Notification, PushSub } from "@/models";

let configured = false;
function configure() {
  if (configured) return !!process.env.VAPID_PUBLIC_KEY;
  configured = true;
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:me@example.com", pub, priv);
  return true;
}

export async function pushTo(userId: string, payload: { title: string; body?: string; link?: string; tag?: string }) {
  if (!configure()) return;
  const subs = await PushSub.find({ user: userId }).lean();
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.keys?.p256dh ?? "", auth: s.keys?.auth ?? "" } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 24 }
        );
      } catch (e: unknown) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await PushSub.deleteOne({ _id: s._id });
        else console.warn("[push] failed", code);
      }
    })
  );
}

/** Store an in-app notification and send it as a push notification. */
export async function notify(userId: string, n: { kind: string; title: string; body?: string; link?: string; push?: boolean }) {
  await Notification.create({ user: userId, kind: n.kind, title: n.title, body: n.body ?? "", link: n.link });
  if (n.push !== false) await pushTo(userId, { title: n.title, body: n.body, link: n.link, tag: n.kind });
}
