import { useCallback, useEffect, useRef } from "react";

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function formatCPF(value: string) {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

export function formatCNPJ(value: string) {
  const digits = onlyDigits(value).slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function formatCPFCNPJ(value: string, tipo: "fisica" | "juridica") {
  return tipo === "juridica" ? formatCNPJ(value) : formatCPF(value);
}

export function formatCEP(value: string) {
  const digits = onlyDigits(value).slice(0, 8);
  return digits.replace(/^(\d{5})(\d)/, "$1-$2");
}

export function isValidCEP(value: string) {
  return /^\d{5}-\d{3}$/.test(value);
}

export function parseBRLInput(value: string) {
  const cleaned = value.replace(/[^\d,.-]/g, "").trim();
  if (!cleaned) return null;

  const comma = cleaned.lastIndexOf(",");
  const dot = cleaned.lastIndexOf(".");
  let normalized = cleaned;

  if (comma >= 0) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (dot >= 0) {
    const decimalPlaces = cleaned.length - dot - 1;
    normalized = decimalPlaces === 3 ? cleaned.replace(/\./g, "") : cleaned;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function calculateDigit(base: string, weights: number[]) {
  const total = base.split("").reduce((sum, digit, index) => sum + Number(digit) * weights[index], 0);
  const rest = total % 11;
  return rest < 2 ? 0 : 11 - rest;
}

export function isValidCPF(value: string) {
  const digits = onlyDigits(value);
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false;
  const base = digits.slice(0, 9);
  const first = calculateDigit(base, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = calculateDigit(`${base}${first}`, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return digits === `${base}${first}${second}`;
}

export function isValidCNPJ(value: string) {
  const digits = onlyDigits(value);
  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) return false;
  const base = digits.slice(0, 12);
  const first = calculateDigit(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = calculateDigit(`${base}${first}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return digits === `${base}${first}${second}`;
}

export function validateCPFCNPJ(value: string, tipo: "fisica" | "juridica") {
  return tipo === "juridica" ? isValidCNPJ(value) : isValidCPF(value);
}

export function upper(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().toLocaleUpperCase("pt-BR");
}

export function upperOrNull(value: FormDataEntryValue | null) {
  const normalized = upper(value);
  return normalized || null;
}

export function normalizeSearch(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

export function applyFormValues(form: HTMLFormElement | null, values: object) {
  if (!form) return;
  for (const [name, value] of Object.entries(values)) {
    if (!value) continue;
    const element = form.elements.namedItem(name);
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) continue;
    element.value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

type DraftData = Record<string, string | boolean>;

export function getDraftValue<T extends string>(formId: string, name: string, fallback: T): T {
  const raw = sessionStorage.getItem(`imobiliaria:rascunho:${formId}`);
  if (!raw) return fallback;
  try {
    const value = (JSON.parse(raw) as DraftData)[name];
    return typeof value === "string" ? value as T : fallback;
  } catch {
    return fallback;
  }
}

function serializeForm(form: HTMLFormElement) {
  const data: DraftData = {};
  for (const element of Array.from(form.elements)) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)) continue;
    if (!element.name || ["file", "password", "submit", "button", "hidden"].includes(element.type)) continue;
    if (element instanceof HTMLInputElement && element.type === "radio") {
      if (element.checked) data[element.name] = element.value;
    } else if (element instanceof HTMLInputElement && element.type === "checkbox") {
      data[element.name] = element.checked;
    } else {
      data[element.name] = element.value;
    }
  }
  return data;
}

export function useFormDraft(formId: string) {
  const formRef = useRef<HTMLFormElement>(null);
  const storageKey = `imobiliaria:rascunho:${formId}`;

  useEffect(() => {
    const form = formRef.current;
    const raw = sessionStorage.getItem(storageKey);
    if (!form || !raw) return;
    let draft: DraftData;
    try {
      draft = JSON.parse(raw) as DraftData;
    } catch {
      sessionStorage.removeItem(storageKey);
      return;
    }

    for (const element of Array.from(form.elements)) {
      if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)) continue;
      if (!element.name || !(element.name in draft)) continue;
      const value = draft[element.name];
      if (element instanceof HTMLInputElement && element.type === "radio") {
        element.checked = value === element.value;
      } else if (element instanceof HTMLInputElement && element.type === "checkbox") {
        element.checked = Boolean(value);
      } else if (typeof value === "string") {
        element.value = value;
      }
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, [storageKey]);

  const saveDraft = useCallback(() => {
    if (formRef.current) sessionStorage.setItem(storageKey, JSON.stringify(serializeForm(formRef.current)));
  }, [storageKey]);

  const clearDraft = useCallback(() => sessionStorage.removeItem(storageKey), [storageKey]);

  return { formRef, saveDraft, clearDraft };
}
