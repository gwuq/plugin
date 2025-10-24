/*  Text Replacer – Revenge, RN-safe, logs everywhere  */
import { Forms, General } from "@vendetta/ui/components";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { findByName } from "@vendetta/metro";
import { after, before } from "@vendetta/patcher";

const { ScrollView, Text, View, TextInput, Button } = General;
const { FormRow, FormIcon, FormDivider, FormSwitchRow } = Forms;

const R = findByName("RowManager");


/* ---------- helpers ---------- */
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const compile = () => {
    const rules = JSON.parse(storage.rules || "[]");
    // console.log("[TR] compile rules", rules);
    return rules.map(r => {
        try {
        const re = new RegExp(r.regex ? r.find : escape(r.find), r.ci ? "gi" : "g");
        return { re, to: r.replace };
        } catch { return null; }
    }).filter(Boolean);
};

/* ---------- defaults ---------- */
storage.rules   ??= JSON.stringify([{ find: "old", replace: "new", regex: false, ci: false }]);
storage.enabled ??= true;
storage.showEditor ??= false;

/* ---------- React patch ---------- */
let unpatch = [];
const patchReact = () => {
    const UserProfilePrimaryInfo = findByName("UserProfilePrimaryInfo", false);
    const UserProfileAboutMeCard = findByName("UserProfileAboutMeCard", false);
    const ChatViewWrapperBase = findByName("ChatViewWrapperBase", false);

    unpatch.push(before("generate", R.prototype, ([data]) => {
        try {
        const rules = compile();
        for (const r of rules) {
            if (data?.message?.content) data.message.content = data.message.content.replace(r.re, r.to);
            // if (data?.message?.author?.id) data.message.author.id = data.message.author.id.replace(r.re, r.to);
            // if (data?.message?.author?.avatar) data.message.author.avatar = data.message.author.avatar.replace(r.re, r.to);
            if (data?.message?.author?.avatarDecorationData?.asset) data.message.author.avatarDecorationData.asset = data.message.author.avatarDecorationData.asset.replace(r.re, r.to);
            if (data?.message?.author?.primaryGuild?.tag) data.message.author.primaryGuild.tag = data.message.author.primaryGuild.tag.replace(r.re, r.to);
            if (data?.message?.author?.primaryGuild?.badge) data.message.author.primaryGuild.badge = data.message.author.primaryGuild.badge.replace(r.re, r.to);
            if (data?.message?.author?.primaryGuild?.identityGuildId) data.message.author.primaryGuild.identityGuildId = data.message.author.primaryGuild.identityGuildId.replace(r.re, r.to);
            if (data?.message?.author?.username) data.message.author.username = data.message.author.username.replace(r.re, r.to);
        }
        } catch (e) { 

        }
    }));
    unpatch.push(after("default", UserProfilePrimaryInfo, (_, component) => {
        try {
            const rules = compile();
            for (const r of rules) {
                if (component?.props?.children[1]?.props?.children[0]?.props?.userTag) component.props.children[1].props.children[0].props.userTag = component.props.children[1].props.children[0].props.userTag.replace(r.re, r.to);
            }
        } catch (e) { 

        }
    }));
    unpatch.push(after("default", UserProfileAboutMeCard, (_, component) => {
        try {
            const rules = compile();
            for (const r of rules) {
                if (component?.props?.children[1]?.props?.userId) component.props.children[1].props.userId = component.props.children[1].props.userId.replace(r.re, r.to);
            }
        } catch (e) { 

        }
    }));
    unpatch.push(after("default", ChatViewWrapperBase, (_, component) => {
        try {
            const rules = compile();
            for (const r of rules) {
                const recipients = component.props.children.props.children.filter(c => Boolean(c))[0].props.children.props.channel.recipients;
                recipients.forEach((id, i) => {
                    recipients[i] = id.replace(r.re, r.to);
                });
            }
        } catch (e) { 

        }
    }));
};

/* ---------- Rule Editor ---------- */
const RuleEditor = () => {
    const rules = JSON.parse(storage.rules || "[]");
    const save = (next) => { storage.rules = JSON.stringify(next); };
    const add = () => save([...rules, { find: "", replace: "", regex: false, ci: false }]);
    const del = (i) => save(rules.filter((_, idx) => idx !== i));
    const upd = (i, patch) => save(rules.map((r, idx) => idx === i ? { ...r, ...patch } : r));

    return (
        <ScrollView style={{ paddingBottom: 100 }}>
        <Text style={{ margin: 12, fontSize: 16, fontWeight: "bold" }}>Replacement Rules</Text>
        {rules.map((r, i) => (
            <View key={i} style={{ margin: 8, padding: 8, borderWidth: 1, borderColor: "#666", borderRadius: 6 }}>
            <TextInput placeholder="Text to find" value={r.find} onChangeText={t => upd(i, { find: t })} style={{ borderWidth: 1, borderColor: "#888", padding: 6, marginBottom: 6, color: '#fff' }} />
            <TextInput placeholder="Replace with" value={r.replace} onChangeText={t => upd(i, { replace: t })} style={{ borderWidth: 1, borderColor: "#888", padding: 6, marginBottom: 6, color: '#fff' }} />
            <FormSwitchRow label="Case-insensitive" leading={<FormIcon source={getAssetIDByName("ic_visibility_24px")} />} value={r.ci} onValueChange={v => upd(i, { ci: v })} />
            <FormSwitchRow label="Regular expression" leading={<FormIcon source={getAssetIDByName("ic_search_24px")} />} value={r.regex} onValueChange={v => upd(i, { regex: v })} />
            <Button title="Delete rule" onPress={() => del(i)} color="red" />
            <FormDivider />
            </View>
        ))}
        <Button title="Add rule" onPress={add} />
        </ScrollView>
    );
};

/* ---------- Main Settings ---------- */
const Settings = () => {
    useProxy(storage);
    return (
        <ScrollView>
        <FormSwitchRow label="Enable replacements" leading={<FormIcon source={getAssetIDByName("ic_message_edit")} />} value={storage.enabled} onValueChange={v => storage.enabled = v} />
        <FormDivider />
        <FormRow label="Manage rules" subLabel="Add, edit or delete replacement strings" leading={<FormIcon source={getAssetIDByName("ic_settings_24px")} />} trailing={FormRow.Arrow} onPress={() => storage.showEditor = !storage.showEditor} />
        {storage.showEditor && (
            <>
            <FormDivider />
            <RuleEditor />
            <Button title="Close editor" onPress={() => storage.showEditor = false} />
            </>
        )}
        </ScrollView>
    );
};

/* ---------- plugin lifecycle ---------- */
export default {
    settings: Settings,
    onLoad() {
        console.log("[TR] onLoad start");
        setTimeout(() => patchReact(), 0);
    },
    onUnload() {
        console.log("[TR] onUnload");
        unpatch.forEach(p => p?.());
    }
};
