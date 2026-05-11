// Next.js instrumentation hook — runs once when the server boots.
// https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
//
// We use it to fail-loud on a misconfigured production deploy: if Upstash
// rate-limiting can't initialise, throwing here causes the boot to error
// instead of every magic-link / write request silently sliding through
// unthrottled. See `src/lib/rateLimit.ts` for the corresponding runtime
// fail-closed behaviour.

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { assertRateLimitReadyInProd } = await import('./src/lib/rateLimit')
  assertRateLimitReadyInProd()
}
