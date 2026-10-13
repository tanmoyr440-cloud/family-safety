import * as React from "react";
import { useParams } from "react-router-dom";
import { usePublicPacketInfo } from "../api/usePublicPacketInfo";
import { usePublicPacketSession } from "../api/usePublicPacketSession";
import { PublicPacketLayout } from "../components/PublicPacketLayout";
import { PublicPacketOtpPrompt } from "../components/PublicPacketOtpPrompt";
import { PublicPacketContent } from "../components/PublicPacketContent";
import { SessionExpiredModal } from "../components/SessionExpiredModal";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/Card";
import { Skeleton } from "@/shared/ui/Skeleton";
import { ShieldX } from "lucide-react";

export interface PublicPacketPageProps {
  tokenOverride?: string;
}

export const PublicPacketPage: React.FC<PublicPacketPageProps> = ({ tokenOverride }) => {
  const params = useParams<{ token: string }>();
  const token = tokenOverride ?? params.token ?? "";
  const [sessionToken, setSessionToken] = React.useState<string | null>(null);

  // Set noindex meta tag dynamically
  React.useEffect(() => {
    let metaRobots = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    const created = !metaRobots;
    if (!metaRobots) {
      metaRobots = document.createElement("meta");
      metaRobots.name = "robots";
      document.head.appendChild(metaRobots);
    }
    const prevContent = metaRobots.content;
    metaRobots.content = "noindex, nofollow";

    return () => {
      if (metaRobots) {
        if (created) {
          document.head.removeChild(metaRobots);
        } else {
          metaRobots.content = prevContent;
        }
      }
    };
  }, []);

  const {
    data: info,
    isLoading: isInfoLoading,
    error: infoError,
  } = usePublicPacketInfo(token || "");

  const {
    data: sessionData,
    isLoading: isSessionLoading,
    error: sessionError,
  } = usePublicPacketSession(sessionToken);

  const isSessionExpired = Boolean(
    sessionError &&
    (sessionError.message.toLowerCase().includes("expired") ||
      (sessionError as { status?: number }).status === 401 ||
      (sessionError as { code?: string }).code === "UNAUTHORIZED" ||
      (sessionError as { code?: string }).code === "SESSION_EXPIRED"),
  );

  return (
    <PublicPacketLayout>
      {/* 1. Loading Initial Token Info */}
      {isInfoLoading && (
        <div className="max-w-lg mx-auto space-y-4" aria-label="Loading packet">
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      )}

      {/* 2. Token Error States (Invalid / Expired) */}
      {!isInfoLoading && infoError && (
        <Card className="border-red-200 bg-red-50/40 max-w-lg mx-auto shadow-sm">
          <CardHeader className="text-center pb-3">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mb-2">
              <ShieldX className="h-6 w-6" aria-hidden="true" />
            </div>
            <CardTitle className="text-lg font-bold text-red-950">
              Unable to Access Emergency Packet
            </CardTitle>
            <CardDescription className="text-xs text-red-800 mt-1">
              {infoError.message.toLowerCase().includes("expired") ||
              (infoError as { code?: string }).code === "TOKEN_EXPIRED"
                ? "This emergency packet link has expired."
                : "This emergency packet link is invalid or has been revoked."}
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 pt-0 text-center space-y-3 text-xs text-red-900 leading-relaxed">
            <p>
              Emergency packet links are strictly time-limited and single-use for security. Please
              try contacting family members directly by phone.
            </p>
          </CardContent>
        </Card>
      )}

      {/* 3. Token Info Valid & Pre-Verification (OTP Step) */}
      {!isInfoLoading && !infoError && info && !sessionToken && (
        <PublicPacketOtpPrompt
          token={token || ""}
          ownerName={info.owner_name}
          recipientPhoneMasked={info.recipient_phone_masked}
          onVerified={(newSessionToken) => {
            setSessionToken(newSessionToken);
          }}
        />
      )}

      {/* 4. Session Loading Skeletons */}
      {sessionToken && isSessionLoading && (
        <div className="space-y-4" aria-label="Loading verified packet">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-36 w-full rounded-2xl" />
        </div>
      )}

      {/* 5. Session Data Loaded: Packet Contents */}
      {sessionToken && !isSessionLoading && sessionData && (
        <PublicPacketContent sessionToken={sessionToken} packet={sessionData} />
      )}

      {/* 6. Session Expired Mid-Read Modal */}
      {token && (
        <SessionExpiredModal
          token={token}
          isOpen={isSessionExpired}
          maskedPhone={info?.recipient_phone_masked}
          onReverified={(newSessionToken) => {
            setSessionToken(newSessionToken);
          }}
        />
      )}
    </PublicPacketLayout>
  );
};
