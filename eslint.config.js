export default [
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        fetch: 'readonly',
        console: 'readonly',
        URL: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': 'off',
      'no-undef': 'off',
      'no-empty': 'off'
    }
  }
];