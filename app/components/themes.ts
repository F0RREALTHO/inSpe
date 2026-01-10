export function getTheme(isDark: boolean) {
  if (isDark) {
    // 🟣 DARK MODE (Obsidian Plum) - The Star 🌟
    return {
      bg: "#150C25",         // Deep Midnight Purple
      text: "#FFFFFF",       // Pure White
      muted: "#9F8DA5",      // Lavender Grey
      card: "#2F1C4E",       // Rich Plum
      cardText: "#FFFFFF",
      cardLight: "#3A225F",  
      cardShadow: "#000000", 
      accent: "#D76D77",     // Plum Pink
      accentAlt: "#00F0FF",  // Neon Teal
      
      progressBg: "rgba(255,255,255,0.1)",
      progressFill: "#FF296D", 
      tinyBg: "#3A225F",

      inputBg: "#23153C",    
      border: "#463366",     
      
      income: "#00F0FF",     // Neon Teal for Income
      expense: "#FF296D",    // Hot Pink for Expense
    };
  } else {
    // ☀️ LIGHT MODE (Digital Daybreak) - Clean & Crisp
    return {
      bg: "#F5F5F7",         // Soft System Grey (Apple style)
      text: "#1C1C1E",       // Near Black (Softer than #000)
      muted: "#8E8E93",      // Classic Grey
      card: "#FFFFFF",       // Pure White
      cardText: "#000000",
      cardLight: "#F2F2F7",  // Very light grey for pressed states
      cardShadow: "#D76D77", // ✨ Pink Shadow for the 'Brand Glow'
      
      // We keep the Accents the same to maintain Brand Identity!
      accent: "#D76D77",     // Plum Pink
      accentAlt: "#3A1C71",  // Deep Purple (Darker for visibility on white)
      
      progressBg: "#E5E5EA", // Standard Grey Track
      progressFill: "#D76D77", // Pink Fill
      tinyBg: "#F2F2F7",

      inputBg: "#FFFFFF",    
      border: "#E5E5EA",     
      
      income: "#059669",     // Darker Teal/Green for visibility on white
      expense: "#E11D48",    // Darker Pink/Red for visibility on white
    };
  }
}