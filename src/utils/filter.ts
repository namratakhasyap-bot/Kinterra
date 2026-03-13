const badWords = ["badword1", "badword2", "offensive1"]; // Placeholder, in real app use a library

export const filterText = (text: string): { cleanText: string; hasBadWords: boolean } => {
  let hasBadWords = false;
  let cleanText = text;

  badWords.forEach(word => {
    const regex = new RegExp(word, "gi");
    if (regex.test(cleanText)) {
      hasBadWords = true;
      cleanText = cleanText.replace(regex, "****");
    }
  });

  return { cleanText, hasBadWords };
};
