export default function UnauthorizedPage() {
  return (
    <div className='bg-background flex min-h-screen flex-col items-center justify-center px-6 py-12'>
      <div className='bg-card w-full max-w-md space-y-6 rounded-xl border p-10 text-center shadow-sm'>
        <h1 className='text-3xl font-semibold tracking-tight'>Access denied</h1>
        <p className='text-muted-foreground text-sm'>
          You don&apos;t have permission to access this page.
        </p>
        <a
          href='/sign-in'
          className='text-primary text-sm font-medium underline'
        >
          Sign in with a different account
        </a>
      </div>
    </div>
  )
}
