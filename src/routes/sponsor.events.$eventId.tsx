import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { FileDown, Download, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const Route = createFileRoute("/sponsor/events/$eventId")({
  component: SponsorEventPortal,
});

function SponsorEventPortal() {
  const { eventId } = Route.useParams();
  const searchParams = useSearch({ from: "/sponsor/events/$eventId" }) as { token?: string };
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(
    searchParams.token || sessionStorage.getItem(`sponsor_token_${eventId}`),
  );

  const [loading, setLoading] = useState(true);
  const [sponsor, setSponsor] = useState<any>(null);
  const [event, setEvent] = useState<any>(null);
  const [rsvps, setRsvps] = useState<any[]>([]);
  const [downloading, setDownloading] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    if (searchParams.token) {
      sessionStorage.setItem(`sponsor_token_${eventId}`, searchParams.token);
      // Clean up URL
      navigate({ to: `/sponsor/events/${eventId}`, replace: true });
    }
  }, [searchParams.token, eventId, navigate]);

  useEffect(() => {
    async function loadData() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        // Verify sponsor token
        const { data: sponsorData, error: sponsorError } = await supabase
          .from("event_sponsors")
          .select("*")
          .eq("event_id", eventId)
          .eq("access_token", token)
          .single();

        if (sponsorError || !sponsorData) {
          throw new Error("Invalid or expired access token.");
        }

        if (new Date(sponsorData.valid_until) < new Date()) {
          throw new Error("This access token has expired.");
        }

        setSponsor(sponsorData);

        // Fetch event info
        const { data: eventData } = await supabase
          .from("events")
          .select("title, start_date")
          .eq("id", eventId)
          .single();

        setEvent(eventData);

        // Fetch RSVPs with resumes
        const { data: rsvpData, error: rsvpError } = await supabase
          .from("event_rsvps")
          .select(
            `
            resume_path,
            profiles (
              id,
              full_name,
              avatar_url,
              email
            )
          `,
          )
          .eq("event_id", eventId)
          .not("resume_path", "is", null);

        if (rsvpError) throw rsvpError;
        setRsvps(rsvpData || []);
      } catch (err: any) {
        toast.error(err.message);
        setSponsor(null);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [eventId, token]);

  const handleBulkDownload = async () => {
    try {
      setDownloading(true);

      // If the edge function returns a Blob directly (binary zip data):
      // The supabase-js client can return a Blob if it detects the content-type,
      // but to be safe we can use the fetch API with the supabase anon key.

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bulk-download-resumes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ eventId, token }),
        },
      );

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to download zip");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // Extract filename from Content-Disposition if present
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = "resumes.zip";
      if (contentDisposition) {
        const matches = /filename="([^"]+)"/.exec(contentDisposition);
        if (matches != null && matches[1]) {
          filename = matches[1];
        }
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Download started!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to download resumes.");
    } finally {
      setDownloading(false);
    }
  };

  const handleSingleDownload = async (path: string, name: string) => {
    try {
      // In a real implementation, we would use the token to bypass RLS,
      // but Supabase storage relies on user auth or signed URLs.
      // The edge function should probably handle single downloads too,
      // or we can generate a signed URL if the sponsor has an actual DB role.
      // Assuming the edge function will handle generating a zip of one file if we pass user_id.
      // For simplicity, we just trigger bulk download for now, or alert that individual download is coming.
      toast.info("Single download requires signed URLs. Use Bulk Download for now.");
    } catch (err: any) {
      toast.error("Failed to download.");
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Loading portal...</div>;
  }

  if (!sponsor) {
    return (
      <div className="flex h-screen items-center justify-center bg-cream p-4">
        <div className="neu-border max-w-md bg-white p-8 text-center shadow-lg">
          <h1 className="mb-2 text-2xl font-bold uppercase">Access Denied</h1>
          <p className="text-muted-foreground">
            You need a valid sponsor access link to view this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="neu-border bg-white p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold uppercase tracking-tight">Sponsor Portal</h1>
            <p className="text-muted-foreground font-mono mt-1">
              {sponsor.company_name} · {event?.title}
            </p>
          </div>
          <Button
            size="lg"
            variant="primary"
            onClick={handleBulkDownload}
            disabled={downloading || rsvps.length === 0}
            className="w-full md:w-auto neu-border font-bold uppercase tracking-wider transition-all hover:scale-105 active:scale-95"
          >
            {downloading ? (
              "Preparing ZIP..."
            ) : (
              <>
                <FileDown className="mr-2 h-5 w-5" />
                Download All Resumes ({rsvps.length})
              </>
            )}
          </Button>
        </header>

        <div className="neu-border bg-white overflow-hidden">
          <div className="border-b-2 border-black bg-muted/30 p-4 font-mono font-bold uppercase text-muted-foreground text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Attendees with Resumes
            </div>
            <span>{rsvps.length} Total</span>
          </div>

          <div className="divide-y-2 divide-black">
            {rsvps.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground font-mono">
                No resumes have been submitted yet.
              </div>
            ) : (
              rsvps.map((rsvp, idx) => (
                <div
                  key={idx}
                  className="p-4 flex items-center justify-between hover:bg-muted/10 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <Avatar className="h-10 w-10 border-2 border-black">
                      <AvatarImage src={rsvp.profiles?.avatar_url || ""} />
                      <AvatarFallback className="font-bold">
                        {rsvp.profiles?.full_name?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-bold">{rsvp.profiles?.full_name || "Unknown Attendee"}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {rsvp.profiles?.email}
                      </p>
                    </div>
                  </div>
                  {/* We disable individual downloads unless implemented via Edge Function */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="neu-border"
                    onClick={() => handleSingleDownload(rsvp.resume_path, rsvp.profiles?.full_name)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
