
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  email: string;
  name: string;
  orderId: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Received request to send email");
    const { email, name, orderId }: RequestBody = await req.json();
    
    console.log("Email details:", { email, name, orderId });

    if (!email) {
      throw new Error("Email address is required");
    }

    const subject = "Your laundry order has been completed!";
    const html = `
      <h2>Hi ${name || "Student"},</h2>
      <p>Your laundry order <b>#${orderId.slice(0, 8)}</b> has just been marked as <b>completed</b> by the worker and is ready for pickup/delivery.</p>
      <p>If you have questions, please contact the laundry support team.</p>
      <br/><p>Thanks,<br/>CleanWash</p>
    `;
    const fromEmail = "CleanWash <onboarding@resend.dev>";

    console.log("Sending email with resend");
    const response = await resend.emails.send({
      from: fromEmail,
      to: [email],
      subject,
      html,
    });

    console.log("Email sent response:", response);

    return new Response(JSON.stringify({ success: true, response }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  } catch (error: any) {
    console.error("Error sending order completion email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      }
    );
  }
});
