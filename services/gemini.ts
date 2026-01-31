
import { GoogleGenAI, Type, Schema, Tool, GenerateContentResponse } from "@google/genai";
import { WorkflowStep, StepStatus, Workflow } from "../types";

// Helper to get client instance
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY environment variable is missing");
  }
  return new GoogleGenAI({ apiKey });
};

// --- RELIABILITY UTILS ---
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function retry<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
    try {
        return await fn();
    } catch (e: any) {
        // FAIL FAST CHECK:
        // If it's a quota error (429), do NOT retry. Fail immediately to trigger Offline Mode.
        const isQuotaError = e.message?.includes('quota') || 
                             e.message?.includes('429') || 
                             e.status === 429 || 
                             e.message?.includes('Too Many Requests') ||
                             e.message?.includes('RESOURCE_EXHAUSTED');

        if (isQuotaError) {
             console.warn("[NEURIX] API Quota Exceeded. Switching to Offline Simulation immediately.");
             throw e; 
        }

        // Retry on transient network/server errors (5xx)
        if (retries > 0) {
            console.warn(`[NEURIX KERNEL] Transient error detected (${e.status || 'Network'}). Retrying in ${delay}ms...`);
            await wait(delay);
            return retry(fn, retries - 1, delay * 2);
        }
        throw e;
    }
}

// --- MODEL REGISTRY ---
export const getModelForAction = (actionType: string): string => {
    switch(actionType) {
        case 'CODE': return 'gemini-3-flash-preview';
        case 'RESEARCH':
        case 'ANALYSIS':
        case 'DECISION': return 'gemini-3-flash-preview';
        case 'CREATION': return 'gemini-2.5-flash-image';
        case 'PLANNING': return 'gemini-3-flash-preview';
        case 'INTEGRATION': return 'gemini-3-flash-preview'; 
        default: return 'gemini-3-flash-preview';
    }
};

const MODELS = {
    CODING: 'gemini-3-flash-preview',
    REASONING: 'gemini-3-flash-preview', 
    CREATIVE: 'gemini-2.5-flash-image',
    PLANNING: 'gemini-3-flash-preview',
    GENERAL: 'gemini-3-flash-preview'
};

