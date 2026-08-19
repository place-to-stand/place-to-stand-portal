import { ExternalLink } from "lucide-react";

import { authLinkClass, authNoticeClass } from "@pts/ui/auth-shell";

type Props = {
  clientPortalUrl: string;
};

export function ClientPortalNotice({ clientPortalUrl }: Props) {
  return (
    <div className={`space-y-2 ${authNoticeClass}`}>
      <p>
        This account is for the client portal, which has its own sign-in page.
      </p>
      <a
        href={clientPortalUrl}
        className={`inline-flex items-center gap-1.5 ${authLinkClass}`}
      >
        Go to the client portal
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      </a>
    </div>
  );
}
