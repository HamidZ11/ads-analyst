"use client";

import { useId, useState } from "react";
import type { CurrencyCode } from "@/domain/types";
import type { ToolId } from "./catalog";
import {
  calculate,
  CURRENCIES,
  FIELDS,
  fieldError,
  type Reading,
  type Values,
} from "./results";
import s from "./tools.module.css";

/**
 * One free calculator: a currency switch, its inputs and the result, which
 * updates as the person types. Nothing is sent anywhere. Inputs are text with
 * a decimal keypad, so "1,250" and "£3,000" are understood and a stray letter
 * gets a message rather than NaN. The result is a polite live region.
 */
export function Calculator({ tool }: { tool: ToolId }) {
  const id = useId();
  const fields = FIELDS[tool];
  const [currency, setCurrency] = useState<CurrencyCode>("GBP");
  const [values, setValues] = useState<Values>({});
  const result = calculate(tool, values, currency);
  const symbol = CURRENCIES.find((c) => c.code === currency)!;

  return (
    <form className={s.panel} onSubmit={(event) => event.preventDefault()} noValidate>
      <fieldset className={s.currency}>
        <legend className={s.legend}>Currency</legend>
        <div className={s.segments}>
          {CURRENCIES.map((option) => (
            <label key={option.code} className={s.segment}>
              <input
                type="radio"
                name={`${id}-currency`}
                value={option.code}
                checked={currency === option.code}
                onChange={() => setCurrency(option.code)}
              />
              <span>
                <span aria-hidden>{option.symbol}</span>
                {option.code}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className={s.fields}>
        {fields.map((field) => {
          const raw = values[field.name] ?? "";
          const error = fieldError(field, raw);
          const inputId = `${id}-${field.name}`;
          const describedBy =
            [field.hint ? `${inputId}-hint` : null, error ? `${inputId}-error` : null]
              .filter(Boolean)
              .join(" ") || undefined;
          return (
            <div key={field.name} className={s.field}>
              <label htmlFor={inputId} className={s.label}>
                {field.label}
                {field.kind === "money" ? (
                  <span className={s.srOnly}> in {symbol.name}</span>
                ) : null}
                {field.optional ? <span className={s.optional}> (optional)</span> : null}
              </label>
              <div
                className={s.inputWrap}
                data-kind={field.kind}
                data-invalid={error ? "" : undefined}
              >
                {field.kind === "money" ? (
                  <span aria-hidden className={s.affix}>
                    {symbol.symbol}
                  </span>
                ) : null}
                <input
                  id={inputId}
                  name={field.name}
                  className={s.input}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={field.placeholder}
                  value={raw}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={describedBy}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, [field.name]: event.target.value }))
                  }
                />
                {field.kind === "percent" ? (
                  <span aria-hidden className={s.affix}>
                    %
                  </span>
                ) : null}
              </div>
              {field.hint ? (
                <p id={`${inputId}-hint`} className={s.hint}>
                  {field.hint}
                </p>
              ) : null}
              {error ? (
                <p id={`${inputId}-error`} className={s.error}>
                  {error}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className={s.result} role="status" aria-live="polite" aria-atomic="true">
        {result.kind === "value" ? (
          <>
            <ResultReading reading={result.reading} lead />
            {result.extra ? <ResultReading reading={result.extra} /> : null}
          </>
        ) : result.kind === "undefined" ? (
          <div className={s.reading}>
            <p className={s.resultLabel}>{result.label}</p>
            <p className={s.resultEmpty}>Not available</p>
            <p className={s.resultDetail}>{result.message}</p>
          </div>
        ) : (
          <p className={s.resultWaiting}>{result.message}</p>
        )}
      </div>
    </form>
  );
}

function ResultReading({ reading, lead = false }: { reading: Reading; lead?: boolean }) {
  return (
    <div className={s.reading} data-lead={lead ? "" : undefined}>
      <p className={s.resultLabel}>{reading.label}</p>
      <p className={s.resultValue}>{reading.value}</p>
      <p className={s.resultDetail}>{reading.detail}</p>
      <p className={s.worked}>{reading.worked}</p>
    </div>
  );
}
