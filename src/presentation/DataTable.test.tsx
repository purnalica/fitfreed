import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  DataTable,
  NumericTableCell,
  NumericTableHeader,
} from "./DataTable";

describe("DataTable", () => {
  it("provides one labelled scroll boundary and explicit numeric alignment semantics", () => {
    render(
      <DataTable
        accessibleName="Recorded intervals"
        scrollAccessibleName="Scrollable recorded interval values"
        scrollClassName="recorded-intervals-table"
      >
        <thead>
          <tr>
            <th scope="col">Interval</th>
            <NumericTableHeader scope="col">Duration</NumericTableHeader>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Warm-up</th>
            <NumericTableCell>12 min</NumericTableCell>
          </tr>
        </tbody>
      </DataTable>,
    );

    const region = screen.getByRole("region", {
      name: "Scrollable recorded interval values",
    });
    expect(region).toHaveClass("data-table-scroll", "recorded-intervals-table");
    const table = within(region).getByRole("table", { name: "Recorded intervals" });
    expect(within(table).getByRole("columnheader", { name: "Duration" }))
      .toHaveClass("data-table-number");
    expect(within(table).getByRole("cell", { name: "12 min" }))
      .toHaveClass("data-table-number");
  });
});
