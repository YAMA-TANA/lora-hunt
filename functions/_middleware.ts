export const onRequest: PagesFunction = async (context) => {
  const requestUrl = new URL(context.request.url);

  if (requestUrl.hostname === "lora-hunt.pages.dev") {
    requestUrl.hostname = "lora-hunt.info";
    return Response.redirect(requestUrl.toString(), 301);
  }

  return context.next();
};
