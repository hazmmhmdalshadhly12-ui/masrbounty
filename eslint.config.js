const { FlatCompat } = require('@eslint/eslintrc');

const compat = new FlatCompat({ baseDirectory: __dirname });

module.exports = [
  { ignores: ['node_modules/**', '.next/**', 'out/**', 'build/**', 'coverage/**', 'playwright-report/**', 'test-results/**'] },
  ...compat.extends('next/core-web-vitals'),
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'react/no-unescaped-entities': 'off',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
