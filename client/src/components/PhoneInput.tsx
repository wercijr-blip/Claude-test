import { useRef, useState, useEffect } from "react";
import {
  usePhoneInput,
  defaultCountries,
  parseCountry,
} from "react-international-phone";
import type { CountryIso2 } from "react-international-phone";

/**
 * Converts an ISO-3166-1 alpha-2 country code to its native Unicode flag emoji.
 * Uses Regional Indicator Symbol Letters — no CDN, no images, works in every
 * modern browser and OS that supports emoji.
 *
 * 'BR' → 🇧🇷, 'US' → 🇺🇸, etc.
 */
function toFlagEmoji(iso2: string): string {
  return iso2
    .toUpperCase()
    .split("")
    .map((ch) => String.fromCodePoint(ch.charCodeAt(0) + 127397))
    .join("");
}

// Brazil first, then alphabetical
const sortedCountries = [
  ...defaultCountries.filter((c) => parseCountry(c).iso2 === "br"),
  ...defaultCountries
    .filter((c) => parseCountry(c).iso2 !== "br")
    .sort((a, b) => parseCountry(a).name.localeCompare(parseCountry(b).name)),
];

interface Props {
  value: string;
  onChange: (e164: string) => void;
  className?: string;
  required?: boolean;
  hasError?: boolean;
}

export function PhoneInput({
  value,
  onChange,
  className,
  required,
  hasError,
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const { inputValue, country, setCountry, handlePhoneValueChange, inputRef } =
    usePhoneInput({
      defaultCountry: "br",
      value,
      forceDialCode: true,
      onChange: ({ phone, country: c }) => {
        // Pass "" to the form when the user hasn't typed anything beyond the dial code.
        // Without this, the hook fires onChange("+55") on mount, which fails Zod validation.
        const beyondDialCode = phone.slice(c.dialCode.length + 1 /* "+" */);
        onChange(beyondDialCode.trim() ? phone : "");
      },
    });

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const border = hasError ? "border-red-400" : "border-slate-300";

  return (
    <div className="relative flex" ref={wrapperRef}>
      {/* ── Country selector button ─────────────────────────────── */}
      <button
        type="button"
        aria-label="Selecionar país"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1 border ${border} border-r-0 rounded-l-lg px-2 bg-white hover:bg-slate-50 cursor-pointer h-[38px] min-w-[60px] select-none`}
      >
        <span className="text-lg leading-none">
          {toFlagEmoji(country.iso2)}
        </span>
        <span className="text-[10px] text-slate-400 leading-none">▾</span>
      </button>

      {/* ── Country dropdown ────────────────────────────────────── */}
      {open && (
        <ul
          role="listbox"
          aria-label="Países"
          className="absolute top-full left-0 z-50 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg w-72 max-h-56 overflow-y-auto py-1"
        >
          {sortedCountries.map((c) => {
            const parsed = parseCountry(c);
            const selected = parsed.iso2 === country.iso2;
            return (
              <li key={parsed.iso2} role="option" aria-selected={selected}>
                <button
                  type="button"
                  className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-slate-50 ${selected ? "bg-blue-50 font-medium" : ""}`}
                  onClick={() => {
                    setCountry(parsed.iso2 as CountryIso2);
                    setOpen(false);
                  }}
                >
                  <span className="text-base select-none">
                    {toFlagEmoji(parsed.iso2)}
                  </span>
                  <span className="flex-1 truncate">{parsed.name}</span>
                  <span className="text-slate-400 text-xs">
                    +{parsed.dialCode}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* ── Phone number input ──────────────────────────────────── */}
      <input
        ref={inputRef}
        type="tel"
        value={inputValue}
        onChange={handlePhoneValueChange}
        onPaste={(e) => {
          // Pasted text without a leading "+" (e.g. a number copied from
          // Contacts/WhatsApp) has no explicit dial code, so the library
          // guesses one from the raw digits — "2015550123" reads as Egypt's
          // "+20" prefix and silently overrides the country the user just
          // picked, or gets discarded if guessing is off. Prepending the
          // selected country's dial code ourselves removes the ambiguity.
          const pasted = e.clipboardData.getData("text");
          if (pasted.trim().startsWith("+")) return;
          const digits = pasted.replace(/\D/g, "");
          if (!digits) return;
          e.preventDefault();
          onChange(`+${country.dialCode}${digits}`);
        }}
        required={required}
        inputMode="tel"
        placeholder="(61) 99999-9999"
        className={`flex-1 border ${border} rounded-r-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${hasError ? "focus:ring-red-400" : ""} ${className ?? ""}`}
      />
    </div>
  );
}
