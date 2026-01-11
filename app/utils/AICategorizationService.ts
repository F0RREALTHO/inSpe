import { Category } from "../../constants/Categories";
import { Sanitizer } from "./Security";

const RAW_KEYS = process.env.EXPO_PUBLIC_GROQ_KEYS || "";
const API_KEYS = RAW_KEYS.split(",").map((k: string) => k.trim()).filter((k: string) => k.length > 0);

const getActiveKey = () => {
  if (API_KEYS.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * API_KEYS.length);
  return API_KEYS[randomIndex];
};

export interface TransactionInput {
  description: string;
  amount: number;
}

const BATCH_SIZE = 20;

export const AICategorizationService = {

  async predictCategory(
    description: string,
    amount: number,
    userCategories: Category[]
  ): Promise<string | null> {
    const apiKey = getActiveKey();
    if (!apiKey) return null;

    const cleanDesc = Sanitizer.sanitizeInput(description);
    const cleanAmount = Sanitizer.sanitizeAmount(amount);
    const categoryLabels = userCategories.map(c => c.label).join(", ");

    const prompt = `
      You are a strict financial classifier.
      Categories: [${categoryLabels}]
      Transaction: "${cleanDesc}" (Amount: ${cleanAmount})
      
      RULES:
      1. **Name + Keyword**: If a name is followed by a business type (e.g., "Ravi Medicals", "Suresh Travels", "Priya Cafe"), categorize based on the business type (Medical -> Health/Medicine, Travels -> Transport).
      2. **Just Name**: If the description is ONLY a person's name (e.g., "Rahul", "Amit Kumar") or a UPI ID, output "General".
      3. **Known Merchants**: "Zomato/Swiggy" -> Food, "Uber/Ola" -> Transport.
      4. **Income**: Matches "Salary", "Interest", "Dividend" -> Income category.
      5. If unsure, output "General".

      Output ONLY the category name. No markdown.
    `;

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: "Output only the category name." },
            { role: "user", content: prompt }
          ],
          max_tokens: 20,
          temperature: 0.1
        })
      });

      const data = await response.json();
      if (data.choices && data.choices.length > 0) {
        let predicted = data.choices[0].message.content.trim();
        predicted = predicted.replace(/["'.]/g, "");

        const exists = userCategories.find(c => c.label.toLowerCase() === predicted.toLowerCase());
        return exists ? exists.label : "General";
      }
    } catch (error) {
      console.error("AI Categorization Error:", error);
    }
    return null;
  },

  async predictCategoriesBatch(
    allTransactions: TransactionInput[],
    userCategories: Category[]
  ): Promise<string[]> {
    const apiKey = getActiveKey();
    if (!apiKey || allTransactions.length === 0) {
      return allTransactions.map(() => "General");
    }

    const categoryLabels = userCategories.map(c => c.label).join(", ");
    let finalResults: string[] = [];

    for (let i = 0; i < allTransactions.length; i += BATCH_SIZE) {
      const chunk = allTransactions.slice(i, i + BATCH_SIZE);
      const txList = chunk.map((t, idx) => {
        const sDesc = Sanitizer.sanitizeInput(t.description);
        const sAmt = Sanitizer.sanitizeAmount(t.amount);
        return `${idx + 1}. ${sDesc} (${sAmt})`;
      }).join("\n");

      const prompt = `
          You are a strict financial classifier.
          Categories: [${categoryLabels}]
          
          Transactions:
          ${txList}
          
          Task: Return a JSON Array of strings. One category per transaction, in order.
          
          STRICT RULES:
          1. **Name + Keyword Exception**: If a name is part of a shop name (e.g. "Ravi Medicals", "John's Cafe", "Suresh General Store"), categorize based on the shop type (Medical -> Health, Cafe -> Food).
          2. **Just Name**: If it is JUST a person's name (e.g. "Rahul", "Priya") or UPI transfer, assign "General".
          3. **Food**: "Zomato", "Swiggy", "KFC", "Restaurant" -> Food.
          4. **Transport**: "Uber", "Ola", "Petrol", "Fuel" -> Transport.
          5. **Medical**: "Pharmacy", "Clinic", "Hospital", "Medicals" -> Healthcare/Medicine.
          6. **Income**: "Salary", "Credit Interest" -> Income category.
          7. If unsure, assign "General".
          
          Output ONLY the raw JSON array.
        `;

      try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: "You are a JSON generator. Output only a valid JSON array." },
              { role: "user", content: prompt }
            ],
            max_tokens: 1024,
            temperature: 0.1
          })
        });

        const data = await response.json();

        if (data.choices && data.choices.length > 0) {
          let content = data.choices[0].message.content.trim();

          content = content.replace(/```json/g, "").replace(/```/g, "");

          const arrayMatch = content.match(/\[.*\]/s);
          if (arrayMatch) content = arrayMatch[0];

          const predictions = JSON.parse(content);

          if (Array.isArray(predictions)) {
            const mapped = predictions.map(pred => {
              const cleanPred = (pred as string).trim();
              const exists = userCategories.find(c => c.label.toLowerCase() === cleanPred.toLowerCase());
              return exists ? exists.label : "General";
            });
            finalResults = [...finalResults, ...mapped];
          } else {
            finalResults = [...finalResults, ...chunk.map(() => "General")];
          }
        } else {
          finalResults = [...finalResults, ...chunk.map(() => "General")];
        }

      } catch (error) {
        console.error(`Batch ${i} failed:`, error);
        finalResults = [...finalResults, ...chunk.map(() => "General")];
      }
    }

    return finalResults;
  }
};