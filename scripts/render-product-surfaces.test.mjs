import assert from "node:assert/strict";
import test from "node:test";

import {
  renderProductSurfaces,
  validateProductStatus,
} from "./render-product-surfaces.mjs";

const model = Object.freeze({
  schemaVersion: 2,
  updated: "2026-08-18",
  statuses: [
    createStatus("available", "Available", "Current", "Ready & inspectable"),
    createStatus("active", "Active", "In progress", "Useful < soon"),
    createStatus("later", "Later", "After evidence", "Deliberately later"),
  ],
});

function createStatus(key, label, title, item) {
  return {
    key,
    label,
    title,
    items: [{ key: "primaryCapability", text: item }],
    source: { label: `${label} source`, path: `docs/${key}.md` },
  };
}

test("renders README and product-page status from one model", () => {
  const rendered = renderProductSurfaces(
    model,
    "before\n<!-- product-status:start -->\nstale\n<!-- product-status:end -->\nafter\n",
    "<div>\n  <!-- product-status:start -->\n  stale\n  <!-- product-status:end -->\n</div>\n",
  );

  assert.equal((rendered.readme.match(/<details data-status=/gu) ?? []).length, 3);
  assert.match(rendered.readme, /<details data-status="active" open>/u);
  assert.match(rendered.readme, /<summary><strong>Available — Current<\/strong><\/summary>/u);
  assert.match(rendered.readme, /Ready &amp; inspectable/u);
  assert.match(rendered.productPage, /data-status="active"/u);
  assert.match(rendered.productPage, /<details data-status="active" open>/u);
  assert.match(rendered.productPage, /<summary>/u);
  assert.match(rendered.productPage, /data-i18n="status\.available\.label"/u);
  assert.match(rendered.productPage, /data-i18n="status\.active\.items\.primaryCapability"/u);
  assert.match(rendered.productPage, /Ready &amp; inspectable/u);
  assert.match(rendered.productPage, /Useful &lt; soon/u);
  assert.match(rendered.productPage, /href="\.\.\/docs\/later\.md"/u);
});

test("rejects missing, reordered, or duplicated status contracts", () => {
  assert.throws(
    () => validateProductStatus({ ...model, statuses: model.statuses.slice(1) }),
    /semantic order/u,
  );
  assert.throws(
    () => validateProductStatus({
      ...model,
      statuses: [
        {
          ...model.statuses[0],
          items: [
            { key: "sameCapability", text: "first" },
            { key: "sameCapability", text: "second" },
          ],
        },
        model.statuses[1],
        model.statuses[2],
      ],
    }),
    /duplicate item keys/u,
  );
});
