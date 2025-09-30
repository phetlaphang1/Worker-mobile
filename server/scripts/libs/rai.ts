import axios, { AxiosError } from "axios";
import * as dotenv from "dotenv";
import * as act from "./act";

const apiUrl = "https://llmapi.roxane.one/v1/chat/completions";
const apiKey = "wilson-1750681308487-cloudworker";

interface Message {
    role: string;
    content: string;
}

interface ChatCompletionRequest {
    model: string;
    messages: Message[];
}

interface ChatCompletionResponse {
    choices: Array<{
        message: {
            content: string;
        };
    }>;
}

interface CommentResult {
    result: {
        status: string;
        comment: string;
        reasoning: string;
    };
}

async function promptBase(): Promise<string | void> {
    const data: ChatCompletionRequest = {
        model: "text-model",
        messages: [
            { role: "system", content: "You are a helpful assistant." },
            { role: "user", content: "Make a comment for this post." },
        ],
    };

    await axios
        .post<ChatCompletionResponse>(apiUrl, data, {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
        })
        .then((response) => {
            console.log("Response:", response.data.choices[0].message.content);
            return response.data.choices[0].message.content;
        })
        .catch((error: AxiosError) => {
            console.error("Error:", error.response ? error.response.data : error.message);
        });
}

async function promptByContent(content: string): Promise<string | undefined> {
    const data: ChatCompletionRequest = {
        model: "text-model",
        messages: [
            {
                role: "system",
                content: "You get a tweet and return a comment",
            },
            { role: "user", content: content },
        ],
    };

    const comment = await axios
        .post<ChatCompletionResponse>(apiUrl, data, {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
        })
        .then((response) => {
            return response.data.choices[0].message.content;
        })
        .catch((error: AxiosError) => {
            console.error("Error:", error.response ? error.response.data : error.message);
            return undefined;
        });
    return comment;
}

async function getCommentByAI(post: string): Promise<CommentResult | undefined> {
    const data: CommentResult = {
        "result": {
            "status": "",
            "comment": "",
            "reasoning": ""
        }
    }
    let prompt = "Check this post as below then return a comment without any explaination: \n";
    prompt += post;
    prompt += "\n\nReturn a JSON object as below with status as FAILED if you can not generate a comment: \n";
    prompt += JSON.stringify(data);

    console.log("User prompt: " + prompt);
    console.log("Waiting Roxane AI repsonse...");
    let res: CommentResult | undefined;
    for(let i = 0; i < 3; i++){
        const rawRes = await promptByContent(prompt);
        if (!rawRes) continue;
        const jsonString = extractJsonString(rawRes);
        if (!jsonString) continue;
        res = JSON.parse(jsonString) as CommentResult;
        console.log(res.result);
        if(res.result.status == "SUCCESS"){
            return res;
        }
        await act.pause(2000);

    }
    return res;
}

function extractJsonString(input: string): string | null {
    const startIndex = input.indexOf('{');
    const endIndex = input.lastIndexOf('}');

    if (startIndex === -1 || endIndex === -1) {
      return null;
    }

    return input.slice(startIndex, endIndex + 1);
}

export { promptBase, promptByContent, getCommentByAI };