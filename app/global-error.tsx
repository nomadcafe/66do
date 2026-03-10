'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-50 flex flex-col items-center justify-center px-4 antialiased">
        <h1 className="text-4xl font-bold text-stone-800 mt-4">
          Something went wrong
        </h1>
        <p className="text-stone-600 mt-2 text-center max-w-md">
          An unexpected error occurred. Please try again or go back to the home page.
        </p>
        <div className="mt-8 flex gap-4">
          <button
            type="button"
            onClick={() => reset()}
            className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            Retry
          </button>
          <a
            href="/"
            className="px-6 py-3 border border-stone-300 text-stone-700 rounded-lg hover:bg-stone-100 transition-colors"
          >
            Back to home
          </a>
        </div>
      </body>
    </html>
  );
}
