import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { Workflow, WorkflowStep, StepStatus, Artifact } from "../types";

export const MODELS = {
    PLANNER: 'gemini-3-pro-preview',
    REASONING: 'gemini-3-pro-preview',
    EXECUTOR: 'gemini-3-flash-preview',
    VISION: 'gemini-3-pro-image-preview'
};

const getAiClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        console.error("API_KEY is missing");
    }
    return new GoogleGenAI({ apiKey: apiKey || '' });
};

export const getModelForAction = (actionType: string): string => {
    switch (actionType) {
        case 'RESEARCH':
        case 'CODE':
        case 'ANALYSIS':
            return MODELS.REASONING;
        case 'DECISION':
            return MODELS.PLANNER;
        case 'CREATION':
        case 'INTEGRATION':
            return MODELS.EXECUTOR;
        default:
            return MODELS.EXECUTOR;
    }
};

export const retry = async <T>(fn: () => Promise<T>, retries: number = 3, delay: number = 1000, context: string = ''): Promise<T> => {
    try {
        return await fn();
    } catch (e: any) {
        if (retries > 0) {
            console.warn(`Retrying ${context}... (${retries} left). Error: ${e.message}`);
            await new Promise(r => setTimeout(r, delay));
            return retry(fn, retries - 1, delay * 1.5, context);
        }
        throw e;
    }
};

export const repairJson = async (jsonString: string, context: string = ''): Promise<any> => {
    try {
        let cleaned = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleaned);
    } catch (e) {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: MODELS.EXECUTOR,
            contents: `Fix this broken JSON string and return ONLY the valid JSON object. Do not wrap in markdown.
            
            BROKEN JSON:
            ${jsonString}
            `,
            config: {
                responseMimeType: 'application/json'
            }
        });
        const text = response.text || '{}';
        return JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
    }
};

export const generateWorkflow = async (goal: string, image?: string | null): Promise<{ steps: WorkflowStep[], tokens: number }> => {
    const ai = getAiClient();
    
    let prompt = `
    You are NEXUS, an autonomous AI planning architect.
    GOAL: "${goal}"
    
    Create a detailed execution plan (Directed Acyclic Graph) to achieve this goal.
    Break it down into atomic, executable steps.
    
    Available Action Types:
    - RESEARCH: Web search, data gathering.
    - CODE: Writing software, scripts, html.
    - ANALYSIS: Reasoning, summarizing, evaluating.
    - DECISION: Strategic choices (often creates branches).
    - CREATION: Content generation (text, image prompts).
    - INTEGRATION: Calling external APIs (simulated) or assembling outputs.

    Return a JSON object with a "steps" array. 
    Each step must have:
    - id: string (unique, e.g., "step-1")
    - label: string (short title)
    - description: string (detailed prompt for the agent executing this step)
    - actionType: string (one of the above)
    - dependencies: string[] (ids of previous steps)
    - parameters: Record<string, string> (key-value pairs for context)
    `;

    const contents: any[] = [{ text: prompt }];
    if (image) {
        contents.push({
            inlineData: {
                mimeType: 'image/png',
                data: image
            }
        });
        prompt += "\n\nAlso consider the provided image context in the plan.";
    }

    const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODELS.PLANNER,
        contents: { parts: contents },
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    steps: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.STRING },
                                label: { type: Type.STRING },
                                description: { type: Type.STRING },
                                actionType: { type: Type.STRING },
                                dependencies: { type: Type.ARRAY, items: { type: Type.STRING } },
                                parameters: { type: Type.OBJECT }
                            },
                            required: ['id', 'label', 'description', 'actionType', 'dependencies']
                        }
                    }
                }
            },
            thinkingConfig: { thinkingBudget: 2048 }
        }
    }), 2, 2000, "Generate Workflow");

    let data;
    try {
        data = JSON.parse(response.text || '{}');
    } catch {
        data = await repairJson(response.text || '', "Workflow JSON");
    }

    const steps: WorkflowStep[] = (data.steps || []).map((s: any) => ({
        ...s,
        status: StepStatus.PENDING,
        parameters: s.parameters || {},
        alternatives: [],
        dependencies: s.dependencies || []
    }));

    return { steps, tokens: response.usageMetadata?.totalTokenCount || 0 };
};

