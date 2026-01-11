export function getTheme(isDark: boolean) {
  if (isDark) {
    return {
      bg: "#150C25",
      text: "#FFFFFF",
      muted: "#9F8DA5",
      card: "#2F1C4E",
      cardText: "#FFFFFF",
      cardLight: "#3A225F",
      cardShadow: "#000000",
      accent: "#D76D77",
      accentAlt: "#00F0FF",

      progressBg: "rgba(255,255,255,0.1)",
      progressFill: "#FF296D",
      tinyBg: "#3A225F",

      inputBg: "#23153C",
      border: "#463366",

      income: "#00F0FF",
      expense: "#FF296D",
    };
  } else {
    return {
      bg: "#F5F5F7",
      text: "#1C1C1E",
      muted: "#8E8E93",
      card: "#FFFFFF",
      cardText: "#000000",
      cardLight: "#F2F2F7",
      cardShadow: "#D76D77",
      accent: "#D76D77",
      accentAlt: "#3A1C71",

      progressBg: "#E5E5EA",
      progressFill: "#D76D77",
      tinyBg: "#F2F2F7",

      inputBg: "#FFFFFF",
      border: "#E5E5EA",

      income: "#059669",
      expense: "#E11D48",
    };
  }
}