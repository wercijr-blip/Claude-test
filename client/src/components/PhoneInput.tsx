import { PhoneInput as IntlPhoneInput } from 'react-international-phone'
import 'react-international-phone/style.css'

interface Props {
  value: string
  onChange: (e164: string) => void
  className?: string
  required?: boolean
  hasError?: boolean
}

export function PhoneInput({ value, onChange, className, required, hasError }: Props) {
  return (
    <IntlPhoneInput
      defaultCountry="br"
      value={value}
      onChange={(phone) => onChange(phone)}
      inputClassName={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${hasError ? 'border-red-400 focus:ring-red-400' : 'border-slate-300'} ${className ?? ''}`}
      countrySelectorStyleProps={{ buttonClassName: `border border-slate-300 rounded-l-lg px-2 h-full ${hasError ? 'border-red-400' : ''}` }}
      required={required}
    />
  )
}
