module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'prettier'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  rules: {
    'prettier/prettier': 'error',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'error',
    // require() for image assets is standard in React Native (Metro bundler pattern)
    '@typescript-eslint/no-var-requires': 'off',
  },
  env: {
    es2022: true,
    node: true,
  },
  ignorePatterns: [
    'node_modules/',
    '.expo/',
    'dist/',
    'android/',
    'ios/',
    'babel.config.js',
    'metro.config.js',
  ],
  overrides: [
    {
      // CRITICAL BOUNDARY: src/core must stay pure TypeScript — no native imports.
      files: ['src/core/**/*.ts', 'src/core/**/*.tsx'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: [
                  'react-native',
                  'react-native/*',
                  '@react-native/*',
                  'react-native-*',
                  '@shopify/react-native-skia',
                  '@shopify/react-native-skia/*',
                  'expo',
                  'expo/*',
                  'expo-*',
                ],
                message:
                  'Native and Expo imports are forbidden inside src/core. This layer must stay pure TypeScript (no device, no renderer).',
              },
            ],
          },
        ],
      },
    },
  ],
};
