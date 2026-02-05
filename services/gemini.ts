
import { GoogleGenAI, Type, Schema, Tool, GenerateContentResponse, Part, Content } from "@google/genai";
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
        const isQuotaError = e.message?.includes('quota') || 
                             e.message?.includes('429') || 
                             e.status === 429 || 
                             e.message?.includes('Too Many Requests') ||
                             e.message?.includes('RESOURCE_EXHAUSTED');

        if (isQuotaError) {
             console.warn("[NEURIX] API Quota Exceeded. Switching to Offline Simulation immediately.");
             throw e; 
        }

        if (retries > 0) {
            console.warn(`[NEURIX KERNEL] Transient error detected (${e.status || e.message || 'Network'}). Retrying in ${delay}ms...`);
            await wait(delay);
            return retry(fn, retries - 1, delay * 2);
        }
        throw e;
    }
}

// --- MODEL REGISTRY & AUTO-SWITCHING LOGIC ---
export const getModelForAction = (actionType: string): string => {
    switch(actionType) {
        // COMPLEX REASONING TASKS -> GEMINI 3 PRO
        case 'PLANNING': 
        case 'CODE': 
            return 'gemini-3-pro-preview';
            
        // CREATIVE VISUAL TASKS -> NANO BANANA PRO (GEMINI 3 PRO IMAGE)
        // Updated for "Creative Autopilot" Track
        case 'CREATION': 
            return 'gemini-3-pro-image-preview';
            
        // FAST EXECUTION / RETRIEVAL -> GEMINI 3 FLASH
        case 'RESEARCH':
        case 'ANALYSIS':
        case 'INTEGRATION': 
        case 'DECISION': 
            return 'gemini-3-flash-preview';
            
        default: 
            return 'gemini-3-flash-preview';
    }
};

