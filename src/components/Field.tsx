export function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
  className,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number | null;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="label" htmlFor={name}>{label}{required && " *"}</label>
      <input id={name} name={name} type={type} required={required} defaultValue={defaultValue ?? ""} className="input" />
    </div>
  );
}

export function SelectField({
  label,
  name,
  options,
  defaultValue,
  empty,
  required,
  className,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string | null;
  empty?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="label" htmlFor={name}>{label}{required && " *"}</label>
      <select id={name} name={name} defaultValue={defaultValue ?? ""} required={required} className="input">
        {empty !== undefined && <option value="">{empty}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function Check({ label, name, defaultChecked }: { label: string; name: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} /> {label}
    </label>
  );
}
