import type { FormRule } from 'antd'

// Mêmes règles que le serveur (newPasswordSchema) : on évite un aller-retour pour rien
export const newPasswordRules: FormRule[] = [
  { required: true, message: 'Saisissez un mot de passe' },
  { min: 8, message: '8 caractères minimum' },
  {
    // bcrypt ignore tout ce qui dépasse 72 octets (un accent compte pour 2)
    validator: (_, value?: string) =>
      !value || new TextEncoder().encode(value).length <= 72
        ? Promise.resolve()
        : Promise.reject(new Error('Mot de passe trop long')),
  },
]

/** Le champ de confirmation doit être identique au champ `field`. */
export function confirmPasswordRules(field: string): FormRule[] {
  return [
    { required: true, message: 'Confirmez le mot de passe' },
    ({ getFieldValue }) => ({
      validator(_, value) {
        return !value || getFieldValue(field) === value
          ? Promise.resolve()
          : Promise.reject(new Error('Les mots de passe ne correspondent pas'))
      },
    }),
  ]
}
