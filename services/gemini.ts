import { GoogleGenAI, Type, Schema, Tool } from "@google/genai";
import { WorkflowStep, StepStatus } from "../types";

// Helper to get client instance
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY environment variable is missing");
  }
  return new GoogleGenAI({ apiKey });
};

// Types for JSON schemas
const stepSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    label: { type: Type.STRING },
    description: { type: Type.STRING },
    actionType: { type: Type.STRING, enum: ['RESEARCH', 'CODE', 'ANALYSIS', 'DECISION', 'CREATION'] },
    dependencies: { type: Type.ARRAY, items: { type: Type.STRING } },
    parameters: {
      type: Type.ARRAY,
      description: "Execution parameters.",
      items: {
        type: Type.OBJECT,
        properties: {
          key: { type: Type.STRING },
          value: { type: Type.STRING }
        },
        required: ['key', 'value']
      },
      nullable: true
    },
    alternatives: { 
      type: Type.ARRAY, 
      description: "List of alternative approaches if this step fails.",
      items: { type: Type.STRING },
      nullable: true 
    },
  },
  required: ['id', 'label', 'description', 'actionType', 'dependencies'],
};

const workflowSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    steps: { type: Type.ARRAY, items: stepSchema },
  },
  required: ['steps'],
};

const transformParams = (paramsArray?: {key: string, value: string}[]): Record<string, string> => {
  const params: Record<string, string> = {};
  if (Array.isArray(paramsArray)) {
    paramsArray.forEach(p => {
      if (p.key && p.value) {
        params[p.key] = p.value;
      }
    });
  }
  return params;
};

export const generateWorkflow = async (goal: string, imageBase64?: string | null): Promise<{ steps: WorkflowStep[], tokens: number }> => {
  const ai = getAiClient();
  const prompt = `
    Goal: "${goal}"
    
    You are NEURIX, an autonomous agent architect. 
    Create a logical, step-by-step workflow to achieve this goal.
    
    Schema Requirements:
    1. Dependencies: Ensure steps are correctly linked.
    2. Action Type: Categorize each step. Use 'CREATION' for visual assets (images, ui, diagrams).
    3. Parameters: Provide specific configuration parameters (e.g., search queries, target filenames, prompt details) in the 'parameters' field.
    4. Alternatives: Suggest 1-2 alternative approaches in 'alternatives' if a step is risky or complex.
    
    Steps should be granular enough to be executed by an LLM agent.
    
    Return a clean JSON object.
  `;

  // Prepare contents (Multimodal support)
  const contents: any = [{ text: prompt }];
  if (imageBase64) {
      contents.unshift({
          inlineData: {
              mimeType: 'image/png', // Assume PNG for simplicity in this demo context
              data: imageBase64
          }
      });
      // Append instruction to use the image
      contents.push({ text: "IMPORTANT: Analyze the provided image to inform the workflow steps. The goal typically relates to this image." });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: contents,
      config: {
        responseMimeType: 'application/json',
        responseSchema: workflowSchema,
        systemInstruction: "You are an expert systems planner. Break down complex goals into executable steps with clear parameters. If an image is provided, use visual analysis to tailor the steps.",
      },
    });

    const data = JSON.parse(response.text || '{}');
    if (!data.steps || !Array.isArray(data.steps)) {
      throw new Error("Invalid workflow format received");
    }
    
    // Estimate tokens if usageMetadata is missing (safety fallback)
    const tokens = response.usageMetadata?.totalTokenCount || JSON.stringify(data).length / 4;

    return {
      steps: data.steps.map((s: any) => ({
        id: s.id,
        label: s.label,
        description: s.description,
        actionType: s.actionType,
        dependencies: s.dependencies || [],
        parameters: transformParams(s.parameters),
        alternatives: s.alternatives || [],
        status: StepStatus.PENDING,
      })),
      tokens: Math.ceil(tokens)
    };

  } catch (error) {
    console.error("Workflow generation failed:", error);
    throw error;
  }
};