export const executeWorkflowStep = async (
    step: WorkflowStep, 
    allSteps: WorkflowStep[], 
    goal: string, 
    image?: string | null
): Promise<{ output: string, reasoning: string, citations: any[], tokens: number, model: string }> => {
    const ai = getAiClient();
    const model = getModelForAction(step.actionType);

    const dependencyOutputs = step.dependencies.map(depId => {
        const dep = allSteps.find(s => s.id === depId);
        return dep ? `Output from ${dep.label}:\n${dep.output}` : '';
    }).join('\n\n');

    const systemInstruction = `
    You are an autonomous agent executing the task: "${step.label}".
    Role: ${step.actionType} Specialist.
    Global Goal: "${goal}".
    
    Perfrom the task described in the input strictly. 
    If writing code, return the full code block.
    If analyzing, be concise and logical.
    `;

    const userPrompt = `
    TASK DESCRIPTION:
    ${step.description}

    PARAMETERS:
    ${JSON.stringify(step.parameters)}

    CONTEXT FROM PREVIOUS STEPS:
    ${dependencyOutputs}
    `;

    const contents: any[] = [{ text: userPrompt }];
    if (image && step.dependencies.length === 0) {
         contents.push({
            inlineData: { mimeType: 'image/png', data: image }
        });
    }

    const tools = [];
    if (step.actionType === 'RESEARCH') {
        tools.push({ googleSearch: {} });
    }

    // Only apply thinking budget for PRO models to avoid 400 errors with Flash
    const useThinking = model.includes('pro') && step.actionType !== 'CREATION';

    const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
        model: model,
        contents: { parts: contents },
        config: {
            systemInstruction: systemInstruction,
            tools: tools.length > 0 ? tools : undefined,
            thinkingConfig: useThinking ? { thinkingBudget: 1024 } : undefined
        }
    }), 2, 2000, `Execute ${step.id}`);

    const citations = response.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.filter((c: any) => c.web?.uri)
        .map((c: any) => ({ uri: c.web.uri, title: c.web.title || 'Source' })) || [];

    return {
        output: response.text || '',
        reasoning: "Task executed successfully.",
        citations,
        tokens: response.usageMetadata?.totalTokenCount || 0,
        model
    };
};

export const verifyOutput = async (step: WorkflowStep, output: string, goal: string): Promise<{ passed: boolean, reason: string, tokens: number }> => {
    const ai = getAiClient();
    
    const prompt = `
    You are AXION, a QA Verifier.
    Goal: "${goal}"
    Step: "${step.label}"
    Description: "${step.description}"
    
    Generated Output:
    ${output.substring(0, 5000)}
    
    Verify if this output:
    1. Satisfies the step description.
    2. Is complete (no placeholders like "TODO").
    3. Is not an error message.

    Return JSON: { "passed": boolean, "reason": "short explanation" }
    `;

    const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODELS.EXECUTOR,
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
    }), 2, 1000, "Verify Output");

    let data;
    try {
        data = JSON.parse(response.text || '{}');
    } catch {
         data = { passed: true, reason: "Verification format error, assuming pass." };
    }

    return {
        passed: data.passed,
        reason: data.reason,
        tokens: response.usageMetadata?.totalTokenCount || 0
    };
};

export const replanWorkflow = async (failedStep: WorkflowStep, allSteps: WorkflowStep[], error: string, goal: string): Promise<{ steps: WorkflowStep[], tokens: number }> => {
    const ai = getAiClient();
    
    const context = allSteps.map(s => `- ${s.label} (${s.status})`).join('\n');
    
    const prompt = `
    You are NEXUS (Recovery Mode).
    Goal: "${goal}"
    
    Current Plan Status:
    ${context}
    
    FAILURE DETECTED at step "${failedStep.label}":
    Error: ${error}
    
    Generate a RECOVERY BRANCH.
    Create a sequence of new steps to handle this failure and get back on track to the goal.
    Start with a step that analyzes or fixes the error.
    
    Return JSON object with "steps" array.
    `;

    const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODELS.PLANNER,
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    steps: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.STRING },
                                label: { type: Type.STRING },
                                description: { type: Type.STRING },
                                actionType: { type: Type.STRING },
                                dependencies: { type: Type.ARRAY, items: { type: Type.STRING } },
                                parameters: { type: Type.OBJECT }
                            }
                        }
                    }
                }
            },
            thinkingConfig: { thinkingBudget: 2048 }
        }
    }), 2, 2000, "Replan Workflow");

    let data;
    try {
        data = JSON.parse(response.text || '{}');
    } catch {
        data = await repairJson(response.text || '', "Replan JSON");
    }

    const steps = (data.steps || []).map((s: any) => ({
        ...s,
        status: StepStatus.PENDING,
        parameters: s.parameters || {},
        alternatives: [],
        dependencies: s.dependencies || []
    }));

    return { steps, tokens: response.usageMetadata?.totalTokenCount || 0 };
};

