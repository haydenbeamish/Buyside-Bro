const BRAND_GREEN = "#39ff14";
const BRAND_ORANGE = "#f59e0b";

export function marketWrapEmail(params: {
  market: string;
  summaryContent: string;
  date: string;
}): { subject: string; html: string } {
  const { market, summaryContent, date } = params;

  const marketLabels: Record<string, string> = {
    USA: "US Markets",
    ASX: "ASX (Australia)",
    Europe: "European Markets",
  };

  const marketLabel = marketLabels[market] || market;
  const subject = `${marketLabel} Close Wrap - ${date}`;

  const paragraphs = summaryContent
    .split("\n")
    .filter((p) => p.trim())
    .map((p) => `<p style="margin:0 0 12px 0;line-height:1.6;">${p}</p>`)
    .join("");

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#000;font-family:'Courier New',Courier,monospace;color:#e4e4e7;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#000;">
    <tr>
      <td align="center" style="padding:20px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="padding:24px 0;text-align:center;border-bottom:1px solid #27272a;">
              <h1 style="margin:0;font-size:28px;font-weight:700;color:${BRAND_GREEN};letter-spacing:2px;text-transform:uppercase;">
                BUY SIDE BRO
              </h1>
              <p style="margin:8px 0 0;font-size:12px;color:#71717a;letter-spacing:1px;text-transform:uppercase;">
                Market Close Wrap
              </p>
            </td>
          </tr>

          <!-- Market Label -->
          <tr>
            <td style="padding:24px 0 8px;">
              <div style="display:inline-block;background-color:#18181b;border:1px solid #27272a;border-radius:4px;padding:6px 14px;">
                <span style="font-size:13px;color:${BRAND_ORANGE};font-weight:600;letter-spacing:1px;text-transform:uppercase;">
                  ${marketLabel}
                </span>
              </div>
              <span style="font-size:12px;color:#52525b;margin-left:12px;">${date}</span>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:16px 0 24px;font-size:14px;color:#d4d4d8;">
              ${paragraphs}
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:0 0 32px;text-align:center;">
              <a href="https://www.buysidebro.com/dashboard" style="display:inline-block;background-color:${BRAND_GREEN};color:#000;font-weight:700;font-size:13px;padding:12px 28px;border-radius:4px;text-decoration:none;letter-spacing:1px;text-transform:uppercase;">
                VIEW MARKETS
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 0;border-top:1px solid #27272a;text-align:center;">
              <p style="margin:0 0 8px;font-size:11px;color:#52525b;">
                You're receiving this because you opted in to market wrap emails on Buy Side Bro.
              </p>
              <p style="margin:0;font-size:11px;">
                <a href="https://www.buysidebro.com/dashboard" style="color:#71717a;text-decoration:underline;">Manage preferences</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

export function welcomeEmail(params: { firstName?: string }): { subject: string; html: string } {
  const name = params.firstName || "Bro";
  const subject = "Welcome to Buy Side Bro";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#000;font-family:'Courier New',Courier,monospace;color:#e4e4e7;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#000;">
    <tr>
      <td align="center" style="padding:20px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;">
          <tr>
            <td style="padding:24px 0;text-align:center;border-bottom:1px solid #27272a;">
              <h1 style="margin:0;font-size:28px;font-weight:700;color:${BRAND_GREEN};letter-spacing:2px;text-transform:uppercase;">
                BUY SIDE BRO
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 0 16px;">
              <h2 style="margin:0;font-size:20px;color:${BRAND_GREEN};">Hey ${name},</h2>
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 24px;font-size:14px;color:#d4d4d8;line-height:1.7;">
              <p style="margin:0 0 16px;">Welcome to Buy Side Bro - your new favourite markets dashboard.</p>
              <p style="margin:0 0 16px;">Here's what you can do:</p>
              <ul style="margin:0 0 16px;padding-left:20px;">
                <li style="margin-bottom:8px;">Track live global market data across US, ASX, and European markets</li>
                <li style="margin-bottom:8px;">Build your watchlist and portfolio</li>
                <li style="margin-bottom:8px;">Get AI-powered stock analysis</li>
                <li style="margin-bottom:8px;">Chat with Ask Bro, your AI markets assistant</li>
                <li style="margin-bottom:8px;">Receive daily market close wrap emails</li>
              </ul>
              <p style="margin:0;">Head to the dashboard to get started.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 32px;text-align:center;">
              <a href="https://www.buysidebro.com/dashboard" style="display:inline-block;background-color:${BRAND_GREEN};color:#000;font-weight:700;font-size:13px;padding:12px 28px;border-radius:4px;text-decoration:none;letter-spacing:1px;text-transform:uppercase;">
                GO TO DASHBOARD
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 0;border-top:1px solid #27272a;text-align:center;">
              <p style="margin:0;font-size:11px;color:#52525b;">
                Buy Side Bro - Free financial markets intelligence
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}
