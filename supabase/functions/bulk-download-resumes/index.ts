import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.24.2";
import { downloadZip, InputFile } from "https://esm.sh/client-zip@2.4.4";
import { parseJsonBody } from "../_shared/validation.ts";

const bulkDownloadSchema = z
  .object({
    eventId: z.string().uuid("eventId must be a valid UUID"),
    token: z.string().min(1, "token is required"),
  })
  .strict();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const parsed = await parseJsonBody(bulkDownloadSchema, req);
    if (!parsed.ok) return parsed.response;
    const { eventId, token } = parsed.data;

    // 1. Verify Sponsor Token
    const { data: sponsorData, error: sponsorError } = await supabase
      .from("event_sponsors")
      .select("*")
      .eq("event_id", eventId)
      .eq("access_token", token)
      .single();

    if (sponsorError || !sponsorData) {
      return new Response(JSON.stringify({ error: "Invalid sponsor token" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(sponsorData.valid_until) < new Date()) {
      return new Response(JSON.stringify({ error: "Sponsor token expired" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch the event info
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, title")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Fetch all RSVPs with resumes
    const { data: rsvps, error: rsvpsError } = await supabase
      .from("event_rsvps")
      .select(`
        resume_path,
        profiles!inner (
          full_name,
          email
        )
      `)
      .eq("event_id", eventId)
      .not("resume_path", "is", null);

    if (rsvpsError) {
      throw rsvpsError;
    }

    if (!rsvps || rsvps.length === 0) {
      return new Response(JSON.stringify({ error: "No resumes found for this event." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Generator function to fetch file streams sequentially on-demand
    async function* getFilesStream() {
      const bucketName = "resumes";
      for (const rsvp of rsvps) {
        const filePath = (rsvp as any).resume_path;
        if (!filePath) continue;
        
        // Use authenticated URL with service role since bucket is private
        const fileUrl = `${supabaseUrl}/storage/v1/object/authenticated/${bucketName}/${filePath}`;

        const res = await fetch(fileUrl, {
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
        });

        if (!res.ok) {
          console.error(`Failed to stream resume: ${filePath}`);
          continue; // Skip failing files instead of crashing whole zip
        }

        const profile = (rsvp as any).profiles;
        const name = profile?.full_name ? profile.full_name.replace(/[^a-z0-9]/gi, '_') : "Unknown";
        const fileExt = filePath.split('.').pop() || 'pdf';
        const finalName = `${name}_Resume.${fileExt}`;

        const input: InputFile = {
          name: finalName,
          lastModified: new Date(),
          input: res.body!,
        };

        yield input;
      }
    }

    // Stream-compress all files to zip on-the-fly
    const zipResponse = downloadZip(getFilesStream());

    // Sanitize event title to build a valid filename
    const safeTitle = event.title.replace(/[^a-z0-9]+/gi, "_");
    const zipFilename = `${safeTitle}_Resumes.zip`;

    const responseHeaders = new Headers(corsHeaders);
    responseHeaders.set("Content-Type", "application/zip");
    responseHeaders.set("Content-Disposition", `attachment; filename="${zipFilename}"`);
    
    // NOTE: For client-side React code parsing JSON, returning a binary stream directly 
    // requires the client to handle the blob correctly.
    // However, if the client called `invoke` with `supabase.functions.invoke`, 
    // supabase-js might expect JSON by default unless configured otherwise.
    // But returning the binary directly is best practice for large zips.

    return new Response(zipResponse.body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Internal Bulk Download Error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred generating zip archive." }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
