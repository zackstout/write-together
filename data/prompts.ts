// Writing prompts generated for Write Together.
// Run `npx tsx scripts/seed-prompts.ts` to insert these into the database.

export type PromptSeed = {
  text: string
  max_response_chars: number
}

export const prompts: PromptSeed[] = [
  {
    text: "Describe a place you've never been to but have always imagined clearly. What does it look, feel, and smell like?",
    max_response_chars: 2000,
  },
  {
    text: "Write about a small decision that changed the direction of your day — or your life.",
    max_response_chars: 2000,
  },
  {
    text: "Tell the story of an object in your home. Where did it come from? What has it witnessed?",
    max_response_chars: 2000,
  },
  {
    text: "Write a letter to a version of yourself from five years ago. What would you say?",
    max_response_chars: 2000,
  },
  {
    text: "Describe a moment where you felt completely out of place. What did you do?",
    max_response_chars: 2000,
  },
  {
    text: "Write about something you believed in as a child that you no longer believe. What changed?",
    max_response_chars: 2000,
  },
  {
    text: "Describe the best meal you've ever had. Who were you with, and what made it memorable?",
    max_response_chars: 2000,
  },
  {
    text: "Write about a time you had to do something that scared you. What happened?",
    max_response_chars: 2000,
  },
  {
    text: "What is something you are quietly proud of that most people don't know about?",
    max_response_chars: 2000,
  },
  {
    text: "Write about a friendship that surprised you — one you didn't expect to matter as much as it did.",
    max_response_chars: 2000,
  },
]
