import Field from "./Field";

export type AccountValues = { name: string; email: string; pin: string };
export type FieldErrors = Partial<Record<"name" | "email" | "pin", string>>;

/** Name, email and PIN inputs shared by the join and create-group screens. */
export default function AccountFields({
  values,
  errors,
  onChange,
}: {
  values: AccountValues;
  errors: FieldErrors;
  onChange: (patch: Partial<AccountValues>) => void;
}) {
  return (
    <>
      <Field
        id="nombre"
        label="Tu nombre"
        type="text"
        autoComplete="name"
        placeholder="Como te conoce la familia"
        maxLength={60}
        value={values.name}
        onChange={(e) => onChange({ name: e.target.value })}
        error={errors.name}
      />
      <Field
        id="correo"
        label="Correo electrónico"
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder="tucorreo@ejemplo.com"
        value={values.email}
        onChange={(e) => onChange({ email: e.target.value })}
        error={errors.email}
      />
      <Field
        id="pin"
        label="PIN o contraseña"
        type="password"
        autoComplete="new-password"
        placeholder="Mínimo 4 caracteres"
        hint="Con esto abres tu cuenta en cualquier celular. Si lo olvidas, quien organiza puede restablecerlo."
        value={values.pin}
        onChange={(e) => onChange({ pin: e.target.value })}
        error={errors.pin}
      />
    </>
  );
}
