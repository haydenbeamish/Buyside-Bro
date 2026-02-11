import { useEffect } from "react";

const BASE_TITLE = "Buy Side Bro";
const DEFAULT_TITLE = `${BASE_TITLE} | Free Financial Markets Dashboard & Stock Analysis Terminal`;
const DEFAULT_DESCRIPTION = "Buy Side Bro is your bro on the buyside — a free financial markets dashboard with live global market data across 100+ tickers, hedge fund quality deep dive stock analysis with BUY/HOLD/SELL recommendations, portfolio tracking, watchlist alerts, earnings analysis, and a CFA-certified research analyst at your fingertips. Professional Bloomberg-alternative trading tools — free to explore.";

function setMetaDescription(description: string) {
  const meta = document.querySelector('meta[name="description"]');
  if (meta) {
    meta.setAttribute("content", description);
  }
}

export function useDocumentTitle(pageTitle?: string, pageDescription?: string) {
  useEffect(() => {
    if (pageTitle) {
      document.title = `${pageTitle} | ${BASE_TITLE}`;
    } else {
      document.title = DEFAULT_TITLE;
    }

    if (pageDescription) {
      setMetaDescription(pageDescription);
    }

    return () => {
      document.title = DEFAULT_TITLE;
      setMetaDescription(DEFAULT_DESCRIPTION);
    };
  }, [pageTitle, pageDescription]);
}
