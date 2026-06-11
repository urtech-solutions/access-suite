self.addEventListener("push", (event) => {
  if (!event.data) return;

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

  const isCall = payload.data?.type === "incoming_call";
  const title = payload.title || "AccessOS";

  const options = {
    body: payload.body || "Nova atualização disponível.",
    tag: payload.tag || `push-${Date.now()}`,
    renotify: payload.renotify ?? false,
    requireInteraction: isCall,
    data: {
      url: payload.url || "/",
      module: payload.module || null,
      audience: payload.audience || "resident",
      ...(payload.data || {}),
    },
  };

  if (isCall) {
    options.actions = [
      { action: "accept", title: "Atender" },
      { action: "reject", title: "Recusar" },
    ];
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const isCall = data.type === "incoming_call";

  if (isCall) {
    const callUuid = data.call_uuid;
    const action = event.action;

    event.waitUntil(
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
        for (const client of clients) {
          client.postMessage({
            type: action === "reject" ? "CALL_PUSH_REJECT" : "CALL_PUSH_ACCEPT",
            call_uuid: callUuid,
            conversation_uuid: data.conversation_uuid,
            tenant_uuid: data.tenant_uuid,
          });
        }

        if (action === "reject") return;

        const targetUrl = "/";
        for (const client of clients) {
          if ("focus" in client) return client.focus();
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      }),
    );
    return;
  }

  const targetUrl =
    typeof data.url === "string" && data.url.trim().length > 0
      ? data.url
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
