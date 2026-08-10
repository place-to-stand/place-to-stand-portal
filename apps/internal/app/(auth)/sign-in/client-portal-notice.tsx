import { ExternalLink } from "lucide-react";

type Props = {
  clientPortalUrl: string;
};

export function ClientPortalNotice({ clientPortalUrl }: Props) {
  return (
    <div className="space-y-2 rounded-md border bg-muted/50 p-3 text-sm">
      <p>
        This account is for the client portal, which has its own sign-in page.
      </p>
      <a
        href={clientPortalUrl}
        className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
      >
        Go to the client portal
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      </a>
    </div>
  );
}
