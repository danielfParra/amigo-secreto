import Field from "./Field";

export type PinValues = { pin: string; pin2: string };
export type PinErrors = Partial<Record<"pin" | "pin2", string>>;

/** Choose-a-PIN inputs (PIN plus a repeat) shared by the join and create-group screens. */
export default function PinFields({
  values,
  errors,
  onChange,
}: {
  values: PinValues;
  errors: PinErrors;
  onChange: (patch: Partial<PinValues>) => void;
}) {
  return (
    <>
      <Field
        id="pin"
        label="Elige tu PIN o contraseña"
        type="password"
        autoComplete="new-password"
        placeholder="Mínimo 4 caracteres"
        hint="Con esto abres tu cuenta en cualquier celular. Si lo olvidas, quien organiza puede restablecerlo."
        value={values.pin}
        onChange={(e) => onChange({ pin: e.target.value })}
        error={errors.pin}
      />
      <Field
        id="pin2"
        label="Repite tu PIN"
        type="password"
        autoComplete="new-password"
        value={values.pin2}
        onChange={(e) => onChange({ pin2: e.target.value })}
        error={errors.pin2}
      />
    </>
  );
}
