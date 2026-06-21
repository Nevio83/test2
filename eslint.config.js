// ESLint Flat Config (ESLint 9+).
// Fokus: echte Bugs fangen (z. B. doppelte Object-Keys — genau so ein Bug hatte
// einmal die Bestell-Metadaten überschrieben), ohne den Legacy-Code mit Stil-/
// Umgebungs-Rauschen zu überfluten.
const js = require('@eslint/js');

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'Marketing/**',
      'graphify-out/**',
      '**/*.min.js'
    ]
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      // Code läuft teils in Node (Backend), teils im Browser (Frontend) —
      // daher Umgebungs-Checks aus, damit `no-undef` keine Falschmeldungen wirft.
      sourceType: 'commonjs'
    },
    rules: {
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-duplicate-case': 'error',
      'no-unreachable': 'error',
      'no-cond-assign': 'error',
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-empty': 'warn',
      'no-constant-condition': ['warn', { checkLoops: false }]
    }
  }
];
