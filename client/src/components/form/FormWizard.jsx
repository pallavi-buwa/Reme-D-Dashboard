import { useState } from 'react'
import FormStep from './FormStep'

export default function FormWizard({ schema, onSubmit, submitting }) {
  const sections = schema.sections
  const [step, setStep] = useState(0)
  const [formData, setFormData] = useState(() =>
    Object.fromEntries(sections.map(s => [s.name, {}]))
  )
  const [errors, setErrors] = useState({})

  const currentSection = sections[step]
  const currentValues = formData[currentSection.name]

  function handleChange(fieldId, value) {
    setFormData(prev => ({
      ...prev,
      [currentSection.name]: { ...prev[currentSection.name], [fieldId]: value },
    }))
    setErrors(prev => ({ ...prev, [fieldId]: undefined }))
  }

  function validate() {
    const errs = {}
    for (const field of currentSection.fields) {
      if (!field.required) continue
      // Skip conditional fields that aren't visible
      if (field.condition && currentValues[field.condition.field] !== field.condition.value) continue
      const val = currentValues[field.id]
      if (!val || (Array.isArray(val) && !val.length)) {
        errs[field.id] = 'This field is required'
      }
    }
    return errs
  }

  function handleNext() {
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setStep(s => s + 1)
  }

  function handleBack() {
    setErrors({})
    setStep(s => s - 1)
  }

  function handleSubmit() {
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    onSubmit(formData)
  }

  const isLast = step === sections.length - 1
  const progress = ((step) / sections.length) * 100

  return (
    <div>
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Step {step + 1} of {sections.length}</span>
          <span>{currentSection.name}</span>
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-remed-red rounded-full transition-all duration-300"
            style={{ width: `${((step + 1) / sections.length) * 100}%` }}
          />
        </div>
        {/* Step dots */}
        <div className="flex gap-1.5 mt-3 justify-center">
          {sections.map((s, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i < step ? 'bg-green-500 w-4' : i === step ? 'bg-remed-red w-6' : 'bg-gray-200 w-4'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Section header */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">{currentSection.name}</h2>
        <p className="text-sm text-gray-500 mt-0.5">Complete all required fields below</p>
      </div>

      {/* Fields */}
      <FormStep
        section={currentSection}
        values={currentValues}
        onChange={handleChange}
        errors={errors}
      />

      {/* Navigation */}
      <div className="flex justify-between mt-8 pt-6 border-t border-gray-100">
        <button
          type="button"
          onClick={handleBack}
          disabled={step === 0}
          className="btn-secondary"
        >
          ← Back
        </button>

        {isLast ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-primary px-6"
          >
            {submitting ? 'Submitting…' : 'Submit Report →'}
          </button>
        ) : (
          <button type="button" onClick={handleNext} className="btn-primary">
            Next →
          </button>
        )}
      </div>
    </div>
  )
}
