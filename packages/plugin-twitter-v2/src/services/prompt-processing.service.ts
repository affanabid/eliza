import { IAgentRuntime, generateText, ModelClass } from '@elizaos/core';

export interface ProcessedPrompt {
    keywords: string[];
    topics: string[];
    accounts: string[];
    context: string;
}

const PROMPT_TEMPLATE = `You are a tweet analysis assistant. Your task is to analyze the following prompt and extract key information for tweet generation.

User Prompt: "{{prompt}}"

Extract and return ONLY a JSON object with the following structure (no markdown, no additional text):
{
    "keywords": ["keyword1", "keyword2"],
    "topics": ["topic1", "topic2"],
    "accounts": ["account1", "account2"],
    "context": "brief description"
}

Requirements:
- Return ONLY the JSON object, no other text
- Do not include markdown formatting
- Keep keywords and topics focused and relevant
- Include Twitter handles in accounts if mentioned
- Provide a clear, concise context description`;

export class PromptProcessingService {
    constructor(private runtime: IAgentRuntime) {}

    async processPrompt(prompt: string): Promise<ProcessedPrompt> {
        try {
            console.log('Processing prompt:', prompt);

            // Prepare context for AI analysis
            const context = PROMPT_TEMPLATE.replace('{{prompt}}', prompt);

            // Generate analysis using AI
            const response = await generateText({
                runtime: this.runtime,
                context,
                modelClass: ModelClass.SMALL
            });

            // Clean the response and parse JSON
            const cleanedResponse = this.cleanJsonResponse(response);
            const processed = JSON.parse(cleanedResponse);

            // Validate and clean the response
            const result: ProcessedPrompt = {
                keywords: this.cleanArray(processed.keywords || []),
                topics: this.cleanArray(processed.topics || []),
                accounts: this.cleanArray(processed.accounts || []),
                context: processed.context || ''
            };

            console.log('Processed prompt result:', result);
            return result;
        } catch (error) {
            console.error('Error processing prompt:', error);
            throw new Error('Failed to process prompt');
        }
    }

    private cleanJsonResponse(response: string): string {
        // Remove markdown formatting if present
        let cleaned = response.replace(/```json\n?|\n?```/g, '');
        
        // Remove any leading/trailing whitespace
        cleaned = cleaned.trim();
        
        // If the response starts with a newline or any other character before {, clean it
        const jsonStart = cleaned.indexOf('{');
        const jsonEnd = cleaned.lastIndexOf('}');
        
        if (jsonStart !== -1 && jsonEnd !== -1) {
            cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
        }
        
        return cleaned;
    }

    private cleanArray(arr: string[]): string[] {
        return arr
            .map(item => item.toLowerCase().trim())
            .filter(item => item.length > 0)
            .filter((item, index, self) => self.indexOf(item) === index); // Remove duplicates
    }
} 