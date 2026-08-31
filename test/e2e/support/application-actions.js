export async function openArchivePicker(
  dialogMock,
  selectedPath,
  chooseLabel,
  cancellationFocusLabel = chooseLabel,
) {
  await dialogMock.mockReturnValue(selectedPath);
  await dialogMock.update();
  const expectedCallCount = dialogMock.mock.calls.length + 1;
  await $(`aria/${chooseLabel}`).click();
  await browser.waitUntil(
    async () => {
      await dialogMock.update();
      return dialogMock.mock.calls.length >= expectedCallCount;
    },
    { timeout: 10_000, timeoutMsg: "archive picker was not invoked" },
  );
  expect(dialogMock.mock.calls[expectedCallCount - 1][0]).toEqual({
    options: {
      multiple: false,
      directory: false,
      filters: [{ name: "ZIP", extensions: ["zip"] }],
    },
  });
  if (selectedPath === null) {
    await browser.waitUntil(
      () => browser.execute(
        (label) => document.activeElement?.textContent?.trim() === label,
        cancellationFocusLabel,
      ),
      { timeout: 10_000, timeoutMsg: "archive selection did not regain focus after cancellation" },
    );
  }
}

export async function selectArchive(dialogMock, archivePath, chooseLabel) {
  await openArchivePicker(dialogMock, archivePath, chooseLabel);
  const archiveName = archivePath.split(/[\\/]/).filter(Boolean).at(-1);
  await expect($(".path")).toHaveText(archiveName);
  await expect($("body")).not.toHaveText(expect.stringContaining(archivePath));
  await browser.waitUntil(
    () => browser.execute(() => {
      const heading = document.querySelector(".source-path-import h2");
      const archive = document.querySelector(".source-path-import .path")
        ?.getBoundingClientRect();
      const importAction = document.querySelector(".source-path-import button:not(.secondary)")
        ?.getBoundingClientRect();
      const navigation = document.querySelector(".app-sidebar")?.getBoundingClientRect();
      const compact = navigation && navigation.width >= document.documentElement.clientWidth - 1;
      const visibleTop = compact ? navigation.bottom : 0;
      return document.activeElement === heading
        && archive && importAction
        && archive.top >= visibleTop - 1
        && importAction.bottom <= document.documentElement.clientHeight + 1;
    }),
    {
      timeout: 10_000,
      timeoutMsg: "selected archive and import action were not revealed together",
    },
  );
}

export async function waitForNotice(fragment, timeout = 10_000, session = browser) {
  await session.waitUntil(
    () => session.execute(
      (expectedFragment) => [...document.querySelectorAll("[role='status']")]
        .some((notice) => notice.textContent?.includes(expectedFragment)),
      fragment,
    ),
    { timeout, timeoutMsg: `status did not contain ${fragment}` },
  );
}

export async function persistSettings() {
  const status = await $(".settings-status");
  const previewStatus = await status.getText();
  const save = await $(".settings-actions button[type='submit']");
  await save.waitForExist({ timeout: 10_000 });
  await save.waitForEnabled({ timeout: 10_000 });
  await save.click();
  await browser.waitUntil(async () => {
    const currentStatus = await $(".settings-status").getText();
    const currentSave = await $$(".settings-actions button[type='submit']");
    return currentStatus !== previewStatus && currentSave.length === 0;
  }, { timeout: 10_000, timeoutMsg: "the application settings were not saved" });
}

export async function goToHome(home, session = browser) {
  const destination = await session.$(`.app-sidebar nav button[data-home='${home}']`);
  await destination.waitForEnabled({ timeout: 10_000 });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await destination.click();
    try {
      await session.waitUntil(
        async () => (await destination.getAttribute("aria-current")) === "page",
        {
          timeout: 1_000,
          interval: 50,
          timeoutMsg: `${home} did not become the current application section`,
        },
      );
      return;
    } catch (error) {
      if (attempt === 1) throw error;
    }
  }
}