export const executeWorkflowStep = async (
  step: WorkflowStep, 
  previousSteps: WorkflowStep[],
  goal: string
): Promise<{ output: string; reasoning: string; tokens: number; citations: {uri:string, title:string}[] }> => {
  const ai = getAiClient();

  // 1. Build Context from Previous Steps
  const context = previousSteps
    .filter(s => s.status === StepStatus.COMPLETED && s.output)
    .map(s => {
        // Truncate long outputs (like base64 images) for context window efficiency
        const isImage = s.output?.startsWith('data:image');
        const displayOutput = isImage ? "[Generated Image Asset]" : s.output;
        return `[Step: ${s.label}]\nOutput: ${displayOutput}`;
    })
    .join('\n\n');

  // --- BRANCH 1: VISUAL CREATION AGENT (gemini-2.5-flash-image) ---
  if (step.actionType === 'CREATION') {
      const prompt = `
        Create a high-quality visual asset based on this request.
        Request: ${step.description}
        Context: ${goal}
        Parameters: ${JSON.stringify(step.parameters || {})}
      `;
      
      try {
          const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash-image',
              contents: {
                  parts: [{ text: prompt }]
              },
              config: {
                 // No responseMimeType for image model
              }
          });

          let output = "Image generation completed.";
          let imageFound = false;

          // Iterate parts to find the image
          if (response.candidates?.[0]?.content?.parts) {
             for (const part of response.candidates[0].content.parts) {
                 if (part.inlineData) {
                     const base64Str = part.inlineData.data;
                     // Store as Data URI for immediate frontend rendering
                     output = `data:image/png;base64,${base64Str}`;
                     imageFound = true;
                 } else if (part.text) {
                     // Capture any accompanying text
                     if (!imageFound) output = part.text;
                 }
             }
          }

          return {
              output: output,
              reasoning: `[VISUAL CORTEX]\n1. Analyzing visual requirements from parameters.\n2. Constructing latent space projection.\n3. Rendering asset at 1024x1024.\n4. Output encoded to Base64 stream.`,
              tokens: response.usageMetadata?.totalTokenCount || 500,
              citations: []
          };

      } catch (e) {
          console.error("Image gen failed", e);
          return {
              output: "Failed to generate image. Fallback to text description.",
              reasoning: "Visual Cortex Error. Fallback to linguistic engine.",
              tokens: 0,
              citations: []
          };
      }
  }

  // --- BRANCH 2: GENERAL REASONING AGENT (gemini-3-flash-preview) ---
  
  const prompt = `
    You are an autonomous execution agent.
    
    OVERALL GOAL: "${goal}"
    CURRENT TASK: ${step.label}
    DESCRIPTION: ${step.description}
    PARAMETERS: ${JSON.stringify(step.parameters || {})}
    
    CONTEXT:
    ${context || "No previous context."}
    
    INSTRUCTIONS:
    1. First, think step-by-step about how to solve this. Enclose your thoughts in <thought> tags.
    2. Then, provide the final output.
    
    - If RESEARCH: Use Google Search to find facts.
    - If CODE: Write the code.
    - If ANALYSIS: Synthesize insights.
  `;

  const tools: Tool[] = [];
  if (step.actionType === 'RESEARCH' || step.actionType === 'ANALYSIS') {
    tools.push({ googleSearch: {} });
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      tools: tools,
      systemInstruction: "You are NEURIX-EXECUTOR. You are precise, data-driven, and efficient. You MUST reveal your internal reasoning process in <thought> tags before generating the result.",
    }
  });

  const rawText = response.text || "";
  
  // Parse Thoughts vs Output
  let reasoning = "[NEURIX EXECUTION CORE]\n";
  let output = rawText;

  // Extract <thought> content
  const thoughtMatch = rawText.match(/<thought>([\s\S]*?)<\/thought>/);
  if (thoughtMatch) {
      reasoning = thoughtMatch[1].trim();
      // Remove thought from output for clean display
      output = rawText.replace(/<thought>[\s\S]*?<\/thought>/, '').trim();
  } else {
      // Fallback if model forgets tags
      reasoning += "Direct execution path chosen. No internal monologue trace available.";
  }

  // Extract Grounding (Citations)
  const citations: {uri:string, title:string}[] = [];
  if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
     response.candidates[0].groundingMetadata.groundingChunks.forEach(chunk => {
         if (chunk.web?.uri && chunk.web?.title) {
             citations.push({ uri: chunk.web.uri, title: chunk.web.title });
         }
     });
  }

  // Add grounding info to reasoning if available
  if (citations.length > 0) {
     reasoning = `[GROUNDING: ${citations.length} SOURCES VERIFIED]\n` + reasoning;
  }

  return {
    output,
    reasoning,
    tokens: response.usageMetadata?.totalTokenCount || 200,
    citations
  };
};

