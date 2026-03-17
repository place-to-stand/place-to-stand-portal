export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
        <p className="mt-2 text-sm text-foreground/60">
          You don&apos;t have permission to access this page.
        </p>
        <a
          href="/sign-in"
          className="mt-4 inline-block text-sm underline hover:text-foreground"
        >
          Sign in with a different account
        </a>
      </div>
    </div>
  )
}