export async function resizeApplication(width, height, session = browser) {
  const resizeError = await session.executeAsync((nextWidth, nextHeight, done) => {
    window.__TAURI_INTERNALS__.invoke("plugin:window|set_size", {
      label: "main",
      value: { Logical: { width: nextWidth, height: nextHeight } },
    }).then(() => done(null), (error) => done(String(error)));
  }, width, height);
  if (resizeError !== null) throw new Error(`native window resize failed: ${resizeError}`);
  let previousWidth;
  let stableWidthObservations = 0;
  await session.waitUntil(
    async () => {
      const currentWidth = await session.execute(
        () => document.documentElement.clientWidth,
      );
      const withinRequestedRange = Math.abs(currentWidth - width) <= 24;
      stableWidthObservations = withinRequestedRange && currentWidth === previousWidth
        ? stableWidthObservations + 1
        : Number(withinRequestedRange);
      previousWidth = currentWidth;
      return stableWidthObservations >= 3;
    },
    {
      timeout: 10_000,
      interval: 50,
      timeoutMsg: `the application did not settle at ${width}px`,
    },
  );
}

export async function openSettingsCategory(category, session = browser) {
  await goToHome("settings", session);
  const target = await session.$(
    `.settings-panel .workspace-navigation button[data-workspace='${category}']`,
  );
  await target.waitForDisplayed({ timeout: 10_000 });
  if (await target.getAttribute("aria-current") !== "page") await target.click();
  await session.waitUntil(
    async () => (await target.getAttribute("aria-current")) === "page",
    { timeout: 10_000, timeoutMsg: `${category} did not become the current Settings category` },
  );
}

export async function returnToLibraryHome(catalog) {
  await goToHome("explore");
  const returnHome = await $(
    `.explorer-return button[aria-label="${catalog.home.backHome}"]`,
  );
  await browser.waitUntil(async () => (
    await $(".library-home h1").isDisplayed()
    || await returnHome.isExisting()
  ), {
    timeout: 10_000,
    timeoutMsg: "neither Library Home nor its exact return action became available",
  });
  if (!(await $(".library-home h1").isDisplayed())) {
    await returnHome.waitForDisplayed({ timeout: 10_000 });
    await returnHome.click();
  }
  const heading = await $(".library-home h1");
  await heading.waitForDisplayed({ timeout: 10_000 });
  await expect(heading).toHaveText(catalog.home.title);
}

export async function openHomeQuestion(catalog, kind, expectedSelector) {
  await returnToLibraryHome(catalog);
  const expectedLabel = catalog.home.questions[kind];
  const buttons = await $$(".library-home-questions button");
  const labels = [];
  for (const button of buttons) {
    const label = await button.getText();
    labels.push(label);
    if (label.includes(expectedLabel)) {
      await button.click();
      await $(expectedSelector).waitForDisplayed({ timeout: 10_000 });
      return;
    }
  }
  throw new Error(`Home question was not available: ${expectedLabel}; found ${labels.join(" | ")}`);
}

export async function selectLocale(locale, destination = "explore") {
  await openSettingsCategory("appearance");
  const select = await $("#application-language");
  await select.waitForEnabled({ timeout: 10_000 });
  if (await select.getValue() !== locale) {
    await browser.execute((nextLocale) => {
      const select = document.querySelector("#application-language");
      const setValue = Object.getOwnPropertyDescriptor(
        window.HTMLSelectElement.prototype,
        "value",
      ).set;
      setValue.call(select, nextLocale);
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }, locale);
    await expect(select).toHaveValue(locale);
    await persistSettings();
  }
  await goToHome(destination);
  await browser.waitUntil(
    () => browser.execute(
      (expectedLocale) => document.documentElement.lang === expectedLocale,
      locale,
    ),
    { timeout: 10_000, timeoutMsg: `the ${locale} preference was not applied` },
  );
}