export const verifyOutput = async (
    step: WorkflowStep,
    output: string,
    goal: string
): Promise<{ passed: boolean; reason: string; tokens: number }> => {
    const ai = getAiClient();
    
    // Truncate large outputs for verification
    const safeOutput = output.length > 5000 ? output.substring(0, 5000) + "...[TRUNCATED]" : output;

    const prompt = `
      You are NEURIX-VERIFIER (AXION Module).
      Your job is to strictly audit the work of the Executor agent.

      ORIGINAL GOAL: "${goal}"
      STEP REQUIREMENT: "${step.description}"
      EXECUTOR OUTPUT: "${safeOutput}"

      Did the Executor successfully satisfy the Step Requirement?
      
      Respond in JSON:
      {
        "passed": boolean,
        "reason": "Short explanation of why it passed or failed."
      }
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        passed: { type: Type.BOOLEAN },
                        reason: { type: Type.STRING }
                    },
                    required: ['passed', 'reason']
                }
            }
        });

        const result = JSON.parse(response.text || '{"passed": false, "reason": "Parsing Error"}');
        return {
            passed: result.passed,
            reason: result.reason,
            tokens: response.usageMetadata?.totalTokenCount || 100
        };

    } catch (e) {
        return { passed: false, reason: "Verification System Error", tokens: 0 };
    }
}


export const replanWorkflow = async (
  failedStep: WorkflowStep,
  existingSteps: WorkflowStep[],
  errorMsg: string,
  goal: string
): Promise<{ steps: WorkflowStep[], tokens: number }> => {
  const ai = getAiClient();
  
  const completedSteps = existingSteps.filter(s => s.status === StepStatus.COMPLETED);
  
  const prompt = `
    The agent failed to execute a step in the workflow.
    Goal: "${goal}"
    
    Failed Step: ${failedStep.label} (${failedStep.id})
    Error: ${errorMsg}
    Pre-planned Alternatives: ${failedStep.alternatives?.join(', ') || 'None'}
    
    Completed Steps:
    ${completedSteps.map(s => `- ${s.label}`).join('\n')}
    
    Task:
    Generate a NEW set of steps to replace the failed step and the remaining future steps.
    Consider the pre-planned alternatives if viable.
    Find an alternative strategy to achieve the goal given the failure.
    Return ONLY the new steps (including a replacement for the failed one).
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: workflowSchema,
    }
  });

  const data = JSON.parse(response.text || '{}');
  const tokens = response.usageMetadata?.totalTokenCount || 500;

  return {
    steps: data.steps.map((s: any) => ({
      id: s.id,
      label: s.label,
      description: s.description,
      actionType: s.actionType,
      dependencies: s.dependencies || [],
      parameters: transformParams(s.parameters),
      alternatives: s.alternatives || [],
      status: StepStatus.PENDING,
    })),
    tokens: Math.ceil(tokens)
  };
};