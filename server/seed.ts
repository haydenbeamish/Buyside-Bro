import { db } from "./db";
import { portfolioHoldings } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function seedDatabase() {
  try {
    const existing = await db.select().from(portfolioHoldings).limit(1);
    if (existing.length > 0) {
      console.log("Database already seeded, skipping...");
      return;
    }

    console.log("Seeding database with sample portfolio data...");

    const sampleHoldings = [
      {
        ticker: "AAPL",
        shares: "50",
        avgCost: "175.50",
        currentPrice: "185.25",
        name: "Apple Inc.",
        sector: "Technology",
      },
      {
        ticker: "MSFT",
        shares: "30",
        avgCost: "380.00",
        currentPrice: "412.50",
        name: "Microsoft Corporation",
        sector: "Technology",
      },
      {
        ticker: "GOOGL",
        shares: "25",
        avgCost: "140.00",
        currentPrice: "152.30",
        name: "Alphabet Inc.",
        sector: "Technology",
      },
      {
        ticker: "NVDA",
        shares: "20",
        avgCost: "450.00",
        currentPrice: "875.00",
        name: "NVIDIA Corporation",
        sector: "Technology",
      },
      {
        ticker: "JPM",
        shares: "40",
        avgCost: "165.00",
        currentPrice: "195.75",
        name: "JPMorgan Chase & Co.",
        sector: "Financials",
      },
    ];

    await db.insert(portfolioHoldings).values(sampleHoldings);
    console.log("Database seeded successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}
