// Password validation rules
const passwordRules = {
  minLength: 8,
  patterns: {
    uppercase: /[A-Z]/,
    lowercase: /[a-z]/,
    number: /[0-9]/,
    special: /[@$!%*?&]/
  }
};

/**
 * Validates a password against security requirements
 * @param {string} password - The password to validate
 * @returns {Object} - Validation result with isValid flag and error message
 */
export const validatePassword = (password) => {
  if (!password) {
    return { isValid: false, message: 'Password is required' };
  }

  if (password.length < passwordRules.minLength) {
    return { 
      isValid: false, 
      message: `Password must be at least ${passwordRules.minLength} characters long` 
    };
  }

  const validations = [
    { rule: 'uppercase', message: 'Password must contain at least one uppercase letter' },
    { rule: 'lowercase', message: 'Password must contain at least one lowercase letter' },
    { rule: 'number', message: 'Password must contain at least one number' },
    { rule: 'special', message: 'Password must contain at least one special character' }
  ];

  for (const validation of validations) {
    if (!passwordRules.patterns[validation.rule].test(password)) {
      return { isValid: false, message: validation.message };
    }
  }

  return { isValid: true };
};

// Export rules for client-side validation
export const getPasswordRules = () => ({
  minLength: passwordRules.minLength,
  patterns: {
    uppercase: passwordRules.patterns.uppercase.source,
    lowercase: passwordRules.patterns.lowercase.source,
    number: passwordRules.patterns.number.source,
    special: passwordRules.patterns.special.source
  }
}); 