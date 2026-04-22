export function TextField({ field, value, onChange, error }) {
  return (
    <div>
      <label className="label">
        {field.label}
        {field.required && <span className="text-remed-red ml-1">*</span>}
      </label>
      <input
        type="text"
        className={`input ${error ? 'border-remed-red' : ''}`}
        value={value || ''}
        onChange={e => onChange(field.id, e.target.value)}
        placeholder={field.placeholder || ''}
      />
      {error && <p className="text-remed-red text-xs mt-1">{error}</p>}
    </div>
  )
}

export function TextareaField({ field, value, onChange, error }) {
  return (
    <div>
      <label className="label">
        {field.label}
        {field.required && <span className="text-remed-red ml-1">*</span>}
      </label>
      <textarea
        rows={4}
        className={`input resize-none ${error ? 'border-remed-red' : ''}`}
        value={value || ''}
        onChange={e => onChange(field.id, e.target.value)}
        placeholder={field.placeholder || ''}
      />
      {error && <p className="text-remed-red text-xs mt-1">{error}</p>}
    </div>
  )
}

export function RadioField({ field, value, onChange, error }) {
  return (
    <div>
      <label className="label">
        {field.label}
        {field.required && <span className="text-remed-red ml-1">*</span>}
      </label>
      <div className="flex flex-wrap gap-2 mt-1">
        {(field.options || []).map(opt => (
          <label
            key={opt}
            className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer text-sm transition-all select-none ${
              value === opt
                ? 'border-remed-red bg-red-50 text-remed-red font-medium'
                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
            }`}
          >
            <input
              type="radio"
              name={field.id}
              value={opt}
              checked={value === opt}
              onChange={() => onChange(field.id, opt)}
              className="sr-only"
            />
            {opt}
          </label>
        ))}
      </div>
      {error && <p className="text-remed-red text-xs mt-1">{error}</p>}
    </div>
  )
}

export function DropdownField({ field, value, onChange, error }) {
  return (
    <div>
      <label className="label">
        {field.label}
        {field.required && <span className="text-remed-red ml-1">*</span>}
      </label>
      <select
        className={`input ${error ? 'border-remed-red' : ''}`}
        value={value || ''}
        onChange={e => onChange(field.id, e.target.value)}
      >
        <option value="">— Select —</option>
        {(field.options || []).map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      {error && <p className="text-remed-red text-xs mt-1">{error}</p>}
    </div>
  )
}

export function CheckboxField({ field, value, onChange, error }) {
  const selected = Array.isArray(value) ? value : []
  const toggle = (opt) => {
    const next = selected.includes(opt)
      ? selected.filter(v => v !== opt)
      : [...selected, opt]
    onChange(field.id, next)
  }
  return (
    <div>
      <label className="label">
        {field.label}
        {field.required && <span className="text-remed-red ml-1">*</span>}
      </label>
      <div className="flex flex-wrap gap-2 mt-1">
        {(field.options || []).map(opt => (
          <label
            key={opt}
            className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer text-sm transition-all select-none ${
              selected.includes(opt)
                ? 'border-remed-red bg-red-50 text-remed-red font-medium'
                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
            }`}
          >
            <input
              type="checkbox"
              checked={selected.includes(opt)}
              onChange={() => toggle(opt)}
              className="sr-only"
            />
            <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${selected.includes(opt) ? 'bg-remed-red border-remed-red' : 'border-gray-400'}`}>
              {selected.includes(opt) && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
            {opt}
          </label>
        ))}
      </div>
      {error && <p className="text-remed-red text-xs mt-1">{error}</p>}
    </div>
  )
}

export function DateTimeField({ field, value, onChange, error }) {
  return (
    <div>
      <label className="label">
        {field.label}
        {field.required && <span className="text-remed-red ml-1">*</span>}
      </label>
      <input
        type="datetime-local"
        className={`input ${error ? 'border-remed-red' : ''}`}
        value={value || ''}
        onChange={e => onChange(field.id, e.target.value)}
      />
      {error && <p className="text-remed-red text-xs mt-1">{error}</p>}
    </div>
  )
}

export function FileField({ field, value, onChange, error }) {
  return (
    <div>
      <label className="label">
        {field.label}
        {field.required && <span className="text-remed-red ml-1">*</span>}
      </label>
      <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${error ? 'border-remed-red' : 'border-gray-300 hover:border-remed-red'}`}>
        <input
          type="file"
          id={field.id}
          className="sr-only"
          accept="image/*,.pdf,.csv,.xlsx,.txt,.log"
          onChange={e => onChange(field.id, e.target.files[0])}
        />
        <label htmlFor={field.id} className="cursor-pointer flex flex-col items-center gap-2">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          {value ? (
            <span className="text-sm text-remed-red font-medium">{value.name}</span>
          ) : (
            <span className="text-sm text-gray-500">Click to upload or drag and drop</span>
          )}
          <span className="text-xs text-gray-400">Images, PDF, CSV, Excel, Log files (max 20MB)</span>
        </label>
      </div>
      {error && <p className="text-remed-red text-xs mt-1">{error}</p>}
    </div>
  )
}
