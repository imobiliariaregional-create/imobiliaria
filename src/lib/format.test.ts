import { describe, expect, it } from "vitest";
import { addMonthsISO, dateInTimeZoneISO } from "@/lib/format";

describe("datas do sistema", () => {
  it("usa a data de Fortaleza em vez da data UTC", () => {
    const instante = new Date("2026-08-25T00:30:00.000Z");
    expect(dateInTimeZoneISO(instante)).toBe("2026-08-24");
  });

  it("ajusta o fim do mês sem pular fevereiro", () => {
    expect(addMonthsISO("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonthsISO("2025-01-31", 1)).toBe("2025-02-28");
  });
});

