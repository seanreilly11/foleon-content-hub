const REQUIRED_ENV_VARS = ['OPENAI_API_KEY'] as const;

export function validateEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error('');
    console.error('❌ Missing required environment variables:');
    missing.forEach((key) => console.error(`   - ${key}`));
    console.error('');
    console.error('Copy .env.example to .env and fill in the values.');
    console.error('');
    process.exit(1);
  }
}

/** Typed, centralised access to environment variables. Import from here — never read process.env directly in app code. */
export const env = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY as string,
  ADMIN_KEY: process.env.ADMIN_KEY,
} as const;
