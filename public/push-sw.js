self.addEventListener("push", (event) => {
  if (!event.data) {
    return;
  }

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: "AccessOS",
      body: event.data.text(),
      tag: `push-${Date.now()}`,
      url: "/",
    };
  }

  const title = payload.title || "AccessOS";
  const options = {
    body: payload.body || "Nova atualização disponível.",
    tag: payload.tag || `push-${Date.now()}`,
    data: {
      url: payload.url || "/",
      module: payload.module || null,
      audience: payload.audience || "resident",
      ...(payload.data || {}),
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl =
    typeof event.notification.data?.url === "string" &&
    event.notification.data.url.trim().length > 0
      ? event.notification.data.url
      : "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        const currentPath = new URL(client.url).pathname;
        if (currentPath === targetUrl && "focus" in client) {
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    }),
  );
});
