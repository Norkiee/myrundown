"use client";

import { useState, useEffect } from "react";

export function PushNotificationToggle() {
  const [permission, setPermission] = useState<NotificationPermission | "loading">("loading");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPermission("denied");
      return;
    }

    setPermission(Notification.permission);

    // Check if already subscribed
    navigator.serviceWorker.ready.then((registration) => {
      registration.pushManager.getSubscription().then((subscription) => {
        setSubscribed(!!subscription);
      });
    });
  }, []);

  const subscribe = async () => {
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== "granted") {
        setLoading(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      if (res.ok) {
        setSubscribed(true);
      }
    } catch (err) {
      console.error("Push subscription error:", err);
    }
    setLoading(false);
  };

  const unsubscribe = async () => {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });

        await subscription.unsubscribe();
        setSubscribed(false);
      }
    } catch (err) {
      console.error("Push unsubscribe error:", err);
    }
    setLoading(false);
  };

  if (permission === "loading") {
    return null;
  }

  if (permission === "denied") {
    return (
      <div className="flex items-center justify-between py-3">
        <div>
          <p className="text-sm text-text-primary">Push Notifications</p>
          <p className="text-xs text-text-muted">Blocked in browser settings</p>
        </div>
        <span className="text-xs text-text-muted">Blocked</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm text-text-primary">Push Notifications</p>
        <p className="text-xs text-text-muted">Get notified when daily reads are ready</p>
      </div>
      <button
        onClick={subscribed ? unsubscribe : subscribe}
        disabled={loading}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
          subscribed ? "bg-accent-green" : "bg-border"
        } disabled:opacity-50`}
        role="switch"
        aria-checked={subscribed}
      >
        <span
          className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${
            subscribed ? "translate-x-5" : "translate-x-0"
          } ${loading ? "opacity-50" : ""}`}
        />
      </button>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
