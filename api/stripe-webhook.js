const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2022-11-15" });

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers["stripe-signature"];

  if (!webhookSecret || !signature) {
    return res.status(400).json({ error: "Webhook signature not configured." });
  }

  try {
    const rawBody = await getRawBody(req);
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        console.log("Stripe webhook: checkout session completed", session.id, session.customer_email);
        break;
      }
      default:
        console.log("Stripe webhook received event:", event.type);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Webhook error", error);
    res.status(400).json({ error: error.message });
  }
};
