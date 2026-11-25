export type CommandUiLanguage = "en" | "hi";

export interface CommandUiCopy {
  label: string;
  placeholder: string;
  submit: string;
  clarify: string;
}

const copy: Record<CommandUiLanguage, CommandUiCopy> = {
  en: {
    label: "Command",
    placeholder: "Try: compress image, merge PDF, or convert units...",
    submit: "Run command",
    clarify: "Please describe one tool action clearly.",
  },
  hi: {
    label: "कमांड",
    placeholder: "जैसे: फोटो compress करें, PDF जोड़ें...",
    submit: "कमांड चलाएँ",
    clarify: "कृपया एक काम स्पष्ट रूप से बताएं।",
  },
};

export function getCommandUiCopy(language: CommandUiLanguage): CommandUiCopy {
  return copy[language];
}
