import React from "react";
import { patcher } from "@vendetta";
import { findByName } from "@vendetta/metro";
import { findInReactTree } from "@vendetta/utils";
import { Forms, General, Keyboard } from "@vendetta/ui/components";
import { showToast } from "@vendetta/ui/toasts";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "textreplacer.rules.v1";

type Rule = { id: string; oldText: string; newText: string };

let unpatches: Array<() => void> = [];
const makeId = () => Math.random().toString(36).slice(2, 9);

async function loadRules(): Promise<Rule[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Rule[];
  } catch (e) {
    return [];
  }
}

async function saveRules(rules: Rule[]) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  } catch {}
}

function applyPatches(getRules: () => Rule[]) {
  const MessageContent = findByName("MessageContent", false) || findByName("MessageBody", false);
  if (!MessageContent) return;

  const unpatch = patcher.after("default", MessageContent, (args: any[], res: any) => {
    try {
      const rules = getRules();
      if (!rules.length) return res;
      const textNode = findInReactTree(res, (m: any) => typeof m?.props?.children === "string");
      if (textNode && typeof textNode.props.children === "string") {
        let newText = textNode.props.children as string;
        for (const r of rules) {
          if (!r.oldText) continue;
          newText = newText.split(r.oldText).join(r.newText ?? "");
        }
        if (newText !== textNode.props.children) textNode.props.children = newText;
      }
    } catch {}
    return res;
  });
  unpatches.push(unpatch);
}

export default {
  onLoad: async () => {},
  onUnload: () => {
    unpatches.forEach((u) => u());
    unpatches = [];
  },
  settings: () => {
    const [rules, setRules] = React.useState<Rule[]>([]);
    const [, setTick] = React.useState(0);
    const getRules = React.useCallback(() => rules, [rules]);

    React.useEffect(() => {
      let mounted = true;
      loadRules().then((loaded) => {
        if (!mounted) return;
        const normalized = loaded.map((r) => ({ id: r.id ?? makeId(), oldText: r.oldText ?? "", newText: r.newText ?? "" }));
        setRules(normalized);
        applyPatches(getRules);
      });
      return () => (mounted = false);
    }, []);

    React.useEffect(() => {
      saveRules(rules);
      unpatches.forEach((u) => u());
      unpatches = [];
      applyPatches(() => rules);
    }, [rules]);

    const addRule = () => setRules((r) => [...r, { id: makeId(), oldText: "", newText: "" }]);
    const removeRule = (id: string) => setRules((r) => r.filter((x) => x.id !== id));
    const updateRule = (id: string, field: "oldText" | "newText", value: string) =>
      setRules((rows) => rows.map((x) => (x.id === id ? { ...x, [field]: value } : x)));

    return (
      <Forms.FormSection title="Text Replacements" description="Add pairs in the form 'old text' → 'new text'. Changes apply locally and persist.">
        {rules.length === 0 && <General.Text style={{ margin: 12 }}>No replacements yet — add one to get started.</General.Text>}
        {rules.map((r) => (
          <Forms.FormRow key={r.id} label={r.oldText || "(empty)"} subLabel={r.newText || "→ (empty)"}>
            <Forms.FormRowItem>
              <Forms.FormTextInput
                value={r.oldText}
                placeholder="Old text (what to replace)"
                onChangeText={(val: string) => updateRule(r.id, "oldText", val)}
                onSubmitEditing={() => Keyboard.dismiss()}
              />
            </Forms.FormRowItem>
            <Forms.FormRowItem>
              <Forms.FormTextInput
                value={r.newText}
                placeholder="New text (replacement)"
                onChangeText={(val: string) => updateRule(r.id, "newText", val)}
                onSubmitEditing={() => Keyboard.dismiss()}
              />
            </Forms.FormRowItem>
            <Forms.FormRowItem>
              <Forms.FormButton title="Remove" onPress={() => { removeRule(r.id); showToast("Removed replacement"); }} />
            </Forms.FormRowItem>
          </Forms.FormRow>
        ))}
        <Forms.FormRow>
          <Forms.FormRowItem>
            <Forms.FormButton title="Add replacement" onPress={() => { addRule(); setTick((t) => t + 1); }} />
          </Forms.FormRowItem>
        </Forms.FormRow>
        <Forms.FormRow>
          <Forms.FormRowItem>
            <Forms.FormButton title="Reset all" onPress={() => { setRules([]); showToast("All replacements cleared"); }} />
          </Forms.FormRowItem>
        </Forms.FormRow>
      </Forms.FormSection>
    );
  },
};
