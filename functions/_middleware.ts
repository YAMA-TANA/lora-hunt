export const onRequest: PagesFunction = async (context) => {
  const requestUrl = new URL(context.request.url);

  if (requestUrl.hostname === "lora-hunt.pages.dev") {
    requestUrl.hostname = "lora-hunt.info";
    return Response.redirect(requestUrl.toString(), 301);
  }

  const response = await context.next();
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  const path = requestUrl.pathname;
  const scripts: string[] = [];
  if (path === "/" || path === "/index.html") {
    scripts.push("/search-refresh.js?v=20260913.3", "/locale-refresh.js?v=20260913.3", "/card-refresh.js?v=20260913.3", "/review-refresh.js?v=20260913.3");
  }
  if (path.startsWith("/lora/")) scripts.push("/detail-refresh.js?v=20260913.3");

  return new HTMLRewriter()
    .on("head", {
      element(element) {
        element.append('<link rel="stylesheet" href="/ui-refresh.css?v=20260913.3">', { html: true });
      }
    })
    .on("body", {
      element(element) {
        if (scripts.length) element.append(scripts.map((src) => `<script src="${src}" defer></script>`).join(""), { html: true });
      }
    })
    .transform(response);
};