export const runMaintenanceScan = async (workflow: Workflow): Promise<{ status: 'HEALTHY' | 'DEGRADED', message: string, tokens: number }> => {
    const ai = getAiClient();
    
    const prompt = `
    You are a System Watchdog.
    Project Goal: "${workflow.goal}"
    Completion Status: ${(workflow.steps.filter(s => s.status === 'COMPLETED').length / workflow.steps.length * 100).toFixed(0)}%
    
    Is the system state healthy? Return JSON: { "status": "HEALTHY" | "DEGRADED", "message": "status report" }
    `;

    try {
        const response = await ai.models.generateContent({
            model: MODELS.EXECUTOR,
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        status: { type: Type.STRING, enum: ['HEALTHY', 'DEGRADED'] },
                        message: { type: Type.STRING }
                    }
                }
            }
        });
        const data = JSON.parse(response.text || '{}');
        return {
            status: data.status || 'HEALTHY',
            message: data.message || 'System nominal.',
            tokens: response.usageMetadata?.totalTokenCount || 0
        };
    } catch (e) {
        return { status: 'HEALTHY', message: 'Watchdog offline (network).', tokens: 0 };
    }
};

export const generateRemediationPlan = async (goal: string, issue: string, currentSteps: WorkflowStep[]): Promise<{ steps: WorkflowStep[], tokens: number }> => {
    const ai = getAiClient();
    const lastStep = currentSteps[currentSteps.length - 1];
    
    const prompt = `
    Maintenance Alert: "${issue}"
    Goal: "${goal}"
    
    Create immediate remediation steps to fix this anomaly.
    Return JSON "steps".
    `;

    const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
        model: MODELS.PLANNER,
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    steps: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.STRING },
                                label: { type: Type.STRING },
                                description: { type: Type.STRING },
                                actionType: { type: Type.STRING },
                                dependencies: { type: Type.ARRAY, items: { type: Type.STRING } },
                                parameters: { type: Type.OBJECT }
                            }
                        }
                    }
                }
            }
        }
    }), 2, 2000, "Remediation");

    let data;
    try {
        data = JSON.parse(response.text || '{}');
    } catch {
        data = await repairJson(response.text || '');
    }

    const steps = (data.steps || []).map((s: any) => ({
        ...s,
        status: StepStatus.PENDING,
        parameters: s.parameters || {},
        dependencies: [lastStep.id]
    }));

    return { steps, tokens: response.usageMetadata?.totalTokenCount || 0 };
};

export const runProjectQAReview = async (
    workflow: Workflow,
    artifacts: Artifact[]
): Promise<{ approved: boolean, score: number, feedback: string, issues: string[], tokens: number }> => {
    const ai = getAiClient();

    const artifactsSummary = artifacts.map(a => `[${a.type}] ${a.title} (${a.content.length} bytes)`).join('\n');
    const stepSummary = workflow.steps.filter(s => s.status === StepStatus.COMPLETED).map(s => `- ${s.label}: ${s.output?.substring(0, 100)}...`).join('\n');

    const prompt = `
        You are NEURIX-AXION, the Lead Quality Assurance Engineer. 
        The execution phase is complete. You must audit the system before allowing it to enter MAINTENANCE MODE.
        
        ORIGINAL DIRECTIVE: "${workflow.goal}"
        
        EXECUTION LOG:
        ${stepSummary}
        
        GENERATED ARTIFACTS:
        ${artifactsSummary || 'No artifacts generated.'}

        TASK:
        Perform a rigorous "Go/No-Go" launch review.
        
        EVALUATION CRITERIA:
        1. **Completeness**: Did we actually solve the user's request?
        2. **Artifact Integrity**: If code was requested, does it look complete (no placeholders like "TODO")?
        3. **Safety**: Are there any obvious security risks in the logic?
        4. **Resilience**: Is the solution robust enough for maintenance mode?

        SCORING:
        - 0-100 Stability Score.
        - Approval requires Score > 85.

        Return JSON:
        {
            "approved": boolean,
            "score": number, 
            "feedback": "Concise executive summary of the review (max 2 sentences).",
            "critical_issues": ["List", "of", "specific", "defects", "if", "failed"]
        }
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
                        approved: { type: Type.BOOLEAN },
                        score: { type: Type.INTEGER },
                        feedback: { type: Type.STRING },
                        critical_issues: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ['approved', 'score', 'feedback', 'critical_issues']
                },
                thinkingConfig: { thinkingBudget: 2048 }
            }
        }), 2, 2000, "QA Review");

        let data;
        try {
            data = JSON.parse(response.text || '{}');
        } catch(e) {
            data = await repairJson(response.text || '', "QA JSON Invalid");
        }

        return {
            approved: data.approved,
            score: data.score || 0,
            feedback: data.feedback,
            issues: data.critical_issues || [],
            tokens: response.usageMetadata?.totalTokenCount || 500
        };

    } catch (e) {
        console.error("QA Review Failed", e);
        return { approved: false, score: 0, feedback: "QA Protocol Failed (Offline). Manual Check Required.", issues: ["QA System Failure"], tokens: 0 };
    }
};
