import { TextField, TextareaField, RadioField, DropdownField, CheckboxField, DateTimeField, FileField } from './fields'

function shouldShow(field, sectionValues) {
  if (!field.condition) return true
  return sectionValues[field.condition.field] === field.condition.value
}

export default function FormStep({ section, values, onChange, errors }) {
  const renderField = (field) => {
    if (!shouldShow(field, values)) return null

    const value = values[field.id]
    const error = errors?.[field.id]
    const props = { field, value, onChange, error }

    switch (field.type) {
      case 'text': return <TextField key={field.id} {...props} />
      case 'textarea': return <TextareaField key={field.id} {...props} />
      case 'radio': return <RadioField key={field.id} {...props} />
      case 'dropdown': return <DropdownField key={field.id} {...props} />
      case 'checkbox': return <CheckboxField key={field.id} {...props} />
      case 'datetime': return <DateTimeField key={field.id} {...props} />
      case 'file': return <FileField key={field.id} {...props} />
      default: return null
    }
  }

  return (
    <div className="space-y-6">
      {section.fields.map(field => (
        <div key={field.id}>
          {renderField(field)}
        </div>
      ))}
    </div>
  )
}
