interface InstrumentedWindow extends Window {
  __wdio_mocks__?: Record<string, (arguments_?: unknown) => unknown>;
}

export async function openInstrumentedOfficialSourceLink(url: string) {
  const instrumentedWindow = window as InstrumentedWindow;
  const openUrl = instrumentedWindow.__wdio_mocks__?.["plugin:opener|open_url"];
  if (typeof openUrl !== "function") {
    throw new Error("The instrumented official-link adapter requires a configured opener mock");
  }
  await openUrl({ url, with: undefined });
}