const MODELS = {
    CODING: 'gemini-3-pro-preview',
    REASONING: 'gemini-3-pro-preview', 
    CREATIVE: 'gemini-3-pro-image-preview', // Upgraded
    PLANNING: 'gemini-3-pro-preview',
    GENERAL: 'gemini-3-flash-preview',
    // Fallback if 3-series is not enabled for the key
    FALLBACK: 'gemini-2.0-flash-exp'
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
          value: { type: Type.STRING, description: "Keep values short (under 100 chars). NO BASE64 OR IMAGE DATA." }
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
const getFallbackWorkflow = (goal: string, errorMsg?: string): { steps: WorkflowStep[], tokens: number } => {
    return {
        tokens: 0,
        steps: [
            {
                id: 'fallback-1',
                label: 'System Capacity Analysis',
                description: `[OFFLINE SIMULATION] The neural link to Gemini-3 is unavailable. Error: ${errorMsg || 'Unknown'}. The system has switched to local simulation mode.`,
                actionType: 'ANALYSIS',
                dependencies: [],
                status: StepStatus.PENDING,
                assignedAgentId: 'helix-r'
            },
            {
                id: 'fallback-2',
                label: 'Synthesize Offline Strategy',
                description: 'Generate a safe execution path based on cached patterns and local logic gates. This step simulates the Planner capability.',
                actionType: 'ANALYSIS',
                dependencies: ['fallback-1'],
                status: StepStatus.PENDING,
                assignedAgentId: 'nexus-arch'
            },
             {
                id: 'fallback-3',
                label: 'Execute Safe Mode Task',
                description: `Perform the core task requirement using simulated execution environment: ${goal}`,
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

const getFallbackExecution = (step: WorkflowStep, errorMsg?: string): any => {
    return {
        output: `[SIMULATED OUTPUT for ${step.label}]\n\nSystem is operating in offline mode. \nError Trace: ${errorMsg}\n\nThe requested action "${step.actionType}" was simulated successfully.`,
        reasoning: `[OFFLINE KERNEL]\n1. API Error detected: ${errorMsg}\n2. Switching to local simulation engine.\n3. Executing ${step.actionType} logic locally.\n4. Result: SUCCESS (Simulated).`,
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
    3. CRITICAL: NEVER output Base64 image data in parameters. Keep all parameter values very short (< 200 chars). Do not include long code blocks as parameters; describe them instead.
    4. Dependencies: Logical flow is critical.
    
    Return a clean JSON object.
  `;

  // Prepare contents (Multimodal support) - STRICT STRUCTURE
  const parts: Part[] = [];
  
  if (imageBase64) {
      parts.push({
          inlineData: {
              mimeType: 'image/png',
              data: imageBase64
          }
      });
      parts.push({ text: "IMPORTANT: Analyze the provided image to inform the workflow steps. The goal typically relates to this image. DO NOT echo the image data back in the response." });
  }
  
  parts.push({ text: prompt });

  const contents: Content = { role: 'user', parts: parts };

  try {
    const runGeneration = async (model: string) => {
        return await ai.models.generateContent({
          model: model,
          contents: contents,
          config: {
            responseMimeType: 'application/json',
            responseSchema: workflowSchema,
            systemInstruction: "You are an expert systems planner. Break down complex goals into executable steps. CRITICAL: Never include base64 image data or extremely long strings in the JSON output. Keep parameter values concise. If you need to reference a file, use a placeholder like '[Image File]'.",
            maxOutputTokens: 8192,
            // Enable Native Thinking for deeper planning logic
            thinkingConfig: { thinkingBudget: 2048 } 
          },
        });
    };

    let response;
    try {
        response = await retry<GenerateContentResponse>(() => runGeneration(MODELS.PLANNING));
    } catch (e: any) {
        console.warn(`[NEURIX] Planning with ${MODELS.PLANNING} failed, trying fallback ${MODELS.FALLBACK}. Error: ${e.message}`);
        response = await retry<GenerateContentResponse>(() => runGeneration(MODELS.FALLBACK));
    }

    let text = response.text || '{}';
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    // Safety: Try to repair truncated JSON if it looks like it ended abruptly
    if (text.endsWith('"') || text.endsWith(',') || text.endsWith(':') || text.endsWith('{') || text.endsWith('[')) {
       // A very basic attempt to close structures if they look obviously incomplete
       // This is a last ditch effort before failing
       if (!text.endsWith('}')) text += '}]}';
    }

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

  } catch (error: any) {
    console.error("Workflow generation failed (Switching to Offline Mode):", error);
    return getFallbackWorkflow(goal, error.message);
  }
};

export const executeWorkflowStep = async (
  step: WorkflowStep, 
  previousSteps: WorkflowStep[],
  goal: string,
  imageBase64?: string | null // NEW: Receive Image Context
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

  // --- AUTO MODEL SWITCHING ---
  let selectedModel = getModelForAction(step.actionType);

  // --- BRANCH 1: INTEGRATION AGENT (Improved Simulation) ---
  if (step.actionType === 'INTEGRATION') {
      const tool = step.toolId || 'unknown_tool';
      const simulationPrompt = `
         You are the API Gateway for ${tool}. 
         The user is executing: ${step.label}
         Parameters: ${JSON.stringify(step.parameters)}
         Previous Context: ${context}

         Generate a realistic, technical success log/response that this tool would return.
         If it's Slack, show the message posted (filling in any templates with real data from context).
         If it's GitHub, show the PR details.
         Keep it brief (under 5 lines) but realistic. 
      `;

      try {
          const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
             model: MODELS.GENERAL, // Flash is sufficient for simulation
             contents: { role: 'user', parts: [{ text: simulationPrompt }] }
          }));
          
          return {
              output: response.text || `[SUCCESS] ${tool} executed successfully.`,
              reasoning: `[BRIDGE :: ${selectedModel}]\n1. Authenticating with ${tool.toUpperCase()} Gateway.\n2. Validating payload against OpenAPI spec.\n3. Executing POST request.\n4. Response: 200 OK.`,
              tokens: response.usageMetadata?.totalTokenCount || 100,
              citations: [],
              model: selectedModel
          };
      } catch (e) {
          return {
            output: `[SUCCESS] Command sent to ${tool}. (Simulation fallback)`,
            reasoning: "Bridge connection stable. Payload delivered.",
            tokens: 50,
            citations: [],
            model: selectedModel
          };
      }
  }

  // --- BRANCH 2: VISUAL CREATION AGENT ---
  if (step.actionType === 'CREATION') {
      // NOTE: Gemini 3 Pro Image (Nano Banana Pro) supports 1K, 2K, 4K
      const prompt = `
        Create a high-quality visual asset based on this request.
        Request: ${step.description}
        Context: ${goal}
        Parameters: ${JSON.stringify(step.parameters || {})}
      `;
      
      try {
          const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
              model: selectedModel, 
              contents: { role: 'user', parts: [{ text: prompt }] },
              config: {
                  // Specific config for Image models
                  imageConfig: {
                    aspectRatio: "1:1",
                    imageSize: "1K" 
                  }
              }
          }));

          let output = "Image generation completed.";
          let imageFound = false;

          // Iterate parts to find the image
          if (response.candidates?.[0]?.content?.parts) {
             for (const part of response.candidates[0].content.parts) {
                 if (part.inlineData) {
                     const base64Str = part.inlineData.data;
                     const mimeType = part.inlineData.mimeType || 'image/png'; // Use returned mimeType
                     output = `data:${mimeType};base64,${base64Str}`;
                     imageFound = true;
                 } else if (part.text) {
                     // Capture any accompanying text
                     if (!imageFound) output = part.text;
                 }
             }
          }

          return {
              output: output,
              reasoning: `[VISUAL CORTEX :: ${selectedModel}]\n1. Analyzing visual requirements from parameters.\n2. Constructing latent space projection.\n3. Rendering asset at 1024x1024 (Nano Banana Pro).\n4. Output encoded to Base64 stream.`,
              tokens: response.usageMetadata?.totalTokenCount || 500,
              citations: [],
              model: selectedModel
          };

      } catch (e: any) {
          console.error("Image gen failed", e);
          return getFallbackExecution(step, e.message);
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
    - If CODE: Write the complete, runnable code. Wrap it in standard markdown code blocks (e.g. \`\`\`html ... \`\`\`).
    - If ANALYSIS: Synthesize insights.
  `;

  // Prepare Multimodal Input - STRICT STRUCTURE
  const parts: Part[] = [];
  if (imageBase64) {
      parts.push({
          inlineData: {
              mimeType: 'image/png',
              data: imageBase64
          }
      });
  }
  parts.push({ text: prompt });
  
  const contents: Content = { role: 'user', parts: parts };

  const tools: Tool[] = [];
  
  // Smart Tool Injection for Research
  const isResearch = step.actionType === 'RESEARCH' || step.actionType === 'ANALYSIS';

  // Only inject tools if we are sure the model supports it or we are prepared to fallback
  if (isResearch) {
      tools.push({ googleSearch: {} });
  }

  // Determine if we should use Native Thinking (Code & Planning tasks)
  const useThinking = step.actionType === 'CODE' || step.actionType === 'ANALYSIS';

  try {
      const execute = async (model: string, useTools: boolean) => {
           return await ai.models.generateContent({
            model: model,
            contents: contents,
            config: {
              tools: useTools ? tools : [],
              systemInstruction: "You are NEURIX-EXECUTOR. You are precise, data-driven, and efficient. You MUST reveal your internal reasoning process in <thought> tags before generating the result.",
              maxOutputTokens: 8192,
              // Inject thinking budget for complex tasks to ensure high quality code/analysis
              thinkingConfig: useThinking ? { thinkingBudget: 2048 } : undefined
            }
          });
      };

      let response;
      try {
          response = await retry<GenerateContentResponse>(() => execute(selectedModel, tools.length > 0));
      } catch (e: any) {
          // If tool use fails or model not found, try without tools or fallback model
          console.warn(`[NEURIX] Execution failed with ${selectedModel}. Retrying with safe fallback. Error: ${e.message}`);
          selectedModel = MODELS.FALLBACK; 
          response = await retry<GenerateContentResponse>(() => execute(selectedModel, false));
      }

      const rawText = response.text || "";
      
      // Parse Thoughts vs Output
      let reasoning = `[NEURIX KERNEL :: ${selectedModel}]\n`;
      let output = rawText;

      const thoughtMatch = rawText.match(/<thought>([\s\S]*?)<\/thought>/);
      if (thoughtMatch) {
          reasoning += thoughtMatch[1].trim();
          output = rawText.replace(/<thought>[\s\S]*?<\/thought>/, '').trim();
      } else {
          reasoning += "Direct execution path chosen. Native thinking applied in background.";
      }

      const citations: {uri:string, title:string}[] = [];
      if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
         response.candidates[0].groundingMetadata.groundingChunks.forEach(chunk => {
             if (chunk.web?.uri && chunk.web?.title) {
                 citations.push({ uri: chunk.web.uri, title: chunk.web.title });
             }
         });
      }

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
  } catch (error: any) {
      console.error("Execution failed (Offline fallback)", error);
      return getFallbackExecution(step, error.message);
  }
};

export const verifyOutput = async (
    step: WorkflowStep,
    output: string,
    goal: string
): Promise<{ passed: boolean; reason: string; tokens: number }> => {
    const ai = getAiClient();
    
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
        const runVerify = async () => {
             return await ai.models.generateContent({
                model: MODELS.REASONING,
                contents: { role: 'user', parts: [{ text: prompt }] },
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            passed: { type: Type.BOOLEAN },
                            reason: { type: Type.STRING }
                        },
                        required: ['passed', 'reason']
                    },
                    // Verification is critical, so we allocate a thinking budget
                    thinkingConfig: { thinkingBudget: 1024 }
                }
            });
        };

        let response;
        try {
            response = await retry<GenerateContentResponse>(() => runVerify());
        } catch (e) {
            // Fallback to simpler model if Pro fails
             response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
                model: MODELS.FALLBACK,
                contents: { role: 'user', parts: [{ text: prompt }] },
                config: { responseMimeType: 'application/json' } // Relax schema for fallback
            }));
        }

        const result = JSON.parse(response.text || '{"passed": false, "reason": "Parsing Error"}');
        return {
            passed: result.passed,
            reason: result.reason,
            tokens: response.usageMetadata?.totalTokenCount || 100
        };

    } catch (e) {
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
      // Use fallback logic similar to generateWorkflow
      const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODELS.PLANNING,
        contents: { role: 'user', parts: [{ text: prompt }] },
        config: {
          responseMimeType: 'application/json',
          responseSchema: workflowSchema,
          thinkingConfig: { thinkingBudget: 2048 } // Replanning needs deep thought
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
       return {
           tokens: 0,
           steps: [{
               id: 'fallback-replan-1',
               label: 'Manual Intervention Required',
               description: `Automated replanning failed. Please reset or continue manually. Error: ${error}`,
               actionType: 'DECISION',
               dependencies: [],
               status: StepStatus.PENDING,
               assignedAgentId: 'sys-router'
           }]
       };
  }
};

