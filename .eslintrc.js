module.exports = {
  root: true,
  extends: [
    '@react-native',
  ],
  rules: {
    'react-native/no-inline-styles': 'off',
    'react-hooks/exhaustive-deps': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'prefer-const': 'warn',
    'no-shadow': 'off',
    '@typescript-eslint/no-shadow': ['error'],
  },
  ignorePatterns: [
    'node_modules/',
    'android/',
    'ios/',
    '.bundle/',
    'vendor/',
    'coverage/',
    '*.config.js',
    '.eslintrc.js',
  ],
};