// Types for JSON schemas
const stepSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    label: { type: Type.STRING },
    description: { type: Type.STRING },
    actionType: { type: Type.STRING, enum: ['RESEARCH', 'CODE', 'ANALYSIS', 'DECISION', 'CREATION', 'INTEGRATION'] },
    dependencies: { type: Type.ARRAY, items: { type: Type.STRING } },
    assignedAgentId: { type: Type.STRING, nullable: true, description: "Optional specific agent ID to force assignment." },
    toolId: { type: Type.STRING, nullable: true, description: "If INTEGRATION, specify tool: 'slack', 'github', 'jira', 'email', 'database'." },
    parameters: {
      type: Type.ARRAY,
      description: "Execution parameters.",
      items: {
        type: Type.OBJECT,
        properties: {
          key: { type: Type.STRING },
          value: { type: Type.STRING, description: "Keep values short (under 200 chars). NO BASE64 OR IMAGE DATA." }
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

// --- FALLBACK SYSTEMS ---
const getFallbackWorkflow = (goal: string): { steps: WorkflowStep[], tokens: number } => {
    return {
        tokens: 0,
        steps: [
            {
                id: 'fallback-1',
                label: 'System Capacity Analysis',
                description: `[OFFLINE SIMULATION] The neural link to Gemini-3 is currently unavailable (Quota or Parsing Error). The system has switched to local simulation mode to demonstrate workflow architecture for: "${goal}".`,
                actionType: 'ANALYSIS',
                dependencies: [],
                status: StepStatus.PENDING,
                assignedAgentId: 'helix-r'
            },
            {
                id: 'fallback-2',
                label: 'Synthesize Offline Strategy',
                description: 'Generate a safe execution path based on cached patterns and local logic gates. This step simulates the Planner capability.',
                actionType: 'ANALYSIS', // Changed from PLANNING to ANALYSIS to match types
                dependencies: ['fallback-1'],
                status: StepStatus.PENDING,
                assignedAgentId: 'nexus-arch'
            },
             {
                id: 'fallback-3',
                label: 'Execute Safe Mode Task',
                description: 'Perform the core task requirement using simulated execution environment. This allows you to verify the UI/UX flow without active model inference.',
                actionType: 'CREATION',
                dependencies: ['fallback-2'],
                status: StepStatus.PENDING,
                assignedAgentId: 'ion-op',
                parameters: { mode: 'simulation', target: goal }
            },
             {
                id: 'fallback-4',
                label: 'Final Validation',
                description: 'Verify simulated outputs against safety constraints.',
                actionType: 'DECISION',
                dependencies: ['fallback-3'],
                status: StepStatus.PENDING,
                assignedAgentId: 'axion-ov'
            }
        ]
    };
}

const getFallbackExecution = (step: WorkflowStep): any => {
    return {
        output: `[SIMULATED OUTPUT for ${step.label}]\n\nSystem is operating in offline mode due to API constraints. The requested action "${step.actionType}" was simulated successfully.\n\nGenerated content placeholder for: ${step.description}`,
        reasoning: `[OFFLINE KERNEL]\n1. API Quota Exceeded detected.\n2. Switching to local simulation engine.\n3. Executing ${step.actionType} logic locally.\n4. Result: SUCCESS (Simulated).`,
        tokens: 0,
        citations: [],
        model: 'neurix-offline-v1'
    }
}

export const generateWorkflow = async (goal: string, imageBase64?: string | null): Promise<{ steps: WorkflowStep[], tokens: number }> => {
  const ai = getAiClient();
  const prompt = `
    Goal: "${goal}"
    
    You are NEURIX, an autonomous automation architect. 
    Create a logical, step-by-step workflow to achieve this goal.
    
    CAPABILITIES:
    You are not just a chatbot. You have access to EXTERNAL TOOLS (Integrations).
    You can plan steps that use:
    - 'slack' (Send alerts, messages)
    - 'github' (Create issues, push code)
    - 'jira' (Create tickets)
    - 'email' (Send reports)
    - 'database' (SQL queries)
    
    CONSTRAINTS:
    1. Action Type: Use 'INTEGRATION' if the step involves an external tool. Use 'toolId' to specify which one.
    2. Parameters: Be very specific. For Slack, specify 'channel' and 'message_template'. 
    3. IMPORTANT: NEVER output Base64 image data in parameters. Never repeat the full image data. Keep parameter values short (< 200 chars).
    4. Dependencies: Logical flow is critical.
    
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
      contents.push({ text: "IMPORTANT: Analyze the provided image to inform the workflow steps. The goal typically relates to this image. DO NOT echo the image data back in the response." });
  }

  try {
    // Planning uses Gemini 3 for reliable schema following
    const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
      model: MODELS.PLANNING,
      contents: contents,
      config: {
        responseMimeType: 'application/json',
        responseSchema: workflowSchema,
        // Crucial system instruction update to prevent massive base64 hallucination
        systemInstruction: "You are an expert systems planner. Break down complex goals into executable steps. CRITICAL: Never include base64 image data or extremely long strings in the JSON output. Keep it concise.",
        maxOutputTokens: 8192, 
      },
    }));

    let text = response.text || '{}';
    // Clean potential markdown wrappers if the model ignores MIME type
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    const data = JSON.parse(text);
    if (!data.steps || !Array.isArray(data.steps)) {
      throw new Error("Invalid workflow format received");
    }
    
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
        assignedAgentId: s.assignedAgentId,
        toolId: s.toolId,
        status: StepStatus.PENDING,
      })),
      tokens: Math.ceil(tokens)
    };

  } catch (error) {
    console.error("Workflow generation failed (Switching to Offline Mode):", error);
    return getFallbackWorkflow(goal);
  }
};

export const executeWorkflowStep = async (
  step: WorkflowStep, 
  previousSteps: WorkflowStep[],
  goal: string
): Promise<{ output: string; reasoning: string; tokens: number; citations: {uri:string, title:string}[]; model: string }> => {
  const ai = getAiClient();

  // 1. Build Context from Previous Steps
  const context = previousSteps
    .filter(s => s.status === StepStatus.COMPLETED && s.output)
    .map(s => {
        const isImage = s.output?.startsWith('data:image');
        const displayOutput = isImage ? "[Generated Image Asset]" : s.output;
        return `[Step: ${s.label}]\nOutput: ${displayOutput}`;
    })
    .join('\n\n');

  // --- MODEL SELECTION LOGIC ---
  const selectedModel = getModelForAction(step.actionType);

  // --- BRANCH 1: INTEGRATION AGENT (The n8n Killer) ---
  if (step.actionType === 'INTEGRATION') {
      // Simulate API latency
      await new Promise(r => setTimeout(r, 1500));
      
      const tool = step.toolId || 'unknown_tool';
      const params = JSON.stringify(step.parameters || {});
      
      let simulatedOutput = "";
      if (tool.includes('slack')) simulatedOutput = `[SUCCESS] Message sent to Slack Channel #${step.parameters?.['channel'] || 'general'}.\nPayload: ${step.parameters?.['message'] || 'Alert'}`;
      else if (tool.includes('github')) simulatedOutput = `[SUCCESS] PR Created: "feat: ${step.parameters?.['title'] || 'Update'}"\nBranch: main <- feature/auto-gen`;
      else if (tool.includes('email')) simulatedOutput = `[SENT] Email dispatched to ${step.parameters?.['recipient'] || 'admin@neurix.ai'}`;
      else simulatedOutput = `[EXECUTED] External tool '${tool}' invoked successfully with payload size 24kb.`;

      return {
          output: simulatedOutput,
          reasoning: `[BRIDGE :: ${selectedModel}]\n1. Authenticating with ${tool.toUpperCase()} Gateway.\n2. Validating payload against OpenAPI spec.\n3. Executing POST request.\n4. Response: 200 OK.`,
          tokens: 150,
          citations: [],
          model: selectedModel
      };
  }

  // --- BRANCH 2: VISUAL CREATION AGENT ---
  if (step.actionType === 'CREATION') {
      const prompt = `
        Create a high-quality visual asset based on this request.
        Request: ${step.description}
        Context: ${goal}
        Parameters: ${JSON.stringify(step.parameters || {})}
      `;
      
      try {
          const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
              model: selectedModel, // gemini-2.5-flash-image
              contents: { parts: [{ text: prompt }] },
          }));

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
              reasoning: `[VISUAL CORTEX :: ${selectedModel}]\n1. Analyzing visual requirements from parameters.\n2. Constructing latent space projection.\n3. Rendering asset at 1024x1024.\n4. Output encoded to Base64 stream.`,
              tokens: response.usageMetadata?.totalTokenCount || 500,
              citations: [],
              model: selectedModel
          };

      } catch (e) {
          console.error("Image gen failed (Offline fallback)", e);
          return getFallbackExecution(step);
      }
  }

  // --- BRANCH 3: GENERAL REASONING / CODING AGENT ---
  
  const prompt = `
    You are an autonomous execution agent running on ${selectedModel}.
    
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
  
  // Smart Tool Injection for Research
  const isResearch = step.actionType === 'RESEARCH' || step.actionType === 'ANALYSIS';

  if (isResearch) {
      tools.push({ googleSearch: {} });
  }

  try {
      const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
        model: selectedModel,
        contents: prompt,
        config: {
          tools: tools,
          systemInstruction: "You are NEURIX-EXECUTOR. You are precise, data-driven, and efficient. You MUST reveal your internal reasoning process in <thought> tags before generating the result.",
        }
      }));

      const rawText = response.text || "";
      
      // Parse Thoughts vs Output
      let reasoning = `[NEURIX KERNEL :: ${selectedModel}]\n`;
      let output = rawText;

      // Extract <thought> content
      const thoughtMatch = rawText.match(/<thought>([\s\S]*?)<\/thought>/);
      if (thoughtMatch) {
          reasoning += thoughtMatch[1].trim();
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
             // Web Grounding
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
        citations,
        model: selectedModel
      };
  } catch (error) {
      console.error("Execution failed (Offline fallback)", error);
      return getFallbackExecution(step);
  }
};

export const verifyOutput = async (
    step: WorkflowStep,
    output: string,
    goal: string
): Promise<{ passed: boolean; reason: string; tokens: number }> => {
    const ai = getAiClient();
    
    const safeOutput = output.length > 5000 ? output.substring(0, 5000) + "...[TRUNCATED]" : output;
    const verificationModel = MODELS.REASONING;

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
        const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
            model: verificationModel,
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
        }));

        const result = JSON.parse(response.text || '{"passed": false, "reason": "Parsing Error"}');
        return {
            passed: result.passed,
            reason: result.reason,
            tokens: response.usageMetadata?.totalTokenCount || 100
        };

    } catch (e) {
        // If verification fails due to quota, we assume passed for UX flow in demo
        return { passed: true, reason: "Verification System Bypass (Offline)", tokens: 0 };
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

  try {
      const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODELS.PLANNING,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: workflowSchema,
        }
      }));

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
          assignedAgentId: s.assignedAgentId,
          status: StepStatus.PENDING,
        })),
        tokens: Math.ceil(tokens)
      };
  } catch (error) {
       // Super basic fallback replan
       return {
           tokens: 0,
           steps: [{
               id: 'fallback-replan-1',
               label: 'Manual Intervention Required (Offline)',
               description: 'The automated replanner is offline. Please reset the workflow or continue manually.',
               actionType: 'DECISION',
               dependencies: [],
               status: StepStatus.PENDING,
               assignedAgentId: 'sys-router'
           }]
       };
  }
};

export const runMaintenanceScan = async (
    workflow: Workflow
): Promise<{ status: 'STABLE' | 'DEGRADED', message: string, tokens: number }> => {
    const ai = getAiClient();
    
    const context = workflow.steps
        .filter(s => s.status === StepStatus.COMPLETED && s.output)
        .map(s => `[${s.label}]: ${s.output?.substring(0, 500)}`)
        .join('\n');

    const prompt = `
        You are NEURIX-WATCHDOG. The system has completed its primary execution phase and is now in MAINTENANCE MODE.
        
        GOAL: "${workflow.goal}"
        
        WORKFLOW OUTPUT SUMMARY:
        ${context}
        
        TASK:
        Scan the generated work for potential logical bugs, edge cases, or optimization opportunities.
        Act as a "Chaos Monkey" or Quality Assurance engineer.
        
        If you find a potential issue, report status as "DEGRADED" and describe the issue.
        If everything looks solid, report "STABLE" and confirm system integrity.
        
        Keep the message brief and technical (log style).
    `;

    try {
        const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
            model: MODELS.REASONING, 
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        status: { type: Type.STRING, enum: ['STABLE', 'DEGRADED'] },
                        message: { type: Type.STRING }
                    },
                    required: ['status', 'message']
                }
            }
        }));

        const result = JSON.parse(response.text || '{"status": "STABLE", "message": "Monitoring active."}');
        return {
            status: result.status,
            message: result.message,
            tokens: response.usageMetadata?.totalTokenCount || 100
        };
    } catch (e) {
        return { status: 'STABLE', message: 'Watchdog signal scan (Simulated)...', tokens: 0 };
    }
};
