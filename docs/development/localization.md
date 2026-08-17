# Localization Guide

## Current contract

English for the United States (`en-US`) is the canonical source locale. Spanish for Spain (`es-ES`) is the second supported locale. Every scoped interface message must exist in both catalogs under `src/locales`, and project source must not contain a translated interface literal.

The catalogs are nested JSON objects with stable semantic keys. This representation can be synchronized with established collaborative translation platforms without requiring translators to edit TypeScript. Keys are product contracts: rename or remove one only with the presentation and translation checks in the same change.

## Locale resolution and persistence

At startup the application resolves its locale in this order:

1. the previously persisted FitFreed preference;
2. the first supported language in the operating system's ordered language list; or
3. `en-US` when no operating-system language is supported.

The selected locale is stored in the singleton `locale_preference` row documented by the [SQLite version 3 specification](../data-formats/persistence/sqlite-v3.md). If first-run persistence fails, the derived system locale remains active for that session and localized guidance explains that restart will retry initialization. A failed explicit update restores the previous visible locale. Locale changes never rewrite imported information.

Authenticated update text is selected in the application layer from the persisted locale; React never selects a raw signed-language map. After a locale change is saved, the update panel repeats its launch-style evaluation so any visible signed release notes use the new locale. A failed locale save restores the previous interface and does not trigger that refresh.

## Formatting and pluralization

- Use `Intl.NumberFormat` with the selected locale for displayed numbers.
- Use `Intl.DateTimeFormat` with the selected locale for dates. Canonical local dates are constructed at UTC midnight and formatted with the UTC time zone so the calendar day cannot drift with the host time zone.
- Use `Intl.PluralRules` to select count-message variants. Current catalogs provide `one` and `other`; a locale with additional required categories must add those categories to the typed message contract before it is accepted.
- Keep provider-neutral values and units in the domain. Localization belongs to the presentation boundary.

## Adding a locale

Adding a locale is an additive product change and requires all of the following in one increment:

1. Add a complete catalog under `src/locales` using the canonical `en-US` key structure.
2. Add the BCP 47 tag to the typed `Locale` catalog registry and to the visible language selector.
3. Add the corresponding application `LocalePreference` value and transport validation.
4. Add an immutable persistence migration that extends the database locale constraint, then document the new schema and migration path.
5. Add component and packaged E2E evidence for selection, restart persistence, fallback, pluralization, locale-aware dates and numbers, text expansion, keyboard operation, and accessibility.
6. Update user and contributor documentation for the new supported locale.

Do not silently accept arbitrary locale tags. A declared locale is supported only when its complete catalog, formatting behavior, persistence compatibility, and user journey are verified.

## Verification

Run from the repository root:

```sh
npm run check:i18n
npm run check:ui-contracts
npm test
npm run verify:e2e
```

`check:i18n` rejects missing, additional, empty, or structurally incompatible translations. `check:ui-contracts` keeps motion declarations behind the user's reduced-motion preference. Component tests protect resolution, fallback, persistence failures, plural forms, and formatting. The packaged E2E journey proves both locales against the actual desktop process, including restart persistence, text expansion, and automated accessibility checks.
