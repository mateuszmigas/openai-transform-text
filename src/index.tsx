import {
  Action,
  ActionPanel,
  Detail,
  Clipboard,
  Icon,
  Toast,
  closeMainWindow,
  getFrontmostApplication,
  getPreferenceValues,
  getSelectedText,
  showToast,
} from "@raycast/api";
import { usePromise } from "@raycast/utils";
import OpenAI from "openai";

type Preferences = { openAiApiKey: string; openAiPrompt: string; openAiModel: string };
type ResponseData = {
  transformedText: string;
  elapsedTime: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};
const defaultPrompt = `Please generate a text that corrects any spelling and grammatical errors in the provided input. The revised text should maintain the original meaning and context but with improved readability and proper sentence structure. Ensure that all misspelled words are corrected, punctuation is appropriately used, and the text flows naturally, adhering to standard English language conventions. Output should be in the same language as the input.`;
const defaultModel = "gpt-3.5-turbo";

const preferences: Preferences = {
  openAiApiKey: getPreferenceValues<Preferences>().openAiApiKey,
  openAiPrompt: getPreferenceValues<Preferences>().openAiPrompt || defaultPrompt,
  openAiModel: getPreferenceValues<Preferences>().openAiModel || defaultModel,
};

const createPrompt = (text: string) =>
  `${preferences.openAiPrompt}

  ${text}`;

const openai = new OpenAI({ apiKey: preferences.openAiApiKey });

export default function Command() {
  const { isLoading, data, error } = usePromise(async () => {
    try {
      const startTime = performance.now();
      const app = await getFrontmostApplication();
      const selectedText = await getSelectedText();
      const prompt = createPrompt(selectedText);
      const completion = await openai.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: preferences.openAiModel,
      });

      const responseData: ResponseData = {
        transformedText: completion.choices[0].message.content ?? "",
        elapsedTime: performance.now() - startTime,
        promptTokens: completion.usage?.prompt_tokens,
        completionTokens: completion.usage?.completion_tokens,
        totalTokens: completion.usage?.total_tokens,
      };

      return {
        appName: app?.name,
        responseData,
      };
    } catch (e) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Cannot transform text",
        message: String(e),
      });
      return null;
    }
  });

  const transformedText = data?.responseData?.transformedText ?? "";
  const errorText = error?.message ?? "";

  return (
    <Detail
      actions={
        <ActionPanel>
          {transformedText && (
            <Action
              title={`Paste to ${data?.appName}`}
              onAction={async () => {
                await Clipboard.paste(transformedText);
                await closeMainWindow();
              }}
              icon={{ source: Icon.Clipboard }}
            />
          )}
        </ActionPanel>
      }
      isLoading={isLoading}
      markdown={transformedText ?? errorText ?? ""}
      metadata={
        <Detail.Metadata>
          {transformedText && (
            <>
              <Detail.Metadata.Label
                title="Response Time"
                text={
                  data?.responseData?.elapsedTime ? `${(data.responseData.elapsedTime / 1000).toFixed(2)}s` : undefined
                }
              />
              <Detail.Metadata.Label title="Prompt Tokens" text={data?.responseData?.promptTokens?.toLocaleString()} />
              <Detail.Metadata.Label
                title="Completion Tokens"
                text={data?.responseData?.completionTokens?.toLocaleString()}
              />
              <Detail.Metadata.Label title="Total Tokens" text={data?.responseData?.totalTokens?.toLocaleString()} />
            </>
          )}
        </Detail.Metadata>
      }
    />
  );
}
