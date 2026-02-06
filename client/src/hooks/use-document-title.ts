import { useEffect } from "react";

const BASE_TITLE = "Buy Side Bro";

export function useDocumentTitle(pageTitle?: string) {
  useEffect(() => {
    if (pageTitle) {
      document.title = `${pageTitle} | ${BASE_TITLE}`;
    } else {
      document.title = `${BASE_TITLE} | Free Financial Markets Dashboard & Stock Analysis Terminal`;
    }
    return () => {
      document.title = `${BASE_TITLE} | Free Financial Markets Dashboard & Stock Analysis Terminal`;
    };
  }, [pageTitle]);
}
