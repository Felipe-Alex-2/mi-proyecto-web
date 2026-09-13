import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Validador que rechaza campos que contengan únicamente espacios en blanco.
 */
export function noWhitespaceValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) {
      return null; // Deja que Validators.required maneje el valor nulo o vacío
    }
    const isWhitespace = (control.value || '').toString().trim().length === 0;
    return isWhitespace ? { whitespace: true } : null;
  };
}

/**
 * Validador estricto de seguridad de contraseñas:
 * - Mínimo 8 caracteres
 * - Al menos 1 mayúscula
 * - Al menos 1 minúscula
 * - Al menos 1 número
 * - Al menos 1 símbolo
 */
export function passwordStrengthValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value: string = control.value || '';
    if (!value) {
      return null;
    }

    const hasMinLength = value.length >= 8;
    const hasUpperCase = /[A-Z]/.test(value);
    const hasLowerCase = /[a-z]/.test(value);
    const hasNumeric = /[0-9]/.test(value);
    const hasSymbol = /[^A-Za-z0-9\s]/.test(value);

    const valid = hasMinLength && hasUpperCase && hasLowerCase && hasNumeric && hasSymbol;

    if (!valid) {
      return {
        passwordStrength: {
          hasMinLength,
          hasUpperCase,
          hasLowerCase,
          hasNumeric,
          hasSymbol,
        },
      };
    }

    return null;
  };
}
