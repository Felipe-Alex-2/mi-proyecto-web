import { FormControl, Validators } from '@angular/forms';
import { noWhitespaceValidator, trimmedMinLength } from './custom-validators';

describe('Required text validations', () => {
  it('rejects whitespace and applies minimum length after trimming', () => {
    const control = new FormControl('', [Validators.required, noWhitespaceValidator(), trimmedMinLength(2)]);
    for (const value of ['', ' ', '\t\n', ' a ']) {
      control.setValue(value); expect(control.valid).toBe(false);
    }
    control.setValue(' Ana '); expect(control.valid).toBe(true);
  });
});
