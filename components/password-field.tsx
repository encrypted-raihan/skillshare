'use client'

import { useState } from 'react'
import { Eye, EyeOff, LockKeyhole } from 'lucide-react'

export function PasswordField({
  name = 'password',
  label = 'Password',
  autoComplete = 'new-password',
  value,
  onChange,
}: {
  name?: string
  label?: string
  autoComplete?: string
  value: string
  onChange: (value: string) => void
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="premium-field-wrap">
      <span className="premium-field-label">{label}</span>
      <div style={{ position: 'relative' }}>
        <LockKeyhole
          size={16}
          style={{ position: 'absolute', left: 14, top: 16, color: '#879189' }}
          aria-hidden
        />
        <input
          className="premium-field standalone"
          style={{ paddingLeft: 40, paddingRight: 44 }}
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          minLength={8}
          required
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          style={{
            position: 'absolute',
            right: 8,
            top: 8,
            width: 32,
            height: 32,
            display: 'grid',
            placeItems: 'center',
            border: 0,
            borderRadius: 10,
            background: 'transparent',
            color: '#647067',
          }}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      <span className="help">Use at least 8 characters.</span>
    </div>
  )
}
