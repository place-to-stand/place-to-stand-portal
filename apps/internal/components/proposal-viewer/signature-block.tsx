import Image from 'next/image'

export type SignatureBlockProps = {
  signerName?: string | null
  signerEmail?: string | null
  signatureData?: string | null
  acceptedAt?: string | null
  countersignerName?: string | null
  countersignerEmail?: string | null
  countersignatureData?: string | null
  countersignedAt?: string | null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function SignaturePanel({
  label,
  name,
  email,
  signatureData,
  signedAt,
  awaitingLabel,
}: {
  label: string
  name?: string | null
  email?: string | null
  signatureData?: string | null
  signedAt?: string | null
  awaitingLabel: string
}) {
  const signed = Boolean(signatureData && signedAt)

  return (
    <div className="flex-1 space-y-3 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="h-16 border-b">
        {signed && signatureData ? (
          <Image
            src={signatureData}
            alt={`${name ?? label} signature`}
            width={200}
            height={64}
            className="h-16 w-auto object-contain"
            unoptimized
          />
        ) : (
          <p className="flex h-full items-center text-sm italic text-muted-foreground">
            {awaitingLabel}
          </p>
        )}
      </div>
      <dl className="space-y-1 text-sm">
        <div>
          <dt className="inline font-medium">Name: </dt>
          <dd className="inline text-muted-foreground">{signed ? name ?? 'N/A' : '\u2014'}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Email: </dt>
          <dd className="inline text-muted-foreground">{signed ? email ?? 'N/A' : '\u2014'}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Date: </dt>
          <dd className="inline text-muted-foreground">
            {signed && signedAt ? formatDate(signedAt) : '\u2014'}
          </dd>
        </div>
      </dl>
    </div>
  )
}

export function SignatureBlock({
  signerName,
  signerEmail,
  signatureData,
  acceptedAt,
  countersignerName,
  countersignerEmail,
  countersignatureData,
  countersignedAt,
}: SignatureBlockProps) {
  return (
    <section className="mt-10 space-y-3 print:mt-6">
      <h2 className="text-xl font-semibold">Signatures</h2>
      <div className="flex flex-col divide-y rounded-lg border sm:flex-row sm:divide-x sm:divide-y-0">
        <SignaturePanel
          label="Client"
          name={signerName}
          email={signerEmail}
          signatureData={signatureData}
          signedAt={acceptedAt}
          awaitingLabel="Awaiting signature"
        />
        <SignaturePanel
          label="Place To Stand"
          name={countersignerName}
          email={countersignerEmail}
          signatureData={countersignatureData}
          signedAt={countersignedAt}
          awaitingLabel="Awaiting countersignature"
        />
      </div>
    </section>
  )
}
