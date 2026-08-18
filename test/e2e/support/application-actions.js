export async function openArchivePicker(dialogMock, selectedPath) {
  await dialogMock.mockReturnValue(selectedPath);
  await dialogMock.update();
  const expectedCallCount = dialogMock.mock.calls.length + 1;
  await $("aria/Choose ZIP package").click();
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
}

export async function selectArchive(dialogMock, archivePath) {
  await openArchivePicker(dialogMock, archivePath);
  await expect($(".path")).toHaveText(archivePath);
}

export async function persistSettings() {
  const status = await $(".settings-status");
  const previewStatus = await status.getText();
  const save = await $(".settings-actions button[type='submit']");
  await save.waitForEnabled({ timeout: 10_000 });
  await save.click();
  await browser.waitUntil(async () => {
    const currentStatus = await $(".settings-status").getText();
    const currentSave = await $(".settings-actions button[type='submit']");
    return currentStatus !== previewStatus && !(await currentSave.isEnabled());
  }, { timeout: 10_000, timeoutMsg: "the application settings were not saved" });
}

export async function goToHome(home) {
  const destination = await $(`.shell-header nav button[data-home='${home}']`);
  await destination.waitForEnabled({ timeout: 10_000 });
  await destination.click();
}

export async function returnToLibraryHome(catalog) {
  await goToHome("explore");
  const returnButtons = await $$(".explorer-return button");
  if (returnButtons.length > 0 && await returnButtons[0].isDisplayed()) {
    await returnButtons[0].click();
  }
  await expect($(".library-home h1")).toHaveText(catalog.home.title);
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
  const settings = await $(".shell-header nav button[data-home='settings']");
  await settings.waitForEnabled({ timeout: 10_000 });
  await settings.click();
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