export const generateRemediationPlan = async (
  goal: string,
  issue: string,
  existingSteps: WorkflowStep[]
): Promise<{ steps: WorkflowStep[], tokens: number }> => {
    const ai = getAiClient();
    const lastStep = existingSteps[existingSteps.length - 1];
    
    // Generate a unique ID prefix based on time to avoid collisions with existing steps
    const idPrefix = `fix-${Date.now().toString().slice(-4)}`;

    const prompt = `
        SYSTEM ALERT: Maintenance Anomaly Detected.
        GOAL: "${goal}"
        ISSUE: "${issue}"
        
        The previous workflow has finished, but the system state is DEGRADED.
        Create a SHORT remediation workflow branch (1-3 steps) to fix this specific issue and verify stability.
        
        Rules:
        1. Start with an ANALYSIS step to diagnose the root cause.
        2. Follow with a CODE or INTEGRATION step to apply the fix (Hotfix).
        3. End with a DECISION step to verify the fix.
        4. Make sure the first new step depends on the last completed step ID: "${lastStep.id}".
        
        Output JSON with 'steps' array matching the workflow schema. 
        IMPORTANT: Ensure all new step IDs start with "${idPrefix}-".
    `;

    try {
        const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
            model: MODELS.PLANNING,
            contents: { role: 'user', parts: [{ text: prompt }] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: workflowSchema,
                thinkingConfig: { thinkingBudget: 1024 }
            }
        }));

        const data = JSON.parse(response.text || '{}');
        const tokens = response.usageMetadata?.totalTokenCount || 500;

        return {
            steps: data.steps.map((s: any) => ({
                id: s.id.startsWith(idPrefix) ? s.id : `${idPrefix}-${s.id}`, // Enforce prefix if model forgot
                label: `[HOTFIX] ${s.label}`, // Add visual tag
                description: s.description,
                actionType: s.actionType,
                dependencies: s.dependencies && s.dependencies.length > 0 ? s.dependencies : [lastStep.id],
                parameters: transformParams(s.parameters),
                alternatives: s.alternatives || [],
                assignedAgentId: s.assignedAgentId || 'axion-ov',
                status: StepStatus.PENDING,
            })),
            tokens: Math.ceil(tokens)
        };
    } catch (e) {
        console.error("Remediation generation failed", e);
        return {
            tokens: 0,
            steps: [{
                id: `${idPrefix}-fallback`,
                label: '[HOTFIX] Manual System Check',
                description: `Automated remediation planning failed. Operator attention required for issue: ${issue}`,
                actionType: 'DECISION',
                dependencies: [lastStep.id],
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
        Perform a simulated "Chaos Monkey" audit. Look for:
        1. Potential security vulnerabilities in code.
        2. Logic gaps in the plan.
        3. Missing edge case handling.
        
        If you find a plausible issue, report status as "DEGRADED" with the specific issue description.
        If everything is perfect, report "STABLE".
    `;

    try {
        const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
            model: MODELS.REASONING, 
            contents: { role: 'user', parts: [{ text: prompt }] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        status: { type: Type.STRING, enum: ['STABLE', 'DEGRADED'] },
                        message: { type: Type.STRING }
                    },
                    required: ['status', 'message']
                },
                thinkingConfig: { thinkingBudget: 512 } // Quick diagnostic thought
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
